require('dotenv').config();
const pool = require('../config/database');

async function normalizeScores() {
  const conn = await pool.getConnection();

  // Read all raw component values
  const [rows] = await conn.execute(
    'SELECT region_code, region_name, motorized_households, total_condominiums, accessibility_score FROM kpi_regional_market_potential'
  );

  // Min-max normalization helpers
  function mm(arr, key) {
    const vals = arr.map((r) => Number(r[key]));
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const range = mx - mn || 1;
    return (v) => ((Number(v) - mn) / range) * 100;
  }

  const normMotor = mm(rows, 'motorized_households');
  const normCopros = mm(rows, 'total_condominiums');
  // accessibility is already 0-100

  for (const r of rows) {
    const parkDemand = normMotor(r.motorized_households);
    const marketSize = normCopros(r.total_condominiums);
    const accessibility = Number(r.accessibility_score || 0);
    const overall = +(parkDemand * 0.35 + marketSize * 0.35 + accessibility * 0.30).toFixed(2);

    await conn.execute(
      `UPDATE kpi_regional_market_potential
       SET parking_demand_score=?, market_size_score=?, overall_commercial_potential=?
       WHERE region_code=?`,
      [+parkDemand.toFixed(2), +marketSize.toFixed(2), overall, r.region_code]
    );
  }

  // Re-rank
  const [ranked] = await conn.execute(
    'SELECT region_code FROM kpi_regional_market_potential ORDER BY overall_commercial_potential DESC'
  );
  for (let i = 0; i < ranked.length; i++) {
    await conn.execute('UPDATE kpi_regional_market_potential SET ranking=? WHERE region_code=?', [i + 1, ranked[i].region_code]);
  }

  // Verify
  const [final] = await conn.execute(
    'SELECT region_name, overall_commercial_potential, ranking FROM kpi_regional_market_potential ORDER BY ranking LIMIT 17'
  );
  console.log('Final scores (top → bottom):');
  final.forEach((r) => console.log(`  ${r.ranking}. ${r.region_name}: ${r.overall_commercial_potential}%`));

  conn.release();
  pool.end();
}

normalizeScores().catch((e) => { console.error(e); process.exit(1); });

