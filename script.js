// ---------- sync helpers ----------
function link(slider, num) {
  slider.addEventListener('input', () => num.value = slider.value);
  num.addEventListener('input', () => {
    const v = +num.value;
    if (!isNaN(v)) slider.value = Math.min(v, slider.max);
  });
}

// Elements
const attSlider   = document.getElementById('attackerSlider');
const attNumber   = document.getElementById('attackerNumber');
const defSlider   = document.getElementById('defenderSlider');
const defNumber   = document.getElementById('defenderNumber');
const simsInput   = document.getElementById('simulations');
const btn         = document.getElementById('calculateBtn');

const curAttS     = document.getElementById('curAtt');
const curDefS     = document.getElementById('curDef');
const mpoAttS     = document.getElementById('mpoAtt');
const mpoDefS     = document.getElementById('mpoDef');
const winAttS     = document.getElementById('winAtt');
const winDefS     = document.getElementById('winDef');
const riskP       = document.getElementById('riskIndex');
const resDiv      = document.getElementById('results');

link(attSlider, attNumber);
link(defSlider, defNumber);

// ---------- Chart ----------
const ctx = document.getElementById('mpoChart').getContext('2d');
const mpoChart = new Chart(ctx, {
  type: 'line',
  data: { labels: [], datasets: [
      { data: [], borderColor: '#ff5252', borderWidth: 2, pointRadius: 0, tension: .25 },
      { data: [], borderColor: '#448aff', borderWidth: 2, pointRadius: 0, tension: .25 }
    ]},
  options: {
    plugins: { legend: { display: false } },
    scales: {
      x: { display: false },
      y: {
        ticks: { color: getCSS('--fg') },
        grid: { color: 'rgba(255,255,255,0.08)' }
      }
    },
    responsive: true,
    maintainAspectRatio: false
  }
});

function getCSS(v){ return getComputedStyle(document.documentElement).getPropertyValue(v); }

// ---------- Simulation ----------
const roll = () => Math.floor(Math.random() * 6) + 1;

btn.addEventListener('click', () => {
  const A0 = +attNumber.value;
  const D0 = +defNumber.value;
  const N  = +simsInput.value;

  if (A0 < 1 || D0 < 1 || N < 1) { alert('Values must be positive'); return; }

  // display initial
  curAttS.textContent = A0;
  curDefS.textContent = D0;
  resDiv.classList.remove('hidden');

  // trackers
  let winA = 0;
  const outcomeMap = new Map(); // final outcome counts
  const netDiffArr = [];        // for risk factor

  // per‑roll modal maps (array of Map)
  let attMaps = [], defMaps = [];

  for (let s = 0; s < N; s++) {
    let a = A0, d = D0, rollIx = 0;

    while (a > 0 && d > 0) {
      const ad = Math.min(3, a);  // attacker dice
      const dd = Math.min(3, d);  // defender dice (Risiko rule)

      const ar = Array.from({length: ad}, roll).sort((x,y) => y - x);
      const dr = Array.from({length: dd}, roll).sort((x,y) => y - x);

      const fights = Math.min(ad, dd);
      for (let i = 0; i < fights; i++) {
        if (attMaps.length <= rollIx) { attMaps.push(new Map()); defMaps.push(new Map()); }

        // record remaining BEFORE casualties
        attMaps[rollIx].set(a, (attMaps[rollIx].get(a) || 0) + 1);
        defMaps[rollIx].set(d, (defMaps[rollIx].get(d) || 0) + 1);

        if (ar[i] > dr[i]) d--; else a--;
        rollIx++;
        if (a === 0 || d === 0) break;
      }
    }

    if (d === 0) winA++;
    const key = \`\${a}|\${d}\`;
    outcomeMap.set(key, (outcomeMap.get(key) || 0) + 1);

    netDiffArr.push(a - d); // risk metric base
  }

  // ---- chart data: modal (most probable) remaining per roll ----
  const len = attMaps.length;
  const attMPO = [];
  const defMPO = [];
  for (let i = 0; i < len; i++) {
    attMPO.push(modalValue(attMaps[i]));
    defMPO.push(modalValue(defMaps[i]));
  }
  mpoChart.data.labels = Array.from({length: len}, (_, i) => i + 1);
  mpoChart.data.datasets[0].data = attMPO;
  mpoChart.data.datasets[1].data = defMPO;
  mpoChart.update();

  // ---- most probable final outcome ----
  let mpoKey = '', mpoCnt = 0;
  outcomeMap.forEach((cnt, key) => { if (cnt > mpoCnt) { mpoCnt = cnt; mpoKey = key; }});
  const [mpoA, mpoD] = mpoKey.split('|').map(Number);
  mpoAttS.textContent = mpoA;
  mpoDefS.textContent = mpoD;

  // ---- win percentages ----
  const winPctA = (winA / N * 100).toFixed(1);
  const winPctD = (100 - winPctA).toFixed(1);
  winAttS.textContent = winPctA + '%';
  winDefS.textContent = winPctD + '%';

  // ---- risk index (σ of netDiff) ----
  const mean = netDiffArr.reduce((p,c)=>p+c,0) / N;
  const variance = netDiffArr.reduce((p,c)=>p + (c - mean) ** 2, 0) / N;
  const sigma = Math.sqrt(variance);
  const risk = (sigma / (A0 + D0)).toFixed(3); // normalized
  riskP.textContent = 'Risk factor: ' + risk;
});

// modal helper
function modalValue(map) {
  let mode = 0, max = -1;
  map.forEach((cnt, val) => { if (cnt > max) { max = cnt; mode = val; }});
  return mode;
}
