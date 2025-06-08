// routes/countryRoutes.js
const express = require('express');
const { dbAll } = require('../db');
const checkAuth = require('../middlewares/auth');

const router = express.Router();

// GET /api/countries
router.get('/', checkAuth, async (req, res) => {
  try {
    const rows = await dbAll(
      'SELECT id,name,tax_rate,housing_cost,entry_fee,revenue FROM countries'
    );
    res.json(rows);
  } catch (err) {
    console.error('Countries error:', err);
    res.status(500).json({ error: 'db_error' });
  }
}); // server.js : app.get('/api/countries', …) :contentReference[oaicite:7]{index=7}

module.exports = router;
