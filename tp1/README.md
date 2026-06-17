# TP1 — Audit Web & API (OWASP crAPI)

Audit de sécurité structuré de la plateforme d'entraînement **OWASP crAPI**,
**en lab local** et en **exploitation contrôlée**.

> Énoncé complet : [`CLAUDE.md`](CLAUDE.md).

## Cible

OWASP crAPI (service automobile connecté : SPA + microservices identity /
community / workshop + JWT), déployée via Docker sur `http://localhost:8888`
(MailHog : `http://localhost:8025`).

## Déployer la cible

```bash
cd tp1/crapi
docker compose --compatibility up -d      # ~10 conteneurs
# Attendre que crapi-web réponde sur http://localhost:8888
```

Puis créer deux comptes (User A / User B) via l'UI ou l'API de signup.

## Livrables

| Fichier | Contenu |
|---------|---------|
| [`PERIMETRE.md`](PERIMETRE.md) | cadrage : cible, comptes, outils, tests interdits |
| [`CARTOGRAPHIE.md`](CARTOGRAPHIE.md) | architecture, endpoints, zones prioritaires |
| [`scripts/audit.sh`](scripts/audit.sh) | tests rejouables (curl) — JWT, BOLA, NoSQLi, headers, SSRF |
| [`scripts/wordlist-api.txt`](scripts/wordlist-api.txt) | wordlist pour discovery `ffuf` |
| [`RAPPORT-AUDIT.md`](RAPPORT-AUDIT.md) | vulnérabilités triées par criticité (preuve / impact / remédiation) |

## Rejouer l'audit

```bash
# tokens obtenus via /identity/api/auth/login
BASE=http://localhost:8888 TOKEN_A="<jwt A>" TOKEN_B="<jwt B>" \
  bash tp1/scripts/audit.sh
```

## Résultats (prouvés en live)

- **V1 Critique — JWT `alg:none`** : token forgé sans signature accepté → usurpation
  de n'importe quel compte (dashboard de la victime renvoyé en `HTTP 200`).
- **V2 Élevée — BOLA** rapports mécaniciens (`report_id` 1,2,3 → 200) : fuite PII (email, tél, VIN).
- **V3 Élevée — Injection NoSQL** coupon (`{"$ne":null}`) → coupon valide sans code.
- **V4 Élevée — Excessive data exposure** (PII d'autrui dans les réponses).
- **V5 Moyenne — Information disclosure** : erreur Spring verbeuse au login.
- **V6 Moyenne — Misconfiguration** : CSP & HSTS absents, version serveur exposée.

> Cadre éthique respecté : aucun test destructif, aucune cible hors `localhost`.
