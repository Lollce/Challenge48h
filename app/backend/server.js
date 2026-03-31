require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/database');

const kpiRoutes = require('./src/routes/kpi.routes');
const dataRoutes = require('./src/routes/data.routes');
const healthRoutes = require('./src/routes/health.routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/api/v1/health', healthRoutes);

app.use('/api/v1/kpi', kpiRoutes);
app.use('/api/v1/data', dataRoutes);

app.get('/', (req, res) => {
  res.json({
    name: 'Parkshare API',
    version: '1.0.0',
    documentation: '/api/v1/health',
    endpoints: {
      kpi: '/api/v1/kpi',
      data: '/api/v1/data',
      health: '/api/v1/health'
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('  PARKSHARE API SERVER');
  console.log('========================================');
  console.log(`\n✓ Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ Database: ${process.env.DB_NAME || 'parkshare'}`);
  console.log(`\nAPI Documentation:`);
  console.log(`  • Health: http://localhost:${PORT}/api/v1/health`);
  console.log(`  • KPI: http://localhost:${PORT}/api/v1/kpi`);
  console.log(`  • Data: http://localhost:${PORT}/api/v1/data\n`);
});

process.on('SIGINT', async () => {
  console.log('\n\nShutting down...');
  await pool.end();
  process.exit(0);
});
