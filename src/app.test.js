const { test } = require('node:test');
const assert = require('node:assert');
const app = require('./app');

// Test léger : on vérifie que l'app Express est bien exportée et "montable".
// L'objectif est surtout d'avoir un quality gate `npm test` fonctionnel.
test('app exporte un handler Express', () => {
  assert.strictEqual(typeof app, 'function');
});

test('app expose la méthode listen', () => {
  assert.strictEqual(typeof app.listen, 'function');
});
