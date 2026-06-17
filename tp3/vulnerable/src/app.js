// ============================================================================
// TP3 — Application VOLONTAIREMENT VULNÉRABLE (ne pas déployer)
// Chaque commentaire ⚠️ marque une faille intentionnelle.
// ============================================================================
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createDb, makeUserCollection } = require('./db');

// ⚠️ Secret JWT hardcodé + trivial
const JWT_SECRET = 'secret';

function createApp() {
  const db = createDb();
  const usersNoSql = makeUserCollection(
    db.prepare('SELECT * FROM users').all()
  );

  const app = express();
  app.use(express.json());

  // ⚠️ Mauvaise configuration : CORS grand ouvert (toutes origines + credentials)
  app.use(cors({ origin: '*', credentials: true }));
  // ⚠️ Aucun header de sécurité (pas de helmet, pas de CSP)

  // --- Auth : middleware qui décode le JWT ---
  function auth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.replace('Bearer ', '');
    try {
      req.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch (e) {
      res.status(401).json({ error: 'unauthorized' });
    }
  }

  // ⚠️ LOGIN — injection NoSQL : req.body passé tel quel au "findOne".
  // Payload { "email": "admin@example.com", "password": { "$ne": "x" } }
  // contourne la vérification du mot de passe.
  app.post('/api/login', (req, res) => {
    const user = usersNoSql.findOne({
      email: req.body.email,
      password: req.body.password,
    });
    if (!user) return res.status(401).json({ error: 'bad credentials' });
    // ⚠️ JWT sans expiration
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET);
    res.json({ token });
  });

  // ⚠️ RECHERCHE SQL — concaténation directe → injection SQL.
  // ?email=' OR '1'='1  renvoie tous les utilisateurs.
  app.get('/api/users/search', (req, res) => {
    const q = `SELECT id, email, role FROM users WHERE email = '${req.query.email}'`;
    const rows = db.prepare(q).all();
    res.json(rows);
  });

  // ⚠️ IDOR / BOLA — aucune vérification d'ownership : n'importe quel user
  // authentifié peut lire la commande de n'importe qui.
  app.get('/api/orders/:id', auth, (req, res) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    res.json(order);
  });

  // ⚠️ Route admin SANS contrôle de rôle.
  app.get('/api/admin/users', auth, (req, res) => {
    const rows = db.prepare('SELECT id, email, role, balance FROM users').all();
    res.json(rows);
  });

  // ⚠️ MASS ASSIGNMENT — req.body complet écrit en base : un user peut
  // s'octroyer { "role": "admin" } ou modifier { "balance": 999999 }.
  app.put('/api/me', auth, (req, res) => {
    const fields = Object.keys(req.body);
    const setClause = fields.map((f) => `${f} = @${f}`).join(', ');
    db.prepare(`UPDATE users SET ${setClause} WHERE id = @id`).run({
      ...req.body,
      id: req.user.id,
    });
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json(updated);
  });

  // ⚠️ XSS stocké — le commentaire est renvoyé dans une page HTML sans encodage.
  app.post('/api/comments', (req, res) => {
    db.prepare('INSERT INTO comments (author, body) VALUES (?, ?)').run(
      req.body.author || 'anon',
      req.body.body || ''
    );
    res.status(201).json({ ok: true });
  });

  app.get('/comments', (req, res) => {
    const rows = db.prepare('SELECT author, body FROM comments').all();
    // ⚠️ body injecté directement dans le HTML → <script> s'exécute
    const html = rows
      .map((c) => `<div class="comment"><b>${c.author}</b>: ${c.body}</div>`)
      .join('\n');
    res.set('Content-Type', 'text/html');
    res.send(`<!doctype html><html><body><h1>Commentaires</h1>${html}</body></html>`);
  });

  // ⚠️ FUITE D'INFORMATION — la stack trace est renvoyée au client.
  app.get('/api/boom', (req, res) => {
    throw new Error('Connexion DB échouée: user=admin host=10.0.0.5');
  });
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(500).json({ error: err.message, stack: err.stack });
  });

  app.locals.db = db;
  return app;
}

module.exports = { createApp, JWT_SECRET };
