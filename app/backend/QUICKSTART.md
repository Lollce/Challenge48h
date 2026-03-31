# Parkshare Backend - Quick Start Guide

Follow these steps to get Parkshare running in **5 minutes**.

## Prerequisites Check

Ensure you have:
- ✓ MySQL running (on localhost:3306)
- ✓ Node.js installed
- ✓ CSV data files in `backend/data/`

## Setup in 5 Steps

### 1. Install Dependencies (1 min)

```bash
cd backend
npm install
```

### 2. Configure Database (30 sec)

```bash
cp .env.example .env
# Edit .env if needed (default settings usually work)
```

**If replacing an existing database**, add `--drop` flag in next step.

### 3. Initialize Database (1 min)

```bash
npm run init-db
```

Or to replace existing:
```bash
node scripts/init-database.js --drop
```

Creates:
- ✓ parkshare database
- ✓ All 3-layer table structure
- ✓ Views and indexes

### 4. Import Data (20 min)

```bash
npm run import-data
```

Note: this command already runs Node with an 8192 MB heap.

This runs:
1. Households → 4 regions × years = ~50 records ✓ fast
2. Parking → ~25,000 Paris spots ✓ fast
3. Condominiums → ~500,000 records ✓ 15-20 min (streaming + batched inserts)

Watch the progress output. Errors are logged, not fatal.

### 5. Build & Calculate (3-5 min)

```bash
node scripts/build-transformed-tables.js
node scripts/calculate-kpis.js
```

Creates:
- ✓ Transformed enriched tables
- ✓ Regional market scores (0-100)
- ✓ Arrondissement sharing potential
- ✓ Top 5000 commercial targets ranked

## Start Server

```bash
npm start
# Server on http://localhost:5000
```

Check health:
```bash
curl http://localhost:5000/api/v1/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": { "connected": true },
  "data_overview": {
    "total_condominiums": 450000,
    "total_regions": 18,
    "commercial_targets": 5000
  }
}
```

## Test API

### Get top regions by potential
```bash
curl http://localhost:5000/api/v1/kpi/regional
```

### Get Paris best arrondissements
```bash
curl http://localhost:5000/api/v1/kpi/paris-arrondissements
```

### Get commercial targets (top 50)
```bash
curl http://localhost:5000/api/v1/kpi/commercial-targets?limit=50
```

### Export targets as CSV
```bash
curl http://localhost:5000/api/v1/kpi/export/commercial-targets?format=csv > targets.csv
```

## Database Overview

After import, you have:

| Layer | Tables | Purpose |
|-------|--------|---------|
| Raw | 3 tables | Original data (traceability) |
| Transformed | 3 tables | Cleaned, enriched data |
| KPI | 4 tables | Ready-to-display metrics |
| Monitoring | 2 tables | Import logs & data quality |

**Total records**: ~500k condominiums, ~50 regions, ~50k parking spaces

## Troubleshooting

### "Cannot connect to database"
```bash
# Check MySQL is running
mysql -u parkuser -p
# (password: parkpass)
```

### "Database already exists"
Use `--drop` flag:
```bash
node scripts/init-database.js --drop
npm run import-data
```

### "Out of memory during import"
The condominiums import now uses streaming by default.

If the global import command fails, run the heaviest step alone first:
```bash
node scripts/import-condominiums.js
```

If your machine still runs out of memory, increase Node memory further:
```bash
node --max-old-space-size=12288 scripts/import-all-data.js
```

PowerShell equivalent:
```powershell
$env:NODE_OPTIONS="--max-old-space-size=12288"; npm run import-data
```

### API returns empty data
Ensure you ran all steps:
```bash
npm run init-db         # ✓ confirmed?
npm run import-data     # ✓ completed without errors?
node scripts/build-transformed-tables.js  # ✓ did this?
node scripts/calculate-kpis.js            # ✓ and this?
```

## What's Next?

✓ Backend ready  
→ Build frontend dashboard (connect to `/api/v1/kpi` endpoints)  
→ Implement CRM integration  
→ Schedule monthly data refreshes  

## Key Files

| File | Purpose |
|------|---------|
| [database-schema.sql](./database-schema.sql) | Complete DB definition |
| [README.md](./README.md) | Full documentation |
| [server.js](./server.js) | Express API server |
| [scripts/](./scripts/) | ETL pipeline |

## Database Credentials

```
Host: localhost
Port: 3306
User: parkuser
Password: parkpass
Database: parkshare
```

## Performance Notes

- Condominiums import: streamed from CSV and processed in 1000-record chunks
- Import logging: every 500 records
- Best queries: use indexed fields (region_code, ranking, potential_score)
- Large exports: limit to 5000 records

---

**Estimated total time: 30 minutes**  
(5 min setup + 20 min data import + 5 min transform/KPI)

Need help? Check [README.md](./README.md) for full docs.
