// routes/rankingRoutes.js
const express = require('express');
const { dbAll } = require('../db');
const checkAuth = require('../middlewares/auth');

const router = express.Router();

// GET /api/rankings/countries
router.get('/countries', checkAuth, async (req, res) => {
  try {
    const rows = await dbAll(
      'SELECT name, revenue FROM countries ORDER BY revenue DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Rankings countries error:', err);
    res.status(500).json({ error: 'db_error' });
  }
}); // extrait de votre ancien server.js :contentReference[oaicite:0]{index=0}:contentReference[oaicite:1]{index=1}

// GET /api/rankings/companies
router.get('/companies', checkAuth, async (req, res) => {
  try {
    const rows = await dbAll(
      'SELECT name, capital FROM companies ORDER BY capital DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Rankings companies error:', err);
    res.status(500).json({ error: 'db_error' });
  }
}); // extrait de votre ancien server.js :contentReference[oaicite:2]{index=2}:contentReference[oaicite:3]{index=3}

// GET /api/rankings/players
router.get('/players', checkAuth, async (req, res) => {
  try {
    // On récupère aussi l'ID pour que le front puisse faire playerId = Number(p.id)
    const rows = await dbAll(
      `SELECT
         id,
         username   AS name,
         balance,
         avatar_url
       FROM users
       ORDER BY balance DESC
       LIMIT 10`
    );
    const players = rows.map(r => ({
      id:         r.id,
      name:       r.name,
      balance:    Math.round(r.balance),
      avatar_url: r.avatar_url || '/avatars/default.png'
    }));
    res.json(players);
  } catch (err) {
    console.error('Rankings players error:', err);
    res.status(500).json({ error: 'db_error' });
  }
}); // extrait de votre ancien server.js :contentReference[oaicite:4]{index=4}:contentReference[oaicite:5]{index=5}

module.exports = router;
