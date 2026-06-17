# TP1 — Audit Web & API (OWASP crAPI)

> Fichier d'instructions destiné à **Claude Code**.
> Objectif : réaliser un **audit de sécurité structuré** de la plateforme
> d'entraînement **OWASP crAPI**, en appliquant une méthodologie de pentest
> web/API, **dans un périmètre autorisé** et en **exploitation contrôlée**.

> ⚠️ **Cadre éthique (à respecter en permanence).** crAPI est une application
> **volontairement vulnérable conçue par l'OWASP pour l'apprentissage**, déployée
> en local sur ta machine. Tout reste **dans ce périmètre** : ta cible
> `http://localhost`. **Interdit :** destruction de données, déni de service,
> scans agressifs, toute attaque hors périmètre. **Autorisé :** tests manuels,
> interception HTTP, fuzzing léger, modification de requêtes, exploitation
> contrôlée. La même méthodologie s'applique en mission réelle **uniquement avec
> une autorisation écrite**.

---

## 0. Contexte et mission

Tu interviens comme **consultant cybersécurité** mandaté pour auditer une
plateforme SaaS moderne (crAPI) simulant un **service automobile connecté** :
application web (SPA), plusieurs **APIs REST**, microservices, authentification
**JWT**, fonctionnalités utilisateurs et administrateurs.

**Mission :**
- ✅ identifier les vulnérabilités,
- ✅ démontrer leur impact,
- ✅ proposer des remédiations adaptées.

**Compétences visées :** cartographier une API REST, identifier des failles
d'autorisation, tester JWT/auth, exploiter des vulnérabilités web/API de façon
contrôlée, utiliser Burp Suite, et **rédiger un rapport professionnel**.

---

## 1. Installation & accès

```bash
docker pull owasp/crapi
docker-compose pull
docker-compose -f docker-compose.yml --compatibility up -d
```
Accès application : **http://localhost**

> Astuce : crée d'abord **deux comptes utilisateurs** (User A, User B) via le
> formulaire d'inscription. Beaucoup de tests d'autorisation reposent sur « User
> A tente d'accéder aux données de User B ». Le mail OTP/vérification de crAPI
> est consultable via l'interface MailHog exposée par le `docker-compose`.

---

## 2. Outils autorisés

| Outil | Usage |
|-------|-------|
| Burp Suite Community | Interception HTTP, rejeu/modification de requêtes (Repeater) |
| OWASP ZAP | Audit automatique (passif), spider |
| Postman | Test des APIs REST |
| jwt.io | Analyse / décodage de JWT |
| Navigateur + DevTools | Tests manuels, inspection réseau/SPA |
| `ffuf` (optionnel) | Discovery / fuzzing léger d'endpoints |

### Ce que Claude Code peut produire
Claude Code ne pilote pas Burp/ZAP de façon interactive, mais il rend l'audit
**structuré et reproductible** : documents de cadrage et de cartographie,
**scripts `curl`/Node**, **collection Postman**, décodage JWT, **wordlists +
commandes `ffuf`**, et le **rapport final** (`RAPPORT-AUDIT.md`). Travaille
phase par phase ; documente chaque faille dès qu'elle est trouvée.

---

## PHASE 1 — Reconnaissance & cartographie

### Objectif
Comprendre l'application avant tout test offensif.

### À identifier
Routes · endpoints API · paramètres · mécanismes d'auth · cookies · JWT ·
rôles utilisateurs.

### Tableau de cartographie (`CARTOGRAPHIE.md`)

| Élément | Description à compléter |
|---------|--------------------------|
| Frontend | technologies (SPA, framework) |
| APIs | endpoints découverts + méthodes |
| Auth | JWT / session, où est stocké le token |
| Headers | présence/config des headers de sécurité |
| Rôles | user / mechanic / admin |

Exemple de tableau d'endpoints à remplir :

| Endpoint | Méthode | Auth | Rôle supposé | Sensible |
|----------|---------|------|--------------|----------|
| `/identity/api/auth/login` | POST | Non | Public | Oui |
| `/identity/api/v2/user/dashboard` | GET | Oui | User | Oui |
| `/identity/api/v2/vehicle/vehicles` | GET | Oui | Owner | Oui |
| `/workshop/api/mechanic/...` | GET/POST | Oui | Mechanic/Admin | Oui |
| `/community/api/v2/community/posts` | GET/POST | Oui | User | Oui |

> ⚠️ Les chemins exacts varient selon la version de crAPI : **confirme-les
> toi-même** pendant la reconnaissance (DevTools → onglet Réseau, ou le spider
> ZAP en mode passif). C'est précisément l'objet de cette phase.

### Aide Claude Code
- Observer le trafic de la SPA et **lister les appels API** réellement émis.
- (Discovery légère, sur la cible autorisée) :
  ```bash
  ffuf -u http://localhost/FUZZ -w wordlist.txt -mc 200,301,401,403
  ```
  > `401/403` = endpoint **existant mais protégé** → utile pour la carte.

### Résultat à présenter
Ta **carte** de l'application, les **endpoints sensibles**, les **zones
prioritaires** à tester.

---

## PHASE 2 — Authentification & JWT

### Objectif
Analyser la sécurité de l'authentification.

### Tests à effectuer (sur le JWT)
Structure · expiration · algorithme · données sensibles · rôles · stockage.

### Questions guidées
- Le JWT **expire-t-il** (claim `exp`) ?
- Contient-il des **données sensibles** ?
- Le **stockage** est-il sécurisé (cookie `HttpOnly` vs `localStorage`) ?
- Les **rôles** sont-ils vérifiés **côté backend** (et pas seulement dans le token) ?

### Bonus
- Modification du **payload** du token (ex. changer le rôle) → le serveur l'accepte-t-il ?
- **Réutilisation** d'un token après logout / expiration.
- **Contrôle de signature** : un token re-signé avec une mauvaise clé, ou avec
  `alg: none`, est-il rejeté ? (faiblesse classique d'implémentation JWT)

### Aide Claude Code — inspecter un JWT
```bash
# Décoder header puis payload (sans vérifier la signature)
echo "$JWT" | cut -d. -f1 | base64 -d 2>/dev/null; echo
echo "$JWT" | cut -d. -f2 | base64 -d 2>/dev/null; echo
```
Points d'attention : `alg`, `exp`, présence de `role`/`email`, et **vérification
effective de la signature côté serveur**.

### Résultat à présenter
Ce que tu as testé · ce qui est sécurisé · ce qui est vulnérable/suspect · une
**preuve HTTP** ou capture.

---

## PHASE 3 — Broken Access Control / BOLA

### Objectif
Identifier des failles d'autorisation (le cœur des vulnérabilités d'API).

### Tests à effectuer
- changement d'**IDs** dans les requêtes,
- accès aux **données d'autres utilisateurs**,
- **endpoints admin**,
- **APIs privées**,
- ressources liées aux **véhicules / comptes**.

### À analyser
Lecture d'autres comptes · modification de ressources d'autrui · accès admin ·
escalade de privilèges.

### Méthode (reproductible)
```bash
# User A tente d'accéder à une ressource de User B (ex. véhicule, commande...)
curl -s -o /dev/null -w "%{http_code}\n" \
  "http://localhost/identity/api/v2/vehicle/$ID_RESSOURCE_DE_B" \
  -H "Authorization: Bearer $TOKEN_DE_A"
```

| Scénario | Réponse attendue (app sûre) | Réponse révélant une faille |
|----------|-----------------------------|-----------------------------|
| User A lit **sa** ressource | `200` | — |
| User A lit la ressource de **User B** | `403`/`404` | `200` → **BOLA / IDOR** |
| User (non-admin) appelle une fonction admin | `403` | `200` → **BFLA / escalade** |

> crAPI expose typiquement des BOLA sur les **véhicules** et les **rapports
> mécaniciens**, et des fuites de données (excessive data exposure) sur certains
> objets. Vérifie aussi les **champs renvoyés** : l'API expose-t-elle plus de
> données que nécessaire (numéros, coordonnées GPS, etc.) ?

### Résultat à présenter
Une faille d'autorisation trouvée (ou un test négatif significatif), avec la
**requête**, la **réponse** et l'**impact**.

---

## PHASE 4 — Injections (SQLi / NoSQLi / Command Injection)

### Objectif
Tester les entrées utilisateur.

### Zones
Formulaires de login · recherche · filtres API · paramètres JSON · (pour la
command injection) upload, ping/traceroute, génération de fichiers, fonctions
système.

### Payloads de base

| Type | Payload | Comportement révélateur |
|------|---------|--------------------------|
| SQL Injection | `' OR 1=1 --` | bypass, erreur SQL, lignes en trop |
| NoSQL Injection | `{ "$ne": null }` | bypass d'authentification/filtre |
| Command Injection | `; id` / `&& whoami` (selon contexte) | sortie de commande système |

> crAPI contient notamment une **NoSQL injection** côté validation de coupon
> (paramètres JSON). Teste les opérateurs Mongo (`$ne`, `$gt`, `$where`).

### Aide Claude Code — rejouer un payload (exemple body JSON)
```bash
curl -s -X POST http://localhost/community/api/v2/coupon/validate-coupon \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"coupon_code":{"$ne":null}}'
```

### Documentation par vulnérabilité
Pour chaque injection trouvée : **endpoint · payload · impact · capture**.

---

## PHASE 5 — XSS (Reflected, Stored, DOM)

### Objectif
Identifier les injections JavaScript et **démontrer leur exploitation**.

### Zones à tester
Formulaires · commentaires · paramètres d'URL · profils utilisateurs · données
affichées par le frontend.

### DOM XSS — à analyser
Usage de `innerHTML` · rendu dynamique · paramètres JS · spécificités du
**frontend SPA**.

### Payload de base
```html
<script>alert(1)</script>
```
> Distingue bien les **trois types** :
> - **Reflected** : le payload revient dans la réponse immédiate (ex. paramètre
>   d'URL réfléchi).
> - **Stored** : le payload est enregistré (commentaire, profil) puis exécuté
>   chez d'autres utilisateurs.
> - **DOM** : l'exécution vient d'un traitement JS côté client (ex. `innerHTML`
>   sur une valeur contrôlée), sans aller-retour serveur.

### Résultat à présenter
Pour chaque XSS : **zone · payload · type · preuve d'exécution · impact**.

---

## PHASE 6 — Security Misconfiguration

### Objectif
Analyser la configuration de sécurité.

### Analyse serveur — à identifier
Stack traces · erreurs de debug · **CORS** trop permissif · endpoints oubliés ·
fuites d'**infos de version**.

### Headers de sécurité — à vérifier
Présence et bonne configuration de :
- `Content-Security-Policy` (CSP),
- `Strict-Transport-Security` (HSTS),
- `X-Frame-Options`,
- `X-Content-Type-Options`.

### Aide Claude Code — inspecter les headers
```bash
curl -s -D - -o /dev/null http://localhost/
# Relever les headers présents/absents et la config CORS (Access-Control-Allow-Origin)
```

### Résultat à présenter
Headers manquants/mal configurés · messages d'erreur trop verbeux · impact sur
la surface d'attaque.

---

## PHASE 7 — API Abuse & Mass Assignment

### Objectif
Tester les protections backend.

### Consigne
Rechercher des vulnérabilités liées au **Mass Assignment**, à la **modification
de rôles**, aux **champs cachés** et aux **abus d'API**, afin d'évaluer les
contrôles de sécurité côté backend.

### Test (modifier le body JSON)
```json
{
  "email": "user@test.com",
  "role": "admin"
}
```
```bash
curl -s -X PUT http://localhost/identity/api/v2/user/... \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@test.com","role":"admin"}'
# Relire ensuite le profil : le champ "role" a-t-il été modifié ?
```
**Résultat attendu (app sûre) :** le champ `role` (ou tout champ non autorisé)
est **ignoré** — la promotion de privilèges échoue.

### Résultat à présenter
Endpoint · champ injecté · comportement observé · impact (escalade ?).

---

## PHASE 8 — SSRF (bonus)

### Objectif
Identifier des comportements **Server-Side Request Forgery**.

### Où chercher
Fonctions qui font le serveur **récupérer une URL** : upload par URL · import
externe · **preview d'URL** · webhooks.

> crAPI expose typiquement un SSRF via une fonctionnalité où le serveur va
> chercher une ressource distante (ex. rapport mécanicien / service tiers).
> Test contrôlé : fournir une URL interne et observer si le serveur la requête.
> **Reste dans le périmètre local** — ne vise aucune ressource externe réelle.

### Résultat à présenter
Endpoint · URL fournie · comportement du serveur · impact potentiel.

---

## Restitution — documentation par vulnérabilité

Pour **chaque** vulnérabilité découverte, documenter :

| Élément | Exemple |
|---------|---------|
| Nom | BOLA sur endpoint véhicule |
| Endpoint | `GET /api/vehicles/:id` |
| Criticité | Élevée |
| Preuve d'exploitation | User A lit le véhicule de User B (req/rép) |
| Impact | Fuite de données utilisateur |
| Remédiation | Vérifier l'**ownership** côté backend |

Puis **conclure** avec : les **risques majeurs** et les **priorités de
correction**.

### Structure attendue du rapport (`RAPPORT-AUDIT.md`)
1. Périmètre testé
2. Méthodologie utilisée
3. Principaux endpoints testés (cartographie)
4. Vulnérabilités identifiées (une fiche chacune, triées par criticité)
5. Preuves principales
6. Impacts
7. Recommandations prioritaires

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
| Serveur qui fetch une URL fournie | SSRF |

---

## Ce qu'il faut retenir

Un pentest web/API professionnel repose sur : un **périmètre clair**, une
**méthodologie structurée**, une **cartographie précise**, des **tests
manuels**, une **exploitation contrôlée**, une **évaluation du risque** et une
**restitution actionnable**.

> **Message clé :** un bon auditeur ne se contente pas de trouver une faille.
> Il sait l'**expliquer**, la **prouver**, **mesurer son impact**, **proposer
> une correction** et **vérifier la remédiation**.

---

## Checklist finale

- [ ] crAPI déployé et accessible sur `http://localhost`
- [ ] Deux comptes utilisateurs créés (User A / User B)
- [ ] `PERIMETRE.md` + `CARTOGRAPHIE.md` rédigés
- [ ] Phase 2 : JWT analysé (structure, exp, alg, signature, stockage)
- [ ] Phase 3 : BOLA / Broken Access Control testé (User A vs User B, admin)
- [ ] Phase 4 : injections testées (SQLi, NoSQLi, command injection)
- [ ] Phase 5 : XSS testé (Reflected, Stored, DOM)
- [ ] Phase 6 : misconfiguration & headers vérifiés (CSP, HSTS, X-Frame, X-Content-Type)
- [ ] Phase 7 : Mass Assignment / abus d'API testés
- [ ] Phase 8 (bonus) : SSRF recherché
- [ ] Chaque faille : nom · endpoint · criticité · preuve · impact · remédiation
- [ ] `RAPPORT-AUDIT.md` généré, conclusion avec risques majeurs et priorités
- [ ] Aucun test hors périmètre / aucun test interdit effectué
