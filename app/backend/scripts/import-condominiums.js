require('dotenv').config();
const path = require('path');
const pool = require('../config/database');
const { parseCSVStream, logProgress } = require('../src/utils/csvParser');

async function importCondominiumsData() {
  let connection;
  const startTime = Date.now();

  try {
    logProgress('Starting condominiums data import...', 'info');

    const filePath = path.join(__dirname, '../data/rnc-data.csv');
    logProgress(`Reading file: ${filePath}`, 'info');

    let totalRecords = 0;
    let successCount = 0;
    let failureCount = 0;

    const processChunk = async (records) => {
      totalRecords += records.length;

      for (const record of records) {
        try {
          const transformed = {
            epci: String(record.epci || '').trim(),
            commune: String(record.commune || '').trim(),
            numero_d_immatriculation: String(record.numero_d_immatriculation || '').trim(),
            date_d_immatriculation: record.date_d_immatriculation ? new Date(record.date_d_immatriculation) : null,
            date_de_la_derniere_maj: record.date_de_la_derniere_maj ? new Date(record.date_de_la_derniere_maj) : null,
            type_de_syndic: String(record.type_de_syndic_benevole_professionnel_non_connu || record.type_de_syndic || '').trim(),
            raison_sociale_du_representant_legal: String(record.raison_sociale_du_representant_legal || '').trim(),
            siret_du_representant_legal: String(record.siret_du_representant_legal || '').trim(),
            code_ape: String(record.code_ape || '').trim(),
            commune_du_representant_legal: String(record.commune_du_representant_legal || '').trim(),
            mandat_en_cours_dans_la_copropriete: String(record.mandat_en_cours_dans_la_copropriete || '').trim(),
            date_de_fin_du_dernier_mandat: record.date_de_fin_du_dernier_mandat ? new Date(record.date_de_fin_du_dernier_mandat) : null,
            nom_d_usage_de_la_copropriete: String(record.nom_d_usage_de_la_copropriete || '').trim().substring(0, 200),
            adresse_de_reference: String(record.adresse_de_reference || '').trim(),
            code_postal_adresse_de_reference: String(record.code_postal_adresse_de_reference || '').trim(),
            commune_adresse_de_reference: String(record.commune_adresse_de_reference || '').trim(),
            nombre_d_asl_auxquelles_est_rattache: parseInt(record.nombre_d_asl_auxquelles_est_rattache_le_syndicat_de_coproprieta || record.nombre_d_asl_auxquelles_est_rattache || 0) || 0,
            nombre_d_aful_auxquelles_est_rattache: parseInt(record.nombre_d_aful_auxquelles_est_rattache_le_syndicat_de_copropriet || record.nombre_d_aful_auxquelles_est_rattache || 0) || 0,
            nombre_d_unions_auxquelles_est_rattache: parseInt(record.nombre_d_unions_de_syndicats_auxquelles_est_rattache_le_syndica || record.nombre_d_unions_auxquelles_est_rattache || 0) || 0,
            nombre_total_de_lots: parseInt(record.nombre_total_de_lots || 0) || 0,
            nombre_total_de_lots_habitation_bureaux_commerces: parseInt(record.nombre_total_de_lots_a_usage_d_habitation_de_bureaux_ou_de_comm || record.nombre_total_de_lots_habitation_bureaux_commerces || 0) || 0,
            nombre_de_lots_a_usage_d_habitation: parseInt(record.nombre_de_lots_a_usage_d_habitation || 0) || 0,
            nombre_de_lots_de_stationnement: parseInt(record.nombre_de_lots_de_stationnement || 0) || 0,
            periode_de_construction: String(record.periode_de_construction || '').trim(),
            nombre_de_parcelles_cadastrales: parseInt(record.nombre_de_parcelles_cadastrales || 0) || 0,
            nom_qp_2015: String(record.nom_qp_2015 || '').trim(),
            code_qp_2015: String(record.code_qp_2015 || '').trim(),
            nom_qp_2024: String(record.nom_qp_2024 || '').trim(),
            code_qp_2024: String(record.code_qp_2024 || '').trim(),
            copro_dans_acv: String(record.copro_dans_acv || 'Non').trim(),
            copro_dans_pvd: String(record.copro_dans_pvd || 'Non').trim(),
            copro_dans_pdp: String(record.copro_dans_pdp || 'Non').trim(),
            copro_aidee: String(record.copro_aidee || 'Non').trim(),
            code_officiel_commune: String(record.code_officiel_commune || '').trim(),
            nom_officiel_commune: String(record.nom_officiel_commune || '').trim(),
            code_officiel_arrondissement: String(record.code_officiel_arrondissement_commune || record.code_officiel_arrondissement || '').trim(),
            nom_officiel_arrondissement: String(record.nom_officiel_arrondissement_commune || record.nom_officiel_arrondissement || '').trim(),
            code_officiel_epci: String(record.code_officiel_epci || '').trim(),
            nom_officiel_epci: String(record.nom_officiel_epci || '').trim().substring(0, 200),
            code_officiel_departement: String(record.code_officiel_departement || '').trim(),
            nom_officiel_departement: String(record.nom_officiel_departement || '').trim(),
            code_officiel_region: String(record.code_officiel_region || '').trim(),
            nom_officiel_region: String(record.nom_officiel_region || '').trim(),
            longitude: (record.long || record.longitude) ? parseFloat(record.long || record.longitude) : null,
            latitude: (record.lat || record.latitude) ? parseFloat(record.lat || record.latitude) : null
          };

          const fields = Object.keys(transformed);
          const values = Object.values(transformed);
          const placeholders = fields.map(() => '?').join(', ');

          const query = `INSERT INTO raw_condominiums (${fields.join(', ')}) VALUES (${placeholders})`;
          await connection.execute(query, values);
          successCount++;
        } catch (error) {
          failureCount++;
        }
      }

      if (totalRecords % 500 === 0) {
        logProgress(`Progress: ${totalRecords}`, 'info');
      }
    };

    connection = await pool.getConnection();
    await connection.beginTransaction();

    await connection.execute('TRUNCATE TABLE raw_condominiums');
    logProgress('Cleared previous condominium records', 'info');

    await parseCSVStream(filePath, processChunk, 1000);

    logProgress(`Inserted ${successCount} records successfully`, 'success');
    if (failureCount > 0) {
      logProgress(`Failed to insert ${failureCount} records`, 'warning');
    }

    await connection.commit();
    logProgress('Transaction committed', 'success');

    const duration = (Date.now() - startTime) / 1000;
    await connection.execute(
      'INSERT INTO data_import_log (data_source, rows_processed, rows_success, rows_failed, status, import_duration_seconds) VALUES (?, ?, ?, ?, ?, ?)',
      ['raw_condominiums', totalRecords, successCount, failureCount, successCount > 0 ? 'success' : 'failed', duration]
    );

    logProgress(`Import completed in ${duration.toFixed(2)} seconds`, 'success');
    return { successCount, failureCount };

  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (e) {
        // ignore rollback errors
      }
    }
    logProgress(`Import failed: ${error.message}`, 'error');
    throw error;
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}

module.exports = { importCondominiumsData };

if (require.main === module) {
  importCondominiumsData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
