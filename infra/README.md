# Infrastructure Parkshare

[cite_start]Ce dossier contient l'infrastructure conteneurisée du projet Parkshare, incluant la base de données, le reverse proxy et le dashboard[cite: 90].

## Variables d'environnement nécessaires
[cite_start]Copiez le fichier `.env.example` pour créer un fichier `.env` à la racine de `/infra/` et remplissez les valeurs[cite: 104, 114]:
- `DB_USER` : Utilisateur de la base de données
- `DB_PASSWORD` : Mot de passe de la base de données
- `DB_NAME` : Nom de la base de données
- `DOMAIN_NAME` : Nom de domaine ou IP du serveur
- `ACME_EMAIL` : Email pour le certificat Let's Encrypt (HTTPS)
- `APP_PORT` : Port interne de l'application dashboard

## Comment déployer
[cite_start]L'ensemble de la stack se lance avec une seule commande:
```bash
docker compose up -d --build