require('dotenv').config();
const pool = require('../config/database');

async function calculateKPIs() {
  let connection;
  
  try {
    console.log('\n========================================');
    console.log('  CALCULATING KPIs');
    console.log('========================================\n');

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Disable foreign key checks for truncate operations
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    // 1. Calculate regional market potential
    console.log('1. Calculating regional market potential KPIs...');
    await connection.execute('TRUNCATE TABLE kpi_regional_market_potential');

    await connection.execute(`
      INSERT INTO kpi_regional_market_potential 
      (region_code, region_name, motorized_households, total_condominiums, avg_lots_per_copro,
       parking_demand_score, market_size_score, accessibility_score, aid_penetration_rate,
       overall_commercial_potential)
      SELECT 
        th.region_code,
        th.region_name,
        ROUND(MAX(th.motorized_households)) as motorized_households,
        COUNT(DISTINCT tc.numero_d_immatriculation) as total_condominiums,
        ROUND(AVG(tc.nombre_total_lots)) as avg_lots_per_copro,
        ROUND(LEAST(100, MAX(th.motorized_households) / 1000), 2) as parking_demand_score,
        ROUND(LEAST(100, COUNT(DISTINCT tc.numero_d_immatriculation) / 100), 2) as market_size_score,
        COALESCE(ROUND(
          SUM(CASE WHEN tc.longitude IS NOT NULL THEN 1 ELSE 0 END) * 100.0 /
          NULLIF(COUNT(DISTINCT tc.numero_d_immatriculation), 0),
          2
        ), 0) as accessibility_score,
        COALESCE(ROUND(
          SUM(CASE WHEN tc.is_aided = TRUE THEN 1 ELSE 0 END) * 100.0 /
          NULLIF(COUNT(DISTINCT tc.numero_d_immatriculation), 0),
          2
        ), 0) as aid_penetration_rate,
        ROUND(
          (
            LEAST(100, MAX(th.motorized_households) / 1000) * 0.35 +
            LEAST(100, COUNT(DISTINCT tc.numero_d_immatriculation) / 100) * 0.35 +
            COALESCE(SUM(CASE WHEN tc.longitude IS NOT NULL THEN 1 ELSE 0 END) * 100.0 /
             NULLIF(COUNT(DISTINCT tc.numero_d_immatriculation), 0), 0) * 0.30
          ),
          2
        ) as overall_commercial_potential
      FROM transformed_households_region th
      LEFT JOIN transformed_condominiums tc ON th.region_code = tc.region_code
      GROUP BY th.region_code, th.region_name
      ORDER BY overall_commercial_potential DESC
    `);

    // Add ranking using ROW_NUMBER window function
    await connection.execute(`
      UPDATE kpi_regional_market_potential krmp
      JOIN (
        SELECT 
          region_code,
          ROW_NUMBER() OVER (ORDER BY overall_commercial_potential DESC) as rn
        FROM kpi_regional_market_potential
      ) ranked ON krmp.region_code = ranked.region_code
      SET krmp.ranking = ranked.rn
    `);

    console.log('   ✓ Regional market potential calculated\n');

    // 2. Calculate Paris arrondissement KPIs
    console.log('2. Calculating Paris arrondissement KPIs...');
    await connection.execute('TRUNCATE TABLE kpi_paris_arrondissement');

    await connection.execute(`
      INSERT INTO kpi_paris_arrondissement 
      (arrondissement, public_parking_spaces, parking_density_per_km2, 
       residential_zone_percentage, signalization_quality_score, parking_supply_score,
       potential_for_sharing)
      SELECT 
        arrondissement,
        SUM(total_real_spaces) as public_parking_spaces,
        ROUND(SUM(total_real_spaces) / 1.2, 2) as parking_density_per_km2,
        ROUND(
          SUM(residential_zones_count) * 100.0 / NULLIF(SUM(residential_zones_count + 1), 1),
          2
        ) as residential_zone_percentage,
        ROUND(AVG(compliant_signalization_percentage), 2) as signalization_quality_score,
        ROUND(LEAST(100, SUM(total_real_spaces) / 50), 2) as parking_supply_score,
        ROUND(
          (
            ROUND(LEAST(100, SUM(total_real_spaces) / 50), 2) * 0.5 +
            ROUND(AVG(compliant_signalization_percentage), 2) * 0.3 +
            ROUND(
              SUM(residential_zones_count) * 100.0 / NULLIF(SUM(residential_zones_count + 1), 1),
              2
            ) * 0.2
          ),
          2
        ) as potential_for_sharing
      FROM transformed_parking_paris
      GROUP BY arrondissement
      ORDER BY potential_for_sharing DESC
    `);

    // Add ranking using ROW_NUMBER window function
    await connection.execute(`
      UPDATE kpi_paris_arrondissement kpa
      JOIN (
        SELECT 
          arrondissement,
          ROW_NUMBER() OVER (ORDER BY potential_for_sharing DESC) as rn
        FROM kpi_paris_arrondissement
      ) ranked ON kpa.arrondissement = ranked.arrondissement
      SET kpa.ranking = ranked.rn
    `);

    console.log('   ✓ Paris arrondissement KPIs calculated\n');

    // 3. Build top commercial targets
    console.log('3. Identifying top commercial targets...');
    await connection.execute('TRUNCATE TABLE kpi_commercial_targets');

    await connection.execute(`
      INSERT INTO kpi_commercial_targets 
      (numero_d_immatriculation, condominium_name, region_code, region_name, commune,
       code_postal, total_lots, total_habitation_lots, parking_lots, potential_score,
       priority_level)
      SELECT 
        tc.numero_d_immatriculation,
        tc.nom_usage,
        tc.region_code,
        tc.region_name,
        CASE WHEN tc.latitude IS NOT NULL AND tc.longitude IS NOT NULL THEN 'Paris' ELSE tc.commune_code END,
        tc.code_postal,
        tc.nombre_total_lots,
        tc.nombre_lots_habitation,
        tc.nombre_lots_stationnement,
        ROUND(
          (
            (CASE WHEN tc.nombre_total_lots > 50 THEN 100 ELSE (tc.nombre_total_lots * 2) END) * 0.4 +
            (CASE WHEN tc.is_aided THEN 100 ELSE 50 END) * 0.3 +
            (CASE WHEN tc.nombre_lots_stationnement > 20 THEN 100 ELSE (tc.nombre_lots_stationnement * 5) END) * 0.3
          ),
          2
        ) as potential_score,
        CASE 
          WHEN (tc.nombre_total_lots > 100 AND tc.nombre_lots_stationnement > 30) THEN 'VERY_HIGH'
          WHEN (tc.nombre_total_lots > 50 AND tc.nombre_lots_stationnement > 15) THEN 'HIGH'
          WHEN (tc.nombre_total_lots > 30) THEN 'MEDIUM'
          ELSE 'LOW'
        END as priority_level
      FROM transformed_condominiums tc
      WHERE tc.nombre_total_lots > 20
      ORDER BY potential_score DESC
      LIMIT 5000
    `);

    // Add ranking using ROW_NUMBER window function
    await connection.execute(`
      UPDATE kpi_commercial_targets kct
      JOIN (
        SELECT 
          numero_d_immatriculation,
          ROW_NUMBER() OVER (ORDER BY potential_score DESC) as rn
        FROM kpi_commercial_targets
      ) ranked ON kct.numero_d_immatriculation = ranked.numero_d_immatriculation
      SET kct.ranking = ranked.rn
    `);

    console.log('   ✓ Commercial targets identified\n');

    // Re-enable foreign key checks
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    // 4. Create statistics summary
    console.log('4. Creating statistics summary...');
    await connection.execute('TRUNCATE TABLE kpi_statistics_summary');

    await connection.execute(`
      INSERT INTO kpi_statistics_summary 
      (metric_date, total_condominiums, total_motorized_households, avg_motorized_households_per_region,
       regions_with_data, total_arrondissements_analyzed, total_paris_parking_spaces,
       avg_parking_spaces_per_arrondissement, condominiums_with_location, condominiums_in_targeted_zones)
      SELECT 
        CURDATE(),
        COUNT(DISTINCT tc.numero_d_immatriculation),
        ROUND(SUM(th.motorized_households)),
        ROUND(AVG(th.motorized_households)),
        COUNT(DISTINCT th.region_code),
        COUNT(DISTINCT tp.arrondissement),
        SUM(tp.total_real_spaces),
        ROUND(AVG(tp.total_real_spaces)),
        COUNT(DISTINCT CASE WHEN tc.longitude IS NOT NULL THEN tc.numero_d_immatriculation END),
        COUNT(DISTINCT CASE WHEN tc.is_aided OR tc.is_in_qpv THEN tc.numero_d_immatriculation END)
      FROM transformed_households_region th
      CROSS JOIN transformed_condominiums tc
      CROSS JOIN transformed_parking_paris tp
    `);

    console.log('   ✓ Statistics summary created\n');

    await connection.commit();
    console.log('========================================');
    console.log('  KPI CALCULATION COMPLETE');
    console.log('========================================\n');

    // Print summary
    const [topRegions] = await connection.execute(`
      SELECT region_name, overall_commercial_potential, ranking 
      FROM kpi_regional_market_potential 
      ORDER BY ranking LIMIT 5
    `);

    const [topArrondissements] = await connection.execute(`
      SELECT arrondissement, potential_for_sharing, ranking 
      FROM kpi_paris_arrondissement 
      ORDER BY ranking LIMIT 5
    `);

    const [topCibles] = await connection.execute(`
      SELECT COUNT(*) as count FROM kpi_commercial_targets
    `);

    console.log('Top commercial regions by potential:');
    topRegions.forEach(row => {
      console.log(`  ${row.ranking}. ${row.region_name}: ${row.overall_commercial_potential}/100`);
    });

    console.log('\nTop Paris arrondissements by potential:');
    topArrondissements.forEach(row => {
      console.log(`  ${row.ranking}. Arrondissement ${row.arrondissement}: ${row.potential_for_sharing}/100`);
    });

    console.log(`\nTop commercial targets identified: ${topCibles[0].count}\n`);

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('✗ KPI calculation failed:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}

module.exports = { calculateKPIs };

if (require.main === module) {
  calculateKPIs()
    .then(() => {
      pool.end();
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
