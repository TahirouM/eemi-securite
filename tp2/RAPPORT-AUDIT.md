# Rapport d'audit — Application de lab (TP3 `vulnerable`)

- **Cible :** `http://localhost:3000` (Express / Node.js, API REST + JWT)
- **Type d'audit :** gris (boîte noire + lecture du code), exploitation contrôlée
- **Méthodologie :** cadrage → cartographie → auth → autorisation → entrées → config
- **Reproductibilité :** toutes les preuves ci-dessous sont rejouables via
  [`scripts/audit.sh`](scripts/audit.sh) (cible lancée au préalable).

## Synthèse — vulnérabilités par criticité

| # | Vulnérabilité | Endpoint | Criticité |
|---|---------------|----------|-----------|
| V1 | Mass Assignment → élévation de privilège | `PUT /api/me` | **Critique** |
| V2 | Injection NoSQL → bypass d'authentification | `POST /api/login` | **Critique** |
| V3 | Injection SQL → fuite de la table users | `GET /api/users/search` | **Critique** |
| V4 | Broken Access Control → route admin sans rôle | `GET /api/admin/users` | **Élevée** |
| V5 | IDOR / BOLA → lecture des données d'autrui | `GET /api/orders/:id` | **Élevée** |
| V6 | XSS stocké | `POST /api/comments` → `GET /comments` | **Élevée** |
| V7 | Faiblesses JWT (pas d'`exp`, secret faible) | global (auth) | **Moyenne** |
| V8 | Fuite d'information (stack trace) | `GET /api/boom` (global) | **Moyenne** |
| V9 | Mauvaise configuration (CORS `*`, headers absents) | global | **Moyenne** |
| V10 | Stockage de mot de passe en clair | base / `PUT /api/me` | **Élevée** |

**Contrôle positif observé :** la **signature JWT est vérifiée** côté serveur
(un token altéré renvoie `401`). C'est le seul point conforme du mécanisme d'auth.

---

## V1 — Mass Assignment (élévation de privilège) · CRITIQUE

| Élément | Détail |
|---------|--------|
| Endpoint | `PUT /api/me` |
| Cause | `req.body` complet écrit en base (aucune whitelist de champs) |
| Preuve | Avec le token de **Alice (user)** : `{"role":"admin","balance":999999}` |

Réponse :
```json
{"id":1,"email":"alice@example.com","password":"alicepw","role":"admin","displayName":"Alice","balance":999999}
```
- **Impact :** n'importe quel utilisateur devient **admin** et modifie son solde.
  La réponse expose aussi le **mot de passe en clair** (cf. V10).
- **Correction :** whitelist explicite des champs modifiables (`email`,
  `displayName`) ; `role`/`balance` jamais modifiables via cet endpoint.

## V2 — Injection NoSQL (bypass d'authentification) · CRITIQUE

| Élément | Détail |
|---------|--------|
| Endpoint | `POST /api/login` |
| Cause | `req.body.password` (objet) passé tel quel à la requête |
| Preuve | `{"email":"admin@example.com","password":{"$ne":"x"}}` → `200` + token admin |

- **Impact :** authentification en **admin sans connaître le mot de passe**.
- **Correction :** forcer `String()` sur les entrées, rejeter les clés `$`/`.`
  (type `express-mongo-sanitize`), comparer un **hash** (bcrypt).

## V3 — Injection SQL · CRITIQUE

| Élément | Détail |
|---------|--------|
| Endpoint | `GET /api/users/search?email=` |
| Cause | concaténation de l'entrée dans la requête SQL |
| Preuve | `?email=' OR '1'='1` |

Réponse : **toutes** les lignes de `users` (alice, bob, admin) sont renvoyées.
- **Impact :** contournement du filtre, fuite de données ; pivot possible vers
  d'autres injections (UNION, etc.).
- **Correction :** **requêtes paramétrées** (placeholders `?`), validation de type.

## V4 — Broken Access Control (route admin) · ÉLEVÉE

| Élément | Détail |
|---------|--------|
| Endpoint | `GET /api/admin/users` |
| Cause | authentification vérifiée mais **rôle non contrôlé** |
| Preuve | token de Alice (`role:user`) → `HTTP 200` + liste users + soldes |

- **Impact :** tout utilisateur authentifié lit la base utilisateurs (emails, rôles, soldes).
- **Correction :** middleware `requireAdmin` (renvoyer `403` si `role !== 'admin'`).

## V5 — IDOR / BOLA · ÉLEVÉE

| Élément | Détail |
|---------|--------|
| Endpoint | `GET /api/orders/:id` |
| Cause | pas de vérification d'**ownership** |
| Preuve | token de Alice → `GET /api/orders/102` (commande de **Bob**) → `200` `{"userId":2,...}` |

- **Impact :** lecture des ressources de n'importe quel utilisateur par énumération d'ID.
- **Correction :** filtrer `WHERE id = ? AND userId = req.user.id` ; `404` si absent
  (ne pas révéler l'existence).

## V6 — XSS stocké · ÉLEVÉE

| Élément | Détail |
|---------|--------|
| Endpoint | `POST /api/comments` → rendu `GET /comments` |
| Cause | corps du commentaire injecté dans le HTML sans encodage |
| Preuve | body `<script>alert(1)</script>` réapparaît **non échappé** dans la page |

- **Impact :** exécution de script dans le navigateur des visiteurs (vol de session, défacement).
- **Correction :** **encodage HTML** en sortie (`textContent`/échappement),
  DOMPurify si HTML riche nécessaire, et **CSP**.

## V7 — Faiblesses JWT · MOYENNE

| Élément | Détail |
|---------|--------|
| Cause | JWT **sans `exp`** ; secret trivial (`'secret'`) ; rôle porté par le token |
| Preuve | payload décodé : `{"id":3,"role":"admin","iat":...}` — aucun `exp` |

- **Impact :** un token volé reste **valide indéfiniment** ; secret faible = forge possible.
- **Note :** la **signature est vérifiée** (token altéré → `401`) — point conforme.
- **Correction :** `expiresIn` court (15 min), secret fort en variable d'env, rotation.

## V8 — Fuite d'information (stack trace) · MOYENNE

| Élément | Détail |
|---------|--------|
| Endpoint | `GET /api/boom` (handler d'erreur global) |
| Cause | l'erreur brute (`message` + `stack`) est renvoyée au client |
| Preuve | réponse `500` contenant `host=10.0.0.5`, chemins serveur, pile d'appels |

- **Impact :** divulgation d'infos internes (chemins, dépendances, hôtes) facilitant d'autres attaques.
- **Correction :** message **générique** (`Internal Server Error`), détail uniquement en log serveur.

## V9 — Mauvaise configuration · MOYENNE

| Élément | Détail |
|---------|--------|
| Cause | `Access-Control-Allow-Origin: *` **avec** `credentials: true` ; aucun header de sécurité ; `X-Powered-By: Express` |
| Preuve | headers de réponse : `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Credentials: true`, `X-Powered-By: Express` ; pas de CSP/X-Frame-Options/HSTS |

- **Impact :** politique CORS dangereuse, surface d'attaque accrue (clickjacking, sniffing), fingerprinting.
- **Correction :** CORS restreint à l'origine du front, **helmet** (CSP, X-Frame-Options, nosniff, HSTS), masquer `X-Powered-By`.

## V10 — Mot de passe stocké en clair · ÉLEVÉE

| Élément | Détail |
|---------|--------|
| Cause | colonne `password` en clair (visible dans la réponse de `PUT /api/me`) |
| Preuve | `"password":"alicepw"` renvoyé dans le profil |

- **Impact :** compromission totale des comptes en cas de fuite de base.
- **Correction :** stocker un **hash bcrypt**, ne jamais renvoyer le champ mot de passe.

---

## Recommandations prioritaires

1. **Critiques d'abord (V1–V3) :** whitelist des champs, sanitization NoSQL +
   bcrypt, requêtes paramétrées.
2. **Contrôle d'accès (V4, V5) :** rôle backend + ownership systématiques.
3. **V6, V10 :** encodage de sortie + CSP ; hachage des mots de passe.
4. **Durcissement (V7–V9) :** JWT court + secret fort, erreurs génériques,
   helmet + CORS restreint.

> Toutes ces corrections sont implémentées et **testées** dans `tp3/secure`
> (11 tests de validation rejouant ces mêmes attaques → bloquées).
