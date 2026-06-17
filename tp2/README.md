# TP2 — Audit méthodologique (Pentest web/API)

Audit de sécurité structuré d'une application web/API, **en lab autorisé** et en
**exploitation contrôlée**.

> Énoncé complet : [`CLAUDE.md`](CLAUDE.md).

## Cible

L'application de lab du **TP3** (`tp3/vulnerable`) — Express / API REST / JWT,
lancée sur `http://localhost:3000`. Audit **gris** (boîte noire + lecture du code).

## Livrables

| Fichier | Contenu |
|---------|---------|
| [`PERIMETRE.md`](PERIMETRE.md) | cadrage : cible, comptes, rôles, tests interdits, limites |
| [`CARTOGRAPHIE.md`](CARTOGRAPHIE.md) | endpoints, méthodes, auth, rôle, sensibilité, zones prioritaires |
| [`scripts/audit.sh`](scripts/audit.sh) | tests rejouables (curl) — auth, autorisation, entrées, config |
| [`RAPPORT-AUDIT.md`](RAPPORT-AUDIT.md) | 10 vulnérabilités triées par criticité, avec preuve / impact / correction |

## Rejouer l'audit

```bash
# 1) Lancer la cible
cd tp3/vulnerable && npm install && npm start    # http://localhost:3000

# 2) Dans un autre terminal, rejouer les tests
bash tp2/scripts/audit.sh
```

## Résumé des résultats

- **3 critiques** : Mass Assignment, injection NoSQL (bypass auth), injection SQL.
- **4 élevées** : Broken Access Control, IDOR/BOLA, XSS stocké, mot de passe en clair.
- **3 moyennes** : faiblesses JWT (pas d'`exp`), fuite d'info (stack trace), config (CORS `*`, headers absents).
- **1 contrôle conforme** : la signature JWT est bien vérifiée (token altéré → `401`).

Les corrections correspondantes sont implémentées et **testées** dans
[`../tp3/secure`](../tp3/secure) — la boucle audit → remédiation → validation est complète.
