// marketUpdater.js
// Boucle de mise à jour des prix avec random walk symétrique et drift nul
const update = 1000; // 1 seconde
const { distributeSalaries } = require('./services/salaryService');
const { applyTaxes } = require('./services/taxService');

module.exports = function setupMarketLoops(dbGet, dbRun, dbAll, broadcastPrice, EVENT_INTERVAL_MS) {
  console.log('[BOOT] Initialisation des boucles de marché…');

  function gaussianRandom() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function generateOHLC(open, close, volatility) {
    const rangeFactor = Math.abs(gaussianRandom()) * volatility;
    const high = Math.max(open, close) * (1 + rangeFactor);
    const low = Math.max(0.01, Math.min(open, close) * (1 - rangeFactor));
    return { high, low };
  }

  async function processClickcoin() {
    try {
      const row = await dbGet(`SELECT close FROM price_history WHERE asset_type='clickcoin' ORDER BY recorded_at DESC LIMIT 1`);
      const prevClose = row?.close ?? 1.0;
      const open = prevClose;
      const drift = 0;
      const volatility = 0.005;
      const rnd = gaussianRandom();
      const pctChange = drift + rnd * volatility;
      const close = +(open * (1 + pctChange)).toFixed(4);
      const { high, low } = generateOHLC(open, close, volatility);
      const ts = new Date().toISOString();

      await dbRun(`INSERT INTO price_history(asset_type,asset_id,open,high,low,close) VALUES(?,?,?,?,?,?)`,
        ['clickcoin', null, open, high, low, close]);
      broadcastPrice('clickcoin', null, open, high, low, close, ts);

      console.log(`[ClickCoin] ${ts} - open=${open}, close=${close}`);
    } catch (err) {
      console.error('processClickcoin error:', err);
    }
  }

  async function processCompanyEventsAndProductivity() {
    try {
      const companies = await dbAll('SELECT id, name, shares_outstanding FROM companies');
      console.log(`[CompanyTick] ${companies.length} entreprises traitées.`);

      for (const c of companies) {
        const row = await dbGet(
          `SELECT close FROM price_history
           WHERE asset_type='company' AND asset_id=?
           ORDER BY recorded_at DESC
           LIMIT 1`, [c.id]
        );
        const prevClose = row?.close ?? 1.0;
        const open = prevClose;
        const drift = 0;
        const volatility = 0.01;
        const rnd = gaussianRandom();
        const pctChange = drift + rnd * volatility;
        const close = +(open * (1 + pctChange)).toFixed(4);
        const { high, low } = generateOHLC(open, close, volatility * 1.5);
        const ts = new Date().toISOString();

        // Employés de l’entreprise (corrigé avec company_id)
        const r = await dbGet('SELECT COUNT(*) AS cnt FROM users WHERE company_id = ?', [c.id]);
        const employeeCount = r?.cnt ?? 0;

        // Capital actuel
        const capRow = await dbGet('SELECT capital FROM companies WHERE id = ?', [c.id]);
        const oldCapital = capRow?.capital ?? 0;

        // Variation aléatoire du capital ±5 %
        const deltaPct = (Math.random() * 0.1) - 0.05;
        const randomDelta = Math.round(oldCapital * deltaPct);

        // Bonus basé sur les employés
        const employeeBonus = employeeCount * 10;

        // Nouveau capital total
        let newCapital = oldCapital + randomDelta + employeeBonus;
        newCapital = Math.max(0, newCapital); // Pas de capital négatif

        await dbRun('UPDATE companies SET capital = ? WHERE id = ?', [newCapital, c.id]);

        // Logs détaillés
        console.log(`↳ [${c.name}] Employés=${employeeCount} | Capital initial=${oldCapital} | Δ aléatoire=${randomDelta} | Bonus=${employeeBonus} → Nouveau capital=${newCapital} | Prix=${close}`);

        await dbRun(`INSERT INTO price_history(asset_type,asset_id,open,high,low,close) VALUES(?,?,?,?,?,?)`,
          ['company', c.id, open, high, low, close]);
        broadcastPrice('company', c.id, open, high, low, close, ts);
      }
    } catch (err) {
      console.error('processCompanyEventsAndProductivity error:', err);
    }
  }

  async function processSalariesAndTaxes() {
    console.log('[💸] Distribution des salaires…');
    await distributeSalaries();
    console.log('[💰] Application des impôts…');
    await applyTaxes();
  }

  // Démarrage initial + boucles
  processClickcoin();
  setInterval(processClickcoin, EVENT_INTERVAL_MS);

  processCompanyEventsAndProductivity();
  setInterval(processCompanyEventsAndProductivity, EVENT_INTERVAL_MS);

  processSalariesAndTaxes();
  setInterval(processSalariesAndTaxes, 60_000);

  console.log('[✔️] Boucles de marché activées.');
};
