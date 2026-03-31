const express = require('express');
const router = express.Router();
const dataController = require('../controllers/data.controller');

// Raw data endpoints
router.get('/raw/households', dataController.getRawHouseholds);
router.get('/raw/condominiums', dataController.getRawCondominiums);
router.get('/raw/parking', dataController.getRawParking);

// Transformed data endpoints
router.get('/transformed/households', dataController.getTransformedHouseholds);
router.get('/transformed/condominiums', dataController.getTransformedCondominiums);
router.get('/transformed/parking', dataController.getTransformedParking);

// Data quality and import logs
router.get('/import-logs', dataController.getImportLogs);
router.get('/data-quality', dataController.getDataQuality);

module.exports = router;
