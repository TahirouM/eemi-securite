# TP — Sécurisation d'une application vulnérable (Secure Coding)

> Fichier d'instructions destiné à **Claude Code**.
> Objectif : à partir d'une application **volontairement vulnérable**, produire
> une version **sécurisée** en corrigeant les failles, en testant chaque
> correction, et en justifiant la cause profonde de chaque faille.

---

## 0. Contexte et objectif

Tu disposes d'une application volontairement vulnérable. Mission : produire une
version sécurisée en corrigeant les failles identifiées.

**Failles à corriger au minimum :**
1. Autorisation **IDOR / BOLA** (Broken Object Level Authorization)
2. **Injection** (SQL et NoSQL)
3. **XSS** (Cross-Site Scripting)
4. Problème d'**authentification ou de session**
5. **Mass Assignment**
6. **Mauvaise configuration** (headers, CORS, CSP…)
7. **Fuite d'information** (stack trace, messages d'erreur)

**Principe clé :** corriger une faille ne consiste pas seulement à bloquer un
payload — il faut **corriger la cause profonde**. Et : *une correction non
testée n'est pas une correction validée.*

---

## 1. Organisation Git

Deux branches :

| Branche | Contenu |
|---------|---------|
| `vulnerable` | la version attaquable (état initial) |
| `secure` | les corrections |

```bash
# Partir de l'app vulnérable existante
git checkout -b vulnerable      # si pas déjà fait : version attaquable
git checkout -b secure          # branche de travail pour les correctifs
```

> Workflow conseillé : sur `secure`, corriger faille par faille, un commit par
> faille (ex. `fix: IDOR sur /api/orders/:id`), pour pouvoir montrer le diff
> avant/après lors de la présentation.

---

## 2. Comment utiliser ce fichier avec Claude Code

Travaille phase par phase. Pour chaque faille :

1. **Localiser** le code vulnérable (chercher les patterns : `findByPk`,
   `req.body`, `innerHTML`, concaténation SQL, `try/catch` qui renvoie l'erreur
   brute, etc.).
2. **Corriger** la cause profonde (pas seulement filtrer un payload).
3. **Tester** avec le payload/scénario d'attaque correspondant.
4. **Documenter** : faille → cause → correction → résultat du test.

Hypothèses par défaut (à adapter au vrai projet) : **Node.js / Express**, ORM
type **Sequelize**, base **SQL** et/ou **MongoDB**, front qui affiche des
commentaires utilisateur, auth par **JWT**.

---

## PHASE 1 — Identifier les corrections (tableau de remédiation)

### Consigne
À partir des failles trouvées dans les parties précédentes, construire un
tableau de remédiation.

### Tableau de remédiation (modèle à compléter avec tes vraies failles)

| Vulnérabilité | Cause | Correction prévue | Priorité |
|---------------|-------|-------------------|----------|
| IDOR commande | pas de contrôle d'ownership | filtrer par `userId` | Haute |
| XSS commentaire | rendu HTML direct (`innerHTML`) | encodage + sanitization | Haute |
| Mass Assignment | `req.body` complet passé à l'ORM | whitelist des champs | **Critique** |
| JWT en localStorage | token lisible par JS | cookie `HttpOnly` | Moyenne |
| Debug / Error | stack trace exposée | erreurs génériques | Moyenne |

### Résultat à présenter
- tes failles principales,
- leur cause,
- tes corrections prévues.

---

## PHASE 2 — Corriger l'autorisation (IDOR / BOLA)

### Consigne
Corriger les failles liées au contrôle d'accès.

### À faire
- vérifier le **rôle** utilisateur,
- vérifier l'**ownership** (l'objet appartient bien à l'appelant),
- protéger les **routes admin**,
- tester avec **plusieurs comptes**,
- vérifier que **le frontend ne suffit pas** (le contrôle doit être backend).

### Exemple — Avant (vulnérable)
```js
// ⚠️ N'importe quel utilisateur peut lire n'importe quelle commande
app.get('/api/orders/:id', auth, async (req, res) => {
  const order = await Order.findByPk(req.params.id);
  res.json(order);
});
```

### Après (sécurisé)
```js
// ✅ La requête filtre par propriétaire : impossible de lire la commande d'autrui
app.get('/api/orders/:id', auth, async (req, res) => {
  const order = await Order.findOne({
    where: {
      id: req.params.id,
      userId: req.user.id     // ownership forcé côté backend
    }
  });
  if (!order) return res.sendStatus(404);   // 404 plutôt que 403 = pas de fuite d'existence
  res.json(order);
});

// ✅ Middleware de contrôle de rôle pour les routes admin
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.sendStatus(403);
  next();
}
app.get('/api/admin/users', auth, requireAdmin, adminHandler);
```

### Tests de validation
| Test | Résultat attendu |
|------|------------------|
| User A lit **sa** commande | `200 OK` |
| User A lit la commande de **User B** | `403` ou `404` |
| User (non-admin) appelle une route admin | `403` |
| Admin appelle une route admin | `200 OK` |

---

## PHASE 3 — Corriger les injections (SQL / NoSQL)

### Consigne
Corriger les failles d'injection.

### À faire
- supprimer les **concaténations SQL**,
- utiliser des **requêtes paramétrées**,
- **valider les types**,
- éviter les **commandes système**,
- **filtrer les opérateurs NoSQL** (`$ne`, `$gt`, `$where`, …).

### Exemple SQL — Avant
```js
// ⚠️ Injection SQL : ' OR 1=1 -- contourne le filtre
const q = `SELECT * FROM users WHERE email = '${email}'`;
const rows = await db.query(q);
```

### Après
```js
// ✅ Requête paramétrée : l'entrée est traitée comme une donnée, pas du code
const rows = await db.query('SELECT * FROM users WHERE email = ?', [email]);
```

### Exemple NoSQL (MongoDB) — Avant / Après
```js
// ⚠️ Avant : { "$ne": null } passé tel quel court-circuite l'authentification
const user = await User.findOne({ email: req.body.email, password: req.body.password });

// ✅ Après : forcer le type string + ne jamais comparer un mot de passe en clair
const email = String(req.body.email || '');
const password = String(req.body.password || '');
const user = await User.findOne({ email });
const ok = user && await bcrypt.compare(password, user.passwordHash);
```
> Complément : activer un middleware type `express-mongo-sanitize` pour retirer
> les clés commençant par `$` ou contenant `.` dans les entrées.

### Tests de validation
Payloads à rejouer :
```
' OR 1=1 --
{ "$ne": null }
```
**Résultat attendu :** la requête est **refusée** ou **traitée comme une simple
donnée** (aucun bypass, aucune fuite de toutes les lignes).

---

## PHASE 4 — Corriger XSS

### Consigne
Corriger les failles XSS.

### À faire
- éviter `innerHTML`,
- éviter `dangerouslySetInnerHTML` (React),
- **encoder les sorties**,
- utiliser **DOMPurify** si du HTML est réellement nécessaire,
- ajouter une **CSP** (Content-Security-Policy),
- protéger les **cookies** avec `HttpOnly`.

### Exemple — Avant / Après
```js
// ⚠️ Avant : le HTML du commentaire est interprété → <script> s'exécute
commentContainer.innerHTML = comment;

// ✅ Après : textContent échappe automatiquement, aucun HTML interprété
commentContainer.textContent = comment;
```

### Si du HTML est autorisé (texte riche)
```js
// ✅ Nettoyage avant insertion
commentContainer.innerHTML = DOMPurify.sanitize(comment);
```

### En complément — CSP (via Helmet, voir Phase 6)
```js
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],          // bloque les scripts inline injectés
    objectSrc: ["'none'"]
  }
}));
```

### Test de validation
Payload :
```html
<script>alert(1)</script>
```
**Résultat attendu :** le script **ne s'exécute pas** (il est affiché comme du
texte ou supprimé par la sanitization).

---

## PHASE 5 — Corriger le Mass Assignment

### Consigne
Corriger les endpoints qui acceptent trop de champs.

### À faire
- **ne jamais** utiliser directement `req.body`,
- créer une **whitelist** de champs autorisés,
- **refuser** (ou ignorer) les champs inattendus,
- **séparer** les endpoints user / admin.

### Exemple — Avant / Après
```js
// ⚠️ Avant : l'utilisateur peut injecter { "role": "admin" } et s'élever
await User.update(req.body, { where: { id: req.user.id } });

// ✅ Après : seuls les champs explicitement autorisés sont pris en compte
const allowedFields = {
  email: req.body.email,
  displayName: req.body.displayName
};
await User.update(allowedFields, { where: { id: req.user.id } });
```
> `role`, `isAdmin`, `balance`, etc. ne doivent **jamais** être modifiables via
> l'endpoint utilisateur. La promotion de rôle passe par un endpoint admin
> distinct et protégé (voir Phase 2).

### Test de validation
Envoyer :
```json
{ "role": "admin" }
```
**Résultat attendu :** le rôle **n'est pas modifié** (champ ignoré ou requête
rejetée).

---

## PHASE 6 — Sécuriser auth, erreurs et headers

### Consigne
Renforcer les protections globales de l'application.

### Tableau des corrections

| Zone | Correction attendue |
|------|---------------------|
| Login | **rate limiting** (anti brute-force) |
| Erreurs | messages **génériques** (pas de stack trace) |
| Cookies | `HttpOnly`, `Secure`, `SameSite` |
| JWT | **expiration courte** |
| Headers | **Helmet / CSP** |
| CORS | origine **limitée** (pas de `*`) |
| Logs | **pas de secrets** dans les logs |

### Exemple — Helmet (headers de sécurité)
```js
const helmet = require('helmet');
app.use(helmet());
```

### Exemple — Cookie de session sécurisé
```
Set-Cookie: session=abc; HttpOnly; Secure; SameSite=Strict
```
```js
// JWT stocké dans un cookie HttpOnly plutôt que localStorage (non lisible par JS)
res.cookie('token', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000      // expiration courte (15 min)
});
```

### Exemple — Rate limiting du login
```js
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });
app.post('/api/login', loginLimiter, loginHandler);
```

### Exemple — CORS restreint
```js
const cors = require('cors');
app.use(cors({ origin: 'https://mon-front.example.com', credentials: true }));
```

### Exemple — Gestion d'erreurs sans fuite d'information
```js
// ✅ Le détail va dans les logs serveur, le client ne reçoit qu'un message générique
app.use((err, req, res, next) => {
  console.error(err);                         // log interne (sans secrets)
  res.status(500).json({ error: 'Internal Server Error' });
});
```

---

## PHASE 7 — Tests de validation

### Objectif
Vérifier que les corrections **bloquent réellement** les attaques.

### Tableau de validation

| Faille corrigée | Attaque rejouée | Résultat attendu |
|-----------------|-----------------|------------------|
| IDOR | changer l'ID de ressource | `403` ou `404` |
| SQLi | `' OR 1=1 --` | refus / aucun bypass |
| XSS | `<script>alert(1)</script>` | pas d'exécution |
| Mass Assignment | `{ "role": "admin" }` | rôle inchangé |
| Auth | brute force léger | blocage / rate limit |
| Error leak | provoquer une erreur | message générique |

> **À retenir :** une correction non testée n'est pas une correction validée.

### Conseil : automatiser ces tests
Écrire des tests (ex. avec `supertest` + `node --test` ou Jest) qui rejouent
chaque payload et vérifient le code de réponse attendu. Cela rend la
démonstration reproductible.

```js
// Exemple de test IDOR avec supertest
const request = require('supertest');
test('User A ne peut pas lire la commande de User B', async () => {
  const res = await request(app)
    .get('/api/orders/' + orderDeB)
    .set('Authorization', 'Bearer ' + tokenDeA);
  expect([403, 404]).toContain(res.status);
});
```

---

## Présentation des résultats

### Structure attendue
1. Rappel des failles corrigées
2. Démonstration **avant** correction
3. Explication de la **cause**
4. Démonstration du **correctif**
5. **Test de validation**
6. **Justification technique**

### Exemple de présentation d'une faille
- **Faille :** IDOR sur `/api/orders/:id`
- **Cause :** absence de contrôle d'ownership
- **Correction :** requête filtrée par `userId`
- **Validation :** User A ne peut plus accéder à la commande de User B

### Objectif de la présentation
Montrer que tu sais : **comprendre** une faille, la **corriger**, la **tester**,
et l'**expliquer**.

---

## Ce qu'il faut retenir

Le Secure Coding repose sur :
- validation stricte des entrées,
- contrôle **backend** (jamais se fier au frontend),
- requêtes **préparées / paramétrées**,
- contrôle d'**ownership**,
- **whitelist** des champs,
- sessions sécurisées (cookies `HttpOnly`/`Secure`/`SameSite`, JWT court),
- **headers de sécurité** (Helmet, CSP),
- logs maîtrisés (pas de secrets),
- **erreurs génériques**,
- **tests de validation** systématiques.

> Corriger une faille ne consiste pas seulement à bloquer un payload :
> il faut corriger la **cause profonde**.

---

## Checklist finale (avant présentation)

- [ ] Branches `vulnerable` et `secure` existent
- [ ] IDOR / BOLA corrigé (ownership backend) + testé
- [ ] Injection SQL corrigée (requêtes paramétrées) + testée
- [ ] Injection NoSQL filtrée (`$ne`, etc.) + testée
- [ ] XSS corrigé (`textContent` / DOMPurify + CSP) + testé
- [ ] Mass Assignment corrigé (whitelist) + testé
- [ ] Auth / session renforcée (rate limit, JWT court, cookies sécurisés)
- [ ] Headers (Helmet) + CORS restreint configurés
- [ ] Fuite d'information corrigée (erreurs génériques)
- [ ] Chaque correction est **testée** et **justifiée**
