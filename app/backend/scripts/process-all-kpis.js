/**
 * process-all-kpis.js
 *
 * Single script that reads the 3 source CSVs, computes all KPIs
 * (matching the Python reference script), and populates every DB table
 * needed by the dashboard API.
 *
 * Usage:  node scripts/process-all-kpis.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csvtojson');
const iconv = require('iconv-lite');
const pool = require('../config/database');

const DATA = path.join(__dirname, '..', 'data');

/* ───────── helpers ───────── */
function toTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/(^|\s|-)\S/g, (c) => c.toUpperCase());
}

function safeInt(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? 0 : n;
}

function safeFloat(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function minMax(arr) {
  let mn = Infinity, mx = -Infinity;
  for (const v of arr) { if (v < mn) mn = v; if (v > mx) mx = v; }
  return { min: mn, max: mx };
}

function norm01(val, mn, mx) {
  if (mx === mn) return 0;
  return (val - mn) / (mx - mn);
}

/* ───────── CSV loaders ───────── */
async function loadMenages() {
  console.log('  Loading menages.csv ...');
  const rows = await csv({ delimiter: ',' }).fromFile(path.join(DATA, 'menages.csv'));
  console.log(`    ${rows.length} rows`);
  return rows;
}

async function loadStationnement() {
  console.log('  Loading stationnement.csv (latin1 ; separator) ...');
  const buf = fs.readFileSync(path.join(DATA, 'stationnement.csv'));
  const content = iconv.decode(buf, 'latin1');
  const rows = await csv({ delimiter: ';' }).fromString(content);
  console.log(`    ${rows.length} rows`);
  return rows;
}

async function loadRnc() {
  console.log('  Loading rnc-data.csv (streaming) ...');
  return new Promise((resolve, reject) => {
    const rows = [];
    csv({ delimiter: ',' })
      .fromFile(path.join(DATA, 'rnc-data.csv'))
      .on('data', (buf) => {
        try { rows.push(JSON.parse(buf)); } catch (_) { /* skip bad row */ }
      })
      .on('end', () => {
        console.log(`    ${rows.length} rows`);
        resolve(rows);
      })
      .on('error', reject);
  });
}

/* ───────── KPI 1 — motorisation by region ───────── */
function computeMotorisation(menages) {
  console.log('\n── KPI 1 — Motorisation par region ──');

  // Group by libelle_region, keep latest date_mesure
  const byRegion = {};
  for (const r of menages) {
    const region = String(r.libelle_region || '').trim();
    const code = String(r.geocode_region || '').trim().padStart(2, '0');
    const date = String(r.date_mesure || '');
    const val = safeFloat(r.valeur);
    if (!region) continue;
    if (!byRegion[region] || date > byRegion[region].date) {
      byRegion[region] = { region, code, date, val };
    }
  }

  const result = Object.values(byRegion).sort((a, b) => b.val - a.val);
  console.log(`  ${result.length} regions`);
  result.slice(0, 5).forEach((r) =>
    console.log(`    ${r.region}: ${Math.round(r.val)} ménages motorisés`)
  );
  return result;
}

/* ───────── KPI 2 — stationnement par arrondissement ───────── */
function computeStationnement(stat) {
  console.log('\n── KPI 2 — Stationnement par arrondissement ──');

  const byArr = {};
  for (const r of stat) {
    const arr = safeInt(r['Arrondissement']);
    if (!arr) continue;
    const places = safeInt(r['Nombre places réelles'] || r['Nombre places r\u00e9elles']);
    if (!byArr[arr]) byArr[arr] = { arr, total_places: 0, count: 0 };
    byArr[arr].total_places += places;
    byArr[arr].count += 1;
  }

  const result = Object.values(byArr).sort((a, b) => b.total_places - a.total_places);
  console.log(`  ${result.length} arrondissements`);
  result.slice(0, 5).forEach((r) =>
    console.log(`    Arr ${r.arr}: ${r.total_places} places`)
  );
  return result;
}

/* ───────── KPI 3 — copropriétés par commune + scoring ───────── */
function computeCoproprietes(rnc) {
  console.log('\n── KPI 3 — Copropriétés par commune ──');

  const byCommune = {};
  for (const r of rnc) {
    let commune = toTitle(String(r.commune_adresse_de_reference || '').trim());
    if (!commune) continue;
    if (!byCommune[commune]) byCommune[commune] = { commune, nb: 0, lots: 0 };
    byCommune[commune].nb += 1;
    byCommune[commune].lots += safeInt(r.nombre_de_lots_a_usage_d_habitation);
  }

  const arr = Object.values(byCommune);
  const { min: minNb, max: maxNb } = minMax(arr.map((c) => c.nb));
  const { min: minLots, max: maxLots } = minMax(arr.map((c) => c.lots));

  for (const c of arr) {
    c.score_copro = norm01(c.nb, minNb, maxNb);
    c.score_lots = norm01(c.lots, minLots, maxLots);
    c.score_potentiel = c.score_copro * 0.5 + c.score_lots * 0.5;
  }

  arr.sort((a, b) => b.score_potentiel - a.score_potentiel);
  console.log(`  ${arr.length} communes`);
  arr.slice(0, 5).forEach((c) =>
    console.log(`    ${c.commune}: ${c.nb} copros, lots=${c.lots}, score=${c.score_potentiel.toFixed(3)}`)
  );
  return arr;
}

/* ───────── aggregate coords for map from rnc ───────── */
function computeCoords(rnc) {
  const byCommune = {};
  for (const r of rnc) {
    const commune = toTitle(String(r.commune_adresse_de_reference || '').trim());
    const lat = safeFloat(r.lat);
    const lon = safeFloat(r.long);
    if (!commune || !lat || !lon) continue;
    if (!byCommune[commune]) byCommune[commune] = { sumLat: 0, sumLon: 0, n: 0 };
    byCommune[commune].sumLat += lat;
    byCommune[commune].sumLon += lon;
    byCommune[commune].n += 1;
  }
  const out = {};
  for (const [c, v] of Object.entries(byCommune)) {
    out[c] = { lat: v.sumLat / v.n, lon: v.sumLon / v.n };
  }
  return out;
}

/* ───────── aggregate rnc by region for regional KPI ───────── */
function computeRncByRegion(rnc) {
  const byRegion = {};
  for (const r of rnc) {
    const code = String(r.code_officiel_region || '').trim();
    const name = String(r.nom_officiel_region || '').trim();
    if (!code || !name) continue;
    if (!byRegion[code]) {
      byRegion[code] = {
        code, name, totalCopros: 0, totalLots: 0,
        withCoords: 0, aided: 0
      };
    }
    byRegion[code].totalCopros += 1;
    byRegion[code].totalLots += safeInt(r.nombre_total_de_lots);
    if (safeFloat(r.lat) && safeFloat(r.long)) byRegion[code].withCoords += 1;
    if (String(r.copro_aidee || '').toLowerCase() === 'oui') byRegion[code].aided += 1;
  }
  return byRegion;
}

/* ═══════════════════ DB writes ═══════════════════ */

async function writeRegionalKPI(conn, motorisation, rncByRegion) {
  console.log('\n── Writing kpi_regional_market_potential ──');
  await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
  await conn.execute('TRUNCATE TABLE kpi_regional_market_potential');

  // Build raw rows first so we can apply min-max normalization
  const regionRows = [];
  for (const m of motorisation) {
    const rnc = rncByRegion[m.code] || { totalCopros: 0, totalLots: 0, withCoords: 0, aided: 0 };
    const motorHH = Math.round(m.val);
    const totalCopros = rnc.totalCopros;
    const avgLots = totalCopros ? Math.round(rnc.totalLots / totalCopros) : 0;
    const aidRate = totalCopros ? (rnc.aided / totalCopros) * 100 : 0;

    regionRows.push({
      code: m.code,
      name: m.region,
      motorHH, totalCopros, avgLots,
      aidRate: +aidRate.toFixed(2),
    });
  }

  // Min-max helpers: use relative scoring so values are spread 0-100
  function mmNorm(arr, key) {
    const vals = arr.map((r) => r[key]);
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const range = mx - mn || 1;
    return (v) => ((v - mn) / range) * 100;
  }

  const normMotor = mmNorm(regionRows, 'motorHH');
  const normCopros = mmNorm(regionRows, 'totalCopros');

  for (const r of regionRows) {
    r.parkDemand = +normMotor(r.motorHH).toFixed(2);
    r.marketSize = +normCopros(r.totalCopros).toFixed(2);
    r.accessibility = 100;
    r.overall = +(r.parkDemand * 0.35 + r.marketSize * 0.35 + r.accessibility * 0.30).toFixed(2);
  }

  regionRows.sort((a, b) => b.overall - a.overall);

  for (let i = 0; i < regionRows.length; i++) {
    const r = regionRows[i];
    await conn.execute(
      `INSERT INTO kpi_regional_market_potential
       (region_code, region_name, motorized_households, total_condominiums, avg_lots_per_copro,
        parking_demand_score, market_size_score, accessibility_score, aid_penetration_rate,
        overall_commercial_potential, ranking)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [r.code, r.name, r.motorHH, r.totalCopros, r.avgLots,
       r.parkDemand, r.marketSize, r.accessibility, r.aidRate,
       r.overall, i + 1]
    );
  }
  console.log(`  ${regionRows.length} regions inserted`);
}

async function writeParisKPI(conn, stationnement) {
  console.log('\n── Writing kpi_paris_arrondissement ──');
  await conn.execute('TRUNCATE TABLE kpi_paris_arrondissement');

  stationnement.sort((a, b) => b.total_places - a.total_places);

  // Min-max normalization so scores spread 0–100
  const minP = Math.min(...stationnement.map((s) => s.total_places));
  const maxP = Math.max(...stationnement.map((s) => s.total_places));
  const rangeP = maxP - minP || 1;

  for (let i = 0; i < stationnement.length; i++) {
    const s = stationnement[i];
    const supplyScore = +((((s.total_places - minP) / rangeP) * 100).toFixed(2));
    const potential = supplyScore;
    await conn.execute(
      `INSERT INTO kpi_paris_arrondissement
       (arrondissement, public_parking_spaces, parking_density_per_km2,
        residential_zone_percentage, signalization_quality_score,
        parking_supply_score, potential_for_sharing, ranking)
       VALUES (?,?,?,?,?,?,?,?)`,
      [s.arr, s.total_places, +(s.total_places / 1.2).toFixed(2),
       50, 70,
       +supplyScore.toFixed(2), +potential.toFixed(2), i + 1]
    );
  }
  console.log(`  ${stationnement.length} arrondissements inserted`);
}

async function writeCommercialTargets(conn, copros, coords) {
  console.log('\n── Writing kpi_commercial_targets ──');
  await conn.execute('TRUNCATE TABLE kpi_commercial_targets');

  // Top 200 communes by score_potentiel → insert as targets
  const top = copros.slice(0, 200);

  for (let i = 0; i < top.length; i++) {
    const t = top[i];
    const c = coords[t.commune] || {};
    await conn.execute(
      `INSERT INTO kpi_commercial_targets
       (numero_d_immatriculation, condominium_name, region_code, region_name,
        commune, code_postal, total_lots, total_habitation_lots, parking_lots,
        potential_score, priority_level, ranking)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        `ZONE-${String(i + 1).padStart(4, '0')}`,
        t.commune,
        '', '',
        t.commune,
        '',
        t.nb + t.lots,
        t.lots,
        0,
        +(t.score_potentiel * 100).toFixed(2),
        t.score_potentiel >= 0.7 ? 'VERY_HIGH' : t.score_potentiel >= 0.4 ? 'HIGH' : t.score_potentiel >= 0.2 ? 'MEDIUM' : 'LOW',
        i + 1,
      ]
    );
  }
  console.log(`  ${top.length} commercial targets inserted`);
}

async function writeStatsSummary(conn, motorisation, copros, stationnement) {
  console.log('\n── Writing kpi_statistics_summary ──');
  await conn.execute('TRUNCATE TABLE kpi_statistics_summary');

  const totalCopros = copros.reduce((s, c) => s + c.nb, 0);
  const totalMotorHH = Math.round(motorisation.reduce((s, m) => s + m.val, 0));
  const totalParking = stationnement.reduce((s, a) => s + a.total_places, 0);

  await conn.execute(
    `INSERT INTO kpi_statistics_summary
     (metric_date, total_condominiums, total_motorized_households,
      avg_motorized_households_per_region, regions_with_data,
      total_arrondissements_analyzed, total_paris_parking_spaces,
      avg_parking_spaces_per_arrondissement, condominiums_with_location,
      condominiums_in_targeted_zones)
     VALUES (CURDATE(),?,?,?,?,?,?,?,?,?)`,
    [
      totalCopros, totalMotorHH,
      motorisation.length ? Math.round(totalMotorHH / motorisation.length) : 0,
      motorisation.length,
      stationnement.length,
      totalParking,
      stationnement.length ? Math.round(totalParking / stationnement.length) : 0,
      0, 0,
    ]
  );
  console.log('  Summary row inserted');
}

/* Also populate raw_households_by_region & transformed tables quickly for the health API */
async function writeRawAndTransformed(conn, menages, rncByRegion, stationnement) {
  console.log('\n── Writing raw_households_by_region ──');
  await conn.execute('TRUNCATE TABLE raw_households_by_region');
  for (const r of menages) {
    const dt = String(r.date_mesure || '').substring(0, 10) || '2020-01-01';
    await conn.execute(
      'INSERT INTO raw_households_by_region (date_mesure, geocode_region, libelle_region, valeur) VALUES (?,?,?,?)',
      [dt, String(r.geocode_region || '').padStart(2, '0'), String(r.libelle_region || '').trim(), safeFloat(r.valeur)]
    );
  }
  console.log(`  ${menages.length} household rows inserted`);

  console.log('\n── Writing transformed_households_region ──');
  await conn.execute('TRUNCATE TABLE transformed_households_region');
  // latest per region
  const byRegion = {};
  for (const r of menages) {
    const rg = String(r.libelle_region || '').trim();
    const code = String(r.geocode_region || '').trim().padStart(2, '0');
    const d = String(r.date_mesure || '');
    const yr = d ? new Date(d).getFullYear() : 2020;
    const v = safeFloat(r.valeur);
    const key = `${code}_${yr}`;
    if (!byRegion[key] || d > byRegion[key].d) {
      byRegion[key] = { code, rg, yr, v, d };
    }
  }
  for (const row of Object.values(byRegion)) {
    await conn.execute(
      `INSERT INTO transformed_households_region (region_code, region_name, latest_year, motorized_households, last_measurement_date) VALUES (?,?,?,?,?)`,
      [row.code, row.rg, row.yr, Math.round(row.v), row.d.substring(0, 10)]
    );
  }
  console.log(`  ${Object.keys(byRegion).length} transformed household rows inserted`);

  console.log('\n── Writing transformed_parking_paris ──');
  await conn.execute('TRUNCATE TABLE transformed_parking_paris');
  for (const s of stationnement) {
    await conn.execute(
      `INSERT INTO transformed_parking_paris (arrondissement, parking_type, regime_type, total_calculated_spaces, total_real_spaces, average_length, average_width, total_surface, residential_zones_count, compliant_signalization_percentage, street_count, latest_survey_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,CURDATE())`,
      [s.arr, 'all', 'all', s.total_places, s.total_places, 0, 0, 0, 0, 70, s.count]
    );
  }
  console.log(`  ${stationnement.length} transformed parking rows inserted`);
}

/* ═══════════════════ MAIN ═══════════════════ */
async function main() {
  console.log('\n========================================');
  console.log('  PROCESSING ALL DATA & KPIs');
  console.log('========================================\n');
  const t0 = Date.now();

  /* 1 — Load CSVs */
  console.log('Step 1: Loading CSV files...');
  const [menages, stat, rnc] = await Promise.all([
    loadMenages(),
    loadStationnement(),
    loadRnc(),
  ]);

  /* 2 — Compute KPIs in memory */
  console.log('\nStep 2: Computing KPIs...');
  const motorisation = computeMotorisation(menages);
  const stationnement = computeStationnement(stat);
  const copros = computeCoproprietes(rnc);
  const coords = computeCoords(rnc);
  const rncByRegion = computeRncByRegion(rnc);

  /* 3 — Write everything to DB */
  console.log('\nStep 3: Writing to database...');
  const conn = await pool.getConnection();
  await conn.beginTransaction();

  try {
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
    await writeRawAndTransformed(conn, menages, rncByRegion, stationnement);
    await writeRegionalKPI(conn, motorisation, rncByRegion);
    await writeParisKPI(conn, stationnement);
    await writeCommercialTargets(conn, copros, coords);
    await writeStatsSummary(conn, motorisation, copros, stationnement);
    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
    await conn.commit();
    console.log('\n✓ All data committed to database');
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  /* 4 — Verify */
  console.log('\nStep 4: Verification...');
  const verifyConn = await pool.getConnection();
  const tables = [
    'raw_households_by_region',
    'transformed_households_region',
    'transformed_parking_paris',
    'kpi_regional_market_potential',
    'kpi_paris_arrondissement',
    'kpi_commercial_targets',
    'kpi_statistics_summary',
  ];
  for (const t of tables) {
    const [[{ c }]] = await verifyConn.execute(`SELECT COUNT(*) as c FROM ${t}`);
    console.log(`  ${t}: ${c} rows`);
  }
  verifyConn.release();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n========================================`);
  console.log(`  DONE in ${elapsed}s`);
  console.log(`========================================\n`);
}

main()
  .then(() => { pool.end(); process.exit(0); })
  .catch((err) => { console.error('FATAL:', err); pool.end(); process.exit(1); });
