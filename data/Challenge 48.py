import pandas as pd
pd.options.display.max_columns = 100


df_motorisation = pd.read_csv("nombre-de-menage-possedant-au-moins-une-voiture-region.csv", 
                               encoding="utf-8-sig", sep=",", on_bad_lines="skip")

df_rnc = pd.read_csv("rnc-data-gouv-with-qpv.csv", 
                      encoding="utf-8-sig", low_memory=False)

df_stationnement = pd.read_csv("stationnement-sur-voie-publique-emprises.csv", 
                                encoding="utf-8-sig", sep=";", on_bad_lines="skip")


kpi_copro = df_rnc.groupby("commune_adresse_de_reference").agg(
    nb_coproprietes=("numero_d_immatriculation", "count"),
    total_lots_habitation=("nombre_de_lots_a_usage_d_habitation", "sum")
).reset_index().rename(columns={"commune_adresse_de_reference": "commune"})

kpi_copro["commune"] = kpi_copro["commune"].str.title()

kpi_copro = kpi_copro.groupby("commune").agg(
    nb_coproprietes=("nb_coproprietes", "sum"),
    total_lots_habitation=("total_lots_habitation", "sum")
).reset_index()

print("=== KPI 1 - COPROPRIÉTÉS PAR COMMUNE ===")
print(kpi_copro.sort_values("nb_coproprietes", ascending=False).head(10))


kpi_parking = df_stationnement.groupby("Arrondissement").agg(
    total_places=("Nombre places réelles", "sum")
).reset_index()

print("\n=== KPI 2 - STATIONNEMENT PAR ARRONDISSEMENT ===")
print(kpi_parking.sort_values("total_places", ascending=False).head(10))


df_motorisation_latest = df_motorisation.sort_values("date_mesure").groupby("libelle_region").last().reset_index()

kpi_motorisation = df_motorisation_latest[["libelle_region", "valeur"]].rename(
    columns={"valeur": "nb_menages_motorises"}
)

print("\n=== KPI 3 - MOTORISATION PAR RÉGION ===")
print(kpi_motorisation.sort_values("nb_menages_motorises", ascending=False).head(10))

kpi_copro["score_copro"] = (kpi_copro["nb_coproprietes"] - kpi_copro["nb_coproprietes"].min()) / \
                            (kpi_copro["nb_coproprietes"].max() - kpi_copro["nb_coproprietes"].min())

kpi_copro["score_lots"] = (kpi_copro["total_lots_habitation"] - kpi_copro["total_lots_habitation"].min()) / \
                           (kpi_copro["total_lots_habitation"].max() - kpi_copro["total_lots_habitation"].min())


kpi_copro["score_potentiel"] = (kpi_copro["score_copro"] * 0.5) + \
                                (kpi_copro["score_lots"] * 0.5)

top10 = kpi_copro.sort_values("score_potentiel", ascending=False).head(10)

print("\n=== KPI 4 - TOP 10 ZONES PRIORITAIRES ===")
print(top10[["commune", "nb_coproprietes", "total_lots_habitation", "score_potentiel"]])


kpi_copro.to_csv("kpi_coproprietes.csv", index=False, encoding="utf-8-sig")
kpi_parking.to_csv("kpi_stationnement.csv", index=False, encoding="utf-8-sig")
kpi_motorisation.to_csv("kpi_motorisation.csv", index=False, encoding="utf-8-sig")
top10.to_csv("kpi_top10_zones.csv", index=False, encoding="utf-8-sig")

import matplotlib.pyplot as plt
import seaborn as sns


plt.figure(figsize=(12, 6))
sns.barplot(data=top10, x="commune", y="nb_coproprietes", palette="Blues_d")
plt.title("Top 10 communes par nombre de copropriétés", fontsize=14)
plt.xlabel("Commune")
plt.ylabel("Nombre de copropriétés")
plt.xticks(rotation=45, ha="right")
plt.tight_layout()
plt.savefig("graphique_coproprietes.png")
plt.show()


plt.figure(figsize=(12, 6))
sns.barplot(data=top10, x="commune", y="score_potentiel", palette="Oranges_d")
plt.title("Score de potentiel commercial - Top 10 zones prioritaires", fontsize=14)
plt.xlabel("Commune")
plt.ylabel("Score (0 à 1)")
plt.xticks(rotation=45, ha="right")
plt.tight_layout()
plt.savefig("graphique_score_potentiel.png")
plt.show()


plt.figure(figsize=(12, 6))
sns.barplot(data=kpi_parking.sort_values("total_places", ascending=False).head(10), 
            x="Arrondissement", y="total_places", palette="Reds_d")
plt.title("Top 10 arrondissements parisiens - Pression stationnement", fontsize=14)
plt.xlabel("Arrondissement")
plt.ylabel("Nombre de places")
plt.tight_layout()
plt.savefig("graphique_stationnement.png")
plt.show()


plt.figure(figsize=(12, 6))
sns.barplot(data=kpi_motorisation.sort_values("nb_menages_motorises", ascending=False), 
            x="libelle_region", y="nb_menages_motorises", palette="Greens_d")
plt.title("Nombre de ménages motorisés par région", fontsize=14)
plt.xlabel("Région")
plt.ylabel("Nombre de ménages motorisés")
plt.xticks(rotation=45, ha="right")
plt.tight_layout()
plt.savefig("graphique_motorisation.png")
plt.show()

import folium


coords = df_rnc.groupby("commune_adresse_de_reference").agg(
    lat=("lat", "mean"),
    lon=("long", "mean")
).reset_index().rename(columns={"commune_adresse_de_reference": "commune"})

coords["commune"] = coords["commune"].str.title()
coords = coords.groupby("commune").agg(lat=("lat", "mean"), lon=("lon", "mean")).reset_index()

# Fusion avec le top 10
top10_carte = top10.merge(coords, on="commune", how="left")

# Création de la carte
carte = folium.Map(location=[46.5, 2.5], zoom_start=6)

for _, row in top10_carte.iterrows():
    if pd.notna(row["lat"]) and pd.notna(row["lon"]):
        folium.CircleMarker(
            location=[row["lat"], row["lon"]],
            radius=float(row["score_potentiel"]) * 30 + 5,
            color="red",
            fill=True,
            fill_color="orange",
            fill_opacity=0.7,
            popup=folium.Popup(
                f"""<b>{row['commune']}</b><br>
                Score : {row['score_potentiel']:.2f}<br>
                Copropriétés : {int(row['nb_coproprietes'])}<br>
                Lots habitation : {int(row['total_lots_habitation'])}""",
                max_width=200
            ),
            tooltip=row["commune"]
        ).add_to(carte)

print(top10_carte[["commune", "lat", "lon"]].to_string())

carte.save("carte_potentiel_parkshare.html")
