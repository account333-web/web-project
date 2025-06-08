import { WINDOW_MS } from './constants.js';

export function aggregatePerMinute(raw) {
  const grouped = {};
  raw.forEach(p => {
    const iso  = p.x.includes('T') ? p.x : p.x.replace(' ', 'T') + 'Z';
    const date = new Date(iso);
    const key  = Math.floor(date.getTime() / 60000) * 60000;
    if (!grouped[key]) grouped[key] = { open:+p.open, high:+p.high, low:+p.low, close:+p.close };
    else {
      grouped[key].high  = Math.max(grouped[key].high, +p.high);
      grouped[key].low   = Math.min(grouped[key].low,  +p.low);
      grouped[key].close = +p.close;
    }
  });
  return Object.entries(grouped)
    .map(([ms, ohlc]) => ({ x:new Date(+ms), y:[ohlc.open, ohlc.high, ohlc.low, ohlc.close] }))
    .sort((a,b)=>a.x-b.x);
}