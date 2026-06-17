# Périmètre de l'audit (cadrage)

> ⚠️ Audit réalisé en **lab autorisé**, sur une application de démonstration
> exécutée en local. Exploitation **contrôlée** uniquement. Aucun test
> destructif.

## Cible

| Élément | Valeur |
|---------|--------|
| Application | App de lab du TP3 (`tp3/vulnerable`) — Express / Node.js |
| URL cible | `http://localhost:3000` |
| Type | Interface web + API REST + authentification JWT |
| Code source | Disponible (audit **gris** : boîte noire + lecture du code) |

## Comptes fournis

| Compte | Email | Mot de passe | Rôle |
|--------|-------|--------------|------|
| User A | `alice@example.com` | `alicepw` | `user` |
| User B | `bob@example.com` | `bobpw` | `user` |
| Admin | `admin@example.com` | `adminpw` | `admin` |

## Rôles disponibles

`public` (non authentifié) · `user` · `admin`

## Outils

Navigateur + DevTools, `curl`, Node `fetch`, `jwt.io` (décodage JWT), Postman.
Burp/ZAP utilisables pour interception/rejeu (équivalent reproduit ici en `curl`).

## Tests interdits (respectés)

- ❌ Déni de service (DoS)
- ❌ Suppression / altération massive de données
- ❌ Scan agressif / brute-force lourd
- ❌ Toute action hors de la cible `localhost:3000`

## Limites

Exploitation **contrôlée uniquement** : on prouve l'existence d'une faille avec
le minimum d'impact (une requête, un compte de test), sans exfiltration réelle
ni dommage. Objectif : **comprendre, prouver, mesurer, corriger**.
