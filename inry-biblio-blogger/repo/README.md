# INRY-Biblio — Thème Blogger

Thème Blogger monolithique pour la bibliothèque numérique scolaire algérienne **INRY-Biblio**.

## Structure

```
inry-biblio-blogger/
├── inry-biblio-blogger-theme.xml    ← Thème Blogger (monolithique)
└── repo/
    ├── css/
    │   ├── tokens.css               ← Palette kraft-paper, typo Fraunces
    │   ├── components.css           ← Hero, cards, filters, modals, footer
    │   └── assistant-admin.css      ← Chat UI + admin panel
    ├── js/
    │   ├── i18n.js                  ← APP global, loadData(), t()
    │   ├── icons.js                 ← SVG icons
    │   ├── layout.js                ← Header/footer render (adapté INRY)
    │   ├── documents.js             ← Cards, filters, library page
    │   ├── admin.js                 ← Admin panel
    │   ├── assistant.js             ← AI chat
    │   └── doc-manager.js           ← Doc CRUD
    └── data/
        ├── db.json                  ← Base de données
        ├── i18n.json                ← Traductions (fr/ar/en)
        └── keys.json                ← [] (vide)
```

## Déploiement

### 1. Pousser les assets sur GitHub

Créez un repository GitHub (ex: `inry-biblio-assets`) et poussez le dossier `repo/` :

```bash
git init inry-biblio-assets
cp -r repo/* inry-biblio-assets/
cd inry-biblio-assets
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/VOTRE_USER/inry-biblio-assets.git
git push -u origin main
```

### 2. Mettre à jour les URLs CDN

Dans `inry-biblio-blogger-theme.xml`, remplacez `droidapk1002-beep` par votre nom d'utilisateur GitHub :

```
https://cdn.jsdelivr.net/gh/VOTRE_USER/inry-biblio-assets@main/repo/
```

### 3. Installer le thème sur Blogger

1. Allez dans **Blogger > Thème > Modifier HTML**
2. Collez le contenu de `inry-biblio-blogger-theme.xml`
3. Cliquez sur **Enregistrer**

### 4. Données

Les données (`db.json`, `i18n.json`) sont servies via jsDelivr CDN. Pour modifier les documents, éditez `repo/data/db.json` et poussez sur GitHub.

## Fonctionnalités

- **SPA hash-based** : `#home`, `#library`, `#assistant`, `#admin`
- **Multi-langue** : FR / AR (RTL) / EN
- **Dark mode** : toggle sombre/clair
- **Assistant IA** : OpenAI, Anthropic, Google Gemini
- **Admin panel** : gestion des documents, clés API, mot de passe
- **Palette kraft-paper** : beige, vert tampon, or
