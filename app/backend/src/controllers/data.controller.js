const pool = require('../../config/database');

class DataController {
  /**
   * Get raw households data
   */
  static async getRawHouseholds(req, res) {
    try {
      const { limit = 100, offset = 0, region = null } = req.query;
      const connection = await pool.getConnection();

      let query = 'SELECT * FROM raw_households_by_region WHERE 1=1';
      const params = [];

      if (region) {
        query += ' AND geocode_region = ?';
        params.push(region);
      }

      query += ` ORDER BY date_mesure DESC LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), parseInt(offset));

      const [data] = await connection.execute(query, params);

      const [totalCount] = await connection.execute(
        `SELECT COUNT(*) as count FROM raw_households_by_region ${region ? 'WHERE geocode_region = ?' : ''}`,
        region ? [region] : []
      );

      connection.release();

      res.json({
        success: true,
        data,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount[0].count
        }
      });

    } catch (error) {
      console.error('Error fetching raw households:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get raw condominiums data
   */
  static async getRawCondominiums(req, res) {
    try {
      const { limit = 50, offset = 0, region = null, commune = null } = req.query;
      const connection = await pool.getConnection();

      let query = 'SELECT numero_d_immatriculation, nom_d_usage_de_la_copropriete, commune_adresse_de_reference, code_postal_adresse_de_reference, nombre_total_de_lots, nombre_de_lots_de_stationnement, longitude, latitude FROM raw_condominiums WHERE 1=1';
      const params = [];

      if (region) {
        query += ' AND code_officiel_region = ?';
        params.push(region);
      }

      if (commune) {
        query += ' AND commune_adresse_de_reference LIKE ?';
        params.push(`%${commune}%`);
      }

      query += ` LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), parseInt(offset));

      const [data] = await connection.execute(query, params);

      const [totalCount] = await connection.execute(
        `SELECT COUNT(*) as count FROM raw_condominiums WHERE 1=1 ${region ? 'AND code_officiel_region = ?' : ''} ${commune ? 'AND commune_adresse_de_reference LIKE ?' : ''}`,
        [...(region ? [region] : []), ...(commune ? [`%${commune}%`] : [])]
      );

      connection.release();

      res.json({
        success: true,
        data,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount[0].count
        }
      });

    } catch (error) {
      console.error('Error fetching raw condominiums:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get raw parking data
   */
  static async getRawParking(req, res) {
    try {
      const { limit = 100, offset = 0, arrondissement = null } = req.query;
      const connection = await pool.getConnection();

      let query = 'SELECT * FROM raw_parking_spaces WHERE 1=1';
      const params = [];

      if (arrondissement) {
        query += ' AND arrondissement = ?';
        params.push(parseInt(arrondissement));
      }

      query += ` LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), parseInt(offset));

      const [data] = await connection.execute(query, params);

      const [totalCount] = await connection.execute(
        `SELECT COUNT(*) as count FROM raw_parking_spaces ${arrondissement ? 'WHERE arrondissement = ?' : ''}`,
        arrondissement ? [parseInt(arrondissement)] : []
      );

      connection.release();

      res.json({
        success: true,
        data,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount[0].count
        }
      });

    } catch (error) {
      console.error('Error fetching raw parking:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get transformed households data
   */
  static async getTransformedHouseholds(req, res) {
    try {
      const { limit = 50, offset = 0, sortBy = 'motorized_households' } = req.query;
      const connection = await pool.getConnection();

      const [data] = await connection.execute(`
        SELECT * FROM transformed_households_region
        ORDER BY ${sanitizeSort(sortBy)} DESC
        LIMIT ? OFFSET ?
      `, [parseInt(limit), parseInt(offset)]);

      const [totalCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM transformed_households_region'
      );

      connection.release();

      res.json({
        success: true,
        data,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount[0].count
        }
      });

    } catch (error) {
      console.error('Error fetching transformed households:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get transformed condominiums data
   */
  static async getTransformedCondominiums(req, res) {
    try {
      const { limit = 50, offset = 0, region = null, hasLocation = null } = req.query;
      const connection = await pool.getConnection();

      let query = 'SELECT * FROM transformed_condominiums WHERE 1=1';
      const params = [];

      if (region) {
        query += ' AND region_code = ?';
        params.push(region);
      }

      if (hasLocation === 'true') {
        query += ' AND latitude IS NOT NULL AND longitude IS NOT NULL';
      }

      query += ` LIMIT ? OFFSET ?`;
      params.push(parseInt(limit), parseInt(offset));

      const [data] = await connection.execute(query, params);

      const [totalCount] = await connection.execute(
        `SELECT COUNT(*) as count FROM transformed_condominiums WHERE 1=1 ${region ? 'AND region_code = ?' : ''} ${hasLocation === 'true' ? 'AND latitude IS NOT NULL AND longitude IS NOT NULL' : ''}`,
        [...(region ? [region] : [])]
      );

      connection.release();

      res.json({
        success: true,
        data,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount[0].count
        }
      });

    } catch (error) {
      console.error('Error fetching transformed condominiums:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get transformed parking data
   */
  static async getTransformedParking(req, res) {
    try {
      const { limit = 50 } = req.query;
      const connection = await pool.getConnection();

      const [data] = await connection.execute(`
        SELECT * FROM transformed_parking_paris
        ORDER BY arrondissement ASC
        LIMIT ?
      `, [parseInt(limit)]);

      connection.release();

      res.json({
        success: true,
        data,
        count: data.length
      });

    } catch (error) {
      console.error('Error fetching transformed parking:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get import logs
   */
  static async getImportLogs(req, res) {
    try {
      const { limit = 20 } = req.query;
      const connection = await pool.getConnection();

      const [logs] = await connection.execute(`
        SELECT * FROM data_import_log
        ORDER BY import_date DESC
        LIMIT ?
      `, [parseInt(limit)]);

      connection.release();

      res.json({
        success: true,
        data: logs,
        count: logs.length
      });

    } catch (error) {
      console.error('Error fetching import logs:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get data quality metrics
   */
  static async getDataQuality(req, res) {
    try {
      const connection = await pool.getConnection();

      const [quality] = await connection.execute(`
        SELECT 
          'Condominiums' as dataset,
          COUNT(*) as total_records,
          COUNT(CASE WHEN longitude IS NOT NULL AND latitude IS NOT NULL THEN 1 END) as records_with_location,
          ROUND(COUNT(CASE WHEN longitude IS NOT NULL AND latitude IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as location_coverage_percent
        FROM transformed_condominiums
        UNION ALL
        SELECT 
          'Households' as dataset,
          COUNT(*) as total_records,
          COUNT(*) as records_with_location,
          100 as location_coverage_percent
        FROM transformed_households_region
        UNION ALL
        SELECT 
          'Parking' as dataset,
          COUNT(*) as total_records,
          COUNT(CASE WHEN geo_latitude IS NOT NULL THEN 1 END) as records_with_location,
          ROUND(COUNT(CASE WHEN geo_latitude IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 2) as location_coverage_percent
        FROM raw_parking_spaces
      `);

      connection.release();

      res.json({
        success: true,
        data: quality,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error fetching data quality:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

/**
 * Sanitize sort parameter
 */
function sanitizeSort(sortBy) {
  const allowed = ['motorized_households', 'region_name', 'created_at', 'nombre_total_lots'];
  return allowed.includes(sortBy) ? sortBy : 'motorized_households';
}

module.exports = DataController;
