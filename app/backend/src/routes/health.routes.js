const express = require('express');
const router = express.Router();
const pool = require('../../config/database');

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    
    // Check database connectivity
    await connection.execute('SELECT 1');
    
    // Get basic statistics
    const [stats] = await connection.execute(`
      SELECT 
        COALESCE(
          (SELECT total_condominiums FROM kpi_statistics_summary ORDER BY id DESC LIMIT 1),
          (SELECT COUNT(*) FROM transformed_condominiums)
        ) as total_condominiums,
        (SELECT COUNT(*) FROM transformed_households_region) as total_regions,
        (SELECT COUNT(*) FROM transformed_parking_paris) as total_arrondissements,
        (SELECT COUNT(*) FROM kpi_commercial_targets) as commercial_targets
    `);

    const [importLog] = await connection.execute(`
      SELECT 
        data_source,
        rows_processed,
        rows_success,
        status,
        import_duration_seconds,
        import_date
      FROM data_import_log
      ORDER BY import_date DESC
      LIMIT 3
    `);

    connection.release();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        name: process.env.DB_NAME || 'parkshare'
      },
      data_overview: stats[0],
      recent_imports: importLog
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
