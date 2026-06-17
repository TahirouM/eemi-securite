# Périmètre de l'audit — OWASP crAPI

> ⚠️ Cible **volontairement vulnérable** conçue par l'OWASP pour l'apprentissage,
> déployée **en local**. Exploitation **contrôlée**. Aucun test destructif, aucun
> test hors `localhost`.

## Cible

| Élément | Valeur |
|---------|--------|
| Application | OWASP crAPI (completely ridiculous API) — service automobile connecté |
| URL web | `http://localhost:8888` |
| MailHog (OTP / mails) | `http://localhost:8025` |
| Architecture | SPA (frontend) + microservices : `identity`, `community`, `workshop`, `chatbot` |
| Bases | PostgreSQL (identity), MongoDB (community) |
| Auth | JWT (Bearer) |
| Déploiement | `tp1/crapi/docker-compose.yml` (officiel OWASP) |

## Comptes de test

Créés via le formulaire d'inscription (vérification e-mail via MailHog) :

| Compte | Email | Rôle |
|--------|-------|------|
| User A | `userA@example.com` | user |
| User B | `userB@example.com` | user |
| Mécanicien | (compte mécanicien fourni par crAPI) | mechanic |

> La création des comptes et la récupération de l'OTP se font via l'UI + MailHog
> (`localhost:8025`). Le script d'audit prend ensuite les JWT en variables.

## Outils

Navigateur + DevTools, Burp Suite (interception/Repeater), OWASP ZAP (spider
passif), Postman, `jwt.io` (décodage), `ffuf` (discovery léger). Équivalents
reproductibles fournis en `curl` dans [`scripts/audit.sh`](scripts/audit.sh).

## Tests interdits (respectés)

- ❌ Destruction / altération massive de données
- ❌ Déni de service (DoS)
- ❌ Scans agressifs / brute-force lourd
- ❌ Toute requête vers une ressource **externe** réelle (y compris en test SSRF)

## Limites

Exploitation **contrôlée** : prouver chaque faille avec un impact minimal
(une requête, comptes de test). Pour le SSRF, ne viser que des cibles **internes
au lab**.
