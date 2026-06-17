# Cartographie de l'application

Surface d'attaque relevée (boîte noire + lecture du code `tp3/vulnerable/src/app.js`).

## Endpoints

| Endpoint | Méthode | Auth requise | Rôle attendu | Paramètres | Sensible |
|----------|---------|--------------|--------------|------------|----------|
| `/api/login` | POST | Non | Public | `email`, `password` (body JSON) | Oui — auth |
| `/api/users/search` | GET | **Non** | Public | `email` (query) | Oui — accès données users |
| `/api/orders/:id` | GET | Oui (JWT) | Owner | `:id` | Oui — données commande |
| `/api/admin/users` | GET | Oui (JWT) | **Admin** | — | Oui — liste users + soldes |
| `/api/me` | PUT | Oui (JWT) | User | body JSON (profil) | Oui — modif profil |
| `/api/comments` | POST | Non | Public | `author`, `body` | Oui — stockage contenu |
| `/comments` | GET | Non | Public | — | Oui — rendu HTML des commentaires |
| `/api/boom` | GET | Non | Public | — | Non (route de test → fuite d'info) |

## Authentification / session

- **Type :** JWT signé HS256, transmis via header `Authorization: Bearer`.
- **Contenu observé :** `{ "id": <int>, "role": "<user|admin>", "iat": ... }`.
- **Points notables (à tester en Phase 2) :** pas de champ `exp`, le **rôle est
  porté par le token**, signature à valider côté serveur.

## Zones à tester en priorité

1. `/api/login` — bypass d'authentification (injection NoSQL), robustesse JWT.
2. `/api/orders/:id` — contrôle d'ownership (IDOR/BOLA).
3. `/api/admin/users` — contrôle de rôle (escalade / broken access control).
4. `/api/me` — mass assignment (élévation de privilège via `role`/`balance`).
5. `/api/users/search` — injection SQL.
6. `/comments` — XSS stocké.
7. `/api/boom` + config globale — fuite d'information, headers, CORS.
