# TP DevSecOps — Pipeline CI/CD de sécurité

Pipeline GitHub Actions exécutant automatiquement des contrôles de sécurité sur
une application **Node.js / Express**, avec des **quality gates bloquants** sur
les failles critiques.

## Outils intégrés

| Catégorie | Outil | Rôle |
|-----------|-------|------|
| **SCA** | `npm audit` | Vulnérabilités des dépendances |
| **SAST** | Semgrep | Patterns dangereux dans le code source |
| **Secret Scanning** | Gitleaks | Secrets exposés dans le dépôt |
| **DAST** | OWASP ZAP | Tester l'application en fonctionnement |
| **Quality Gates** | GitHub Actions | Faire échouer le pipeline sur faille critique |

## Branches

| Branche | Contenu | Pipeline attendu |
|---------|---------|------------------|
| `main` | base neutre | passe ✅ |
| `vulnerable` | failles intentionnelles (eval, command injection, secret hardcodé, dépendance CVE) | **échoue** ❌ |
| `secure` | corrections (execFile, validation, helmet, secrets en variables d'env) | passe ✅ |

## Démarrage local

```bash
npm install
cp .env.example .env   # puis renseigner des valeurs locales
npm start              # écoute sur http://localhost:3000
npm test
```

## Le pipeline

Le workflow se trouve dans [`.github/workflows/security.yml`](.github/workflows/security.yml).
Il s'exécute sur chaque `push` et `pull_request`.

## Faux positifs justifiés (branche `secure`)

| Outil | Règle | Justification |
|-------|-------|---------------|
| Semgrep | `express-check-csurf-middleware-usage` | API en lecture seule (GET), sans cookie de session → CSRF non applicable. Supprimé via `// nosemgrep` documenté. |
| Semgrep | `xss.direct-response-write` | Sortie de `/calc` toujours numérique (`Number()` + rejet `NaN`) → pas de vecteur XSS. Supprimé via `// nosemgrep` documenté. |
| Gitleaks | `stripe-access-token` (CLAUDE.md) | Clé d'exemple **pédagogique** du sujet, pas un vrai secret. Ignorée via `.gitleaksignore` (fingerprint précis). |

## Limites

- Le baseline scan ZAP est passif/léger : il ne remplace pas un scan actif ni un pentest manuel.
- `npm audit` ne couvre que les CVE connues et publiées.
- Le SAST génère des faux positifs : ils doivent être triés et justifiés.
- Un secret déjà poussé reste dans l'historique Git : suppression ≠ sécurité, il faut **régénérer**.
- Les gates bloquent le merge mais ne garantissent pas l'absence totale de vulnérabilité.
