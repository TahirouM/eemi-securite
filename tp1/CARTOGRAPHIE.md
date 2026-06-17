# Cartographie — OWASP crAPI

Surface relevée (observation du trafic SPA + endpoints documentés crAPI). Les
chemins exacts sont confirmés pendant la reconnaissance (DevTools → Réseau).

## Architecture

| Élément | Description |
|---------|-------------|
| Frontend | SPA (React) servie par `crapi-web`, sur `localhost:8888` |
| Microservices | `identity` (Java/Spring), `community` (Go), `workshop` (Python/Django), `chatbot` |
| Bases | PostgreSQL (identity/workshop), MongoDB (community) |
| Auth | JWT Bearer ; token obtenu via `/identity/api/auth/login` |
| Mail | MailHog (`localhost:8025`) — OTP / vérification e-mail |

## Endpoints principaux

| Endpoint | Méthode | Auth | Rôle | Sensible | Test prévu |
|----------|---------|------|------|----------|------------|
| `/identity/api/auth/signup` | POST | Non | Public | Oui | énumération users |
| `/identity/api/auth/login` | POST | Non | Public | Oui | JWT, messages d'erreur |
| `/identity/api/v2/user/dashboard` | GET | Oui | User | Oui | données exposées |
| `/identity/api/v2/vehicle/vehicles` | GET | Oui | Owner | Oui | excessive data exposure |
| `/identity/api/v2/vehicle/{id}/location` | GET | Oui | Owner | Oui | **BOLA** (GPS d'autrui) |
| `/workshop/api/mechanic/mechanic_report` | GET | Oui | Owner/Mechanic | Oui | **BOLA** (report_id incrémental) |
| `/workshop/api/merchant/contact_mechanic` | POST | Oui | User | Oui | **SSRF** (`mechanic_api`) |
| `/workshop/api/shop/orders/{id}` | GET | Oui | Owner | Oui | **BOLA** commande |
| `/community/api/v2/community/posts` | GET/POST | Oui | User | Oui | **XSS stocké** |
| `/community/api/v2/coupon/validate-coupon` | POST | Oui | User | Oui | **NoSQL injection** (`$ne`) |
| `/identity/api/v2/admin/videos` | divers | Oui | Admin | Oui | **mass assignment** / BFLA |

## Zones prioritaires

1. **JWT** : `exp`, `alg`, signature (Phase 2).
2. **BOLA** : véhicule (location GPS), rapport mécanicien, commande (Phase 3).
3. **NoSQL injection** : validation de coupon (Phase 4).
4. **XSS stocké** : posts communautaires (Phase 5).
5. **Misconfiguration / headers** (Phase 6).
6. **Mass assignment / BFLA** : fonctions admin/vidéos (Phase 7).
7. **SSRF** : `contact_mechanic` (Phase 8, cible interne uniquement).
