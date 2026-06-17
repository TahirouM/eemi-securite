# TP DevSecOps — Pipeline CI/CD de sécurité

> Fichier d'instructions destiné à **Claude Code**.
> Objectif : construire pas à pas un pipeline CI/CD GitHub Actions qui exécute
> automatiquement des contrôles de sécurité (SAST, SCA, Secret Scanning, DAST)
> avec des **quality gates** bloquants sur les failles critiques.

---

## 0. Contexte et objectif

Mettre en place un pipeline CI/CD qui exécute **automatiquement** des contrôles
sécurité sur un projet **Node.js**, et qui **bloque** le merge/déploiement si une
faille critique est détectée.

Outils à intégrer :

| Catégorie | Outil | Rôle |
|-----------|-------|------|
| **SCA** (Software Composition Analysis) | `npm audit` | Vulnérabilités des dépendances |
| **SAST** (Static Application Security Testing) | Semgrep | Patterns dangereux dans le code source |
| **Secret Scanning** | Gitleaks | Secrets exposés dans le dépôt |
| **DAST** (Dynamic Application Security Testing) | OWASP ZAP | Tester l'app en fonctionnement |
| **Quality Gates** | GitHub Actions | Faire échouer le pipeline sur faille critique |

**Objectif pédagogique :** comprendre comment automatiser la détection des
vulnérabilités **avant merge ou déploiement**.

**Message clé :** un pipeline qui *alerte sans bloquer* peut être ignoré.
Les règles bloquantes forcent la correction. Le pipeline n'a pas besoin d'être
parfait : il doit être **cohérent, fonctionnel et justifié**.

---

## 1. Comment utiliser ce fichier avec Claude Code

Travaille phase par phase, dans l'ordre. À chaque phase :

1. Crée/modifie les fichiers demandés.
2. Lance les commandes de vérification locales si l'environnement le permet.
3. Coche la checklist correspondante (section finale).
4. Demande confirmation avant de passer à la phase suivante si un choix
   d'architecture est nécessaire (ex. port de l'app, framework).

Hypothèses par défaut (à adapter au vrai projet de l'étudiant) :
- Application **Node.js / Express** qui écoute sur le **port 3000**.
- Commande de démarrage : `npm start`.
- Deux branches : `vulnerable` (failles intentionnelles) et `secure` (corrigée).

> ⚠️ Si le projet réel diffère (autre port, autre framework, autre commande de
> démarrage), adapte : commande de démarrage, port, variables d'environnement,
> seuil de blocage.

---

## 2. Structure de dépôt attendue

```
project/
├── src/
│   └── app.js              # code de l'application
├── package.json
├── package-lock.json
├── .env                    # JAMAIS commité
├── .env.example            # modèle sans secret réel
├── .gitignore
├── README.md
└── .github/
    └── workflows/
        └── security.yml    # le pipeline de sécurité
```

---

## PHASE 1 — Préparer le repo

### Objectif
Avoir un dépôt Git propre, démarrable localement, avec deux branches et un
workflow GitHub Actions.

### À faire

1. **Initialiser le dépôt** (s'il n'existe pas) :
   ```bash
   git init
   git branch -M main
   ```

2. **Créer le `.gitignore`** (essentiel pour ne pas committer de secrets) :
   ```gitignore
   node_modules/
   .env
   .env.local
   *.log
   coverage/
   dist/
   .DS_Store
   ```

3. **Créer `.env.example`** (modèle commité, sans vraie valeur) :
   ```dotenv
   PORT=3000
   API_KEY=changeme
   DB_PASSWORD=changeme
   ```

4. **Créer `.env`** (local, NON commité — vérifier qu'il est bien ignoré) :
   ```dotenv
   PORT=3000
   API_KEY=une_vraie_cle_locale
   DB_PASSWORD=un_vrai_mdp_local
   ```

5. **Créer `package.json`** minimal :
   ```json
   {
     "name": "tp-devsecops",
     "version": "1.0.0",
     "scripts": {
       "start": "node src/app.js",
       "test": "node --test"
     },
     "dependencies": {
       "express": "^4.19.2",
       "dotenv": "^16.4.5"
     }
   }
   ```

6. **Créer le squelette du workflow** `.github/workflows/security.yml`
   (le contenu complet est en section « Pipeline complet »).

7. **Créer les deux branches** :
   ```bash
   git add .
   git commit -m "chore: base project"
   git checkout -b vulnerable     # contiendra les failles intentionnelles
   git checkout -b secure         # contiendra les corrections
   ```

### À vérifier avant de continuer
- [ ] Le projet démarre localement : `npm install && npm start`.
- [ ] Les dépendances s'installent avec `npm ci` (nécessite `package-lock.json`).
- [ ] Le `.env` **n'est pas** suivi par Git : `git status --ignored` doit le
      lister comme ignoré ; `git ls-files | grep .env` ne doit **rien** renvoyer
      (sauf `.env.example`).
- [ ] Le repo contient `.github/workflows/security.yml`.
- [ ] Les branches `vulnerable` et `secure` existent.

---

## PHASE 2 — SCA avec npm audit

### Objectif
Analyser les dépendances Node.js à la recherche de CVE connues.

### Commandes
```bash
# Audit complet (informatif)
npm audit

# Audit bloquant : sort en code != 0 si une faille >= high est trouvée
npm audit --audit-level=high

# Rapport JSON exploitable
npm audit --json > npm-audit-report.json
```

### À faire
1. Lancer le scan localement.
2. Identifier les vulnérabilités (nombre, criticité, paquet concerné).
3. Corriger si possible : `npm audit fix` ou `npm audit fix --force`
   (attention : `--force` peut casser des versions majeures, à vérifier).
4. Ajouter l'étape dans GitHub Actions.

### Étape GitHub Actions
```yaml
- name: SCA - npm audit
  run: npm audit --audit-level=high
```

### Pour la branche `vulnerable`
Pour générer une alerte volontairement, épingler une version ancienne et connue
comme vulnérable, par exemple :
```bash
npm install lodash@4.17.4   # CVE connues (prototype pollution, etc.)
```

### Résultat à présenter
- Nombre de vulnérabilités.
- Criticité (low / moderate / high / critical).
- Correction appliquée **ou** justification si non corrigée.

---

## PHASE 3 — SAST avec Semgrep

### Objectif
Analyser le **code source** pour détecter des patterns dangereux.

### Commande locale
```bash
# via pip
pip install semgrep
semgrep --config auto .

# ou via Docker
docker run --rm -v "${PWD}:/src" semgrep/semgrep semgrep --config auto /src
```

### Étape GitHub Actions
```yaml
- name: SAST - Semgrep
  uses: semgrep/semgrep-action@v1
```
> Alternative robuste pour un TP (pas de token requis) :
> ```yaml
> - name: SAST - Semgrep
>   run: |
>     pip install semgrep
>     semgrep --config auto --error .   # --error fait échouer sur findings
> ```

### À rechercher
- usage dangereux de `eval()`,
- exécution de commandes système (`child_process.exec`, `spawn` avec entrée
  utilisateur non filtrée),
- injection possible (SQL, commande, path traversal),
- secrets hardcodés,
- absence de validation des entrées.

### Code volontairement vulnérable (branche `vulnerable`, `src/app.js`)
```js
const express = require('express');
const { exec } = require('child_process');
const app = express();

// ⚠️ Secret hardcodé (SAST + Gitleaks)
const API_KEY = "sk_live_1234567890abcdef";

// ⚠️ eval sur entrée utilisateur (injection de code)
app.get('/calc', (req, res) => {
  const result = eval(req.query.expr); // DANGER
  res.send(String(result));
});

// ⚠️ Command injection
app.get('/ping', (req, res) => {
  exec('ping -c 1 ' + req.query.host, (err, stdout) => { // DANGER
    res.send(stdout);
  });
});

app.listen(3000, () => console.log('listening on 3000'));
```

### Correction (branche `secure`, `src/app.js`)
```js
const express = require('express');
const { execFile } = require('child_process');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
app.use(helmet()); // headers de sécurité (utile aussi pour ZAP)

const API_KEY = process.env.API_KEY; // ✅ via variable d'environnement

// ✅ Pas d'eval : parsing contrôlé
app.get('/calc', (req, res) => {
  const a = Number(req.query.a);
  const b = Number(req.query.b);
  if (Number.isNaN(a) || Number.isNaN(b)) return res.status(400).send('Invalid');
  res.send(String(a + b));
});

// ✅ execFile + validation stricte (pas d'interpolation shell)
app.get('/ping', (req, res) => {
  const host = req.query.host;
  if (!/^[a-zA-Z0-9.-]+$/.test(host)) return res.status(400).send('Invalid host');
  execFile('ping', ['-c', '1', host], (err, stdout) => {
    if (err) return res.status(500).send('Error');
    res.send(stdout);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`listening on ${PORT}`));
```

### Résultat à présenter
- Alertes importantes (règle Semgrep déclenchée).
- Fichier concerné + ligne.
- Risque associé.
- Correction proposée.

---

## PHASE 4 — Secret Scanning avec Gitleaks

### Objectif
Détecter les secrets exposés dans le dépôt (clé API, mot de passe, token…).

### Commande locale
```bash
# Scan du contenu actuel
gitleaks detect --source . --verbose

# Scan de tout l'historique Git
gitleaks detect --source . --log-opts="--all"
```

### Étape GitHub Actions
```yaml
- name: Secret Scan - Gitleaks
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### À faire
1. Vérifier que `.env` est bien dans `.gitignore` (Phase 1).
2. Scanner le projet (et l'historique).
3. Corriger les secrets détectés : retirer du code, déplacer en variable
   d'environnement / secret GitHub.
4. **Régénérer** les secrets si nécessaire (un secret commité est compromis,
   même après suppression : il reste dans l'historique Git).

### Pour la branche `vulnerable`
- Garder `API_KEY = "sk_live_..."` hardcodé dans `src/app.js`.
- (Démonstration extrême) committer volontairement un `.env` → Gitleaks
  le détecte. **Ne jamais faire ça avec un vrai secret.**

### Résultat à présenter
- Secret détecté **ou** absence de secret.
- Correction appliquée (variable d'env, secret GitHub, régénération).
- Règle `.gitignore` mise en place.

---

## PHASE 5 — DAST avec OWASP ZAP

### Objectif
Tester l'application **en fonctionnement** (boîte noire), notamment les headers
de sécurité manquants et les vulnérabilités web.

### Étapes
1. Lancer l'application.
2. Attendre qu'elle réponde.
3. Lancer un **ZAP baseline scan**.
4. Analyser le rapport.

### Étapes GitHub Actions
```yaml
- name: Start app
  run: npm start &

- name: Wait for app
  run: npx wait-on http://localhost:3000

- name: DAST - OWASP ZAP Baseline Scan
  uses: zaproxy/action-baseline@v0.12.0
  with:
    target: 'http://localhost:3000'
    # Évite l'échec si l'action tente d'ouvrir des issues GitHub
    allow_issue_writing: false
    # cmd_options: '-a'   # inclut aussi les alertes "alpha"
```

### Résultat à présenter
- Alertes ZAP principales.
- **Headers manquants** (ex. `Content-Security-Policy`,
  `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`).
- Risques détectés.
- Corrections possibles → c'est ici que `helmet()` (branche `secure`) règle la
  majorité des alertes de headers.

---

## PHASE 6 — Quality Gates (règles bloquantes)

### Objectif
Faire **échouer** le pipeline si une faille critique est détectée.

| Contrôle | Blocage attendu | Mécanisme |
|----------|-----------------|-----------|
| `npm audit` | faille `high` ou `critical` | `npm audit --audit-level=high` (exit ≠ 0) |
| Gitleaks | secret détecté | l'action sort en erreur sur détection |
| Semgrep | alerte critique | `semgrep --error` ou findings bloquants |
| Tests | tests échoués | `npm test` (exit ≠ 0) |
| ZAP | alerte haute si configurée | seuil dans `.zap/rules.tsv` ou option d'échec |

### Comportement attendu
- Branche `vulnerable` → **le pipeline échoue** (failles détectées, gate
  bloquant). ✅ C'est le but : prouver que le gate fonctionne.
- Branche `secure` → **le pipeline passe** (failles corrigées).

### À retenir
Un pipeline qui alerte sans bloquer peut être ignoré. Les règles bloquantes
forcent la correction.

---

## Pipeline complet — `.github/workflows/security.yml`

```yaml
name: Security CI

on:
  push:
  pull_request:

permissions:
  contents: read
  security-events: write

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0          # historique complet (utile pour Gitleaks)

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      # --- SCA ---
      - name: SCA - npm audit
        run: npm audit --audit-level=high

      # --- SAST ---
      - name: SAST - Semgrep
        run: |
          pip install semgrep
          semgrep --config auto --error .

      # --- Secret Scanning ---
      - name: Secret Scan - Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # --- Tests ---
      - name: Tests
        run: npm test

      # --- DAST ---
      - name: Start app
        run: npm start &

      - name: Wait for app
        run: npx wait-on http://localhost:3000

      - name: DAST - OWASP ZAP Baseline
        uses: zaproxy/action-baseline@v0.12.0
        with:
          target: 'http://localhost:3000'
          allow_issue_writing: false
```

> **À adapter selon le projet :** la commande de démarrage (`npm start`),
> le port (`3000`), les variables d'environnement, et le seuil de blocage
> (`--audit-level`, `--error`, règles ZAP).

> 💡 Astuce pédagogique : si tu veux que les étapes en aval s'exécutent **même
> en cas d'échec** d'une étape (pour voir tous les rapports d'un coup), ajoute
> `if: always()` aux étapes concernées. Mais pour un **vrai quality gate**,
> garde le comportement bloquant par défaut.

---

## PHASE 7 — Présentation des résultats

**Format :** 7 à 10 minutes par étudiant.

**Structure attendue :**
1. Présentation du pipeline.
2. Outils intégrés.
3. Résultats des scans.
4. Problèmes détectés.
5. Corrections appliquées.
6. Quality gates définis.
7. Limites du pipeline.

**Démonstration attendue — montrer :**
- le fichier `.github/workflows/security.yml`,
- un run GitHub Actions (idéalement : `vulnerable` qui échoue, `secure` qui
  passe),
- une alerte détectée,
- une correction ou une justification.

---

## Checklist DevSecOps (à valider avant présentation)

- [ ] Branches `vulnerable` et `secure` existent
- [ ] SAST intégré (Semgrep)
- [ ] SCA intégré (npm audit)
- [ ] Secret scanning intégré (Gitleaks)
- [ ] DAST intégré (OWASP ZAP)
- [ ] Pipeline visible dans GitHub Actions
- [ ] Quality gates configurés (et démontrés : `vulnerable` échoue)
- [ ] Corrections justifiées
- [ ] Résultats présentables
- [ ] Limites du pipeline expliquées

**Message clé :** le pipeline n'a pas besoin d'être parfait. Il doit être
cohérent, fonctionnel et justifié.

---

## Erreurs fréquentes à éviter

| Erreur | Conséquence |
|--------|-------------|
| Mettre les outils sans lire les résultats | fausse sécurité |
| Ne pas bloquer les failles critiques | alertes ignorées |
| Scanner uniquement la branche principale | failles mergées |
| Ne pas scanner les dépendances | CVE non détectées |
| Garder des secrets dans Git | compromission |
| Ne pas tester l'application lancée | DAST impossible |
| Ignorer les faux positifs sans justification | perte de rigueur |

**À retenir :** un pipeline DevSecOps doit être **utile, lisible et
maintenable**.

---

## Limites du pipeline (à mentionner en présentation)

- Le **baseline scan** ZAP est passif/léger : il ne remplace pas un scan actif
  ni un pentest manuel.
- `npm audit` ne couvre que les CVE **connues et publiées**.
- Le SAST génère des **faux positifs** : ils doivent être triés et justifiés.
- Le secret scanning détecte des **patterns** : un secret au format inhabituel
  peut passer.
- Un secret déjà poussé reste dans l'**historique Git** : suppression ≠
  sécurité, il faut **régénérer**.
- Les gates bloquent le merge mais ne garantissent pas l'absence totale de
  vulnérabilité → la sécurité est un processus **d'amélioration continue**.
