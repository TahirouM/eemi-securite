// Base de données de démonstration (aucune dépendance native à compiler).
// - SQL : module intégré `node:sqlite` (SQL réel → vraie injection SQL).
// - "NoSQL" : petit store en mémoire qui imite la sémantique des requêtes objet
//   de MongoDB (égalité + opérateurs $ne / $gt) pour démontrer une vraie
//   injection NoSQL sans serveur Mongo.
const { DatabaseSync } = require('node:sqlite');

function createDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user',
      displayName TEXT,
      balance INTEGER DEFAULT 0
    );
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY,
      userId INTEGER,
      item TEXT,
      amount INTEGER
    );
    CREATE TABLE comments (
      id INTEGER PRIMARY KEY,
      author TEXT,
      body TEXT
    );
  `);

  const insUser = db.prepare(
    'INSERT INTO users (id, email, password, role, displayName, balance) VALUES (?,?,?,?,?,?)'
  );
  insUser.run(1, 'alice@example.com', 'alicepw', 'user', 'Alice', 100);
  insUser.run(2, 'bob@example.com', 'bobpw', 'user', 'Bob', 50);
  insUser.run(3, 'admin@example.com', 'adminpw', 'admin', 'Admin', 9999);

  const insOrder = db.prepare('INSERT INTO orders (id, userId, item, amount) VALUES (?,?,?,?)');
  insOrder.run(101, 1, 'Clavier', 1);
  insOrder.run(102, 2, 'Souris', 1);

  return db;
}

// Imitation minimale d'une collection MongoDB pour la démo d'injection NoSQL.
function matchValue(stored, query) {
  if (query !== null && typeof query === 'object') {
    if ('$ne' in query) return stored !== query.$ne;
    if ('$gt' in query) return stored > query.$gt;
    if ('$gte' in query) return stored >= query.$gte;
    return false;
  }
  return stored === query;
}

function makeUserCollection(rows) {
  return {
    findOne(filter) {
      return (
        rows.find((row) =>
          Object.keys(filter).every((k) => matchValue(row[k], filter[k]))
        ) || null
      );
    },
  };
}

module.exports = { createDb, makeUserCollection };
