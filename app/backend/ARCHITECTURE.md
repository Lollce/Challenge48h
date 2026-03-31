# Parkshare Data Architecture & Migration Flow

## 3-Layer Architecture Overview

Parkshare uses a 3-layer data warehouse pattern for data quality, traceability, and performance:

```
CSV FILES (External)
    ↓
    ├─→ [RAW TABLES] ← Original data, unchanged
    │   └─→ Full traceability
    │       Import logs & dates tracked
    │
    ├─→ [TRANSFORMED TABLES] ← Cleaned & enriched
    │   └─→ Merged/joined across sources
    │       Business rules applied
    │       Quality metrics calculated
    │
    └─→ [KPI TABLES] ← Aggregated & scored
        └─→ Ready for display in dashboards
            Rankings calculated
            Potential scores (0-100)
```

## Data Flow Example: "Find Top Commercial Targets in Île-de-France"

### Step 1: Raw Data Import
```
menages.csv (households)
    ↓
raw_households_by_region
├─ date_mesure: 2022-01-01
├─ geocode_region: '84'
├─ libelle_region: 'Auvergne-Rhône-Alpes'
└─ valeur: 3153726.77
```

```
rnc-data.csv (condominiums)
    ↓
raw_condominiums
├─ numero_d_immatriculation: '246900724'
├─ nom_d_usage_de_la_copropriete: 'Les Jardins de Justine'
├─ code_officiel_region: '84'
├─ nombre_total_de_lots: 202
├─ nombre_de_lots_de_stationnement: 72
├─ long: 4.688192
└─ lat: 45.746802
```

### Step 2: Transform & Enrich
```
TRANSFORM RAW → TRANSFORMED
    ↓
transformed_condominiums
├─ numero_d_immatriculation: '246900724'
├─ region_code: '84'
├─ region_name: 'Auvergne-Rhône-Alpes'
├─ nombre_total_lots: 202
├─ is_aided: TRUE
├─ potential_score: NULL (calculated below)
└─ longitude: 4.688192
```

### Step 3: Calculate Potential Score
```sql
potential_score = (
  (lots_count * 2 / 100) * 0.4 +      -- Lot count factor
  (aided_status ? 100 : 50) * 0.3 +    -- Aided program factor
  (parking_lots * 5 / 100) * 0.3       -- Parking availability factor
)
```

Example calculation:
- Lots: 202 → (202×2)/100 = 4.04
- Aided: TRUE → 100
- Parking: 72 → (72×5)/100 = 3.6

Score = (4.04 × 0.4) + (100 × 0.3) + (3.6 × 0.3) = 1.62 + 30 + 1.08 = **32.7/100**

### Step 4: Rank & Prioritize
```
kpi_commercial_targets
├─ numero_d_immatriculation: '246900724'
├─ condominium_name: 'Les Jardins de Justine'
├─ region_name: 'Île-de-France'
├─ total_lots: 202
├─ parking_lots: 72
├─ potential_score: 75.3
├─ priority_level: 'HIGH' (lots > 50 AND parking > 15)
├─ ranking: 342 (among all targets)
└─ action_status: 'NEW'
```

### Step 5: Dashboard Usage
```sql
-- Query for prospecting list
SELECT * FROM kpi_commercial_targets
WHERE region_name = 'Île-de-France'
  AND priority_level IN ('HIGH', 'VERY_HIGH')
ORDER BY ranking
LIMIT 100;
```

Returns list ranked by commercial potential, ready for sales team.

---

## Table Reference Guide

### RAW LAYER (Import Source)

#### `raw_households_by_region`
| Field | Type | Source |
|-------|------|--------|
| date_mesure | DATETIME | INSEE household survey |
| geocode_region | VARCHAR(4) | Region code (01-95) |
| libelle_region | VARCHAR(100) | Region name |
| valeur | DECIMAL(15,2) | Motorized households count |

**Purpose**: Tracks demand signal (population with cars) by region over time

**Query Example**:
```sql
-- Latest motorized households by region
SELECT geocode_region, libelle_region, 
       MAX(valeur) as latest_count
FROM raw_households_by_region
GROUP BY geocode_region
ORDER BY latest_count DESC;
```

---

#### `raw_condominiums`
| Key Field | Type | Purpose |
|-----------|------|---------|
| numero_d_immatriculation | VARCHAR(50) | Unique ID |
| nom_d_usage_de_la_copropriete | VARCHAR(200) | Building name |
| code_officiel_region | VARCHAR(5) | Region ID |
| commune_adresse_de_reference | VARCHAR(100) | City |
| code_postal_adresse_de_reference | VARCHAR(10) | Postal code |
| nombre_total_de_lots | INT | Total units |
| nombre_de_lots_a_usage_d_habitation | INT | Residential units |
| nombre_de_lots_de_stationnement | INT | Parking spaces |
| longitude | DECIMAL(10,8) | Coordinate |
| latitude | DECIMAL(10,8) | Coordinate |
| type_de_syndic | VARCHAR(50) | Syndicate type (pro/volunteer) |
| raison_sociale_du_representant_legal | VARCHAR(200) | Syndicate name |
| nom_qp_2024 | VARCHAR(100) | Priority policy zone |
| copro_dans_acv | VARCHAR(10) | In ACV program? |

**Purpose**: National registry of all French condominiums with location and contacts

**Data Volume**: ~500,000 records  
**Quality Notes**: 
- ~15% missing coordinates
- Syndicate info may be outdated
- Updated by RNC ~monthly

**Key Index**:
```sql
CREATE SPATIAL INDEX idx_location 
ON raw_condominiums (POINT(longitude, latitude));
```

---

#### `raw_parking_spaces`
| Field | Type | Source |
|-------|------|--------|
| arrondissement | INT | Paris district 1-20 |
| type_stationnement | VARCHAR(50) | Type (longitudinal, épi, etc) |
| nombre_places_calculees | INT | Theoretical capacity |
| nombre_places_reelles | INT | Actual count |
| longueur | DECIMAL(10,4) | Average length (m) |
| largeur | DECIMAL(10,4) | Average width (m) |
| surface_calculee | DECIMAL(10,4) | Total area |
| zones_residentielles | VARCHAR(10) | Residential zone |
| conformite_signalisation | VARCHAR(50) | Signaling compliance |
| geo_latitude | DECIMAL(12,10) | Location |
| geo_longitude | DECIMAL(12,10) | Location |

**Purpose**: Detailed parking supply data for Paris hyper-local analysis

**Data Volume**: ~25,000 street sections  
**Update Frequency**: Monthly  
**Coverage**: Paris intra-muros only

---

### TRANSFORMED LAYER (Business Rules Applied)

#### `transformed_households_region`
| Field | Type | Transformation |
|-------|------|-----------------|
| region_code | VARCHAR(5) | Cleaned code |
| region_name | VARCHAR(100) | Cleaned name |
| latest_year | INT | YEAR(date_mesure) |
| motorized_households | DECIMAL(15,2) | SUM(valeur) by year |
| households_with_cars_percentage | DECIMAL(5,2) | Regional penetration % |

**Business Logic**:
- Groups by region + year
- Sums motorized households across years
- Calculates regional car ownership %

**Example**:
```sql
SELECT region_name, motorized_households
FROM transformed_households_region
WHERE latest_year = 2022
ORDER BY motorized_households DESC;
/* 
Result:
Île-de-France | 3,402,723  -- Largest market
Provence-Alpes-Côte d'Azur | 2,234,567
...
*/
```

---

#### `transformed_condominiums`
| Field | Changed/Added | Calculation |
|-------|----------------|-------------|
| region_code | Added | From raw |
| region_name | Added | JOIN to households |
| is_in_qpv | NEW | CASE WHEN nom_qp_2024 != '' |
| is_aided | NEW | CASE WHEN copro_aidee = 'Oui' |
| potential_score | NEW | Multi-factor calculation |
| data_completeness_rate | NEW | NOT NULL fields / total |

**Business Logic**:
- Standardizes region/commune codes
- Enriches with program flags (QPA, ACV, PVD)
- Pre-calculates potential scores
- Tracks data completeness

**Indexing for Performance**:
```sql
CREATE SPATIAL INDEX idx_location ON transformed_condominiums 
POINT(longitude, latitude);
```

Used by dashboard for map clustering.

---

#### `transformed_parking_paris`
| Field | Type | Aggregation |
|-------|------|-------------|
| arrondissement | INT | GROUP BY |
| total_real_spaces | INT | SUM(nombre_places_reelles) |
| average_length | DECIMAL | AVG(longueur) |
| average_width | DECIMAL | AVG(largeur) |
| residential_zones_count | INT | COUNT(CASE WHEN zones_residentielles != '') |
| compliant_signalization_percentage | DECIMAL | COUNT(conforme)/COUNT(*)*100 |

**Purpose**: Arrondissement-level parking summary

**Example**:
```sql
SELECT arrondissement, total_real_spaces, 
       residential_zones_count
FROM transformed_parking_paris
WHERE arrondissement <= 10
ORDER BY total_real_spaces DESC;

/* Result:
Arrondissement | Spaces | Residential
1              | 5,432  | 128
2              | 4,201  | 94
...
*/
```

---

### KPI LAYER (Dashboard Ready)

#### `kpi_regional_market_potential`
| Field | Calculation | Use Case |
|-------|-------------|----------|
| region_code | Key | Filtering |
| motorized_households | FROM transformed_households_region | Demand |
| total_condominiums | COUNT(*) FROM transformed_condominiums | Market size |
| overall_commercial_potential | Weighted formula (0-100) | Ranking |
| ranking | ROW_NUMBER() | Market position |

**Scoring Formula**:
```
parking_demand_score = motorized_households / 1000 (capped at 100)
market_size_score = total_condominiums / 100 (capped at 100)
accessibility_score = condos_with_location / total_condos * 100

overall = (parking×0.35) + (market×0.35) + (access×0.30)
```

**Example Result**:
```json
{
  "region_code": "75",
  "region_name": "Île-de-France",
  "motorized_households": 3402723,
  "total_condominiums": 125000,
  "parking_demand_score": 100,
  "market_size_score": 100,
  "accessibility_score": 92.3,
  "overall_commercial_potential": 97.5,
  "ranking": 1
}
```

**Dashboard**: Color-coded heat map (red=high potential)

---

#### `kpi_commercial_targets`
| Field | Calculation | Usage |
|-------|-------------|-------|
| numero_d_immatriculation | PK | CRM lookup |
| condominium_name | From transformed | Display |
| total_lots | From transformed | Filter |
| parking_lots | From transformed | Filter |
| potential_score | Multi-factor 0-100 | Ranking |
| priority_level | IF statements | Sales focus |
| ranking | ROW_NUMBER() | Position |
| action_status | Enum | CRM state |

**Priority Assignment**:
```sql
CASE 
  WHEN total_lots > 100 AND parking_lots > 30 THEN 'VERY_HIGH'
  WHEN total_lots > 50 AND parking_lots > 15 THEN 'HIGH'
  WHEN total_lots > 30 THEN 'MEDIUM'
  ELSE 'LOW'
END
```

**Example**:
```sql
SELECT * FROM kpi_commercial_targets
WHERE region_name = 'Île-de-France'
  AND priority_level = 'VERY_HIGH'
LIMIT 20;
/* Prospecting list: 20 highest-value targets in Île-de-France */
```

**CRM Integration**: Export via API endpoint
```bash
curl /api/v1/kpi/export/commercial-targets?format=csv > targets.csv
```

---

#### `kpi_paris_arrondissement`
| Field | Purpose | Range |
|-------|---------|-------|
| arrondissement | Identifier | 1-20 |
| public_parking_spaces | Supply indicator | 0-∞ |
| parking_density_per_km2 | Area normalization | varies |
| residential_zone_percentage | Market fit | 0-100% |
| potential_for_sharing | Composite score | 0-100 |
| ranking | Comparison | 1-20 |

**Boroughs Ranked by Potential**:
```sql
SELECT arrondissement, potential_for_sharing
FROM kpi_paris_arrondissement
ORDER BY ranking;

/* Top 5:
Arrondissement | Potential
11             | 92.5 (high supply + residential)
20             | 88.3
4              | 85.1
...
*/
```

---

## Data Import & Processing Timeline

### Households Data
```
menages.csv (3 KB)
    ↓ (< 1 second)
raw_households_by_region (50 rows)
    ↓ (< 1 second)
transformed_households_region (18 regions × years)
    ↓ (< 1 second)
kpi_regional_market_potential (18 rows)
```

### Parking Data
```
stationnement.csv (2 MB)
    ↓ (5 seconds)
raw_parking_spaces (25,000 rows)
    ↓ (< 1 second)
transformed_parking_paris (20 arrondissements)
    ↓ (< 1 second)
kpi_paris_arrondissement (20 rows)
```

### Condominiums Data (🔶 LONGEST)
```
rnc-data.csv (150 MB)
    ↓ (15-20 minutes - network limited)
raw_condominiums (500,000 rows)
    ↓ (batched SQL, 2-3 minutes)
transformed_condominiums (500,000 rows)
    ↓ (5 seconds)
kpi_commercial_targets (5,000 rows - top targets only)
```

### Total Time
```
init-db: 1 min
import-data: 20 min (mostly condominiums)
build-transformed: 3 min
calculate-kpis: 2 min
───────────────────
TOTAL: ~26 minutes
```

## Refresh Strategy

### Weekly
- Nothing (fresh data rare)

### Monthly
- Re-import `raw_condominiums` (RNC updates ~monthly)
- Re-run `build-transformed-tables.js`
- Re-run `calculate-kpis.js`
- Duration: ~30 minutes

### Quarterly
- Re-import all data from scratch
- Validate data quality metrics
- Update rankings

### Annual
- Archive previous year's KPIs
- Analysis of trend data

---

## Data Quality Metrics

**Location Coverage** (critical for mapping):
```sql
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN longitude IS NOT NULL THEN 1 END) as with_location,
  COUNT(CASE WHEN longitude IS NOT NULL THEN 1 END)*100/COUNT(*) as coverage_pct
FROM transformed_condominiums;

/* Expected: 85-90% */
```

**Data Freshness**:
```sql
SELECT MAX(date_de_la_derniere_maj) as last_update
FROM raw_condominiums;
```

**Import Success Rate**:
```sql
SELECT data_source, rows_success, rows_failed,
       ROUND(rows_success*100/(rows_success+rows_failed),1) as success_rate
FROM data_import_log;

/* Expected: > 99% */
```

---

## SQL Pattern Library

### Find All High-Priority Targets with Location
```sql
SELECT 
  numero_d_immatriculation,
  condominium_name,
  region_name,
  total_lots,
  parking_lots,
  potential_score,
  tc.longitude,
  tc.latitude
FROM kpi_commercial_targets kct
LEFT JOIN transformed_condominiums tc 
  ON kct.numero_d_immatriculation = tc.numero_d_immatriculation
WHERE priority_level IN ('HIGH', 'VERY_HIGH')
  AND tc.longitude IS NOT NULL
ORDER BY potential_score DESC;
```

### Regional Demand vs Supply Analysis
```sql
SELECT 
  h.region_name,
  h.motorized_households,
  COUNT(c.numero_d_immatriculation) as condominium_count,
  ROUND(h.motorized_households / NULLIF(COUNT(c.numero_d_immatriculation), 0), 1) as motorists_per_condo
FROM transformed_households_region h
LEFT JOIN transformed_condominiums c 
  ON h.region_code = c.region_code
GROUP BY h.region_code, h.region_name, h.motorized_households
ORDER BY motorists_per_condo DESC;
```

### Map: All Targets with Potential Score
```sql
SELECT 
  numero_d_immatriculation,
  nom_usage,
  longitude,
  latitude,
  potential_score,
  priority_level
FROM transformed_condominiums tc
LEFT JOIN kpi_commercial_targets kct 
  ON tc.numero_d_immatriculation = kct.numero_d_immatriculation
WHERE tc.longitude IS NOT NULL
  AND potential_score > 70
ORDER BY potential_score DESC;
```

---

## Troubleshooting Data Issues

### "No data appearing in KPI tables"

```sql
-- Check raw data import
SELECT COUNT(*) as raw_count FROM raw_condominiums;  -- expect ~500k
SELECT COUNT(*) as raw_count FROM raw_households_by_region;  -- expect ~50
SELECT COUNT(*) as raw_count FROM raw_parking_spaces;  -- expect ~25k

-- If counts are 0: re-run import
node scripts/import-all-data.js

-- Check transformed layer
SELECT COUNT(*) as transformed FROM transformed_condominiums;  -- expect ~500k
```

### "Scores are all 0 or NULL"

```sql
-- Check calculation columns
SELECT 
  id,
  nombre_total_lots,
  nombre_lots_de_stationnement,
  is_aided
FROM transformed_condominiums
LIMIT 5;

-- If NULL: re-run transform
node scripts/build-transformed-tables.js
```

### "Rankings are duplicated"

```sql
-- Check ranking logic
SELECT COUNT(*), ranking FROM kpi_commercial_targets 
GROUP BY ranking HAVING COUNT(*) > 1
LIMIT 5;

-- If duplicates: re-run KPIs
node scripts/calculate-kpis.js
```

---

## References

- **Database**: MySQL 5.7+ / MariaDB 10.3+
- **Data Models**: 3NF for raw, denormalized for KPI
- **Indexes**: Spatial for location queries, B-tree for ranking
- **Encoding**: UTF-8 with Latin-1 fallback

See [database-schema.sql](./database-schema.sql) for complete definitions.
