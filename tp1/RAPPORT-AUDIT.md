# Rapport d'audit — OWASP crAPI

- **Cible :** `http://localhost:8888` (OWASP crAPI, lab local volontairement vulnérable)
- **Type :** audit boîte noire + observation API, exploitation **contrôlée**
- **Comptes :** User A (`userA@example.com`) et User B (`userB@example.com`) créés via signup
- **Méthodologie :** cadrage → cartographie → JWT/auth → BOLA → injections → XSS → misconfig → mass assignment → SSRF
- **Reproductibilité :** [`scripts/audit.sh`](scripts/audit.sh) (crAPI lancé + tokens en variables)

## Synthèse — par criticité

| # | Vulnérabilité | Endpoint | Criticité |
|---|---------------|----------|-----------|
| V1 | **JWT `alg:none`** → bypass d'auth + usurpation de compte | global (auth) | **Critique** |
| V2 | **BOLA** rapports mécaniciens (énumération `report_id`) → fuite PII | `GET /workshop/api/mechanic/mechanic_report` | **Élevée** |
| V3 | **Injection NoSQL** → coupon valide sans code | `POST /community/api/v2/coupon/validate-coupon` | **Élevée** |
| V4 | **Excessive data exposure** (PII d'autrui dans les réponses) | rapports / dashboards | **Élevée** |
| V5 | **Information disclosure** (erreur framework verbeuse au login) | `POST /identity/api/auth/login` | **Moyenne** |
| V6 | **Security misconfiguration** (CSP & HSTS absents) | global | **Moyenne** |

---

## V1 — JWT `alg:none` : bypass d'authentification · CRITIQUE

| Élément | Détail |
|---------|--------|
| Cause | Le service accepte un JWT dont l'en-tête déclare `alg:none` **sans vérifier la signature** |
| Preuve | Token forgé `header={"alg":"none"}`, `payload={"sub":"test@example.com","role":"admin",...}`, **sans signature** |

Requête :
```
GET /identity/api/v2/user/dashboard
Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.<payload forgé>.
```
Réponse (`HTTP 200`) — **dashboard de la victime** :
```json
{"id":4,"name":"Test","email":"test@example.com","number":"9876540001",
 "video_name":"Test_video","available_credit":100.0,"role":"ROLE_USER"}
```
- **Impact :** un attaquant forge un token pour **n'importe quel utilisateur**
  (et n'importe quel rôle) sans connaître la clé → usurpation totale,
  contournement complet de l'authentification.
- **Remédiation :** rejeter `alg:none` ; imposer l'algorithme attendu (RS256)
  côté serveur ; **vérifier la signature** avec la clé publique ; ne jamais faire
  confiance à l'en-tête `alg` fourni par le client.

## V2 — BOLA sur les rapports mécaniciens · ÉLEVÉE

| Élément | Détail |
|---------|--------|
| Endpoint | `GET /workshop/api/mechanic/mechanic_report?report_id=<n>` |
| Cause | `report_id` incrémental, **aucun contrôle d'ownership** |
| Preuve | Avec le token de User A : `report_id=1,2,3` → tous `HTTP 200` |

Réponse `report_id=1` (extrait) — données d'**autres** utilisateurs :
```json
{"id":1,"mechanic":{"mechanic_code":"TRAC_JME","user":{"email":"james@example.com"}},
 "vehicle":{"vin":"8IGEF39BZUJ159285","owner":{"email":"test@example.com","number":"9876540001"}},
 "problem_details":"...mobile 9876540001 ... email test@example.com ..."}
```
- **Impact :** énumération des rapports de tous les clients → fuite de **PII**
  (emails, téléphones, VIN, détails). Classique OWASP API1:2023 (BOLA).
- **Remédiation :** vérifier que le `report_id` appartient bien à l'appelant
  (ownership backend) ; renvoyer `403/404` sinon ; IDs non devinables (UUID).

## V3 — Injection NoSQL (validation de coupon) · ÉLEVÉE

| Élément | Détail |
|---------|--------|
| Endpoint | `POST /community/api/v2/coupon/validate-coupon` |
| Cause | l'opérateur Mongo `$ne` est interprété au lieu d'être traité comme une donnée |
| Preuve | body `{"coupon_code":{"$ne":null}}` |

Réponse (`HTTP 200`) :
```json
{"coupon_code":"TRAC075","amount":"75","CreatedAt":"2026-06-17T..."}
```
- **Impact :** obtention d'un **coupon valide (valeur 75)** sans connaître aucun
  code → fraude (crédit gratuit). Démontre une injection NoSQL exploitable.
- **Remédiation :** forcer le **type string** des entrées, rejeter les clés `$`/`.`
  (sanitization), valider le format du code côté serveur.

## V4 — Excessive data exposure · ÉLEVÉE

| Élément | Détail |
|---------|--------|
| Cause | les objets renvoyés incluent des champs sensibles d'autres utilisateurs |
| Preuve | V1 (dashboard complet d'autrui) et V2 (email/tél/VIN dans le rapport) |

- **Impact :** fuite de données personnelles au-delà du strict nécessaire.
- **Remédiation :** DTO de sortie limité aux champs utiles ; ne jamais sérialiser
  l'objet ORM complet.

## V5 — Information disclosure au login · MOYENNE

| Élément | Détail |
|---------|--------|
| Endpoint | `POST /identity/api/auth/login` |
| Cause | une entrée invalide renvoie une erreur de validation **verbeuse** |
| Preuve | mot de passe trop court → message exposant `org.springframework.validation.BeanPropertyBindingResult...` |

- **Impact :** divulgation du **framework** (Spring) et de détails internes,
  utile au fingerprinting / à la préparation d'attaques.
- **Note positive :** « bad credentials » renvoie un message **générique**
  (`Invalid Credentials`) → pas d'énumération d'utilisateurs sur ce chemin.
- **Remédiation :** messages d'erreur génériques, masquer les traces du framework.

## V6 — Security misconfiguration (headers) · MOYENNE

| Élément | Détail |
|---------|--------|
| Preuve | réponses API : `X-Content-Type-Options: nosniff` et `X-Frame-Options: DENY` **présents**, mais **`Content-Security-Policy` et `Strict-Transport-Security` absents** ; bannière `Server: openresty/1.27.1.2` |

- **Impact :** absence de CSP (défense en profondeur anti-XSS) et de HSTS ;
  divulgation de version serveur.
- **Remédiation :** ajouter CSP et HSTS, masquer la version du serveur.

---

## Tests menés sans résultat exploitable (transparence)

- **Mass assignment vidéo** (`PUT /identity/api/v2/user/videos/:id`) : nécessite
  une vidéo préalablement uploadée (réponse `404` sans upload) — non reproduit ici.
- **BOLA véhicule / GPS** : nécessite de réclamer un véhicule via le code envoyé
  par e-mail (MailHog) — non réalisé dans cette session.
- **SSRF** (`contact_mechanic`) : à tester en visant **uniquement** une cible
  interne du lab (script fourni, désactivé par défaut).

## Risques majeurs & priorités

1. **V1 (Critique) — JWT `alg:none`** : à corriger en priorité absolue
   (bypass total d'authentification). Imposer RS256 + vérification de signature.
2. **V2/V4 (BOLA + data exposure)** : contrôle d'ownership systématique + DTO de sortie.
3. **V3 (NoSQL injection)** : sanitization des entrées JSON.
4. **V5/V6 (durcissement)** : erreurs génériques, CSP/HSTS, masquage de version.

> Conformément au cadre éthique : aucun test destructif, aucune cible hors
> `localhost`, exploitation limitée à la preuve de concept.
