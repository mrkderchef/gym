'use strict';

const STORE_KEY = 'gym-data-v1';
const WEIGHT_STEP = 2.5;
const DAY_MS = 864e5;

const view = document.getElementById('view');
const tooltip = document.getElementById('tooltip');

let db = loadDb();
let timerHandle = null;
let chartKey = null;

/* ---------- Daten ---------- */

function loadDb() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY));
    if (data && data.plan && Array.isArray(data.sessions)) return data;
  } catch {}
  return { plan: structuredClone(DEFAULT_PLAN), sessions: [], active: null };
}

function saveDb() {
  localStorage.setItem(STORE_KEY, JSON.stringify(db));
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const norm = s => String(s || '').trim().toLowerCase();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const parseNum = v => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const fmtNum = n => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','));
const fmtInt = n => Math.round(n).toLocaleString('de-DE');
const setsLabel = n => `${n} ${n === 1 ? 'Satz' : 'Sätze'}`;
const muscleName = m => MUSCLES[m] || m || '–';

const findDay = id => db.plan.days.find(d => d.id === id);
const setVolume = s => (s.w || 0) * (s.r || 0);
const sessionSets = s => s.exercises.reduce((n, e) => n + e.sets.length, 0);
const sessionVolume = s => s.exercises.reduce((n, e) => n + e.sets.reduce((m, x) => m + setVolume(x), 0), 0);

// Letzte Ausführung einer Übung: gleiche ID oder gleicher Name (falls die Übung an mehreren Tagen vorkommt).
function lastPerformance(planEx) {
  for (let i = db.sessions.length - 1; i >= 0; i--) {
    const ex = db.sessions[i].exercises.find(e => e.exId === planEx.id || norm(e.name) === norm(planEx.name));
    if (ex && ex.sets.length) return { session: db.sessions[i], ex };
  }
  return null;
}

function lastSessionOfDay(dayId) {
  for (let i = db.sessions.length - 1; i >= 0; i--) {
    if (db.sessions[i].dayId === dayId) return db.sessions[i];
  }
  return null;
}

function nextDay() {
  const days = db.plan.days;
  if (!days.length) return null;
  const last = db.sessions[db.sessions.length - 1];
  const idx = last ? days.findIndex(d => d.id === last.dayId) : -1;
  return days[(idx + 1) % days.length];
}

/* ---------- Datum ---------- */

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - yearStart) / DAY_MS + 1) / 7);
}

const dayKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
const fmtDate = ts => new Date(ts).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtShortDate = ts => new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

function relDay(ts) {
  const diff = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / DAY_MS);
  if (diff <= 0) return 'heute';
  if (diff === 1) return 'gestern';
  return `vor ${diff} Tagen`;
}

function fmtDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = n => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

const fmtMinutes = ms => `${Math.max(1, Math.round(ms / 60000))} min`;

/* ---------- UI-Helfer ---------- */

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function confirmDialog(title, text, okLabel = 'OK', danger = false) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `
      <h2>${esc(title)}</h2>
      <p>${esc(text)}</p>
      <div class="row-btns" style="justify-content:flex-end">
        <button class="btn ghost" value="no">Abbrechen</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" value="yes">${esc(okLabel)}</button>
      </div>`;
    dlg.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (btn) dlg.close(btn.value);
    });
    dlg.addEventListener('close', () => {
      resolve(dlg.returnValue === 'yes');
      dlg.remove();
    });
    document.body.appendChild(dlg);
    dlg.showModal();
  });
}

function showTip(text, x, y) {
  tooltip.textContent = text;
  tooltip.hidden = false;
  const w = tooltip.offsetWidth;
  const clamped = Math.min(Math.max(x, w / 2 + 8), window.innerWidth - w / 2 - 8);
  tooltip.style.left = clamped + 'px';
  tooltip.style.top = y + 'px';
}

function hideTip() {
  tooltip.hidden = true;
}

function showTipFor(el) {
  const r = el.getBoundingClientRect();
  showTip(el.dataset.tip, r.left + r.width / 2, r.top);
}

document.addEventListener('pointerdown', e => {
  const t = e.target.closest('[data-tip]');
  if (t) showTipFor(t);
  else if (!e.target.closest('[data-chart]')) hideTip();
});
document.addEventListener('pointerover', e => {
  if (e.pointerType !== 'mouse') return;
  const t = e.target.closest('[data-tip]');
  if (t) showTipFor(t);
});
document.addEventListener('pointerout', e => {
  if (e.pointerType === 'mouse' && e.target.closest('[data-tip]')) hideTip();
});
window.addEventListener('scroll', hideTip, { passive: true });

/* ---------- Router ---------- */

const routes = [
  [/^#?\/?$/, renderDashboard, 'dashboard'],
  [/^#\/train$/, renderTrain, 'train'],
  [/^#\/history$/, renderHistory, 'history'],
  [/^#\/history\/(.+)$/, renderSessionDetail, 'history'],
  [/^#\/plan$/, renderPlan, 'plan'],
  [/^#\/plan\/day\/(.+)$/, renderPlanDay, 'plan'],
  [/^#\/plan\/ex\/([^/]+)\/(.+)$/, renderExerciseForm, 'plan'],
];

function route() {
  clearInterval(timerHandle);
  hideTip();
  const hash = location.hash || '#/';
  for (const [re, fn, tab] of routes) {
    const m = hash.match(re);
    if (!m) continue;
    document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
    fn(...m.slice(1).map(decodeURIComponent));
    window.scrollTo(0, 0);
    return;
  }
  location.hash = '#/';
}

window.addEventListener('hashchange', route);

/* ---------- Dashboard ---------- */

const heatLevel = n => (n === 0 ? 0 : n < 4 ? 1 : n < 8 ? 2 : n < 12 ? 3 : n < 18 ? 4 : 5);
const HEAT_LABELS = ['0', '1–3', '4–7', '8–11', '12–17', '18+'];

function renderDashboard() {
  const now = new Date();
  const weekStart = startOfWeek(now).getTime();
  const thisWeek = db.sessions.filter(s => s.date >= weekStart);
  const hour = now.getHours();
  const greeting = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Hallo' : 'Guten Abend';

  view.innerHTML = `
    <header class="page-head">
      <p class="sub">${now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h1>${greeting} 💪</h1>
    </header>
    ${heroCard()}
    <div class="stats">
      <div class="stat"><div class="val">${thisWeek.length}</div><div class="lbl">Trainings diese Woche</div></div>
      <div class="stat"><div class="val">${thisWeek.reduce((n, s) => n + sessionSets(s), 0)}</div><div class="lbl">Sätze diese Woche</div></div>
      <div class="stat"><div class="val">${fmtInt(thisWeek.reduce((n, s) => n + sessionVolume(s), 0))}<small style="font-size:15px"> kg</small></div><div class="lbl">Volumen diese Woche</div></div>
      <div class="stat"><div class="val">${db.sessions.length}</div><div class="lbl">Trainings gesamt</div></div>
    </div>
    ${muscleBarsCard()}
    ${heatmapCard()}
    ${progressCard()}
    ${calendarCard()}
  `;
  bindChart();
}

function heroCard() {
  if (db.active) {
    const a = db.active;
    const done = a.exercises.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0);
    const total = a.exercises.reduce((n, e) => n + e.sets.length, 0);
    return `
      <section class="card hero">
        <p class="sub">Training läuft · seit ${fmtMinutes(Date.now() - a.start)}</p>
        <h2>${esc(a.dayName)}</h2>
        <p class="sub">${done} von ${total} Sätzen erledigt</p>
        <a class="btn block" href="#/train">Weiter trainieren</a>
      </section>`;
  }
  const day = nextDay();
  if (!day) {
    return `<section class="card hero"><h2>Noch kein Plan</h2><a class="btn block" href="#/plan">Plan anlegen</a></section>`;
  }
  const last = lastSessionOfDay(day.id);
  return `
    <section class="card hero">
      <p class="sub">Nächstes Training</p>
      <h2>${esc(day.name)}</h2>
      <p class="sub">${day.exercises.length} Übungen · ${last ? 'zuletzt ' + relDay(last.date) : 'noch nie gemacht'}</p>
      <button class="btn block" data-action="start" data-day="${esc(day.id)}">Training starten</button>
    </section>`;
}

function setsPerMuscle(from, to) {
  const out = Object.fromEntries(Object.keys(MUSCLES).map(k => [k, { sets: 0, vol: 0 }]));
  for (const s of db.sessions) {
    if (s.date < from || s.date >= to) continue;
    for (const e of s.exercises) {
      const m = (out[e.muscle] ||= { sets: 0, vol: 0 });
      m.sets += e.sets.length;
      m.vol += e.sets.reduce((n, x) => n + setVolume(x), 0);
    }
  }
  return out;
}

function muscleBarsCard() {
  const to = Date.now();
  const data = setsPerMuscle(to - 7 * DAY_MS, to + 1);
  const rows = Object.entries(data).sort((a, b) => b[1].sets - a[1].sets);
  const max = Math.max(22, ...rows.map(r => r[1].sets));
  const pct = v => (v / max) * 100;
  return `
    <section class="card">
      <div class="card-head"><h2>Sätze pro Muskelgruppe</h2><span class="sub">letzte 7 Tage</span></div>
      <div class="bars">
        ${rows.map(([k, v]) => `
          <div class="bar-row" data-tip="${esc(muscleName(k))}: ${v.sets} Sätze · ${fmtInt(v.vol)} kg Volumen">
            <span class="name">${esc(muscleName(k))}</span>
            <div class="bar-track">
              <div class="bar-zone" style="left:${pct(10)}%;width:${pct(20) - pct(10)}%"></div>
              <div class="bar-fill ${v.sets ? '' : 'zero'}" style="width:${pct(v.sets)}%"></div>
            </div>
            <span class="num">${v.sets}</span>
          </div>`).join('')}
      </div>
      <div class="legend-line"><span><span class="sw" style="background:var(--accent-soft);border:1px dashed var(--muted)"></span>Richtwert 10–20 Sätze pro Woche</span></div>
    </section>`;
}

function heatmapCard() {
  const WEEKS = 8;
  const thisWeek = startOfWeek(new Date());
  const weeks = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - 7 * i);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    weeks.push({ kw: isoWeek(start), data: setsPerMuscle(start.getTime(), end.getTime()) });
  }
  const cols = `grid-template-columns: 84px repeat(${WEEKS}, 1fr)`;
  return `
    <section class="card">
      <div class="card-head"><h2>Muskel-Heatmap</h2><span class="sub">Sätze pro Woche</span></div>
      <div class="heat" style="${cols}">
        ${Object.keys(MUSCLES).map(k => `
          <span class="hname">${esc(muscleName(k))}</span>
          ${weeks.map(w => {
            const n = w.data[k].sets;
            return `<span class="cell" style="background:var(--seq-${heatLevel(n)})" data-tip="${esc(muscleName(k))} · KW ${w.kw}: ${n} Sätze"></span>`;
          }).join('')}`).join('')}
        <span class="wk" style="text-align:left">KW</span>
        ${weeks.map(w => `<span class="wk">${w.kw}</span>`).join('')}
      </div>
      <div class="heat-scale">
        <span style="margin-right:4px">Sätze:</span>
        ${HEAT_LABELS.map((l, i) => `<span class="cell" style="background:var(--seq-${i})" data-tip="${l} Sätze"></span>`).join('')}
        <span style="margin-left:4px">0 → 18+</span>
      </div>
    </section>`;
}

function chartOptions() {
  const opts = new Map();
  const add = (name, id) => {
    const key = norm(name);
    if (!key) return;
    if (!opts.has(key)) opts.set(key, { key, name, ids: new Set() });
    opts.get(key).ids.add(id);
  };
  db.plan.days.forEach(d => d.exercises.forEach(e => add(e.name, e.id)));
  db.sessions.forEach(s => s.exercises.forEach(e => add(e.name, e.exId)));
  return [...opts.values()];
}

function progressPoints(opt) {
  const pts = [];
  for (const s of db.sessions) {
    for (const e of s.exercises) {
      if (!(opt.ids.has(e.exId) || norm(e.name) === opt.key) || !e.sets.length) continue;
      const top = e.sets.reduce((a, b) => ((b.w || 0) > (a.w || 0) ? b : a));
      pts.push({ x: s.date, y: top.w || 0, r: top.r });
    }
  }
  return pts;
}

function progressCard() {
  const opts = chartOptions();
  if (!opts.length) return '';
  if (!opts.some(o => o.key === chartKey)) {
    // Standard: die am häufigsten trainierte Übung
    chartKey = opts.map(o => [o.key, progressPoints(o).length]).sort((a, b) => b[1] - a[1])[0][0];
  }
  const opt = opts.find(o => o.key === chartKey);
  const pts = progressPoints(opt);
  let body;
  if (!pts.length) {
    body = `<p class="empty">Noch keine Daten. Sobald du die Übung trainierst, siehst du hier deinen Verlauf.</p>`;
  } else {
    const diff = pts[pts.length - 1].y - pts[0].y;
    const best = Math.max(...pts.map(p => p.y));
    body = `
      <p class="delta">Bestes Top-Set <b>${fmtNum(best)} kg</b> · seit Start <b>${diff >= 0 ? '+' : '−'}${fmtNum(Math.abs(diff))} kg</b></p>
      <div class="chart-wrap">${lineChart(pts)}</div>`;
  }
  return `
    <section class="card">
      <div class="card-head"><h2>Fortschritt</h2><span class="sub">Top-Gewicht pro Training</span></div>
      <select data-change="chart" style="margin-bottom:12px">
        ${opts.map(o => `<option value="${esc(o.key)}" ${o.key === chartKey ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}
      </select>
      ${body}
    </section>`;
}

function niceTicks(min, max, count) {
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
  const ticks = [];
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + 1e-9; v += step) {
    ticks.push(Math.round(v * 100) / 100);
  }
  return ticks;
}

let chartState = null;

function lineChart(pts) {
  const W = 320, H = 170, PL = 34, PR = 10, PT = 10, PB = 22;
  let lo = Math.min(...pts.map(p => p.y)), hi = Math.max(...pts.map(p => p.y));
  if (hi - lo < 5) { lo -= 2.5; hi += 2.5; }
  const ticks = niceTicks(Math.max(0, lo), hi, 4);
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const x0 = pts[0].x, span = pts[pts.length - 1].x - x0;
  const sx = x => (span ? PL + ((x - x0) / span) * (W - PL - PR) : PL + (W - PL - PR) / 2);
  const sy = y => PT + (1 - (y - y0) / (y1 - y0)) * (H - PT - PB);
  const coords = pts.map(p => [sx(p.x), sy(p.y)]);
  const path = coords.map((c, i) => `${i ? 'L' : 'M'}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join('');
  const base = H - PB;
  const area = coords.length > 1 ? `${path}L${coords[coords.length - 1][0].toFixed(1)},${base}L${coords[0][0].toFixed(1)},${base}Z` : '';
  chartState = { pts, coords, W, H, PT, base };
  const showDots = pts.length <= 20;
  return `
    <svg viewBox="0 0 ${W} ${H}" data-chart style="touch-action: pan-y" role="img" aria-label="Verlauf Top-Gewicht">
      ${ticks.map(t => `
        <line class="gridline" x1="${PL}" x2="${W - PR}" y1="${sy(t)}" y2="${sy(t)}"/>
        <text class="axis" x="${PL - 6}" y="${sy(t) + 4}" text-anchor="end">${fmtNum(t)}</text>`).join('')}
      <path class="area" d="${area}"/>
      <path class="line" d="${path}"/>
      ${coords.map((c, i) => (showDots || i === coords.length - 1) ? `<circle class="pt" cx="${c[0]}" cy="${c[1]}" r="4"/>` : '').join('')}
      <text class="axis" x="${PL}" y="${H - 4}">${fmtShortDate(pts[0].x)}</text>
      ${pts.length > 1 ? `<text class="axis" x="${W - PR}" y="${H - 4}" text-anchor="end">${fmtShortDate(pts[pts.length - 1].x)}</text>` : ''}
      <g class="hover" visibility="hidden">
        <line class="cross" y1="${PT}" y2="${base}"/>
        <circle class="pt" r="6"/>
      </g>
    </svg>`;
}

function bindChart() {
  const svg = view.querySelector('[data-chart]');
  if (!svg || !chartState) return;
  const { pts, coords, W } = chartState;
  const hover = svg.querySelector('.hover');
  const move = e => {
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    coords.forEach((c, i) => { if (Math.abs(c[0] - x) < Math.abs(coords[best][0] - x)) best = i; });
    const [cx, cy] = coords[best];
    hover.setAttribute('visibility', 'visible');
    hover.querySelector('line').setAttribute('x1', cx);
    hover.querySelector('line').setAttribute('x2', cx);
    hover.querySelector('circle').setAttribute('cx', cx);
    hover.querySelector('circle').setAttribute('cy', cy);
    const p = pts[best];
    const scale = r.width / W;
    showTip(`${fmtShortDate(p.x)} · ${fmtNum(p.y)} kg × ${p.r ?? '–'}`, r.left + cx * scale, r.top + cy * scale);
  };
  const leave = () => { hover.setAttribute('visibility', 'hidden'); hideTip(); };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointerleave', leave);
}

function calendarCard() {
  const WEEKS = 17;
  const today = startOfDay(new Date());
  const start = startOfWeek(today);
  start.setDate(start.getDate() - 7 * (WEEKS - 1));
  const byDay = new Map();
  db.sessions.forEach(s => {
    const k = dayKey(s.date);
    byDay.set(k, [...(byDay.get(k) || []), s.dayName]);
  });
  let count = 0;
  const cells = [];
  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    if (d > today) { cells.push('<span></span>'); continue; }
    const names = byDay.get(dayKey(d));
    if (names) count += names.length;
    const label = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
    const cls = ['d', names ? 'on' : '', +d === +today ? 'today' : ''].join(' ');
    cells.push(`<span class="${cls}" data-tip="${esc(label)}${names ? ' · ' + esc(names.join(', ')) : ' · kein Training'}"></span>`);
  }
  return `
    <section class="card">
      <div class="card-head"><h2>Aktivität</h2><span class="sub">${count} Trainings in ${WEEKS} Wochen</span></div>
      <div class="cal">${cells.join('')}</div>
    </section>`;
}

/* ---------- Training ---------- */

function renderTrain() {
  if (db.active) return renderActiveSession();
  const next = nextDay();
  view.innerHTML = `
    <header class="page-head">
      <h1>Training</h1>
      <p class="sub">Welchen Tag trainierst du heute?</p>
    </header>
    ${db.plan.days.map(d => {
      const last = lastSessionOfDay(d.id);
      return `
        <button class="card day-card ${next && d.id === next.id ? 'next' : ''}" data-action="start" data-day="${esc(d.id)}">
          <div class="info">
            <h3>${esc(d.name)}${next && d.id === next.id ? '<span class="badge">Nächstes</span>' : ''}</h3>
            <p class="ex-list">${esc(d.exercises.map(e => e.name).join(' · ') || 'Keine Übungen')}</p>
            <p class="sub">${last ? 'Zuletzt ' + relDay(last.date) : 'Noch nie gemacht'}</p>
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--muted)"><path d="M9 6l6 6-6 6-1.4-1.4L12.2 12 7.6 7.4z"/></svg>
        </button>`;
    }).join('') || `<p class="empty">Noch keine Trainingstage. <a href="#/plan">Plan anlegen</a></p>`}
  `;
}

function startSession(dayId) {
  const day = findDay(dayId);
  if (!day) return;
  db.active = {
    id: uid(),
    dayId: day.id,
    dayName: day.name,
    start: Date.now(),
    exercises: day.exercises.map(ex => {
      const prev = lastPerformance(ex)?.ex.sets || [];
      return {
        exId: ex.id,
        name: ex.name,
        muscle: ex.muscle,
        sets: Array.from({ length: ex.sets }, (_, i) => {
          // Gewicht und Wiederholungen immer vom letzten Training übernehmen
          const p = prev[i] || prev[prev.length - 1];
          return { w: p?.w ?? null, r: p?.r ?? null, done: false };
        }),
      };
    }),
  };
  saveDb();
  if (location.hash === '#/train') route();
  else location.hash = '#/train';
}

const CHECK_ICON = '<svg viewBox="0 0 24 24"><path d="M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.4-1.4z"/></svg>';

function renderActiveSession() {
  const a = db.active;
  const done = a.exercises.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0);
  const total = a.exercises.reduce((n, e) => n + e.sets.length, 0);
  view.innerHTML = `
    <div class="session-bar">
      <div style="flex:1;min-width:0">
        <h3>${esc(a.dayName)}</h3>
        <div class="timer"><span id="timer">${fmtDuration(Date.now() - a.start)}</span> · ${done}/${total} Sätze</div>
        <div class="progress"><div style="width:${total ? (done / total) * 100 : 0}%"></div></div>
      </div>
      <button class="btn primary small" data-action="finish">Fertig</button>
    </div>
    ${a.exercises.map((e, i) => exerciseCard(e, i)).join('')}
    <button class="btn ghost block danger" data-action="discard" style="margin-top:8px">Training verwerfen</button>
  `;
  timerHandle = setInterval(() => {
    const el = document.getElementById('timer');
    if (el && db.active) el.textContent = fmtDuration(Date.now() - db.active.start);
  }, 1000);
}

function exerciseCard(e, i) {
  const prev = lastPerformance({ id: e.exId, name: e.name });
  const complete = e.sets.length && e.sets.every(s => s.done);
  const lastLine = prev
    ? `Letztes Mal (${relDay(prev.session.date)}): ${prev.ex.sets.map(s => `${fmtNum(s.w) || '0'}×${s.r}`).join(' · ')}`
    : 'Erstes Mal – trag dein Startgewicht ein';
  return `
    <section class="card ex-card ${complete ? 'complete' : ''}">
      <div class="ex-head">
        <div style="min-width:0">
          <h3>${esc(e.name)}</h3>
          <div class="last"><span class="tag">${esc(muscleName(e.muscle))}</span> ${setsLabel(e.sets.length)}</div>
        </div>
        <div class="adjust">
          <button class="icon-btn" style="width:auto;padding:0 10px;font-size:14px" data-action="wAll" data-ex="${i}" data-d="-1">−${fmtNum(WEIGHT_STEP)}</button>
          <button class="icon-btn" style="width:auto;padding:0 10px;font-size:14px" data-action="wAll" data-ex="${i}" data-d="1">+${fmtNum(WEIGHT_STEP)}</button>
        </div>
      </div>
      <p class="last">${esc(lastLine)}</p>
      <div class="sets">
        <div class="set-head"><span>Satz</span><span>kg</span><span></span><span>Wdh</span><span></span></div>
        ${e.sets.map((s, j) => `
          <div class="set-row ${s.done ? 'done' : ''}">
            <span class="n">${j + 1}</span>
            <input type="text" inputmode="decimal" autocomplete="off" placeholder="kg" value="${fmtNum(s.w)}" data-input="w" data-ex="${i}" data-set="${j}">
            <span class="x">×</span>
            <input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="Wdh" value="${s.r ?? ''}" data-input="r" data-ex="${i}" data-set="${j}">
            <button class="check" data-action="toggle" data-ex="${i}" data-set="${j}" aria-label="Satz erledigt">${CHECK_ICON}</button>
          </div>`).join('')}
      </div>
      <div class="set-tools">
        <button class="btn small" data-action="addSet" data-ex="${i}">+ Satz</button>
        <button class="btn small ghost" data-action="removeSet" data-ex="${i}" ${e.sets.length ? '' : 'disabled'}>− Satz</button>
      </div>
    </section>`;
}

async function finishSession() {
  const a = db.active;
  const total = a.exercises.reduce((n, e) => n + e.sets.length, 0);
  const done = a.exercises.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0);
  if (!done) {
    if (await confirmDialog('Keine Sätze abgehakt', 'Hake erledigte Sätze mit ✓ ab. Training ohne Speichern beenden?', 'Verwerfen', true)) {
      db.active = null;
      saveDb();
      location.hash = '#/';
    }
    return;
  }
  const text = done < total
    ? `${done} von ${total} Sätzen erledigt. Nicht abgehakte Sätze werden nicht gespeichert.`
    : `Alle ${total} Sätze erledigt. Starke Leistung!`;
  if (!(await confirmDialog('Training beenden?', text, 'Speichern'))) return;
  const session = {
    id: a.id,
    dayId: a.dayId,
    dayName: a.dayName,
    date: a.start,
    duration: Date.now() - a.start,
    exercises: a.exercises
      .map(e => ({
        exId: e.exId,
        name: e.name,
        muscle: e.muscle,
        sets: e.sets.filter(s => s.done).map(s => ({ w: s.w ?? 0, r: s.r ?? 0 })),
      }))
      .filter(e => e.sets.length),
  };
  db.sessions.push(session);
  db.active = null;
  saveDb();
  toast('Training gespeichert ✓');
  location.hash = '#/history/' + session.id;
}

/* ---------- Verlauf ---------- */

function renderHistory() {
  const list = [...db.sessions].reverse();
  view.innerHTML = `
    <header class="page-head">
      <h1>Verlauf</h1>
      <p class="sub">${db.sessions.length} Trainings</p>
    </header>
    ${list.map(s => `
      <a class="card hist-item" href="#/history/${esc(s.id)}">
        <div class="top"><h3>${esc(s.dayName)}</h3><span class="sub">${relDay(s.date)}</span></div>
        <p class="meta">${fmtDate(s.date)} · ${fmtMinutes(s.duration || 0)} · ${sessionSets(s)} Sätze · ${fmtInt(sessionVolume(s))} kg</p>
      </a>`).join('') || '<p class="empty">Noch keine Trainings gespeichert.</p>'}
  `;
}

function renderSessionDetail(id) {
  const s = db.sessions.find(x => x.id === id);
  if (!s) { location.hash = '#/history'; return; }
  view.innerHTML = `
    <header class="page-head">
      <a href="#/history" class="sub" style="text-decoration:none">‹ Verlauf</a>
      <h1>${esc(s.dayName)}</h1>
      <p class="sub">${fmtDate(s.date)} · ${fmtMinutes(s.duration || 0)} · ${sessionSets(s)} Sätze · ${fmtInt(sessionVolume(s))} kg Volumen</p>
    </header>
    <section class="card">
      ${s.exercises.map(e => `
        <div class="hist-ex">
          <div class="top" style="display:flex;justify-content:space-between;gap:8px"><h3>${esc(e.name)}</h3><span class="tag">${esc(muscleName(e.muscle))}</span></div>
          <p class="sets-line">${e.sets.map(x => `${fmtNum(x.w)} kg × ${x.r}`).join(' · ')}</p>
        </div>`).join('')}
    </section>
    <button class="btn ghost block danger" data-action="deleteSession" data-id="${esc(s.id)}">Training löschen</button>
  `;
}

/* ---------- Plan ---------- */

function renderPlan() {
  view.innerHTML = `
    <header class="page-head">
      <h1>Trainingsplan</h1>
      <p class="sub">${db.plan.days.length} Trainingstage</p>
    </header>
    ${db.plan.days.map(d => `
      <section class="card">
        <div class="card-head"><h2>${esc(d.name)}</h2><a class="btn small" href="#/plan/day/${encodeURIComponent(d.id)}">Bearbeiten</a></div>
        ${d.exercises.map(e => `
          <div class="plan-ex">
            <div><div>${esc(e.name)}</div><div class="meta">${setsLabel(e.sets)} · ${esc(muscleName(e.muscle))}</div></div>
          </div>`).join('') || '<p class="sub">Keine Übungen</p>'}
      </section>`).join('')}
    <button class="btn block" data-action="addDay">+ Trainingstag</button>

    <section class="card" style="margin-top:24px">
      <h2>Daten & Backup</h2>
      <p class="sub">Alle Daten liegen nur auf diesem Gerät. Exportiere ab und zu ein Backup.</p>
      <div class="row-btns">
        <button class="btn small" data-action="export">Backup exportieren</button>
        <label class="btn small">Backup importieren<input type="file" accept="application/json,.json" data-change="import" hidden></label>
        <button class="btn small ghost" data-action="resetPlan">Standardplan laden</button>
      </div>
    </section>
  `;
}

function renderPlanDay(dayId) {
  const d = findDay(dayId);
  if (!d) { location.hash = '#/plan'; return; }
  view.innerHTML = `
    <header class="page-head">
      <a href="#/plan" class="sub" style="text-decoration:none">‹ Plan</a>
      <h1>${esc(d.name)}</h1>
    </header>
    <section class="card">
      <label class="field">Name des Trainingstags
        <input type="text" value="${esc(d.name)}" data-change="dayName" data-day="${esc(d.id)}">
      </label>
    </section>
    <section class="card">
      <div class="card-head"><h2>Übungen</h2></div>
      ${d.exercises.map((e, i) => `
        <div class="plan-ex">
          <div><div>${esc(e.name)}</div><div class="meta">${setsLabel(e.sets)} · ${esc(muscleName(e.muscle))}</div></div>
          <div class="tools">
            <button class="icon-btn" data-action="moveEx" data-day="${esc(d.id)}" data-i="${i}" data-d="-1" aria-label="Nach oben" ${i ? '' : 'disabled'}>↑</button>
            <button class="icon-btn" data-action="moveEx" data-day="${esc(d.id)}" data-i="${i}" data-d="1" aria-label="Nach unten" ${i < d.exercises.length - 1 ? '' : 'disabled'}>↓</button>
            <a class="icon-btn" href="#/plan/ex/${encodeURIComponent(d.id)}/${encodeURIComponent(e.id)}" aria-label="Bearbeiten" style="text-decoration:none">✎</a>
          </div>
        </div>`).join('') || '<p class="sub">Noch keine Übungen</p>'}
      <a class="btn block" style="margin-top:12px" href="#/plan/ex/${encodeURIComponent(d.id)}/new">+ Übung</a>
    </section>
    <button class="btn ghost block danger" data-action="deleteDay" data-day="${esc(d.id)}">Trainingstag löschen</button>
  `;
}

function renderExerciseForm(dayId, exId) {
  const d = findDay(dayId);
  if (!d) { location.hash = '#/plan'; return; }
  const e = d.exercises.find(x => x.id === exId) || { id: 'new', name: '', muscle: 'brust', sets: 2 };
  view.innerHTML = `
    <header class="page-head">
      <a href="#/plan/day/${encodeURIComponent(d.id)}" class="sub" style="text-decoration:none">‹ ${esc(d.name)}</a>
      <h1>${e.id === 'new' ? 'Neue Übung' : esc(e.name)}</h1>
    </header>
    <form class="card" id="exForm">
      <div class="form-grid">
        <label class="field full">Name<input type="text" name="name" required value="${esc(e.name)}" placeholder="z. B. Bankdrücken"></label>
        <label class="field full">Muskelgruppe
          <select name="muscle">${Object.entries(MUSCLES).map(([k, v]) => `<option value="${k}" ${k === e.muscle ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
        </label>
        <label class="field full">Standard-Sätze<input type="number" name="sets" min="1" max="10" inputmode="numeric" required value="${e.sets}"></label>
      </div>
      <div class="row-btns">
        <button class="btn primary" type="submit" style="flex:1">Speichern</button>
        ${e.id === 'new' ? '' : `<button class="btn danger" type="button" data-action="deleteEx" data-day="${esc(d.id)}" data-ex="${esc(e.id)}">Löschen</button>`}
      </div>
    </form>
  `;
  document.getElementById('exForm').addEventListener('submit', ev => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    const data = {
      name: String(f.get('name')).trim(),
      muscle: f.get('muscle'),
      sets: Math.max(1, parseInt(f.get('sets'), 10) || 2),
    };
    if (!data.name) return;
    if (e.id === 'new') d.exercises.push({ id: uid(), ...data });
    else Object.assign(e, data);
    saveDb();
    location.hash = '#/plan/day/' + encodeURIComponent(d.id);
  });
}

/* ---------- Backup ---------- */

async function exportData() {
  const name = `gym-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Gym Backup' }); return; } catch (err) { if (err.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importData(input) {
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data?.plan?.days || !Array.isArray(data.sessions)) throw new Error('format');
    if (!(await confirmDialog('Backup importieren?', `${data.sessions.length} Trainings und ${data.plan.days.length} Trainingstage. Die aktuellen Daten werden ersetzt.`, 'Importieren', true))) return;
    data.sessions.sort((a, b) => a.date - b.date);
    db = data;
    saveDb();
    toast('Backup importiert ✓');
    route();
  } catch {
    toast('Datei ist kein gültiges Backup');
  }
}

/* ---------- Aktionen ---------- */

const actions = {
  start: el => startSession(el.dataset.day),
  finish: () => finishSession(),
  async discard() {
    if (await confirmDialog('Training verwerfen?', 'Alle Einträge dieses Trainings gehen verloren.', 'Verwerfen', true)) {
      db.active = null;
      saveDb();
      location.hash = '#/';
    }
  },
  toggle(el) {
    const e = db.active.exercises[el.dataset.ex];
    const s = e.sets[el.dataset.set];
    if (!s.done && s.r == null) {
      view.querySelector(`input[data-input="r"][data-ex="${el.dataset.ex}"][data-set="${el.dataset.set}"]`)?.focus();
      toast('Erst Wiederholungen eintragen');
      return;
    }
    s.done = !s.done;
    saveDb();
    renderActiveSession();
  },
  wAll(el) {
    const e = db.active.exercises[el.dataset.ex];
    const d = +el.dataset.d * WEIGHT_STEP;
    e.sets.forEach(s => { if (!s.done) s.w = Math.max(0, (s.w || 0) + d); });
    saveDb();
    renderActiveSession();
  },
  addSet(el) {
    const e = db.active.exercises[el.dataset.ex];
    const last = e.sets[e.sets.length - 1];
    e.sets.push({ w: last?.w ?? null, r: last?.r ?? null, done: false });
    saveDb();
    renderActiveSession();
  },
  removeSet(el) {
    const e = db.active.exercises[el.dataset.ex];
    e.sets.pop();
    saveDb();
    renderActiveSession();
  },
  async deleteSession(el) {
    if (!(await confirmDialog('Training löschen?', 'Das kann nicht rückgängig gemacht werden.', 'Löschen', true))) return;
    db.sessions = db.sessions.filter(s => s.id !== el.dataset.id);
    saveDb();
    location.hash = '#/history';
  },
  addDay() {
    const day = { id: uid(), name: `Tag ${db.plan.days.length + 1}`, exercises: [] };
    db.plan.days.push(day);
    saveDb();
    location.hash = '#/plan/day/' + encodeURIComponent(day.id);
  },
  async deleteDay(el) {
    const d = findDay(el.dataset.day);
    if (!(await confirmDialog(`„${d.name}“ löschen?`, 'Der Verlauf bleibt erhalten.', 'Löschen', true))) return;
    db.plan.days = db.plan.days.filter(x => x !== d);
    saveDb();
    location.hash = '#/plan';
  },
  moveEx(el) {
    const d = findDay(el.dataset.day);
    const i = +el.dataset.i, j = i + +el.dataset.d;
    [d.exercises[i], d.exercises[j]] = [d.exercises[j], d.exercises[i]];
    saveDb();
    renderPlanDay(d.id);
  },
  async deleteEx(el) {
    const d = findDay(el.dataset.day);
    if (!(await confirmDialog('Übung löschen?', 'Der Verlauf bleibt erhalten.', 'Löschen', true))) return;
    d.exercises = d.exercises.filter(x => x.id !== el.dataset.ex);
    saveDb();
    location.hash = '#/plan/day/' + encodeURIComponent(d.id);
  },
  export: () => exportData(),
  async resetPlan() {
    if (!(await confirmDialog('Standardplan laden?', 'Der aktuelle Plan wird ersetzt. Dein Verlauf bleibt erhalten.', 'Laden', true))) return;
    db.plan = structuredClone(DEFAULT_PLAN);
    saveDb();
    renderPlan();
  },
};

const inputs = {
  w(el) {
    const e = db.active.exercises[el.dataset.ex];
    const j = +el.dataset.set;
    const old = e.sets[j].w;
    const val = parseNum(el.value);
    e.sets[j].w = val;
    // Folgesätze mit gleichem Gewicht ziehen mit
    for (let k = j + 1; k < e.sets.length; k++) {
      const s = e.sets[k];
      if (s.done || s.w !== old) break;
      s.w = val;
      const other = view.querySelector(`input[data-input="w"][data-ex="${el.dataset.ex}"][data-set="${k}"]`);
      if (other) other.value = fmtNum(val);
    }
    saveDb();
  },
  r(el) {
    const n = parseInt(el.value, 10);
    db.active.exercises[el.dataset.ex].sets[el.dataset.set].r = Number.isFinite(n) ? n : null;
    saveDb();
  },
};

const changes = {
  chart(el) {
    chartKey = el.value;
    renderDashboard();
  },
  dayName(el) {
    const d = findDay(el.dataset.day);
    d.name = el.value.trim() || d.name;
    saveDb();
    renderPlanDay(d.id);
  },
  import: el => importData(el),
};

view.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (el && !el.disabled) actions[el.dataset.action]?.(el, e);
});
view.addEventListener('input', e => {
  const el = e.target.closest('[data-input]');
  if (el) inputs[el.dataset.input]?.(el, e);
});
view.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el) changes[el.dataset.change]?.(el, e);
});
// Beim Antippen eines Felds den Inhalt markieren, damit man direkt überschreiben kann
view.addEventListener('focusin', e => {
  if (e.target.matches('.set-row input')) setTimeout(() => e.target.select(), 0);
});

/* ---------- Start ---------- */

navigator.storage?.persist?.();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}
route();
