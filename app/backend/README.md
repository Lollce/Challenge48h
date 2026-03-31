# Parkshare - Data Infrastructure & Dashboard Backend

## Overview

Parkshare is a data-driven platform for analyzing parking sharing opportunities across French condominiums. This backend infrastructure provides:

1. **3-Layer Database Architecture**
   - RAW tables: Original data with full traceability
   - TRANSFORMED tables: Cleaned, enriched, and joined data
   - KPI tables: Aggregated metrics ready for display

2. **Comprehensive Data Processing Pipeline**
   - CSV import with automatic encoding detection
   - Data transformation and enrichment
   - KPI calculation and scoring
   - Statistical analysis

3. **RESTful API**
   - KPI endpoints for market analysis
   - Data endpoints for exploration
   - Health check and import monitoring

## Project Structure

```
backend/
├── database-schema.sql          # Complete database schema
├── server.js                    # Express.js server entry point
├── package.json                 # Dependencies
├── .env.example                 # Environment configuration template
├── config/
│   └── database.js              # Database connection pool
├── data/                        # CSV data files
│   ├── menages.csv              # Households by region
│   ├── rnc-data.csv            # National condominium registry
│   └── stationnement.csv        # Paris public parking spaces
├── scripts/
│   ├── init-database.js         # Database initialization
│   ├── import-all-data.js       # Master import script
│   ├── import-households.js     # Households data import
│   ├── import-condominiums.js   # Condominiums data import
│   ├── import-parking.js        # Parking spaces import
│   ├── build-transformed-tables.js  # Transform raw to enriched data
│   └── calculate-kpis.js        # Calculate performance indicators
└── src/
    ├── controllers/
    │   ├── kpi.controller.js    # KPI endpoints logic
    │   └── data.controller.js   # Data endpoints logic
    ├── routes/
    │   ├── kpi.routes.js        # KPI routes
    │   ├── data.routes.js       # Data routes
    │   └── health.routes.js     # Health check routes
    └── utils/
        └── csvParser.js         # CSV parsing utilities
```

## Installation & Setup

### Prerequisites

- **Node.js** 14+ 
- **MySQL** 5.7+ (or MariaDB 10.3+)
- **npm** or **yarn**

### Step 1: Install Dependencies

```bash
cd backend
npm install
```

### Step 2: Configure Environment

Copy `.env.example` to `.env` and update if needed:

```bash
cp .env.example .env
```

Default configuration:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=parkuser
DB_PASSWORD=parkpass
DB_NAME=parkshare
PORT=5000
```

⚠️ **Important**: If you're replacing an existing database, the init script will drop it automatically with the `--drop` flag.

### Step 3: Initialize Database

This creates the database, schema, and all tables:

```bash
npm run init-db
```

**To drop and recreate existing database:**
```bash
node scripts/init-database.js --drop
```

### Step 4: Import Data

Import all raw data from CSV files:

```bash
npm run import-data
```

This executes sequentially:
1. ✓ Households data (3 minutes)
2. ✓ Parking spaces data (5 minutes)
3. ✓ Condominiums data (15-20 minutes for ~500k records)

Progress is logged with record counts and timings.

### Step 5: Build Transformed Tables

Clean, enrich, and transform raw data:

```bash
node scripts/build-transformed-tables.js
```

Creates enriched tables with:
- Location data enhanced
- Data joined across sources
- Quality metrics calculated

### Step 6: Calculate KPIs

Generate all performance indicators and commercial targets:

```bash
node scripts/calculate-kpis.js
```

Produces:
- Regional market potential scores (1-100)
- Paris arrondissement sharing potential
- Top 5000 commercial targets ranked
- Statistical summary

### Step 7: Start the Server

```bash
npm start
# or for development with auto-reload:
npm run dev
```

Server runs on `http://localhost:5000`

## Database Schema Overview

### Layer 1: Raw Data Tables

#### `raw_households_by_region`
- Original household motorization data by region
- Source: INSEE data
- Fields: date_mesure, geocode_region, libelle_region, valeur

#### `raw_condominiums`
- National Registry of Condominiums (RNC)
- ~500,000+ French condominiums
- Location coordinates, lot counts, syndic info

#### `raw_parking_spaces`
- Public parking spaces on Paris streets
- Arrondissement-level detail
- Compliance and dimensions data

### Layer 2: Transformed Tables

#### `transformed_households_region`
- Aggregated by region and year
- Latest measurement dates
- Used for demand scoring

#### `transformed_condominiums`
- Enriched with region/arrondissement info
- Quality metrics and location completeness
- Potential scores calculated

#### `transformed_parking_paris`
- Aggregated by arrondissement
- Average dimensions and compliance rates
- Residential zone counts

### Layer 3: KPI Tables (What the Dashboard Uses)

#### `kpi_regional_market_potential`
**Key Metrics:**
- motorized_households: Demand indicator
- total_condominiums: Market size
- overall_commercial_potential: 0-100 score
- ranking: 1 (best) to N

**Used for:** Regional heat map, market analysis

#### `kpi_paris_arrondissement`
**Key Metrics:**
- public_parking_spaces: Current supply
- parking_density_per_km2
- residential_zone_percentage
- potential_for_sharing: 0-100 score
- ranking: For arrondissement comparison

**Used for:** Paris hyper-local analysis

#### `kpi_commercial_targets`
**Key Metrics:**
- numero_d_immatriculation: Unique ID
- condominium_name, address, postal code
- total_lots, parking_lots
- potential_score: 0-100
- priority_level: VERY_HIGH, HIGH, MEDIUM, LOW
- ranking: Top 5000 targets

**Used for:** Prospecting lists, CRM integration

#### `kpi_statistics_summary`
- Aggregate counts and percentages
- Data completeness metrics
- Updated after each ETL run

### Views for Easy Querying

```sql
vw_top_commercial_targets    -- Top 50 with location data
vw_regional_summary          -- Regional KPIs ordered by ranking  
vw_paris_analysis            -- Arrondissement analysis
```

## API Endpoints

### Health & Status

```
GET /api/v1/health
```

Returns database connectivity, data counts, and recent imports.

### Regional KPIs

```
GET /api/v1/kpi/regional                              -- All regions
GET /api/v1/kpi/regional/:regionCode                  -- Specific region detail
GET /api/v1/kpi/statistics/regions-comparison         -- Comparison table
```

**Response Example:**
```json
{
  "success": true,
  "data": {
    "region_code": "75",
    "region_name": "Île-de-France",
    "motorized_households": 3402723,
    "total_condominiums": 45230,
    "overall_commercial_potential": 92.5,
    "ranking": 1
  }
}
```

### Paris Arrondissements

```
GET /api/v1/kpi/paris-arrondissements                 -- All boroughs
GET /api/v1/kpi/paris-arrondissements/:arrondissement -- Specific borough
```

### Commercial Targets

```
GET /api/v1/kpi/commercial-targets                          
  ?limit=100&offset=0&priorityLevel=HIGH&sortBy=ranking

GET /api/v1/kpi/commercial-targets/region/:regionCode
GET /api/v1/kpi/commercial-targets/:immatriculationNumber
GET /api/v1/kpi/export/commercial-targets?format=json|csv
```

### Raw Data Exploration

```
GET /api/v1/data/raw/households?region=75&limit=100
GET /api/v1/data/raw/condominiums?commune=Paris
GET /api/v1/data/raw/parking?arrondissement=1
```

### Transformed Data

```
GET /api/v1/data/transformed/households
GET /api/v1/data/transformed/condominiums?region=75
GET /api/v1/data/transformed/parking
```

### Monitoring

```
GET /api/v1/data/import-logs          -- Recent import history
GET /api/v1/data/data-quality         -- Quality metrics per dataset
```

## Scoring Methodology

### Overall Commercial Potential (Regional)

```
Score = (Parking Demand × 0.35) + (Market Size × 0.35) + (Accessibility × 0.30)
```

Where:
- **Parking Demand** = motorized_households / 1000 (capped at 100)
- **Market Size** = condominium_count / 100 (capped at 100)
- **Accessibility** = condominiums_with_location / total_condominiums × 100

### Parking Sharing Potential (Arrondissements)

```
Score = (Supply × 0.5) + (Signalization × 0.3) + (Residential Zones × 0.2)
```

### Commercial Target Priority

```
Potential = (Lot Count × 0.4) + (Aided Program × 0.3) + (Parking Lots × 0.3)
Priority = VERY_HIGH if (lots > 100 AND parking > 30)
           HIGH if (lots > 50 AND parking > 15)
           MEDIUM if (lots > 30)
           LOW otherwise
```

## Data Quality Notes

### Known Issues

1. **Encoding Issues**: French accents handled with iconv-lite fallback to Latin-1
2. **Column Names**: CSV headers may have special characters, auto-normalized
3. **Missing Coordinates**: ~15% of condominiums lack precise location
4. **Parking Data**: Paris-only, updated monthly by Paris city services
5. **RNC Data**: 500k+ records, imports with resumable batching

### Data Completeness Metrics

Check via API:
```
GET /api/v1/data/data-quality
```

Or SQL:
```sql
SELECT dataset, location_coverage_percent FROM data_quality_view;
```

## Common Tasks

### Add New Condominium to Targets

```sql
UPDATE kpi_commercial_targets 
SET action_status = 'CONTACTED', contact_date = NOW()
WHERE numero_d_immatriculation = 'ABC123';
```

### Find High-Value Targets in Region

```sql
SELECT * FROM vw_top_commercial_targets
WHERE region_name = 'Île-de-France'
AND priority_level IN ('HIGH', 'VERY_HIGH')
LIMIT 20;
```

### Recalculate KPIs After Data Update

```bash
node scripts/build-transformed-tables.js
node scripts/calculate-kpis.js
```

### Export Targets for CRM

```bash
curl "http://localhost:5000/api/v1/kpi/export/commercial-targets?format=csv" \
  > targets.csv
```

## Troubleshooting

### Database Connection Error

```
✗ Database connection failed
```

**Solutions:**
- Verify MySQL is running: `mysql -u parkuser -p`
- Check credentials in `.env`
- Ensure user has CREATE DATABASE privilege:
  ```sql
  GRANT ALL ON parkshare.* TO 'parkuser'@'localhost';
  ```

### Import Timeout

For large datasets, increase Node memory:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run import-data
```

### Missing CSV Files

```
ENOENT: no such file or directory
```

Ensure CSV files are in `backend/data/`:
- menages.csv
- rnc-data.csv
- stationnement.csv

### No Data After Import

1. Check import log:
   ```bash
   curl http://localhost:5000/api/v1/data/import-logs
   ```

2. Verify counts:
   ```sql
   SELECT COUNT(*) FROM raw_households_by_region;
   SELECT COUNT(*) FROM raw_condominiums;
   ```

3. Check for errors in recent imports

## Performance Optimization

### For Large Queries

Add indexes (already in schema):
```sql
-- Query recent condominiums by region
SELECT * FROM transformed_condominiums 
WHERE region_code = '75' 
AND longitude IS NOT NULL;
```

### Query Optimization Tips

```sql
-- Get top targets with location (indexed)
SELECT * FROM kpi_commercial_targets
WHERE region_code = '75'
ORDER BY ranking LIMIT 100;

-- Aggregate by region (uses aggregated table)
SELECT * FROM kpi_regional_market_potential
ORDER BY overall_commercial_potential DESC;
```

## Next Steps

### For Production Deployment

1. **Database**
   - Use managed MySQL service (AWS RDS, Azure Database)
   - Enable backups
   - Use SSL connections

2. **API Server**
   - Deploy to Node.js hosting (Heroku, AWS ECS, Azure App Service)
   - Use environment variables for secrets
   - Enable HTTPS

3. **Frontend Dashboard**
   - Build React/Vue dashboard connecting to `/api/v1/kpi`
   - Implement map visualization for location-based data
   - Create filters and search interface

4. **ETL Scheduling**
   - Schedule monthly data refreshes (RNC updates ~monthly)
   - Monitor import logs for failures
   - Update KPIs automatically after imports

## Support & Documentation

- **Database Schema**: [database-schema.sql](./database-schema.sql)
- **API Examples**: [curl examples in comments]
- **Data Flows**: CSV → Raw → Transformed → KPI
- **Update Frequency**: Monthly for RNC data

## License

MIT

---

**Last Updated**: March 2026  
**Version**: 1.0.0  
**Status**: Production Ready
