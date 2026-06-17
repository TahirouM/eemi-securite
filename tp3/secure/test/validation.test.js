// Tests de VALIDATION sur la version sécurisée.
// On rejoue exactement les mêmes attaques que sur la version vulnérable et on
// vérifie qu'elles sont désormais BLOQUÉES. On vérifie aussi que les usages
// légitimes fonctionnent toujours.
const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp, JWT_SECRET } = require('../src/app');

const app = createApp();
const tokenAlice = jwt.sign({ id: 1, role: 'user' }, JWT_SECRET);
const tokenAdmin = jwt.sign({ id: 3, role: 'admin' }, JWT_SECRET);

// --- NoSQL injection bloquée ---
test('NoSQL injection : $ne rejeté (400)', async () => {
  const res = await request(app)
    .post('/api/login')
    .send({ email: 'admin@example.com', password: { $ne: 'x' } });
  assert.strictEqual(res.status, 400);
});

test('Login légitime fonctionne toujours', async () => {
  const res = await request(app)
    .post('/api/login')
    .send({ email: 'alice@example.com', password: 'alicepw' });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.token);
});

// --- SQL injection neutralisée ---
test('SQL injection : OR 1=1 traité comme une donnée (0 résultat)', async () => {
  const res = await request(app)
    .get('/api/users/search')
    .query({ email: "' OR '1'='1" });
  assert.strictEqual(res.body.length, 0, 'aucune ligne ne fuit');
});

// --- IDOR corrigé ---
test('IDOR : Alice ne peut pas lire la commande de Bob (404)', async () => {
  const res = await request(app)
    .get('/api/orders/102')
    .set('Authorization', 'Bearer ' + tokenAlice);
  assert.strictEqual(res.status, 404);
});

test('Ownership : Alice lit bien SA commande (200)', async () => {
  const res = await request(app)
    .get('/api/orders/101')
    .set('Authorization', 'Bearer ' + tokenAlice);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.userId, 1);
});

// --- Contrôle d'accès admin ---
test('Route admin : user non-admin → 403', async () => {
  const res = await request(app)
    .get('/api/admin/users')
    .set('Authorization', 'Bearer ' + tokenAlice);
  assert.strictEqual(res.status, 403);
});

test('Route admin : admin → 200', async () => {
  const res = await request(app)
    .get('/api/admin/users')
    .set('Authorization', 'Bearer ' + tokenAdmin);
  assert.strictEqual(res.status, 200);
});

// --- Mass assignment corrigé ---
test('Mass assignment : role/balance ignorés', async () => {
  const res = await request(app)
    .put('/api/me')
    .set('Authorization', 'Bearer ' + tokenAlice)
    .send({ displayName: 'Alice2', role: 'admin', balance: 999999 });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.displayName, 'Alice2', 'champ autorisé appliqué');
  assert.strictEqual(res.body.role, 'user', 'rôle inchangé');
  assert.strictEqual(res.body.balance, 100, 'solde inchangé');
});

// --- XSS corrigé ---
test('XSS : le <script> est échappé', async () => {
  await request(app)
    .post('/api/comments')
    .send({ author: 'attacker', body: '<script>alert(1)</script>' });
  const res = await request(app).get('/comments');
  assert.ok(!res.text.includes('<script>alert(1)</script>'), 'script non interprété');
  assert.ok(res.text.includes('&lt;script&gt;'), 'affiché comme texte échappé');
});

// --- Headers de sécurité présents ---
test('Headers : helmet + CSP présents', async () => {
  const res = await request(app).get('/comments');
  assert.strictEqual(res.headers['x-content-type-options'], 'nosniff');
  assert.ok(res.headers['content-security-policy'], 'CSP définie');
});

// --- Fuite d'info corrigée ---
test('Erreur : message générique, pas de stack trace', async () => {
  const res = await request(app).get('/api/boom');
  assert.strictEqual(res.status, 500);
  assert.strictEqual(res.body.error, 'Internal Server Error');
  assert.ok(!res.body.stack, 'pas de stack trace exposée');
});
