# EEMI — Sécurité

Dépôt regroupant les travaux pratiques de sécurité. Chaque TP est isolé dans son
propre sous-dossier.

## Travaux pratiques

| TP | Sujet | Dossier | Énoncé |
|----|-------|---------|--------|
| **TP3** | Secure Coding — corriger une app vulnérable (IDOR, injections, XSS, mass assignment, auth, headers, fuite d'info) | [`tp3/`](tp3/) | [`tp3/CLAUDE.md`](tp3/CLAUDE.md) |
| **TP4** | DevSecOps — pipeline CI/CD de sécurité (SAST, SCA, Secret Scanning, DAST, quality gates) | [`tp4/`](tp4/) | [`tp4/CLAUDE.md`](tp4/CLAUDE.md) |

## Organisation

- Tout est sur la branche **`main`** ; chaque TP est un sous-dossier autonome.
- Les TP qui comparent une version « attaquable » et une version « corrigée »
  utilisent des sous-dossiers `vulnerable/` et `secure/` (plutôt que des branches),
  pour que tout soit visible d'un coup.
- Le pipeline CI (TP4) est dans [`.github/workflows/`](.github/workflows/).
