# TP3 — Secure Coding

À partir d'une application **volontairement vulnérable**, produire une version
**sécurisée** en corrigeant la **cause profonde** de chaque faille, et en
**testant** chaque correction.

> Énoncé complet : [`CLAUDE.md`](CLAUDE.md).

## Organisation

| Dossier | Contenu | Tests |
|---------|---------|-------|
| [`vulnerable/`](vulnerable/) | app Express attaquable (état initial) | `test/attacks.test.js` — les attaques **réussissent** |
| [`secure/`](secure/) | corrections faille par faille | `test/validation.test.js` — les attaques sont **bloquées** |

L'application simule : utilisateurs avec rôles, commandes (ownership), login JWT,
recherche SQL, profil modifiable, commentaires affichés en HTML.

> Stack sans dépendance native : SQL via le module intégré **`node:sqlite`**
> (Node ≥ 22.5). L'injection NoSQL est démontrée via un petit store en mémoire
> qui imite la sémantique des requêtes objet de MongoDB (`$ne`, `$gt`).

## Lancer les tests

```bash
# Démontrer que la version vulnérable est exploitable (7 attaques réussissent)
cd tp3/vulnerable && npm install && npm test

# Démontrer que la version sécurisée bloque tout (11 tests passent)
cd tp3/secure && npm install && npm test
```

## Tableau de remédiation

| # | Vulnérabilité | Cause profonde | Correction | Test |
|---|---------------|----------------|------------|------|
| 1 | **IDOR / BOLA** sur `/api/orders/:id` | pas de contrôle d'ownership | filtre `WHERE userId = req.user.id`, 404 si absent | Alice → commande de Bob = 404 |
| 2 | **Broken access control** sur `/api/admin/*` | route admin sans contrôle de rôle | middleware `requireAdmin` (403) | user → 403, admin → 200 |
| 3 | **Injection SQL** sur `/api/users/search` | concaténation de chaîne dans la requête | requête **paramétrée** (`?`) | `' OR '1'='1` → 0 résultat |
| 4 | **Injection NoSQL** sur `/api/login` | `req.body` passé tel quel (opérateurs `$ne`) | typage `String()` + rejet des clés `$`/`.` + bcrypt | `{ "$ne": "x" }` → 400 |
| 5 | **XSS stocké** sur `/comments` | rendu HTML direct du commentaire | **encodage HTML** en sortie + **CSP** | `<script>` affiché échappé |
| 6 | **Mass Assignment** sur `PUT /api/me` | `req.body` complet écrit en base | **whitelist** des champs (email, displayName) | `{ "role": "admin" }` ignoré |
| 7 | **Auth / session** | mdp en clair, JWT sans expiration | bcrypt, JWT `expiresIn 15m`, cookie `HttpOnly`, **rate limit** login | login légitime OK |
| 8 | **Mauvaise config** | CORS `*`, aucun header | CORS restreint + **helmet** + CSP | headers présents |
| 9 | **Fuite d'information** | stack trace renvoyée au client | message **générique**, détail en log serveur | pas de `stack` dans la réponse |

## Cause profonde, pas le payload

Chaque correction traite la **cause** (requête paramétrée, ownership backend,
whitelist, encodage de sortie…) et non un blocage de payload spécifique. C'est
ce qui rend la protection robuste face à des variantes d'attaque.
