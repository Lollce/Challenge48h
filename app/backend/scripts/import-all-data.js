require('dotenv').config();
const { importHouseholdsData } = require('./import-households');
const { importParkingData } = require('./import-parking');
const { importCondominiumsData } = require('./import-condominiums');
const pool = require('../config/database');

async function importAllData() {
  console.log('\n========================================');
  console.log('  PARKSHARE DATA IMPORT');
  console.log('========================================\n');

  let startTime = Date.now();
  const results = {};

  try {
    // 1. Import households
    console.log('\n[1/3] Importing households data...');
    results.households = await importHouseholdsData();

    // 2. Import parking
    console.log('\n[2/3] Importing parking spaces data...');
    results.parking = await importParkingData();

    // 3. Import condominiums
    console.log('\n[3/3] Importing condominiums data...');
    results.condominiums = await importCondominiumsData();

    // Print summary
    console.log('\n========================================');
    console.log('  IMPORT SUMMARY');
    console.log('========================================\n');

    Object.entries(results).forEach(([source, result]) => {
      console.log(`${source.toUpperCase()}:`);
      console.log(`  ✓ Success: ${result.successCount}`);
      console.log(`  ✗ Failed: ${result.failureCount}`);
      if (Array.isArray(result.errors) && result.errors.length > 0) {
        console.log(`  First error: ${result.errors[0].error}`);
      }
      console.log();
    });

    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Total import time: ${totalDuration} seconds\n`);

    console.log('========================================');
    console.log('  ALL DATA IMPORTED SUCCESSFULLY');
    console.log('========================================\n');
    console.log('Next steps:');
    console.log('1. Build transformed tables using transformation scripts');
    console.log('2. Calculate KPIs');
    console.log('3. Start the backend server: npm start\n');

  } catch (error) {
    console.error('\n✗ Import failed:', error.message);
    console.error('\nCheck data_import_log table for details\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

importAllData();
