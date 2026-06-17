// ============================================================================
// TP3 — Application SÉCURISÉE
// Chaque ✅ corrige la cause profonde d'une faille de la version vulnérable.
// ============================================================================
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { createDb } = require('./db');

// ✅ Secret via variable d'environnement (valeur de repli uniquement pour la démo/les tests).
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';

function createApp() {
  const db = createDb();
  const app = express();
  app.use(express.json());

  // ✅ Headers de sécurité + CSP stricte (XSS / clickjacking / sniffing).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"], // bloque les scripts inline injectés
          objectSrc: ["'none'"],
        },
      },
    })
  );

  // ✅ CORS restreint à une origine connue (plus de '*').
  app.use(cors({ origin: 'https://mon-front.example.com', credentials: true }));

  // ✅ Refuser les entrées contenant des opérateurs NoSQL ($..., clés avec ".").
  // Empêche le passage d'objets type { "$ne": ... } dans le corps des requêtes.
  function rejectOperatorKeys(obj) {
    if (obj && typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        if (k.startsWith('$') || k.includes('.')) return true;
        if (rejectOperatorKeys(obj[k])) return true;
      }
    }
    return false;
  }
  app.use((req, res, next) => {
    if (rejectOperatorKeys(req.body)) {
      return res.status(400).json({ error: 'invalid input' });
    }
    next();
  });

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

  // ✅ Contrôle de rôle (routes admin).
  function requireAdmin(req, res, next) {
    if (req.user?.role !== 'admin') return res.sendStatus(403);
    next();
  }

  // ✅ Rate limiting du login (anti brute-force).
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
  });

  // ✅ LOGIN — types forcés en string + comparaison bcrypt (plus d'injection NoSQL,
  // plus de mot de passe en clair). JWT à expiration courte.
  app.post('/api/login', loginLimiter, (req, res) => {
    const email = String(req.body.email || '');
    const password = String(req.body.password || '');
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const ok = user && bcrypt.compareSync(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'bad credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: '15m',
    });
    // ✅ JWT dans un cookie HttpOnly/Secure/SameSite (non lisible par JS).
    res.cookie?.('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });
    res.json({ token });
  });

  // ✅ RECHERCHE SQL — requête paramétrée (l'entrée est une donnée, pas du code).
  app.get('/api/users/search', (req, res) => {
    const rows = db
      .prepare('SELECT id, email, role FROM users WHERE email = ?')
      .all(String(req.query.email || ''));
    res.json(rows);
  });

  // ✅ IDOR / BOLA — ownership forcé côté backend (filtre par userId).
  // 404 plutôt que 403 → ne révèle pas l'existence de la ressource.
  app.get('/api/orders/:id', auth, (req, res) => {
    const order = db
      .prepare('SELECT * FROM orders WHERE id = ? AND userId = ?')
      .get(req.params.id, req.user.id);
    if (!order) return res.sendStatus(404);
    res.json(order);
  });

  // ✅ Route admin protégée par contrôle de rôle.
  app.get('/api/admin/users', auth, requireAdmin, (req, res) => {
    const rows = db.prepare('SELECT id, email, role, balance FROM users').all();
    res.json(rows);
  });

  // ✅ MASS ASSIGNMENT — whitelist explicite des champs modifiables.
  // role / balance ne sont JAMAIS modifiables via l'endpoint utilisateur.
  app.put('/api/me', auth, (req, res) => {
    const allowed = {};
    if (typeof req.body.email === 'string') allowed.email = req.body.email;
    if (typeof req.body.displayName === 'string') allowed.displayName = req.body.displayName;
    if (Object.keys(allowed).length === 0) {
      return res.status(400).json({ error: 'no updatable field' });
    }
    const setClause = Object.keys(allowed).map((f) => `${f} = @${f}`).join(', ');
    db.prepare(`UPDATE users SET ${setClause} WHERE id = @id`).run({
      ...allowed,
      id: req.user.id,
    });
    const updated = db
      .prepare('SELECT id, email, role, displayName, balance FROM users WHERE id = ?')
      .get(req.user.id);
    res.json(updated);
  });

  // ✅ XSS — sortie encodée (échappement HTML) avant insertion dans la page.
  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
  app.post('/api/comments', (req, res) => {
    db.prepare('INSERT INTO comments (author, body) VALUES (?, ?)').run(
      String(req.body.author || 'anon'),
      String(req.body.body || '')
    );
    res.status(201).json({ ok: true });
  });
  app.get('/comments', (req, res) => {
    const rows = db.prepare('SELECT author, body FROM comments').all();
    const html = rows
      .map((c) => `<div class="comment"><b>${escapeHtml(c.author)}</b>: ${escapeHtml(c.body)}</div>`)
      .join('\n');
    res.set('Content-Type', 'text/html');
    res.send(`<!doctype html><html><body><h1>Commentaires</h1>${html}</body></html>`);
  });

  // ✅ FUITE D'INFORMATION — message générique au client, détail dans les logs.
  app.get('/api/boom', (req, res) => {
    throw new Error('Connexion DB échouée: user=admin host=10.0.0.5');
  });
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err); // log interne uniquement
    res.status(500).json({ error: 'Internal Server Error' });
  });

  app.locals.db = db;
  return app;
}

module.exports = { createApp, JWT_SECRET };
