require('dotenv').config();
const pool = require('../config/database');

async function buildTransformedTables() {
  let connection;
  
  try {
    console.log('\n========================================');
    console.log('  BUILDING TRANSFORMED DATA TABLES');
    console.log('========================================\n');

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Disable foreign key checks for truncate operations
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');

    // 1. Build transformed households by region
    console.log('1. Transforming households data...');
    await connection.execute(`
      TRUNCATE TABLE transformed_households_region
    `);

    await connection.execute(`
      INSERT INTO transformed_households_region 
      (region_code, region_name, latest_year, motorized_households, last_measurement_date)
      SELECT 
        geocode_region,
        libelle_region,
        YEAR(date_mesure) as latest_year,
        ROUND(SUM(valeur), 0) as motorized_households,
        MAX(date_mesure) as last_measurement_date
      FROM raw_households_by_region
      GROUP BY geocode_region, libelle_region, YEAR(date_mesure)
      ORDER BY latest_year DESC, libelle_region
    `);

    console.log('   ✓ Households transformed\n');

    // 2. Build transformed condominiums
    console.log('2. Transforming condominiums data...');
    await connection.execute(`
      TRUNCATE TABLE transformed_condominiums
    `);

    await connection.execute(`
      INSERT INTO transformed_condominiums 
      (numero_d_immatriculation, commune_code, region_code, region_name, arrondissement_code,
       nom_usage, adresse_complete, code_postal, nombre_total_lots, nombre_lots_habitation,
       nombre_lots_stationnement, type_syndic, syndic_name, is_in_qpv, is_in_acv, is_in_pvd,
       is_aided, longitude, latitude, last_update)
      SELECT 
        numero_d_immatriculation,
        code_officiel_commune,
        code_officiel_region,
        nom_officiel_region,
        code_officiel_arrondissement,
        nom_d_usage_de_la_copropriete,
        adresse_de_reference,
        code_postal_adresse_de_reference,
        nombre_total_de_lots,
        nombre_de_lots_a_usage_d_habitation,
        nombre_de_lots_de_stationnement,
        type_de_syndic,
        raison_sociale_du_representant_legal,
        CASE WHEN nom_qp_2024 != '' THEN TRUE ELSE FALSE END,
        CASE WHEN copro_dans_acv = 'Oui' THEN TRUE ELSE FALSE END,
        CASE WHEN copro_dans_pvd = 'Oui' THEN TRUE ELSE FALSE END,
        CASE WHEN copro_aidee = 'Oui' THEN TRUE ELSE FALSE END,
        longitude,
        latitude,
        date_de_la_derniere_maj
      FROM raw_condominiums
      WHERE numero_d_immatriculation IS NOT NULL
        AND numero_d_immatriculation != ''
    `);

    console.log('   ✓ Condominiums transformed\n');

    // 3. Build transformed parking
    console.log('3. Transforming parking data...');
    await connection.execute(`
      TRUNCATE TABLE transformed_parking_paris
    `);

    await connection.execute(`
      INSERT INTO transformed_parking_paris 
      (arrondissement, parking_type, regime_type, total_calculated_spaces, total_real_spaces,
       average_length, average_width, total_surface, residential_zones_count, 
       compliant_signalization_percentage, street_count, latest_survey_date)
      SELECT 
        arrondissement,
        type_stationnement,
        regime_prioritaire,
        SUM(nombre_places_calculees) as total_calculated_spaces,
        SUM(nombre_places_reelles) as total_real_spaces,
        ROUND(AVG(longueur), 2) as average_length,
        ROUND(AVG(largeur), 2) as average_width,
        ROUND(SUM(surface_calculee), 2) as total_surface,
        COUNT(CASE WHEN zones_residentielles != '' THEN 1 END) as residential_zones_count,
        ROUND(
          COUNT(CASE WHEN conformite_signalisation LIKE '%Conforme%' THEN 1 END) * 100.0 / 
          NULLIF(COUNT(*), 0), 
          2
        ) as compliant_signalization_percentage,
        COUNT(DISTINCT nom_voie) as street_count,
        MAX(date_du_releve) as latest_survey_date
      FROM raw_parking_spaces
      WHERE arrondissement IS NOT NULL
      GROUP BY arrondissement, type_stationnement, regime_prioritaire
      ORDER BY arrondissement
    `);

    console.log('   ✓ Parking data transformed\n');

    // Re-enable foreign key checks before commit
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');

    await connection.commit();
    console.log('========================================');
    console.log('  TRANSFORMATION COMPLETE');
    console.log('========================================\n');

    // Print statistics
    const [householdsStats] = await connection.execute('SELECT COUNT(*) as count FROM transformed_households_region');
    const [condominiumsStats] = await connection.execute('SELECT COUNT(*) as count FROM transformed_condominiums');
    const [parkingStats] = await connection.execute('SELECT COUNT(*) as count FROM transformed_parking_paris');

    console.log('Transformed data summary:');
    console.log(`  • Household regions: ${householdsStats[0].count}`);
    console.log(`  • Condominiums: ${condominiumsStats[0].count}`);
    console.log(`  • Parking records: ${parkingStats[0].count}\n`);

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('✗ Transformation failed:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}

module.exports = { buildTransformedTables };

if (require.main === module) {
  buildTransformedTables()
    .then(() => {
      pool.end();
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
