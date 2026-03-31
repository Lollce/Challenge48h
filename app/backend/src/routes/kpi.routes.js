const express = require('express');
const router = express.Router();
const kpiController = require('../controllers/kpi.controller');

// Regional KPIs
router.get('/regional', kpiController.getRegionalKPIs);
router.get('/regional/:regionCode', kpiController.getRegionalKPIDetail);

// Paris Arrondissement KPIs
router.get('/paris-arrondissements', kpiController.getParisBoroughsKPIs);
router.get('/paris-arrondissements/:arrondissement', kpiController.getParisBoroughDetail);

// Commercial Targets
router.get('/commercial-targets', kpiController.getCommercialTargets);
router.get('/commercial-targets/region/:regionCode', kpiController.getCommercialTargetsByRegion);
router.get('/commercial-targets/:immatriculationNumber', kpiController.getCommercialTargetDetail);

// Statistics
router.get('/statistics', kpiController.getStatisticalSummary);
router.get('/statistics/regions-comparison', kpiController.getRegionsComparison);

// Export/Reports
router.get('/export/commercial-targets', kpiController.exportCommercialTargets);

module.exports = router;
