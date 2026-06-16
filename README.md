# Linked Cards — Trello Power-Up

Power-Up Trello permettant de lier des cartes entre elles avec des relations typées, à la manière des « Linked Issues » de Jira.

Publié sur GitHub Pages : `https://gogui63.github.io/trello-plugin-linked-cards/`

---

## Fonctionnement

### Ce que fait le Power-Up

L'utilisateur peut, depuis n'importe quelle carte Trello :

- Ajouter un lien vers une autre carte en précisant la nature de la relation (bloque, parent de, duplique, etc.)
- Visualiser les cartes liées dans la section arrière de la carte, avec leur statut actuel (liste, échéance, labels, archivée…)
- Supprimer un lien existant
- Voir un badge sur la face avant de la carte indiquant le nombre de liens ou le nombre de cartes bloquantes

Lorsqu'un lien est ajouté, un **lien réciproque** est automatiquement écrit sur la carte cible via le backend (ex : si A bloque B, alors B est bloquée par A).

### Relations disponibles

| Clé | Libellé | Inverse |
|-----|---------|---------|
| `blocks` | bloque | `isBlockedBy` |
| `isBlockedBy` | est bloquée par | `blocks` |
| `parentOf` | parent de | `childOf` |
| `childOf` | enfant de | `parentOf` |
| `duplicates` | duplique | `duplicatedBy` |
| `duplicatedBy` | est dupliquée par | `duplicates` |
| `clones` | clone | `clonedBy` |
| `clonedBy` | est clonée par | `clones` |
| `relatesTo` | liée à | `relatesTo` |

### Stockage des données

Les liens sont stockés dans le `pluginData` de la carte courante via le SDK Trello, sous la clé partagée `linkedCards` :

```json
[
  {
    "id": "abc123",
    "shortLink": "abc123",
    "url": "https://trello.com/c/abc123/ma-carte",
    "relation": "blocks",
    "createdAt": "2026-06-16T10:00:00.000Z",
    "createdBy": "Prénom Nom",
    "reciprocal": true
  }
]
```

Le stockage est limité à ~3 900 octets par carte (contrainte Trello). Le plugin vérifie cette limite avant d'écrire.

---

## Architecture

```
plugin/
├── src/
│   ├── client.ts          # Point d'entrée : enregistrement des 6 capabilities Trello
│   ├── popup.ts           # Modal d'ajout / suppression de liens
│   ├── section.ts         # Section arrière de carte : liste des cartes liées résolues
│   ├── authorize.ts       # Page d'autorisation (passive avec la clé admin)
│   ├── backendClient.ts   # Client HTTP vers le backend (fetch avec credentials: include)
│   ├── linkedCards.ts     # Logique métier pure : relations, parsing, badges
│   ├── trelloStorage.ts   # Accesseurs pluginData via le SDK Trello
│   ├── config.ts          # Configuration runtime (VITE_BACKEND_BASE_URL)
│   ├── types.ts           # Types TypeScript partagés
│   ├── dom.ts             # Utilitaires DOM (qs, clear, formatDate)
│   └── styles.css         # Styles partagés
├── index.html             # Connector principal (charge client.ts)
├── popup.html             # Page du modal
├── section.html           # Page de la section arrière
├── authorize.html         # Page d'autorisation
├── public/
│   └── icon.svg           # Icône du Power-Up
├── manifest.json          # Déclaration Trello du Power-Up
├── vite.config.ts         # Build Vite — 4 points d'entrée, base /trello-plugin-linked-cards/
├── tsconfig.json
├── package.json
└── .github/
    └── workflows/
        └── deploy.yml     # CI/CD GitHub Actions → GitHub Pages
```

### Capabilities Trello enregistrées

| Capability | Rôle |
|------------|------|
| `authorization-status` | Retourne toujours `{ authorized: true }` — auth gérée côté backend |
| `show-authorization` | Popup de secours si le backend est inaccessible |
| `card-buttons` | Bouton « Linked Cards » sur la carte |
| `card-back-section` | Section arrière avec la liste des cartes liées résolues |
| `card-badges` | Badge face avant : nombre de liens ou nombre de bloquants |
| `card-detail-badges` | Badge détaillé face arrière avec libellé des relations |

### Dépendance au backend

Le plugin ne fait **aucun appel direct à l'API Trello REST**. Il délègue au backend :

- La résolution des cartes liées (nom, board, liste, statut actuel)
- L'écriture et la suppression des liens réciproques sur les cartes cibles

Si `VITE_BACKEND_BASE_URL` est vide au build, les fonctionnalités de résolution sont dégradées : les liens s'affichent avec leur shortLink uniquement.

---

## Développement local

### Prérequis

- Node.js 20+
- Un backend local en cours d'exécution (voir [linked-cards-backend](../backend/README.md))

### Installation

```bash
npm install
```

### Variables d'environnement

Créer un fichier `.env.local` à la racine du dossier `plugin/` :

```env
VITE_BACKEND_BASE_URL=http://localhost:3000
```

### Démarrer le serveur de développement

```bash
npm run dev
# Serveur disponible sur http://0.0.0.0:5173
```

Pour tester dans Trello, le Power-Up doit être enregistré avec une URL HTTPS. Utiliser [ngrok](https://ngrok.com/) pour exposer le serveur local :

```bash
ngrok http 5173
# Déclarer https://<id>.ngrok.io/trello-plugin-linked-cards/ dans le portail Trello
```

### Tests unitaires

```bash
npm test
```

Les tests couvrent la logique pure de `src/linkedCards.ts` : mapping des relations, parsing des identifiants de carte, déduplication, calcul des badges et limite de taille du `pluginData`.

### Build de production

```bash
npm run build
# Artefacts dans dist/ (HTML + JS minifiés, prêts pour GitHub Pages)
```

---

## Déploiement sur GitHub Pages

Le déploiement est automatisé via `.github/workflows/deploy.yml` : un push sur `main` déclenche le build et publie `dist/` sur la branche `gh-pages`.

### Setup initial

1. Créer le repo GitHub `gogui63/trello-plugin-linked-cards`

2. Initialiser git depuis ce dossier et pousser :
   ```bash
   git init
   git remote add origin git@github.com:gogui63/trello-plugin-linked-cards.git
   git push -u origin main
   ```

3. Dans **Settings → Pages** du repo, choisir la source : branche `gh-pages`

4. Dans **Settings → Secrets → Actions**, ajouter :

   | Secret | Valeur |
   |--------|--------|
   | `VITE_BACKEND_BASE_URL` | URL publique du backend (ex : `https://linked-cards.welyb.fr`) |

5. Pousser sur `main` → le workflow build et publie automatiquement

### URL finale

```
https://gogui63.github.io/trello-plugin-linked-cards/
```

---

## Enregistrement dans Trello

1. Se connecter sur [trello.com/power-ups/admin](https://trello.com/power-ups/admin)
2. Créer un nouveau Power-Up dans le workspace Welyb
3. Renseigner le **Connector URL** :
   ```
   https://gogui63.github.io/trello-plugin-linked-cards/
   ```
4. Activer les capabilities : `card-badges`, `card-detail-badges`, `card-buttons`, `card-back-section`, `authorization-status`, `show-authorization`
5. Récupérer l'**API Key** et générer un **Token** : les renseigner dans les secrets du backend

---

## Configuration

| Variable | Description | Requis |
|----------|-------------|--------|
| `VITE_BACKEND_BASE_URL` | URL de base du backend, sans slash final | Oui en production |

Cette variable n'est pas un secret — elle est incluse dans le bundle JavaScript public.
