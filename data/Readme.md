
## Objectif
Collecter, nettoyer et analyser des données ouvertes pour produire des KPIs 
d'analyse de marché, dans le but d'identifier les zones à fort potentiel 
commercial pour Parkshare.

---

## Sources de données utilisées

| Fichier | Source | Description |
|---|---|---|
| `rnc-data-gouv-with-qpv.csv` | [data.gouv.fr](https://www.data.gouv.fr/fr/datasets/registre-national-des-coproprietes/) | Registre National des Copropriétés — liste toutes les copropriétés françaises avec localisation et nombre de lots |
| `nombre-de-menage-possedant-au-moins-une-voiture-region.csv` | [data.gouv.fr](https://www.data.gouv.fr) | Nombre de ménages motorisés par région |
| `stationnement-sur-voie-publique-emprises.csv` | [opendata.paris.fr](https://opendata.paris.fr) | Places de stationnement sur voie publique à Paris par arrondissement |
| `popref2023_cc_popref.csv` | [INSEE](https://www.insee.fr) | Population de référence 2023 — non exploité car agrégé au niveau national |

---

## Instructions pour reproduire le pipeline

### 1. Prérequis
```bash
pip install pandas matplotlib seaborn folium
```

### 2. Placer les fichiers CSV dans le même dossier que `Challenge 48.py`

### 3. Lancer le script
```bash
python "Challenge 48.py"
```

### 4. Fichiers générés
- `kpi_coproprietes.csv` — KPIs par commune
- `kpi_stationnement.csv` — KPIs par arrondissement parisien
- `kpi_motorisation.csv` — KPIs par région
- `kpi_top10_zones.csv` — Top 10 zones prioritaires avec score
- `graphique_coproprietes.png`
- `graphique_score_potentiel.png`
- `graphique_stationnement.png`
- `graphique_motorisation.png`

---

## KPIs produits

### KPI 1 — Nombre de copropriétés par commune
Agrégation du Registre National des Copropriétés par commune.
Indique la densité de cibles potentielles pour Parkshare.

### KPI 2 — Pression de stationnement par arrondissement (Paris)
Somme des places de stationnement réelles par arrondissement parisien.
Un nombre élevé de places publiques indique une forte demande de stationnement
et donc un potentiel plus important pour Parkshare.

### KPI 3 — Taux de motorisation par région
Nombre de ménages possédant au moins une voiture par région.
Permet d'identifier les régions où la demande de stationnement privé est la plus forte.

### KPI 4 — Score de potentiel commercial
Score composite normalisé entre 0 et 1, calculé comme suit :
```
Score = (score_nb_copropriétés × 0.5) + (score_nb_lots_habitation × 0.5)
```

Les deux composantes sont normalisées entre 0 et 1 (min-max scaling).

---

## Résultats — Top 10 zones prioritaires

| Rang | Commune | Nb copropriétés | Score |
|---|---|---|---|
| 1 | Paris | ~44 000 | 1.00 |
| 2 | Marseille | 17 631 | 0.41 |
| 3 | Toulouse | 7 521 | 0.21 |
| 4 | Lyon | 7 117 | 0.19 |
| 5 | Bordeaux | 7 073 | 0.15 |
| 6 | Montpellier | 4 589 | 0.13 |
| 7 | Nantes | 4 730 | 0.12 |
| 8 | Strasbourg | 4 821 | 0.11 |
| 9 | Lyon | 3 644 | 0.10 |
| 10 | Lille | 4 050 | 0.10 |

**Conclusion** : Paris représente un potentiel écrasant avec plus de 44 000 copropriétés.
Marseille est la deuxième priorité, suivie des grandes métropoles françaises.

---

## Limites et axes d'amélioration
- Le fichier de population INSEE était agrégé au niveau national, non exploitable par commune
- Les données de stationnement couvrent uniquement Paris
- Le scoring pourrait être enrichi avec des données PLU ou DVF pour affiner l'analyse

---

*Données ouvertes — INSEE, data.gouv.fr, OpenData Paris*