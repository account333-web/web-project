import ApexCharts from 'https://cdn.jsdelivr.net/npm/apexcharts@3.41.0/dist/apexcharts.esm.min.js';
import { WINDOW_MS } from './constants.js';
import { aggregatePerMinute } from './aggregator.js';
let ccChart;

export async function initClickcoinChart() {
   // on calcule la coupure et on l’envoie au server
  const sinceISO = new Date(Date.now() - WINDOW_MS).toISOString();
  const url = `/api/clickcoin/history?since=${encodeURIComponent(sinceISO)}`;
  console.log('→ fetching history:', url);
  const resp = await fetch(url, { credentials: 'include' });
  console.log('→ URL fetch history:', url);
  console.log('→ Status fetch history:', resp.status);
  const raw = await resp.json();
  console.log('→ Raw history payload:', raw);
  const cutoff   = Date.now() - WINDOW_MS;
  const series   = aggregatePerMinute(raw).filter(pt=>pt.x.getTime()>=cutoff);
  window.seriesData  = [...series];
  window.liveCandle  = null;

  const cfg = {
    series: [{ name:'ClickCoin', data: series }],
    chart:  { type:'candlestick', height:300, toolbar:{show:true}, animations:{enabled:false} },
    plotOptions:{candlestick:{colors:{upward:'#00B746',downward:'#EF403C'},wick:{useFillColor:true}}},
    xaxis:{type:'datetime',range:WINDOW_MS,labels:{datetimeUTC:false}},
    yaxis:{tooltip:{enabled:true},title:{text:'Prix (CC)'}},
    annotations:{yaxis:[]}
  };
  ccChart = new ApexCharts(document.querySelector('#clickcoin-chart'), cfg);
  await ccChart.render();
}

export function subscribeClickcoinSSE() {
  if (!window.EventSource) return;
  const es = new EventSource('/api/stream');
  es.onmessage = evt => {
    const d = JSON.parse(evt.data);
    if (d.assetType!=='clickcoin') return;
    updCandle(d.close, new Date(d.x));
  };
  es.onerror = () => { es.close(); setTimeout(subscribeClickcoinSSE,3000); };
}

function updCandle(price,timestamp=new Date()) {
  if (!ccChart) return;
  const ts  = timestamp.getTime();
  const key = Math.floor(ts/60000)*60000;
  if (!window.liveCandle || window.liveCandle.key!==key) {
    if (window.liveCandle) {
      window.seriesData.push({ x:window.liveCandle.start, y:[window.liveCandle.open,window.liveCandle.high,window.liveCandle.low,window.liveCandle.close] });
      window.seriesData = window.seriesData.filter(pt=>pt.x.getTime()>=Date.now()-WINDOW_MS);
    }
    window.liveCandle = { key:key, start:new Date(key), open:price, high:price, low:price, close:price };
  } else {
    window.liveCandle.high  = Math.max(window.liveCandle.high,price);
    window.liveCandle.low   = Math.min(window.liveCandle.low, price);
    window.liveCandle.close = price;
  }
  const display = [...window.seriesData, { x:window.liveCandle.start, y:[window.liveCandle.open,window.liveCandle.high,window.liveCandle.low,window.liveCandle.close] }];
  ccChart.updateSeries([{ data:display }],false);
  updateChartAnnotation(price);
}

function updateChartAnnotation(price) {
  ccChart.updateOptions({ annotations:{ yaxis:[{ y:price,borderColor:'#FF4560',label:{borderColor:'#FF4560',style:{color:'#fff',background:'#FF4560'},text:`Prix courant : ${price.toFixed(4)}`}}] }},false,true);
}