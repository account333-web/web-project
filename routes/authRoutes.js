// routes/authRoutes.js
const express = require('express');
const bcrypt  = require('bcrypt');
const { dbGet, dbRun } = require('../db');

const router = express.Router();

// Clé : pseudo ou IP → { count, lastFailureTime, lockedUntil }
const loginFailures = {};

const MAX_FAILURES = 5;
const LOCK_TIME = 5 * 60 * 1000; // 5 minutes

function loginRateLimiter(req, res, next) {
  const key = req.body.pseudo || req.ip;
  const record = loginFailures[key];
  const now = Date.now();

  if (record && record.lockedUntil && now < record.lockedUntil) {
    return res.status(429).send('Compte temporairement verrouillé, réessayez plus tard.');
  }
  next();
}

router.post('/login', loginRateLimiter, async (req, res) => {
  const { pseudo, password } = req.body;
  const key = pseudo || req.ip;
  if (!pseudo || !password) {
    return res.redirect('/index.html?error=missing');
  }
  try {
    const row = await dbGet(
      'SELECT id,password_hash FROM users WHERE username=?',
      [pseudo]
    );
    if (!row) {
      recordFailure(key);
      return res.redirect('/index.html?error=invalid');
    }
    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) {
      recordFailure(key);
      return res.redirect('/index.html?error=invalid');
    }
    // Réussite : réinitialisation des échecs
    if (loginFailures[key]) delete loginFailures[key];
    req.session.userId = row.id;
    req.session.username = pseudo;
    res.redirect('/dashboard.html');
  } catch (err) {
    console.error('Login error:', err);
    res.redirect('/index.html?error=server');
  }
});

function recordFailure(key) {
  const now = Date.now();
  if (!loginFailures[key]) {
    loginFailures[key] = { count: 1, lastFailureTime: now };
  } else {
    loginFailures[key].count++;
    loginFailures[key].lastFailureTime = now;
  }
  if (loginFailures[key].count >= MAX_FAILURES) {
    loginFailures[key].lockedUntil = now + LOCK_TIME;
    console.warn(`Verrouillage temporaire du compte/IP ${key}`);
  }
}

// POST /signup
router.post('/signup', async (req, res) => {
  const { pseudo, password } = req.body;
  if (!pseudo || !password) return res.redirect('/signup.html?error=missing');
  // Nouveau : longueur max 8
  if (pseudo.length > 8) {
    return res.redirect('/signup.html?error=length');
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    await dbRun(
      'INSERT INTO users(username,password_hash,balance) VALUES(?,?,10000)',
      [pseudo, hash]
    );
    const user = await dbGet('SELECT id FROM users WHERE username=?', [pseudo]);
    req.session.userId = user.id;
    req.session.username = pseudo;
    res.redirect('/dashboard.html');
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      res.redirect('/signup.html?error=exists');
    } else {
      console.error('Signup error:', err);
      res.redirect('/signup.html?error=server');
    }
  }
});

module.exports = router;
