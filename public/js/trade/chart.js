import { aggregatePerMinute } from './candles.js';
import { WINDOW_MS } from './config.js';
import { state } from './state.js';
import { updateInvestmentsTable } from './investments.js';
import { API } from './config.js';

// ─── Initialisation du graphique ────────────────────────────────────────────
export async function initChart(asset) {
  let url, name;
  if (asset === 'clickcoin') {
    url  = API.clickcoinHistory;
    name = 'ClickCoin';
  } else if (asset.startsWith('company-')) {
    const id = asset.split('-')[1];
    url  = API.companyHistory.id;
    name = state.dom.assetSelect.querySelector(`option[value="${asset}"]`).textContent;
  } else return;

  const sinceISO = new Date(Date.now() - WINDOW_MS).toISOString();
  const rawData = await (await csrfFetch(`${url}?since=${sinceISO}`)).json();

  // 2) Agrège et filtre les 15 dernières minutes
  const cutoff     = Date.now() - WINDOW_MS;
  const allCandles = aggregatePerMinute(rawData)
                        .filter(pt => pt.x.getTime() >= cutoff);

  // 3) Détecte si la dernière bougie correspond à la minute en cours
  const nowKey      = Math.floor(Date.now() / 60000) * 60000;
  const last        = allCandles[allCandles.length - 1];
  if (last && last.x.getTime() === nowKey) {
    // on retire cette bougie de la série fermée…
    state.seriesData = allCandles.slice(0, -1);
    // …et on la transforme en state.liveCandle
    const [o, h, l, c] = last.y;
    state.liveCandle = {
      key:   Math.floor(nowKey / 60000),
      start: new Date(nowKey),
      open:  o, high: h, low: l, close: c
    };
  } else {
    state.seriesData = allCandles;
    state.liveCandle = null;
  }

  // Titre
  state.dom.chartTitle.textContent = `Cours de ${name}`;
  // Re-création du chart
  if (state.chart) {
    state.chart.destroy();
    document.querySelector('#trade-chart').innerHTML = '';
  }
  state.chart = new ApexCharts(document.querySelector('#trade-chart'), {
    series: [{ name, data: [
      ...state.seriesData,
      // si on a déjà une state.liveCandle, on l’affiche dès le départ
      ...(state.liveCandle
          ? [{ x: state.liveCandle.start, y: [state.liveCandle.open, state.liveCandle.high, state.liveCandle.low, state.liveCandle.close] }]
          : [])
    ] }],
    chart: {
      type: 'candlestick',
      height: 350,
      animations: { enabled: false },
      toolbar: { show: true }
    },
    plotOptions: {
      candlestick: {
        colors: { upward: '#00B746', downward: '#EF403C' },
        wick: { useFillColor: true }
      }
    },
    xaxis: { type: 'datetime', range: WINDOW_MS },
    yaxis: { tooltip: { enabled: true }, title: { text: 'Prix (CC)' } },
    annotations: { yaxis: [] }
  });
  await state.chart.render();
  removeSkeleton();
  if (state.lastPrice !== null) {
    updateTradeInfo(state.lastPrice);
  }
  
  // après le render, si on avait une bougie partielle, on l'affiche dans l'annotation
  if (state.liveCandle) {
    updateTradeInfo(state.liveCandle.close);
    updateInvestmentsTable(state.liveCandle.close);
  }
}

// ─── Mise à jour des prix d’achat/vente & annotation ────────────────────────
export function updateTradeInfo(price) {
  // 1) Mise à jour du prix d'achat, de vente et du spread (vous pouvez conserver votre logique)
  document.getElementById('buy-price' ).textContent = (price * 1.01).toFixed(4);
  document.getElementById('sell-price').textContent = (price * 0.99).toFixed(4);
  document.getElementById('spread'     ).textContent = (price * 0.02).toFixed(4);
  
  // 2) Annotation “Prix courant” sur le chart
  state.chart.updateOptions({
    annotations: {
      yaxis: [{
        y: price,
        borderColor: '#FF4560',
        label: {
          borderColor: '#FF4560',
          style: { color: '#fff', background: '#FF4560' },
          text: `Prix courant : ${price.toFixed(4)}`
        }
      }]
    }
  }, false, true);

  // 3) CALCUL DU P/L DE L’ACTIF SÉLECTIONNÉ
  // Filtrer les positions pour l'actif sélectionné
  const code = state.dom.assetSelect.value;
  const pos  = state.investments.filter(inv => inv.asset_code === code);

  if (pos.length === 0) {
    // Pas de position => on affiche “--”
    document.getElementById('pl-percent').textContent = '--';
    document.getElementById('pl-cc'     ).textContent = '--';
    return;
  }

  // Somme des coûts d'achat et des quantités
  const totalCost = pos.reduce((sum, inv) => sum + inv.buy_price * inv.quantity, 0);
  const totalQty  = pos.reduce((sum, inv) => sum + inv.quantity, 0);

  // Valeur courante et P/L
  const currentValue = totalQty * price;
  const plCC    = currentValue - totalCost;
  const plPct   = totalCost > 0 ? (plCC / totalCost) * 100 : 0;

  // 4) Affichage
  document.getElementById('pl-cc').textContent      = `${plCC.toFixed(4)} CC`;
  document.getElementById('pl-percent').textContent = `${plPct.toFixed(2)} %`;
}

// ─── Helpers Skeleton ──────────────────────────────────────────────────────
function removeSkeleton() {
  // supprime les éléments <span class="skeleton"> insérés en HTML
  document.querySelectorAll('.skeleton').forEach(el => {
    // si c’est un span, on le retire entièrement…
    if (el.tagName === 'SPAN') el.remove();
    // …sinon (ex: #trade-chart) on enlève juste la classe
    else el.classList.remove('skeleton');
  });
}