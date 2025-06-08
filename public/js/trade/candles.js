import { WINDOW_MS } from './config.js';
import { state } from './state.js';
import { updateTradeInfo } from './chart.js';
import { updateInvestmentsTable } from './investments.js';
import { API } from './config.js';

// ─── Agrégation de l’historique par minute ────────────────────────────────
export function aggregatePerMinute(raw) {
  const grouped = {};
  raw.forEach(p => {
    const iso  = p.x.includes('T') ? p.x : p.x.replace(' ', 'T') + 'Z';
    const date = new Date(iso);
    const key  = Math.floor(date.getTime() / 60000) * 60000;
    if (!grouped[key]) {
      grouped[key] = { open:+p.open, high:+p.high, low:+p.low, close:+p.close };
    } else {
      grouped[key].high  = Math.max(grouped[key].high,  +p.high);
      grouped[key].low   = Math.min(grouped[key].low,   +p.low);
      grouped[key].close = +p.close;
    }
  });
  return Object.entries(grouped)
    .map(([ms, ohlc]) => ({
      x: new Date(+ms),
      y: [ohlc.open, ohlc.high, ohlc.low, ohlc.close]
    }))
    .sort((a,b) => a.x - b.x);
}

// ─── SSE & candles “live” ───────────────────────────────────────────────────
function updCandle(price, timestamp = new Date()) {
  // si le chart n'est pas encore initialisé, on ignore
  if (!state.chart) return;

  const ts    = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const key   = Math.floor(ts.getTime() / 60000);

  // nouvelle minute ?
  if (!state.liveCandle || state.liveCandle.key !== key) {
    // on clôture l'ancienne
    if (state.liveCandle) {
      state.seriesData.push({
        x: state.liveCandle.start,
        y: [state.liveCandle.open, state.liveCandle.high, state.liveCandle.low, state.liveCandle.close]
      });
      // on conserve que les dernières 15 min
      const cutoff = Date.now() - WINDOW_MS;
      state.seriesData = state.seriesData.filter(pt => pt.x.getTime() >= cutoff);
    }
    // démarrage de la nouvelle bougie
    state.liveCandle = {
      key:   key,
      start: new Date(key * 60000),
      open:  price,
      high:  price,
      low:   price,
      close: price
    };
  } else {
    // mise à jour intra-minute
    state.liveCandle.high  = Math.max(state.liveCandle.high,  price);
    state.liveCandle.low   = Math.min(state.liveCandle.low,   price);
    state.liveCandle.close = price;
  }

  // redraw du chart
  const display = [
    ...state.seriesData,
    { x: state.liveCandle.start, y: [state.liveCandle.open, state.liveCandle.high, state.liveCandle.low, state.liveCandle.close] }
  ];
  state.chart.updateSeries([{ data: display }], false);

  // update infos et tableau
  updateTradeInfo(price);
  updateInvestmentsTable(price);
}

// réception des ticks SSE
function handleStreamEvent(e) {
  const d = JSON.parse(e.data);
  let code = null;
  if (d.assetType === 'clickcoin')       code = 'clickcoin';
  else if (d.assetType === 'company')    code = `company-${d.assetId}`;
  if (!code || code !== state.dom.assetSelect.value) return;

  state.lastPrice = d.close;
  const ts   = d.x ? new Date(d.x) : new Date();
  updCandle(state.lastPrice, ts);
}

const evtSource = new EventSource(API.stream);
evtSource.onmessage = handleStreamEvent;