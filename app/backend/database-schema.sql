-- ====================================
-- PARKSHARE DATABASE SCHEMA
-- ====================================
-- This schema implements a 3-layer architecture:
-- 1. RAW tables: Original data as received (for traceability)
-- 2. TRANSFORMED tables: Cleaned, enriched, and joined data
-- 3. KPI tables: Aggregated metrics ready for display

-- ====================================
-- LAYER 1: RAW DATA TABLES (Source of Truth)
-- ====================================

-- Raw household data by region
CREATE TABLE IF NOT EXISTS raw_households_by_region (
    id INT PRIMARY KEY AUTO_INCREMENT,
    date_mesure DATETIME NOT NULL,
    geocode_region VARCHAR(4) NOT NULL,
    libelle_region VARCHAR(100) NOT NULL,
    valeur DECIMAL(15, 2) NOT NULL,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_region (geocode_region),
    INDEX idx_date (date_mesure)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Raw national registry of condominiums
CREATE TABLE IF NOT EXISTS raw_condominiums (
    id INT,
    epci VARCHAR(50),
    commune VARCHAR(100),
    numero_d_immatriculation VARCHAR(50) UNIQUE NOT NULL,
    date_d_immatriculation DATE,
    date_de_la_derniere_maj DATE,
    type_de_syndic VARCHAR(50),
    raison_sociale_du_representant_legal VARCHAR(200),
    siret_du_representant_legal VARCHAR(20),
    code_ape VARCHAR(10),
    commune_du_representant_legal VARCHAR(100),
    mandat_en_cours_dans_la_copropriete VARCHAR(50),
    date_de_fin_du_dernier_mandat DATE,
    nom_d_usage_de_la_copropriete VARCHAR(200),
    adresse_de_reference TEXT,
    code_postal_adresse_de_reference VARCHAR(10),
    commune_adresse_de_reference VARCHAR(100),
    nombre_d_asl_auxquelles_est_rattache INT,
    nombre_d_aful_auxquelles_est_rattache INT,
    nombre_d_unions_auxquelles_est_rattache INT,
    nombre_total_de_lots INT,
    nombre_total_de_lots_habitation_bureaux_commerces INT,
    nombre_de_lots_a_usage_d_habitation INT,
    nombre_de_lots_de_stationnement INT,
    periode_de_construction VARCHAR(50),
    nombre_de_parcelles_cadastrales INT,
    nom_qp_2015 VARCHAR(100),
    code_qp_2015 VARCHAR(10),
    nom_qp_2024 VARCHAR(100),
    code_qp_2024 VARCHAR(10),
    copro_dans_acv VARCHAR(10),
    copro_dans_pvd VARCHAR(10),
    copro_dans_pdp VARCHAR(10),
    copro_aidee VARCHAR(10),
    code_officiel_commune VARCHAR(10),
    nom_officiel_commune VARCHAR(100),
    code_officiel_arrondissement VARCHAR(10),
    nom_officiel_arrondissement VARCHAR(100),
    code_officiel_epci VARCHAR(20),
    nom_officiel_epci VARCHAR(200),
    code_officiel_departement VARCHAR(5),
    nom_officiel_departement VARCHAR(100),
    code_officiel_region VARCHAR(5),
    nom_officiel_region VARCHAR(100),
    longitude DECIMAL(10, 8),
    latitude DECIMAL(10, 8),
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (numero_d_immatriculation),
    INDEX idx_commune (code_officiel_commune),
    INDEX idx_region (code_officiel_region),
    INDEX idx_coords (latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Raw public parking spaces data (Paris)
CREATE TABLE IF NOT EXISTS raw_parking_spaces (
    id INT PRIMARY KEY AUTO_INCREMENT,
    regime_prioritaire VARCHAR(50),
    regime_particulier VARCHAR(50),
    type_stationnement VARCHAR(50),
    arrondissement INT,
    nombre_places_calculees INT,
    nombre_places_reelles INT,
    zones_residentielles VARCHAR(10),
    localisation_stationnement VARCHAR(50),
    numero_voie VARCHAR(20),
    type_voie VARCHAR(30),
    nom_voie VARCHAR(100),
    complement_numero VARCHAR(50),
    localisation_numero VARCHAR(50),
    parite VARCHAR(20),
    longueur DECIMAL(10, 4),
    largeur DECIMAL(10, 4),
    surface_calculee DECIMAL(10, 4),
    signalisation_horizontale VARCHAR(50),
    signalisation_verticale VARCHAR(50),
    conformite_signalisation VARCHAR(50),
    type_mobilier VARCHAR(50),
    numero_mobilier VARCHAR(20),
    plage_horaire_1_debut VARCHAR(20),
    plage_horaire_1_fin VARCHAR(20),
    plage_horaire_2_debut VARCHAR(20),
    plage_horaire_2_fin VARCHAR(20),
    plage_horaire_3_debut VARCHAR(20),
    plage_horaire_3_fin VARCHAR(20),
    nouvel_identifiant VARCHAR(20),
    ancien_identifiant VARCHAR(20),
    date_du_releve DATE,
    derniere_modification DATE,
    code_voie_paris VARCHAR(20),
    numero_sequentiel_troncon VARCHAR(20),
    numero_ilot VARCHAR(20),
    numero_iris VARCHAR(20),
    zones_asp VARCHAR(20),
    numero_section_territoriale VARCHAR(20),
    competence_prefecture VARCHAR(100),
    geo_latitude DECIMAL(12, 10),
    geo_longitude DECIMAL(12, 10),
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_arrondissement (arrondissement),
    INDEX idx_date (date_du_releve)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================
-- LAYER 2: TRANSFORMED DATA TABLES
-- ====================================

-- Transformed household data with region enrichment
CREATE TABLE IF NOT EXISTS transformed_households_region (
    id INT PRIMARY KEY AUTO_INCREMENT,
    region_code VARCHAR(5) NOT NULL,
    region_name VARCHAR(100) NOT NULL,
    latest_year INT NOT NULL,
    motorized_households DECIMAL(15, 2) NOT NULL,
    households_with_cars_percentage DECIMAL(5, 2),
    last_measurement_date DATETIME,
    data_quality_score DECIMAL(3, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_region_year (region_code, latest_year),
    INDEX idx_region (region_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transformed condominium data with location and enrichment
CREATE TABLE IF NOT EXISTS transformed_condominiums (
    id INT,
    numero_d_immatriculation VARCHAR(50) UNIQUE NOT NULL,
    commune_code VARCHAR(10),
    region_code VARCHAR(5),
    region_name VARCHAR(100),
    arrondissement_code VARCHAR(10),
    nom_usage VARCHAR(200),
    adresse_complete TEXT,
    code_postal VARCHAR(10),
    nombre_total_lots INT,
    nombre_lots_habitation INT,
    nombre_lots_stationnement INT,
    type_syndic VARCHAR(50),
    syndic_name VARCHAR(200),
    is_in_qpv BOOLEAN DEFAULT FALSE,
    is_in_acv BOOLEAN DEFAULT FALSE,
    is_in_pvd BOOLEAN DEFAULT FALSE,
    is_aided BOOLEAN DEFAULT FALSE,
    longitude DECIMAL(10, 8),
    latitude DECIMAL(10, 8),
    potential_score DECIMAL(5, 2),
    data_completeness_rate DECIMAL(3, 2),
    last_update DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (numero_d_immatriculation),
    INDEX idx_commune (commune_code),
    INDEX idx_region (region_code),
    INDEX idx_arrondissement (arrondissement_code),
    INDEX idx_potential (potential_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transformed parking data with aggregation
CREATE TABLE IF NOT EXISTS transformed_parking_paris (
    id INT PRIMARY KEY AUTO_INCREMENT,
    arrondissement INT NOT NULL,
    parking_type VARCHAR(50),
    regime_type VARCHAR(50),
    total_calculated_spaces INT,
    total_real_spaces INT,
    average_length DECIMAL(10, 4),
    average_width DECIMAL(10, 4),
    total_surface DECIMAL(12, 4),
    residential_zones_count INT,
    compliant_signalization_percentage DECIMAL(5, 2),
    street_count INT,
    latest_survey_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_arrondissement (arrondissement),
    INDEX idx_type (parking_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================
-- LAYER 3: KPI TABLES (Ready for Display)
-- ====================================

-- KPI: Regional market potential
CREATE TABLE IF NOT EXISTS kpi_regional_market_potential (
    id INT PRIMARY KEY AUTO_INCREMENT,
    region_code VARCHAR(5) NOT NULL,
    region_name VARCHAR(100) NOT NULL,
    motorized_households INT,
    total_condominiums INT,
    avg_lots_per_copro INT,
    parking_demand_score DECIMAL(5, 2),
    market_size_score DECIMAL(5, 2),
    accessibility_score DECIMAL(5, 2),
    aid_penetration_rate DECIMAL(5, 2),
    overall_commercial_potential DECIMAL(5, 2),
    ranking INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_region (region_code),
    INDEX idx_potential (overall_commercial_potential DESC),
    INDEX idx_ranking (ranking)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- KPI: Arrondissement level (Paris)
CREATE TABLE IF NOT EXISTS kpi_paris_arrondissement (
    id INT PRIMARY KEY AUTO_INCREMENT,
    arrondissement INT NOT NULL UNIQUE,
    public_parking_spaces INT,
    parking_density_per_km2 DECIMAL(10, 2),
    residential_zone_percentage DECIMAL(5, 2),
    signalization_quality_score DECIMAL(5, 2),
    parking_supply_score DECIMAL(5, 2),
    potential_for_sharing DECIMAL(5, 2),
    ranking INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_potential (potential_for_sharing),
    INDEX idx_ranking (ranking)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- KPI: Top commercial targets
CREATE TABLE IF NOT EXISTS kpi_commercial_targets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    numero_d_immatriculation VARCHAR(50) UNIQUE NOT NULL,
    condominium_name VARCHAR(200),
    region_code VARCHAR(5),
    region_name VARCHAR(100),
    commune VARCHAR(100),
    code_postal VARCHAR(10),
    total_lots INT,
    total_habitation_lots INT,
    parking_lots INT,
    potential_score DECIMAL(5, 2),
    priority_level VARCHAR(20),
    ranking INT,
    action_status VARCHAR(50) DEFAULT 'NEW',
    notes TEXT,
    contact_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (numero_d_immatriculation) REFERENCES transformed_condominiums(numero_d_immatriculation),
    INDEX idx_region (region_code),
    INDEX idx_potential (potential_score),
    INDEX idx_priority (priority_level),
    INDEX idx_ranking (ranking)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- KPI: Statistical summary
CREATE TABLE IF NOT EXISTS kpi_statistics_summary (
    id INT PRIMARY KEY AUTO_INCREMENT,
    metric_date DATE UNIQUE NOT NULL,
    total_condominiums INT,
    total_motorized_households INT,
    avg_motorized_households_per_region INT,
    regions_with_data INT,
    total_arrondissements_analyzed INT,
    total_paris_parking_spaces INT,
    avg_parking_spaces_per_arrondissement INT,
    condominiums_with_location INT,
    condominiums_in_targeted_zones INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================
-- DATA QUALITY TRACKING
-- ====================================

CREATE TABLE IF NOT EXISTS data_import_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    import_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_source VARCHAR(100) NOT NULL,
    rows_processed INT,
    rows_success INT,
    rows_failed INT,
    error_message TEXT,
    import_duration_seconds DECIMAL(10, 2),
    status VARCHAR(20)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================
-- INDEXES FOR PERFORMANCE
-- ====================================

-- Create composite indexes for common queries
CREATE INDEX idx_copro_region_lots ON transformed_condominiums(region_code, nombre_total_lots);
CREATE INDEX idx_parking_arrondissement_type ON transformed_parking_paris(arrondissement, parking_type);

-- ====================================
-- VIEWS FOR EASY QUERYING
-- ====================================

-- View: Top 50 commercial targets
CREATE OR REPLACE VIEW vw_top_commercial_targets AS
SELECT 
    k.id,
    k.numero_d_immatriculation,
    k.condominium_name,
    k.region_name,
    k.commune,
    k.code_postal,
    k.total_lots,
    k.parking_lots,
    k.potential_score,
    k.priority_level,
    k.ranking,
    tc.longitude,
    tc.latitude
FROM kpi_commercial_targets k
LEFT JOIN transformed_condominiums tc ON k.numero_d_immatriculation = tc.numero_d_immatriculation
ORDER BY k.ranking ASC
LIMIT 50;

-- View: Regional summary
CREATE OR REPLACE VIEW vw_regional_summary AS
SELECT 
    krmp.region_code,
    krmp.region_name,
    krmp.motorized_households,
    krmp.total_condominiums,
    krmp.parking_demand_score,
    krmp.market_size_score,
    krmp.overall_commercial_potential,
    krmp.ranking
FROM kpi_regional_market_potential krmp
ORDER BY krmp.ranking ASC;

-- View: Paris arrondissement analysis
CREATE OR REPLACE VIEW vw_paris_analysis AS
SELECT 
    kpa.arrondissement,
    kpa.public_parking_spaces,
    kpa.parking_density_per_km2,
    kpa.residential_zone_percentage,
    kpa.signalization_quality_score,
    kpa.potential_for_sharing,
    kpa.ranking
FROM kpi_paris_arrondissement kpa
ORDER BY kpa.ranking ASC;

COMMIT;
