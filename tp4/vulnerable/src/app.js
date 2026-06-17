const express = require('express');
const { exec } = require('child_process');
const _ = require('lodash'); // version épinglée vulnérable (voir package.json)
const app = express();

// ⚠️ Secret hardcodé (détecté par SAST + Gitleaks)
const API_KEY = "sk_live_1234567890abcdef";

// Route racine : permet à wait-on / ZAP de constater que l'app répond.
app.get('/', (req, res) => {
  res.send('TP DevSecOps - branche vulnerable (API_KEY=' + API_KEY.slice(0, 4) + '...)');
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// ⚠️ eval sur entrée utilisateur (injection de code)
app.get('/calc', (req, res) => {
  const result = eval(req.query.expr); // DANGER
  res.send(String(result));
});

// ⚠️ Command injection (interpolation shell d'une entrée utilisateur)
app.get('/ping', (req, res) => {
  exec('ping -c 1 ' + req.query.host, (err, stdout) => { // DANGER
    res.send(stdout);
  });
});

// ⚠️ Merge non sécurisé via lodash vulnérable (prototype pollution)
app.get('/merge', (req, res) => {
  const out = _.merge({}, req.query);
  res.json(out);
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => console.log(`listening on ${PORT}`));
}

module.exports = app;
