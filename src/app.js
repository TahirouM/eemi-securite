const express = require('express');
require('dotenv').config();

// Faux positif justifié : API en lecture seule (GET), sans cookie de session ni
// formulaire mutant l'état → la protection CSRF n'est pas applicable ici.
const app = express(); // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage

// Route racine simple : permet à wait-on / ZAP de constater que l'app répond.
app.get('/', (req, res) => {
  res.send('TP DevSecOps - base neutre');
});

// Endpoint de santé.
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;

// On n'écoute pas pendant les tests (node --test importe ce module).
if (require.main === module) {
  app.listen(PORT, () => console.log(`listening on ${PORT}`));
}

module.exports = app;
