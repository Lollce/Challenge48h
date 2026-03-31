const pool = require('../../config/database');

class KPIController {
  /**
   * Get all regional KPIs
   */
  static async getRegionalKPIs(req, res) {
    try {
      const { limit = 50, offset = 0, sortBy = 'ranking' } = req.query;
      
      const connection = await pool.getConnection();
      
      const [kpis] = await connection.execute(`
        SELECT 
          id,
          region_code,
          region_name,
          motorized_households,
          total_condominiums,
          avg_lots_per_copro,
          parking_demand_score,
          market_size_score,
          accessibility_score,
          aid_penetration_rate,
          overall_commercial_potential,
          ranking,
          created_at,
          updated_at
        FROM kpi_regional_market_potential
        ORDER BY ${sanitizeSort(sortBy)} DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `);

      const [totalCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM kpi_regional_market_potential'
      );

      connection.release();

      res.json({
        success: true,
        data: kpis,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount[0].count
        }
      });

    } catch (error) {
      console.error('Error getting regional KPIs:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get detail of a specific region
   */
  static async getRegionalKPIDetail(req, res) {
    try {
      const { regionCode } = req.params;
      const connection = await pool.getConnection();

      const [kpi] = await connection.execute(`
        SELECT * FROM kpi_regional_market_potential
        WHERE region_code = ?
      `, [regionCode]);

      if (kpi.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Region not found'
        });
      }

      connection.release();

      res.json({
        success: true,
        data: kpi[0]
      });

    } catch (error) {
      console.error('Error getting regional detail:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get Paris boroughs KPIs
   */
  static async getParisBoroughsKPIs(req, res) {
    try {
      const { sortBy = 'ranking' } = req.query;
      const connection = await pool.getConnection();

      const [kpis] = await connection.execute(`
        SELECT 
          id,
          arrondissement,
          public_parking_spaces,
          parking_density_per_km2,
          residential_zone_percentage,
          signalization_quality_score,
          parking_supply_score,
          potential_for_sharing,
          ranking
        FROM kpi_paris_arrondissement
        ORDER BY ${sanitizeSort(sortBy)} ASC
      `);

      connection.release();

      res.json({
        success: true,
        data: kpis,
        count: kpis.length
      });

    } catch (error) {
      console.error('Error getting Paris boroughs KPIs:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get detail of a Paris borough
   */
  static async getParisBoroughDetail(req, res) {
    try {
      const { arrondissement } = req.params;
      const connection = await pool.getConnection();

      const [kpi] = await connection.execute(`
        SELECT * FROM kpi_paris_arrondissement
        WHERE arrondissement = ?
      `, [parseInt(arrondissement)]);

      if (kpi.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Arrondissement not found'
        });
      }

      // Get parking details for this arrondissement
      const [parkingDetails] = await connection.execute(`
        SELECT 
          parking_type,
          regime_type,
          total_calculated_spaces,
          total_real_spaces,
          average_length,
          average_width
        FROM transformed_parking_paris
        WHERE arrondissement = ?
      `, [parseInt(arrondissement)]);

      connection.release();

      res.json({
        success: true,
        data: {
          kpi: kpi[0],
          parking_details: parkingDetails
        }
      });

    } catch (error) {
      console.error('Error getting Paris borough detail:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get top commercial targets
   */
  static async getCommercialTargets(req, res) {
    try {
      const { 
        limit = 100, 
        offset = 0, 
        priorityLevel = null,
        regionCode = null,
        sortBy = 'ranking'
      } = req.query;

      const connection = await pool.getConnection();
      let query = 'SELECT * FROM kpi_commercial_targets WHERE 1=1';
      const params = [];

      if (priorityLevel) {
        query += ' AND priority_level = ?';
        params.push(priorityLevel);
      }

      if (regionCode) {
        query += ' AND region_code = ?';
        params.push(regionCode);
      }

      query += ` ORDER BY ${sanitizeSort(sortBy)} ASC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

      const [targets] = await connection.execute(query, params);

      const [totalCount] = await connection.execute(
        `SELECT COUNT(*) as count FROM kpi_commercial_targets WHERE 1=1 ${priorityLevel ? 'AND priority_level = ?' : ''} ${regionCode ? 'AND region_code = ?' : ''}`,
        [...(priorityLevel ? [priorityLevel] : []), ...(regionCode ? [regionCode] : [])]
      );

      connection.release();

      res.json({
        success: true,
        data: targets,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount[0].count
        }
      });

    } catch (error) {
      console.error('Error getting commercial targets:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get commercial targets by region
   */
  static async getCommercialTargetsByRegion(req, res) {
    try {
      const { regionCode } = req.params;
      const { limit = 50, sortBy = 'ranking' } = req.query;

      const connection = await pool.getConnection();

      const [targets] = await connection.execute(`
        SELECT 
          numero_d_immatriculation,
          condominium_name,
          commune,
          code_postal,
          total_lots,
          potential_score,
          priority_level,
          ranking
        FROM kpi_commercial_targets
        WHERE region_code = ?
        ORDER BY ${sanitizeSort(sortBy)} ASC
        LIMIT ${parseInt(limit)}
      `, [regionCode]);

      connection.release();

      res.json({
        success: true,
        region: regionCode,
        data: targets,
        count: targets.length
      });

    } catch (error) {
      console.error('Error getting targets by region:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get detail of a commercial target
   */
  static async getCommercialTargetDetail(req, res) {
    try {
      const { immatriculationNumber } = req.params;
      const connection = await pool.getConnection();

      const [target] = await connection.execute(`
        SELECT * FROM kpi_commercial_targets
        WHERE numero_d_immatriculation = ?
      `, [immatriculationNumber]);

      if (target.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Commercial target not found'
        });
      }

      // Get additional details from transformed table
      const [condoDetails] = await connection.execute(`
        SELECT 
          longitude,
          latitude,
          adresse_complete,
          is_in_qpv,
          is_in_acv,
          is_in_pvd,
          is_aided
        FROM transformed_condominiums
        WHERE numero_d_immatriculation = ?
      `, [immatriculationNumber]);

      connection.release();

      res.json({
        success: true,
        data: {
          target: target[0],
          condo_details: condoDetails[0] || null
        }
      });

    } catch (error) {
      console.error('Error getting target detail:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get statistical summary
   */
  static async getStatisticalSummary(req, res) {
    try {
      const connection = await pool.getConnection();

      const [stats] = await connection.execute(`
        SELECT * FROM kpi_statistics_summary
        ORDER BY metric_date DESC
        LIMIT 1
      `);

      connection.release();

      res.json({
        success: true,
        data: stats[0] || null
      });

    } catch (error) {
      console.error('Error getting statistics:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get regions comparison data
   */
  static async getRegionsComparison(req, res) {
    try {
      const connection = await pool.getConnection();

      const [comparison] = await connection.execute(`
        SELECT 
          region_name,
          motorized_households,
          total_condominiums,
          parking_demand_score,
          market_size_score,
          overall_commercial_potential,
          ranking
        FROM kpi_regional_market_potential
        ORDER BY overall_commercial_potential DESC
      `);

      connection.release();

      res.json({
        success: true,
        data: comparison,
        count: comparison.length
      });

    } catch (error) {
      console.error('Error getting regions comparison:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Export commercial targets as JSON
   */
  static async exportCommercialTargets(req, res) {
    try {
      const { format = 'json' } = req.query;
      const connection = await pool.getConnection();

      const [targets] = await connection.execute(`
        SELECT 
          numero_d_immatriculation,
          condominium_name,
          region_name,
          commune,
          code_postal,
          total_lots,
          parking_lots,
          potential_score,
          priority_level,
          ranking
        FROM kpi_commercial_targets
        ORDER BY ranking ASC
      `);

      connection.release();

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="commercial_targets.csv"');
        
        const headers = Object.keys(targets[0]);
        let csv = headers.join(',') + '\n';
        targets.forEach(row => {
          csv += headers.map(h => `"${row[h]}"`).join(',') + '\n';
        });
        res.send(csv);
      } else {
        res.json({
          success: true,
          data: targets,
          count: targets.length,
          exported_at: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('Error exporting targets:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

/**
 * Sanitize sort parameter to prevent SQL injection
 */
function sanitizeSort(sortBy) {
  const allowed = ['ranking', 'potential_score', 'overall_commercial_potential', 'created_at'];
  return allowed.includes(sortBy) ? sortBy : 'ranking';
}

module.exports = KPIController;
