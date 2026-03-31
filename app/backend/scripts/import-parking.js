require('dotenv').config();
const path = require('path');
const pool = require('../config/database');
const { parseCSV, normalizeFieldName, logProgress, batchInsert } = require('../src/utils/csvParser');

async function importParkingData() {
  let connection;
  const startTime = Date.now();
  
  try {
    logProgress('Starting parking spaces data import...', 'info');
    
    const filePath = path.join(__dirname, '../data/stationnement.csv');
    logProgress(`Reading file: ${filePath}`, 'info');
    
    const records = await parseCSV(filePath, ';');
    logProgress(`Parsed ${records.length} records from CSV`, 'success');

    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Clean previous data
    await connection.execute('TRUNCATE TABLE raw_parking_spaces');
    logProgress('Cleared previous parking records', 'info');

    // Transform data
    const transformedRecords = records.map(record => {
      // Extract geo_point_2d
      let coords = { lat: null, lon: null };
      if (record['geo_point_2d']) {
        const parts = String(record['geo_point_2d']).split(',');
        if (parts.length === 2) {
          coords.lat = parseFloat(parts[0].trim());
          coords.lon = parseFloat(parts[1].trim());
        }
      }

      return {
        regime_prioritaire: String(record['Régime prioritaire'] || record['Regime prioritaire'] || '').trim(),
        regime_particulier: String(record['Régime particulier'] || record['Regime particulier'] || '').trim(),
        type_stationnement: String(record['Type de stationnement'] || '').trim(),
        arrondissement: parseInt(record['Arrondissement']) || null,
        nombre_places_calculees: parseInt(record['Nombre places calculées'] || record['Nombre places calcul']) || null,
        nombre_places_reelles: parseInt(record['Nombre places réelles'] || record['Nombre places r']) || null,
        zones_residentielles: String(record['Zones résidentielles'] || record['Zones residentielles'] || '').trim(),
        localisation_stationnement: String(record['Localisation stationnement'] || '').trim(),
        numero_voie: String(record['Numéro voie'] || record['Numero voie'] || '').trim(),
        type_voie: String(record['Type voie'] || '').trim(),
        nom_voie: String(record['Nom voie'] || '').trim(),
        complement_numero: String(record['Complément numéro voie'] || record['Complement numero voie'] || '').trim(),
        localisation_numero: String(record['Localisation numéro'] || record['Localisation numero'] || '').trim(),
        parite: String(record['Parité'] || record['Parite'] || '').trim(),
        longueur: parseFloat(record['Longueur']) || null,
        largeur: parseFloat(record['Largeur']) || null,
        surface_calculee: parseFloat(record['Surface calculée'] || record['Surface calcul']) || null,
        signalisation_horizontale: String(record['Signalisation horizontale'] || '').trim(),
        signalisation_verticale: String(record['Signalisation verticale'] || '').trim(),
        conformite_signalisation: String(record['Conformité signalisation'] || record['Conformite signalisation'] || '').trim(),
        type_mobilier: String(record['Type mobilier'] || '').trim(),
        numero_mobilier: String(record['Numéro mobilier'] || record['Numero mobilier'] || '').trim(),
        plage_horaire_1_debut: String(record['Plage horaire 1-Début'] || record['Plage horaire 1-Debut'] || '').trim(),
        plage_horaire_1_fin: String(record['Plage horaire 1-Fin'] || record['Plage horaire 1-Fin'] || '').trim(),
        plage_horaire_2_debut: String(record['Plage horaire 2-Début'] || record['Plage horaire 2-Debut'] || '').trim(),
        plage_horaire_2_fin: String(record['Plage horaire 2-Fin'] || record['Plage horaire 2-Fin'] || '').trim(),
        plage_horaire_3_debut: String(record['Plage horaire 3-Début'] || record['Plage horaire 3-Debut'] || '').trim(),
        plage_horaire_3_fin: String(record['Plage horaire 3-Fin'] || record['Plage horaire 3-Fin'] || '').trim(),
        nouvel_identifiant: String(record['Nouvel identifiant'] || '').trim(),
        ancien_identifiant: String(record['Ancien identifiant'] || '').trim(),
        date_du_releve: record['Date du relevé'] ? new Date(record['Date du relevé']) : null,
        derniere_modification: record['Dernière modification'] ? new Date(record['Dernière modification']) : null,
        code_voie_paris: String(record['Code voie Ville de Paris'] || '').trim(),
        numero_sequentiel_troncon: String(record['Numéro séquentiel Tronçon voie'] || record['Numero sequentiel Troncon voie'] || '').trim(),
        numero_ilot: String(record['Numéro ilot'] || record['Numero ilot'] || '').trim(),
        numero_iris: String(record['Numéro IRIS'] || record['Numero IRIS'] || '').trim(),
        zones_asp: String(record['Zones ASP'] || '').trim(),
        numero_section_territoriale: String(record['Numéro Section Territoriale de Voirie'] || record['Numero Section Territoriale de Voirie'] || '').trim(),
        competence_prefecture: String(record['Compétence préfecture'] || record['Competence prefecture'] || '').trim(),
        geo_latitude: coords.lat,
        geo_longitude: coords.lon
      };
    });

    // Insert
    const result = await batchInsert(connection, 'raw_parking_spaces', transformedRecords);
    
    logProgress(`Inserted ${result.successCount} records successfully`, 'success');
    if (result.failureCount > 0) {
      logProgress(`Failed to insert ${result.failureCount} records`, 'warning');
    }

    await connection.commit();
    logProgress('Transaction committed', 'success');

    const duration = (Date.now() - startTime) / 1000;
    await connection.execute(
      'INSERT INTO data_import_log (data_source, rows_processed, rows_success, rows_failed, status, import_duration_seconds) VALUES (?, ?, ?, ?, ?, ?)',
      ['raw_parking_spaces', records.length, result.successCount, result.failureCount, 'success', duration]
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

module.exports = { importParkingData };

if (require.main === module) {
  importParkingData()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
