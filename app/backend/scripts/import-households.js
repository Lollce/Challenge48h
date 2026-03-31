require('dotenv').config();
const path = require('path');
const pool = require('../config/database');
const { parseCSV, logProgress, batchInsert } = require('../src/utils/csvParser');

async function importHouseholdsData() {
  let connection;
  const startTime = Date.now();
  
  try {
    logProgress('Starting households data import...', 'info');
    
    const filePath = path.join(__dirname, '../data/menages.csv');
    logProgress(`Reading file: ${filePath}`, 'info');
    
    const records = await parseCSV(filePath);
    logProgress(`Parsed ${records.length} records from CSV`, 'success');

    // Get database connection
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Clean previous data
    await connection.execute('TRUNCATE TABLE raw_households_by_region');
    logProgress('Cleared previous household records', 'info');

    // Transform data for import
    const transformedRecords = records.map(record => ({
      date_mesure: new Date(record.date_mesure),
      geocode_region: String(record.geocode_region || '').padStart(2, '0') || null,
      libelle_region: String(record.libelle_region || '').trim() || null,
      valeur: parseFloat(record.valeur) || 0
    }));

    // Insert data
    const result = await batchInsert(connection, 'raw_households_by_region', transformedRecords);
    
    logProgress(`Inserted ${result.successCount} records successfully`, 'success');
    if (result.failureCount > 0) {
      logProgress(`Failed to insert ${result.failureCount} records`, 'warning');
    }

    // Commit transaction
    await connection.commit();
    logProgress('Transaction committed', 'success');

    // Log import
    const duration = (Date.now() - startTime) / 1000;
    await connection.execute(
      'INSERT INTO data_import_log (data_source, rows_processed, rows_success, rows_failed, status, import_duration_seconds) VALUES (?, ?, ?, ?, ?, ?)',
      ['raw_households_by_region', records.length, result.successCount, result.failureCount, 'success', duration]
    );

    logProgress(`Import completed in ${duration.toFixed(2)} seconds`, 'success');
    return result;

  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    logProgress(`Import failed: ${error.message}`, 'error');
    throw error;
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}

module.exports = { importHouseholdsData };

// Run if executed directly
if (require.main === module) {
  importHouseholdsData()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
