const express = require('express');
const { execFile } = require('child_process');
const helmet = require('helmet');
require('dotenv').config();

// Faux positif justifié : API en lecture seule (GET), sans cookie de session ni
// formulaire mutant l'état → la protection CSRF n'est pas applicable ici.
const app = express(); // nosemgrep: javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
app.use(helmet()); // ✅ headers de sécurité (corrige la majorité des alertes ZAP)

// ✅ Secret via variable d'environnement, jamais hardcodé.
const API_KEY = process.env.API_KEY;

app.get('/', (req, res) => {
  res.send('TP DevSecOps - branche secure');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ✅ Pas d'eval : parsing numérique contrôlé.
app.get('/calc', (req, res) => {
  const a = Number(req.query.a);
  const b = Number(req.query.b);
  if (Number.isNaN(a) || Number.isNaN(b)) return res.status(400).send('Invalid');
  // Faux positif justifié : `a` et `b` sont coercés en Number et rejetés si NaN ;
  // la sortie est toujours numérique, donc aucun vecteur XSS possible.
  res.send(String(a + b)); // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
});

// ✅ execFile + validation stricte : pas d'interpolation shell, pas d'injection.
app.get('/ping', (req, res) => {
  const host = req.query.host;
  if (!/^[a-zA-Z0-9.-]+$/.test(host || '')) return res.status(400).send('Invalid host');
  execFile('ping', ['-c', '1', host], (err, stdout) => {
    if (err) return res.status(500).send('Error');
    res.send(stdout);
  });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`listening on ${PORT}`));
}

module.exports = app;
