# INRY-Biblio

Plateforme éducative algérienne — HTML/CSS/JS vanilla, multi-langues (FR/AR/EN), inspirée de dzexams.com.

## 📁 Structure

```
inry-biblio/
├── index.html          → Page d'accueil (hero, niveaux, matières, BAC/BEM en vedette)
├── library.html         → Bibliothèque complète avec filtres (niveau, filière, matière, type, année)
├── assistant.html        → Chat "Assistant pédagogique algérien" (IA configurable)
├── admin.html           → Panneau admin : gestion des clés API (Claude / GPT / Gemini)
├── data/
│   ├── db.json          → Toutes les données : niveaux, filières, matières, documents
│   └── i18n.json        → Traductions de l'interface (fr / ar / en)
├── css/
│   ├── tokens.css       → Design system (couleurs, typo, header)
│   ├── components.css   → Hero, cartes, filtres, modal, footer
│   └── assistant-admin.css → Styles du chat et du panneau admin
└── js/
    ├── i18n.js          → Système de langue + état global (APP)
    ├── icons.js          → Bibliothèque d'icônes SVG inline
    ├── layout.js         → Header / footer / modal de prévisualisation
    ├── documents.js      → Rendu des cartes + moteur de filtrage
    ├── admin.js          → Gestion des clés API (localStorage)
    └── assistant.js      → Appel direct aux APIs Claude/OpenAI/Gemini
```

## 🗂️ Gérer les documents depuis l'administration (NOUVEAU)

Le panneau admin (`admin.html`) a maintenant un onglet **"Documents"** qui permet de :

- **Ajouter** un nouveau document via un formulaire complet (titres FR/AR/EN, niveau, filière, matière, type, année, wilaya, liens preview/téléchargement, hébergeur)
- **Modifier** n'importe quel document existant (clic sur l'icône ⚙️ dans le tableau)
- **Supprimer** un document (clic sur l'icône 🗑️, avec confirmation)
- **Rechercher** dans le tableau pour retrouver un document à éditer rapidement

### Comment ça marche techniquement

Le site est 100% statique (pas de serveur/base de données), donc le navigateur ne peut pas réécrire le fichier `data/db.json` sur le disque. Le système fonctionne ainsi :

1. Tes ajouts/modifications/suppressions sont enregistrés dans le **localStorage de ton navigateur**.
2. Sur `index.html` et `library.html`, ces changements sont automatiquement **fusionnés** avec les documents originaux de `db.json` au chargement de la page — donc dans **ton propre navigateur**, tout fonctionne immédiatement comme si la base avait été modifiée.
3. ⚠️ **Mais** ces changements restent locaux à ton navigateur. Un autre visiteur (ou toi sur un autre appareil/navigateur) ne les verra pas, puisqu'ils ne sont jamais écrits dans le fichier `db.json` réel sur le serveur.

### Rendre les changements permanents pour TOUS les visiteurs

Dans l'onglet Documents, clique sur **"Exporter db.json"** : ça télécharge un fichier `db.json` à jour contenant tous tes documents (originaux + tes ajouts/modifications, moins tes suppressions). Il suffit ensuite de :

1. Remplacer le fichier `data/db.json` actuel par celui téléchargé
2. Re-déployer/uploader le site avec ce nouveau fichier

Après ça, tous les visiteurs verront les changements — pas seulement ton navigateur.

### Pour une vraie solution multi-utilisateurs en temps réel

Si tu veux que les changements faits dans l'admin soient visibles **immédiatement par tous** sans passer par cette étape d'export manuel, il faut un vrai backend avec une base de données (ou un service comme Firebase, Supabase, etc.) à la place du `db.json` statique. Dis-moi si tu veux qu'on passe à cette architecture.

## 🔑 Clés API — modèle libre, modification, suppression

- Le champ **"Modèle"** est maintenant un champ texte libre : tape n'importe quel nom de modèle (`claude-opus-4-7`, `gpt-4o`, `gemini-2.5-pro`, ou autre chose) — il n'y a plus de liste fermée qui te limite.
- Un 4ème fournisseur **"Autre (compatible OpenAI)"** est disponible : tu fournis toi-même l'URL de l'API (endpoint), utile pour n'importe quel service qui imite le format `chat/completions` d'OpenAI (LM Studio, Ollama avec proxy, OpenRouter, etc.)
- Chaque clé enregistrée affiche maintenant deux boutons : **⚙️ Modifier** (recharge la clé dans le formulaire pour la modifier) et **🗑️ Supprimer**.
- Les clés enregistrées apparaissent dans l'onglet **"Clés API"** de l'administration, section "Clés enregistrées" tout en haut.

## ⚠️ Si une mise à jour ne semble "pas s'appliquer"

Les navigateurs mettent en cache agressivement les fichiers `.js` et `.css`. Si après une mise à jour du site tu vois encore l'ancien comportement (boutons manquants, listes vides, etc.) :

1. Vérifie que tu as bien **remplacé tous les fichiers** (pas juste certains) par la nouvelle version
2. Fais un **rechargement forcé** : `Ctrl+Maj+R` (Windows/Linux) ou `Cmd+Maj+R` (Mac)
3. Ou ouvre le site en **navigation privée** pour éliminer tout cache
4. Ouvre la console développeur (`F12` → onglet "Console") : si un fichier essentiel manque, un message d'erreur explicite y apparaîtra désormais au lieu d'un échec silencieux

Depuis cette version, tous les fichiers CSS/JS sont chargés avec un paramètre de version (`?v=...`) dans les balises `<script>`/`<link>`, ce qui force normalement le navigateur à toujours récupérer la dernière version du fichier plutôt que de servir une copie en cache.

## 🎓 Niveaux scolaires complets

Le système couvre maintenant l'intégralité du parcours scolaire algérien :

- **Préscolaire**
- **Primaire** : 1ère à 5ème année (1AP à 5AP)
- **Moyen** : 1ère à 4ème année (1AM à 4AM / BEM)
- **Secondaire** : 1ère à 3ème année (1AS à 3AS / BAC)

## 🗺️ Wilayas (69)

Le champ "Wilaya" dans le formulaire d'ajout/modification de document est maintenant une **liste déroulante pré-remplie avec les 69 wilayas officielles d'Algérie** (selon la réorganisation territoriale d'avril 2026, loi n°26-06), classées par numéro de code officiel (01 — Adrar à 69 — El Abiodh Sidi Cheikh). Tu peux aussi choisir "National" pour un sujet officiel (BAC/BEM) ou laisser vide pour un cours général sans ancrage régional.

## 🔍 Messages d'erreur de l'assistant IA — plus précis

Si l'assistant IA renvoie une erreur, le message affiché inclut maintenant **le détail exact retourné par le fournisseur** (ex: "invalid x-api-key") plutôt qu'un simple code HTTP, ainsi qu'un conseil contextuel selon le type d'erreur :

- **401** : la clé API est refusée — vérifie qu'elle est bien copiée sans espace, qu'elle n'a pas expiré, et que le compte a accès à ce fournisseur
- **404** : le nom du modèle est probablement incorrect ou n'existe pas chez ce fournisseur
- **429** : la limite de requêtes ou le crédit disponible est dépassé

## 📅 Système trimestriel algérien

Le formulaire d'ajout/modification de document a maintenant un champ **Trimestre** (1er / 2ème / 3ème, ou aucun), et les types de documents distinguent maintenant clairement :

- **Devoir** : contrôle court et fréquent
- **Composition** : examen de fin de trimestre

au lieu d'un seul type générique "Devoirs" comme avant. Le filtre de la bibliothèque (`library.html`) permet aussi de filtrer par trimestre.

## 🔑 Pourquoi le champ "Modèle" est-il demandé ?

Chaque fournisseur d'IA (Anthropic, OpenAI, Google) a besoin de savoir **exactement quel modèle utiliser** à chaque appel — il n'existe pas de modèle "par défaut" universel côté serveur. Pour te simplifier la vie :

- Le champ se **pré-remplit automatiquement** avec une valeur par défaut sûre dès que tu choisis un fournisseur (tu peux la garder telle quelle)
- Un lien **"Voir la liste des modèles disponibles"** apparaît sous le champ et t'amène directement à la documentation officielle du fournisseur choisi
- Tu peux toujours taper n'importe quel autre nom de modèle si tu sais ce que tu veux

## 🧹 Nettoyage automatique des clés API (corrige les erreurs 401 dues à un copier-coller imparfait)

Une cause fréquente d'erreur "401 — invalid x-api-key" est un caractère invisible resté collé à la clé après un copier-coller (espace, tabulation, retour à la ligne, ou caractère Unicode invisible provenant d'un PDF ou d'une page web). Désormais, toute clé API est **automatiquement nettoyée** de ces caractères, à la fois au moment de l'enregistrement dans l'administration et au moment de l'appel à l'IA — donc même une ancienne clé déjà enregistrée avec ce problème fonctionnera correctement maintenant.

Un avertissement (non bloquant) s'affiche aussi si le format de la clé ne correspond pas à ce qu'on attend généralement pour ce fournisseur (ex : une clé Anthropic commence normalement par `sk-ant-`), pour t'aider à repérer une erreur de copie avant même d'essayer.

**Si tu obtiens encore une erreur 401 après cette mise à jour**, le nouveau message d'erreur affichera le détail exact renvoyé par le fournisseur — dans ce cas, la clé est probablement réellement invalide, expirée, ou le compte associé n'a pas accès/crédit pour ce modèle. Il faut alors générer une nouvelle clé sur le site du fournisseur (ex: console.anthropic.com → API Keys).

## 🚀 Lancer le site

Comme le site charge des fichiers JSON via `fetch()`, il faut un petit serveur local (pas juste double-cliquer sur `index.html`) :

```bash
cd inry-biblio
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

Ou avec Node : `npx serve .`

## ✏️ Ajouter / modifier des documents

Tout est dans `data/db.json`. Chaque document suit ce modèle :

```json
{
  "id": "doc-0031",
  "title": { "fr": "...", "ar": "...", "en": "..." },
  "level": "s3",            // id d'une année dans "levels"
  "stream": "sciences",      // id d'une filière (ou null)
  "subject": "math",         // id d'une matière
  "type": "bac-bem",         // cours | exercices | devoirs | examens | corriges | resumes | bac-bem
  "year": 2024,
  "wilaya": "National",
  "description": { "fr": "...", "ar": "...", "en": "..." },
  "fileType": "pdf",
  "pages": 4,
  "size": "1.2 MB",
  "previewUrl": "https://drive.google.com/file/d/XXXX/preview",
  "downloadUrl": "https://drive.google.com/uc?export=download&id=XXXX",
  "host": "drive",           // drive | mega
  "downloads": 0,
  "rating": 4.5,
  "tags": ["bac2024"]
}
```

**Pour Google Drive** : l'URL de preview doit être au format `https://drive.google.com/file/d/ID_FICHIER/preview` (fonctionne dans une iframe). L'URL de téléchargement : `https://drive.google.com/uc?export=download&id=ID_FICHIER`.

**Pour Mega** : utiliser le lien d'intégration `https://mega.nz/embed/...` pour la preview, et le lien normal `https://mega.nz/file/...` pour le téléchargement.

⚠️ Les liens actuellement dans `db.json` sont des **exemples réalistes** (IDs fictifs) — il faut les remplacer par tes vrais liens Drive/Mega une fois les documents uploadés.

## 🤖 Configurer l'assistant IA (panneau admin)

1. Aller sur `admin.html`
2. Mot de passe par défaut : **`inry2026`** (à changer dans `js/admin.js`, ligne `ADMIN_PASSWORD`)
3. Choisir un fournisseur (Anthropic / OpenAI / Google), coller la clé API, sauvegarder
4. La clé devient active automatiquement (sinon clic sur "Définir comme actif")
5. Le prompt système (le rôle "assistant pédagogique algérien") est modifiable dans la même page

### ⚠️ Important — sécurité des clés API

Actuellement, les clés API sont stockées dans le `localStorage` du navigateur et les appels API se font **directement depuis le navigateur de l'utilisateur final**. C'est pratique pour tester, mais :

- **N'importe qui ouvrant les outils développeur du navigateur peut voir la clé API.**
- Si tu déploies ce site publiquement avec une vraie clé payante, n'importe quel visiteur peut l'utiliser et te faire consommer ton crédit.

**Pour une mise en production sérieuse**, il faut déplacer l'appel API vers un petit serveur backend (Node/PHP/Cloudflare Worker) qui garde la clé secrète côté serveur, et faire en sorte que le frontend appelle ce backend à la place. Je peux te construire ce backend si tu veux passer à cette étape.

## 🌍 Langues

Le site bascule entre français, arabe (avec RTL automatique) et anglais via les boutons FR / ع / EN dans le header. La préférence est sauvegardée dans `localStorage`.

## 🎨 Thème clair/sombre

Bouton soleil/lune dans le header, sauvegardé aussi en `localStorage`.
