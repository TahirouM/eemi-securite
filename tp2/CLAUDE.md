# TP2 — Audit méthodologique d'une application (Pentest web/API)

> Fichier d'instructions destiné à **Claude Code**.
> Objectif : réaliser un **audit de sécurité structuré** d'une application
> web/API en appliquant une méthodologie de pentest, **dans un périmètre
> autorisé** et en **exploitation contrôlée uniquement**.

> ⚠️ **Cadre éthique (à respecter en permanence).** Ce TP s'effectue
> **uniquement** sur la cible désignée (ton application de lab, généralement sur
> `localhost`), avec les comptes fournis. **Tests interdits :** DoS, suppression
> massive de données, scan agressif. Toute action en dehors de ce périmètre est
> hors sujet et interdite. Le but est de **comprendre, prouver, mesurer et
> corriger** — pas de nuire.

---

## 0. Contexte et objectif

Tu interviens comme **auditeur sécurité** sur une application web moderne qui
expose : une interface web, une API REST, un système d'authentification, des
comptes utilisateurs et des fonctionnalités sensibles.

**Étapes de la mission :**
1. Définir le périmètre
2. Cartographier l'application
3. Analyser les requêtes HTTP
4. Tester l'authentification
5. Tester l'autorisation
6. Rechercher des injections / tester les entrées
7. Tester les configurations
8. Identifier les risques principaux
9. Préparer une restitution orale

**Outils autorisés :** Burp Suite Community, OWASP ZAP, navigateur + DevTools,
Postman, jwt.io, `ffuf` (optionnel).

---

## 1. Comment utiliser ce fichier avec Claude Code

Claude Code n'exécute pas Burp/ZAP de façon interactive, mais il peut produire
tout ce qui rend l'audit **structuré et reproductible** :

- rédiger le **document de cadrage** (périmètre),
- construire les **tableaux de cartographie** et de résultats,
- générer des **scripts de test reproductibles** (curl / Node / collection
  Postman) pour rejouer les requêtes d'auth et d'autorisation,
- décoder/inspecter des **JWT**,
- préparer des **wordlists** et commandes `ffuf` pour l'énumération d'endpoints,
- compiler le **rapport d'audit** final.

Travaille phase par phase. À chaque faille trouvée, documente immédiatement :
**nom → endpoint → criticité → preuve (requête/réponse) → impact → correction**.

---

## PHASE 0 — Règles et périmètre

Avant **tout** test technique, formaliser le périmètre. Génère un fichier
`PERIMETRE.md` :

| Élément | À compléter (exemple) |
|---------|------------------------|
| URL cible | `http://localhost:3000` |
| Comptes utilisés | `user1`, `user2`, `admin` |
| Rôles disponibles | `public`, `user`, `admin` |
| Outils autorisés | Burp, ZAP, navigateur, Postman, jwt.io, ffuf |
| **Tests interdits** | DoS, suppression massive, scan agressif |
| Limites | **exploitation contrôlée uniquement** |

**Résultat à présenter (en 1 minute) :** quelle cible tu testes, avec quels
comptes, quelles limites tu respectes.

---

## PHASE 1 — Reconnaissance et cartographie

### Consigne
Explorer l'application et documenter sa structure.

### À identifier
Pages principales · Endpoints API · Méthodes HTTP · Paramètres · Headers ·
Cookies · JWT · Rôles · Fonctionnalités sensibles.

### Tableau de cartographie à construire (`CARTOGRAPHIE.md`)

| Endpoint | Méthode | Auth requise | Rôle supposé | Sensible |
|----------|---------|--------------|--------------|----------|
| `/api/login` | POST | Non | Public | Oui |
| `/api/profile` | GET | Oui | User | Oui |
| `/api/orders/:id` | GET | Oui | Owner | Oui |
| `/api/admin/users` | GET | Oui | Admin | Oui |

### Aide Claude Code
- Parcourir le code source du projet (si disponible) pour **lister les routes**
  automatiquement (grep des `app.get/post/put/delete`, des routers Express…).
- (Énumération boîte noire, optionnelle, sur cible autorisée)
  ```bash
  ffuf -u http://localhost:3000/api/FUZZ -w wordlist-api.txt -mc 200,401,403
  ```
  > `-mc 200,401,403` : un `401/403` révèle souvent un endpoint **existant mais
  > protégé** — information utile pour la carte.

### Résultat à présenter
Ta **carte** de l'application, les **endpoints sensibles**, les **zones à tester
en priorité**.

---

## PHASE 2 — Tests d'authentification

### Consigne
Tester le mécanisme d'authentification.

### Tests à effectuer
- Messages d'erreur de login (trop verbeux ?)
- Énumération d'utilisateurs (réponse différente si user existe / n'existe pas ?)
- Expiration du JWT
- Contenu du JWT (données sensibles ?)
- Stockage du token (localStorage vs cookie `HttpOnly`)
- Logout (invalide-t-il réellement l'accès ?)
- Réutilisation du token après logout
- Manipulation du rôle dans le token (si pertinent)

### Questions guidées
- Le token **expire-t-il** ?
- Contient-il des **données sensibles** ?
- Le **rôle** est-il dans le JWT ?
- La **signature** est-elle vérifiée côté serveur ?
- Le **logout** invalide-t-il vraiment l'accès ?
- Les **messages d'erreur** révèlent-ils trop d'informations ?

### Aide Claude Code — inspecter un JWT
```bash
# Décoder header + payload d'un JWT (sans vérifier la signature)
echo "$JWT" | cut -d. -f1 | base64 -d 2>/dev/null; echo
echo "$JWT" | cut -d. -f2 | base64 -d 2>/dev/null; echo
```
> Vérifier notamment : `exp` (expiration), `role`/`isAdmin` (autorité dans le
> token), `alg` (attention à `alg: none` ou aux clés faibles). Test clé : le
> serveur **rejette-t-il** un token dont la signature a été altérée ?

### Aide Claude Code — rejouer une requête authentifiée (reproductible)
```bash
# 1) Login → récupérer le token
curl -s -X POST http://localhost:3000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user1@test.com","password":"..."}'

# 2) Appeler une route protégée avec ce token
curl -s http://localhost:3000/api/profile \
  -H "Authorization: Bearer $JWT"
```

### Résultat à présenter
Ce que tu as testé · ce qui est sécurisé · ce qui est vulnérable ou suspect ·
une **preuve HTTP** ou capture.

---

## PHASE 3 — Tests d'autorisation (IDOR / BOLA)

### Consigne
Tester les contrôles d'accès **côté backend**.

### Méthode
1. Se connecter avec **User A**.
2. Capturer une requête vers une ressource.
3. Identifier un **ID** ou une ressource sensible.
4. Remplacer par l'**ID de User B**.
5. Observer la réponse.
6. Tester avec un compte **admin** si disponible.

### Tests à effectuer
IDOR · BOLA · accès admin · modification d'une ressource d'un autre utilisateur ·
accès à une API « cachée » · escalade de privilèges.

### Aide Claude Code — script de test d'autorisation
```bash
# User A tente de lire la ressource de User B
curl -s -o /dev/null -w "%{http_code}\n" \
  http://localhost:3000/api/orders/$ID_DE_B \
  -H "Authorization: Bearer $TOKEN_DE_A"
```
| Scénario | Réponse attendue (app sûre) | Réponse révélant une faille |
|----------|-----------------------------|-----------------------------|
| User A lit **sa** ressource | `200` | — |
| User A lit la ressource de **User B** | `403`/`404` | `200` → **IDOR/BOLA** |
| User (non-admin) appelle route admin | `403` | `200` → **escalade** |

### Résultat à présenter
Une faille d'autorisation trouvée **ou** un test négatif significatif, avec la
**requête**, la **réponse** et l'**impact**.

---

## PHASE 4 — Tests des entrées utilisateur

### Consigne
Tester les entrées utilisateur de l'application.

### Zones à tester
Login · recherche · commentaires · profil · filtres API · body JSON ·
paramètres d'URL · uploads (si disponibles).

### Payloads de base

| Type | Payload de base | Ce qu'on observe |
|------|-----------------|------------------|
| SQL Injection | `' OR 1=1 --` | bypass, erreur SQL, lignes en trop |
| XSS | `<script>alert(1)</script>` | script exécuté dans la réponse rendue |
| Mass Assignment | `{ "role": "admin" }` | le rôle change-t-il ? |
| NoSQL Injection | `{ "$ne": null }` | bypass d'authentification |

### Aide Claude Code — rejouer un payload (exemple Mass Assignment)
```bash
curl -s -X PUT http://localhost:3000/api/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"displayName":"x","role":"admin"}'
# Puis relire le profil et vérifier si "role" a été modifié.
```

### Résultat à présenter
Un input testé · le payload utilisé · le comportement observé · la **conclusion
sécurité** (vulnérable / non vulnérable + pourquoi).

---

## PHASE 5 — Présentation des résultats

### Fiche par vulnérabilité (modèle)

| Élément | Exemple |
|---------|---------|
| Nom | BOLA sur endpoint véhicule |
| Endpoint | `GET /api/vehicles/:id` |
| Criticité | Élevée |
| Preuve | User A lit le véhicule de User B (req/rép) |
| Impact | Fuite de données utilisateur |
| Correction | Vérifier l'**ownership** côté backend |

### Structure attendue de la restitution
1. Périmètre testé
2. Méthodologie utilisée
3. Principaux endpoints testés
4. Vulnérabilités / faiblesses identifiées
5. Preuves principales
6. Impacts
7. Recommandations prioritaires

### Aide Claude Code
Générer un `RAPPORT-AUDIT.md` qui agrège : le périmètre, la cartographie, et une
fiche par vulnérabilité selon le modèle ci-dessus. Classer les vulnérabilités
par criticité décroissante.

---

## Débrief collectif (questions de synthèse)
- Quelles failles sont revenues le plus souvent ?
- Lesquelles étaient les plus faciles à exploiter ?
- Quelles protections ont bien fonctionné ?
- Quels endpoints étaient les plus sensibles ?
- Quelles erreurs de conception reviennent ?
- Quelles corrections seraient prioritaires ?

---

## Patterns fréquents à reconnaître

| Pattern | Risque |
|---------|--------|
| Absence de contrôle d'ownership | IDOR / BOLA |
| Confiance dans le frontend | Broken Access Control |
| Rôles modifiables côté client | Privilege Escalation |
| Validation insuffisante | Injection / XSS |
| Messages d'erreur trop détaillés | Information Disclosure |
| Headers de sécurité absents | Surface d'attaque augmentée |

---

## Ce qu'il faut retenir

Un pentest web professionnel repose sur :
- un **périmètre clair**,
- une **méthodologie structurée**,
- une **cartographie précise**,
- des **tests manuels**,
- une **exploitation contrôlée**,
- une **évaluation du risque**,
- une **restitution actionnable**.

> **Message clé :** un bon auditeur ne se contente pas de trouver une faille.
> Il doit savoir l'**expliquer**, la **prouver**, **mesurer son impact**,
> **proposer une correction** et **vérifier la remédiation**.

---

## Checklist finale (avant restitution)

- [ ] `PERIMETRE.md` rédigé (cible, comptes, rôles, tests interdits)
- [ ] `CARTOGRAPHIE.md` : endpoints, méthodes, auth, rôle, sensibilité
- [ ] Tests d'authentification réalisés (JWT, expiration, logout, messages)
- [ ] Tests d'autorisation réalisés (IDOR/BOLA, accès admin, escalade)
- [ ] Tests d'entrées réalisés (SQLi, XSS, Mass Assignment, NoSQLi)
- [ ] Chaque faille a une **preuve** (requête/réponse ou capture)
- [ ] Chaque faille a un **impact** et une **correction** proposée
- [ ] `RAPPORT-AUDIT.md` généré, vulnérabilités triées par criticité
- [ ] Restitution orale préparée (périmètre → méthodo → résultats → reco)
- [ ] Aucun test hors périmètre / aucun test interdit effectué
