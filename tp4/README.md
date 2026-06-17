# TP4 — Pipeline CI/CD de sécurité (DevSecOps)

Pipeline GitHub Actions exécutant automatiquement des contrôles de sécurité
(SAST, SCA, Secret Scanning, DAST) avec des **quality gates bloquants**.

> Énoncé complet : [`CLAUDE.md`](CLAUDE.md).

## Organisation

Ce TP compare deux états d'une même app Node.js / Express :

| Dossier | Contenu | Pipeline attendu |
|---------|---------|------------------|
| [`vulnerable/`](vulnerable/) | failles intentionnelles (eval, command injection, secret hardcodé, lodash CVE) | **échoue** ❌ |
| [`secure/`](secure/) | corrections (execFile + validation, helmet, secrets via env) | passe ✅ |

> **Note historique :** la démonstration CI a été faite via des **branches**
> `vulnerable` / `secure` (le workflow `security.yml` s'exécutant sur chaque
> branche). Ces branches ont ensuite été consolidées ici en sous-dossiers pour
> regrouper tous les TP dans un seul dépôt sur `main`. Les runs GitHub Actions
> de démonstration restent consultables :
>
> - Actions : https://github.com/TahirouM/eemi-securite/actions
> - Run `vulnerable` (rouge, toutes détections) : run #27689768753
> - Run `secure` (vert) : run #27689770741

## Outils intégrés

| Catégorie | Outil | Gate bloquant |
|-----------|-------|---------------|
| **SCA** | `npm audit --audit-level=high` | faille `high`/`critical` → exit 1 |
| **SAST** | Semgrep `--config auto --error` | finding bloquant → exit 1 |
| **Secret** | Gitleaks (`--no-git`, branche courante) | secret détecté → exit 1 |
| **DAST** | OWASP ZAP Baseline (`.zap/rules.tsv`) | alerte ≥ seuil |
| **Tests** | `npm test` | test échoué → exit 1 |

Le workflow se trouve dans [`.github/workflows/security.yml`](.github/workflows/security.yml).

## Lancer un dossier en local

```bash
cd tp4/secure      # ou tp4/vulnerable
npm install
PORT=3100 npm start   # 3000 souvent occupé en local (OrbStack) ; libre en CI
npm test
```

Voir [`secure/RESULTATS.md`](secure/RESULTATS.md) pour la synthèse des scans.
