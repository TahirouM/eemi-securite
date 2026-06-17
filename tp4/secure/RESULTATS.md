# Résultats des scans — synthèse pour la présentation

Vérifications réalisées **localement** (Docker pour Semgrep/Gitleaks, npm pour
l'audit). En CI GitHub Actions, le même pipeline s'exécute sur chaque `push` /
`pull_request`.

## Tableau comparatif des deux branches

| Gate | Outil | Branche `vulnerable` | Branche `secure` |
|------|-------|----------------------|------------------|
| **SCA** | `npm audit --audit-level=high` | ❌ **1 critical** (lodash 4.17.4) — exit 1 | ✅ 0 vuln — exit 0 |
| **SAST** | Semgrep `--config auto --error` | ❌ **5 findings bloquants** | ✅ **0 finding** |
| **Secret** | Gitleaks | ❌ **2 secrets** (dont `sk_live_…` réel) | ✅ **0 leak** |
| **Tests** | `npm test` | ✅ 2 pass | ✅ 2 pass |
| **DAST** | OWASP ZAP baseline | ⚠️ headers manquants (pas de helmet) | ✅ headers OK (helmet) |
| **Résultat pipeline** | — | **ÉCHEC** (dès `npm audit`) | **SUCCÈS** |

## Détail branche `vulnerable`

### SCA — lodash 4.17.4 (critical)
- Prototype Pollution (plusieurs CVE), Command Injection, ReDoS, Code Injection via `_.template`.
- `npm audit --audit-level=high` → exit 1 → **gate bloquant**.

### SAST — Semgrep (5 findings)
| Fichier:ligne | Règle | Risque |
|---------------|-------|--------|
| `src/app.js:20` | `detect-eval-with-expression` | injection de code via `eval(req.query.expr)` |
| `src/app.js:20` | `code-string-concat` | exécution arbitraire via `eval` |
| `src/app.js:21` | `direct-response-write` | XSS (renvoi direct d'entrée utilisateur) |
| `src/app.js:26` | `detect-child-process` | command injection via `exec('ping … ' + host)` |

### Secret — Gitleaks (2)
- `src/app.js:7` → `API_KEY = "sk_live_…"` (secret hardcodé **réel** — le vrai problème).
- `CLAUDE.md:239` → écho du même exemple dans le sujet.

## Détail branche `secure`

### Corrections appliquées
| Faille | Correction |
|--------|------------|
| `eval()` | parsing numérique contrôlé (`Number()` + rejet `NaN`) |
| `exec()` + concat | `execFile('ping', ['-c','1', host])` + validation regex stricte du host |
| Secret hardcodé | `process.env.API_KEY` (via `.env`, jamais commité) |
| lodash CVE | dépendance retirée |
| Headers manquants | `app.use(helmet())` |

### Vérifié en local
- Headers présents : `Content-Security-Policy`, `X-Frame-Options: SAMEORIGIN`,
  `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`.
- `/calc?a=2&b=3` → `5` (pas d'eval).
- `/ping?host=8.8.8.8;rm` → **HTTP 400** (injection rejetée).

## Quality gates

Un pipeline qui *alerte sans bloquer* peut être ignoré. Ici chaque contrôle
**sort en erreur** sur faille critique (`exit ≠ 0`), ce qui fait échouer le job
GitHub Actions et **bloque le merge**. Démonstration : `vulnerable` échoue,
`secure` passe.
