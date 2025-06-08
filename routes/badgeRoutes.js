// routes/badgeRoutes.js
const express = require('express');
const { dbGet } = require('../db');
const checkAuth = require('../middlewares/auth');
const router = express.Router();

router.get('/', checkAuth, async (req, res) => {
  console.log('GET /api/badges requested by user', req.session.userId);
  try {
    const badges = await dbGet(`
      SELECT
        -- Top trader (0 si aucun trade)
        COALESCE((
          SELECT user_id
            FROM trades
           GROUP BY user_id
           ORDER BY COUNT(*) DESC
           LIMIT 1
        ), 0) AS trader,
        -- Top Snake uniquement si score > 0
        COALESCE((
          SELECT id
            FROM users
           WHERE snake_best_score > 0
           ORDER BY snake_best_score DESC
           LIMIT 1
        ), 0) AS snake,
        -- Top Pong uniquement si score > 0
        COALESCE((
          SELECT id
            FROM users
           WHERE pong_best_score > 0
           ORDER BY pong_best_score DESC
           LIMIT 1
        ), 0) AS pong
    `);
    console.log('Badges from DB:', badges);
    res.json(badges);
  } catch (err) {
    console.error('Erreur get badges:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

module.exports = router;
