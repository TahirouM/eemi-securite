// Base de données de démonstration (version sécurisée).
// Les mots de passe sont stockés HACHÉS (bcrypt), jamais en clair.
const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');

function createDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      email TEXT UNIQUE,
      passwordHash TEXT,
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

  const hash = (pw) => bcrypt.hashSync(pw, 8);
  const insUser = db.prepare(
    'INSERT INTO users (id, email, passwordHash, role, displayName, balance) VALUES (?,?,?,?,?,?)'
  );
  insUser.run(1, 'alice@example.com', hash('alicepw'), 'user', 'Alice', 100);
  insUser.run(2, 'bob@example.com', hash('bobpw'), 'user', 'Bob', 50);
  insUser.run(3, 'admin@example.com', hash('adminpw'), 'admin', 'Admin', 9999);

  const insOrder = db.prepare('INSERT INTO orders (id, userId, item, amount) VALUES (?,?,?,?)');
  insOrder.run(101, 1, 'Clavier', 1);
  insOrder.run(102, 2, 'Souris', 1);

  return db;
}

module.exports = { createDb };
