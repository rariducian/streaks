import { DAYS, MOVES, MOVE_NOUNS, FAST_PRESETS, FAST_STAGES, WORK_SEC_CHOICES, DEFAULT_WORK_SEC } from './data.js';
import { isGuidePending } from './form/pending.js';
import {
  todayStr, addDays, defaultState, sessionPlan, placeFromCalibration, applyCalibration, finishSession,
  trainingDates, fastingDates, computeStreak, heatmap, runningFast, startFast, endFast, editFast,
  deleteFast, fastStage, fastStats, moveTrend, moveProgress, recentEvents, growthOffer,
  acceptGrowth, dismissGrowth, barUnlockDue, setPullupBar, backupDue, markBackedUp, rangeOf, repTotals, sessionTotals
} from './logic.js';
import { load, save, exportJSON, importJSON } from './store.js';
import { ensureGame, syncRewards, offlineCatchUp, buyStat, buyFocus, canAscend, ascend, buyTalent, respec, forge, forgeCost, toggleLock, equip, findItem } from './game/engine.js';
import { viewTower, mountTower, unmountTower, towerMounted, refreshTowerUi, gearSheet, invSheet, invPatch, mountInv, unmountInv, newInv, equipMsg, heroHit, AFF_NAME } from './game/view.js';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtClock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`; };
const fmtH = (h) => { const m = Math.round((h || 0) * 60); return `${Math.floor(m / 60)}h ${pad(m % 60)}m`; };
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dmy = (d) => `${d.getDate()} ${MON[d.getMonth()]}`;
const fmtWhen = (iso) => { const d = new Date(iso); return `${dmy(d)}, ${d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`; };
const toLocalInput = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const fromLocalInput = (v) => new Date(v).toISOString();
const weekDates = () => {
  const t = parseDate(todayStr()); const off = (t.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => todayStr(new Date(t.getFullYear(), t.getMonth(), t.getDate() - off + i)));
};
const asList = (x) => Array.isArray(x) ? x : Object.values(x || {});
const getMove = (id) => Array.isArray(MOVES) ? MOVES.find((m) => m.id === id) : (MOVES && MOVES[id]);
const moveName = (id) => (getMove(id) || {}).name || id;
const levelOf = (id, lv) => ((getMove(id) || {}).levels || [])[lv] || { name: Number.isInteger(lv) ? `Level ${lv + 1}` : 'Retired exercise', cue: '' };
// A stored set or event can have level null (an exercise that left the ladder). It carries the old name in `legacy`.
const levelName = (rec) => (rec.level == null ? (rec.legacy || 'Retired exercise') : levelOf(rec.moveId, rec.level).name);
const dayShort = { upper: 'Upper', legs: 'Legs', full: 'Full', push: 'Push', pull: 'Pull' };
const workSecOf = () => state.settings.workSec || DEFAULT_WORK_SEC;
const rng = (id, lv) => rangeOf(id, lv, workSecOf());
const sideWord = (side) => (side === 'L' ? 'Left side' : side === 'R' ? 'Right side' : '');
const presets = () => asList(FAST_PRESETS).map((p) => ({ label: p.label ?? p.name ?? p.id, hours: p.hours ?? p.goalHours ?? null }));
const withSettings = (st, patch) => { const n = structuredClone(st); Object.assign(n.settings, patch); return n; };

const I = {
  today: '<svg aria-hidden="true" class="ic" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="4"/><path d="M8 3v4M16 3v4M8 13l2.8 2.8L16 10.5"/></svg>',
  fast: '<svg aria-hidden="true" class="ic" viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 8.5V13l3 2M9.5 2.8h5"/></svg>',
  fitness: '<svg aria-hidden="true" class="ic" viewBox="0 0 24 24"><path d="M6.5 7.5v9M17.5 7.5v9M3.5 10v4M20.5 10v4M6.5 12h11"/></svg>',
  tower: '<svg aria-hidden="true" class="ic" viewBox="0 0 24 24"><path d="M6 21V9h12v12M4 9V4.5h3V6h2.5V4.5h5V6H17V4.5h3V9M10 21v-4.5a2 2 0 0 1 4 0V21M3 21h18"/></svg>',
  progress: '<svg aria-hidden="true" class="ic" viewBox="0 0 24 24"><path d="M5 20V12M12 20V5M19 20v-5"/></svg>',
  plus: '<svg aria-hidden="true" class="ic" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  gear: '<svg aria-hidden="true" class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  clock: '<svg aria-hidden="true" class="ic sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  bolt: '<svg aria-hidden="true" class="ic sm" viewBox="0 0 24 24"><path d="M13 3L5 14h6l-1 7 8-11h-6z"/></svg>',
  check: '<svg aria-hidden="true" class="ic sm" viewBox="0 0 24 24" style="stroke-width:3"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  moon: '<svg aria-hidden="true" class="ic" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  x: '<svg aria-hidden="true" class="ic" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  info: '<svg aria-hidden="true" class="ic sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/></svg>'
};
// "Form" capsule: opens the 3D form guide for a move level. It never touches the session timer.
const formChip = (moveId, level, levelName) => isGuidePending(moveId, level) ? '' : `<button class="formchip" data-act="form" data-move="${esc(moveId)}" data-level="${level}" aria-label="Form guide: ${esc(levelName)}">${I.info}<span>Form</span></button>`;

/* ---------- app state ---------- */
let state = load();
let tab = 'today';
let sheet = null;       // { type, id?, slot?, msg? }
let sess = null;        // session UI state
let ticker = null;

function commit(next) { state = next; try { save(state); } catch (e) { toast('Could not save. Storage may be full.'); } render(); }
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); }

/* iOS-style action sheet. ask({ title, message, confirmLabel, destructive }) -> Promise<boolean>. Escape or scrim tap = cancel. */
let askOpen = null;
function ask({ title, message = '', confirmLabel = 'OK', destructive = false }) {
  if (askOpen) askOpen(false);
  return new Promise((resolve) => {
    const root = $('#ask-root'), prev = document.activeElement;
    root.innerHTML = `<div class="scrim" data-ask="cancel"></div><div class="asksheet" role="alertdialog" aria-modal="true" aria-labelledby="ask-t" ${message ? 'aria-describedby="ask-m"' : ''} tabindex="-1">
      <div class="ask-group"><div class="ask-head"><h3 id="ask-t">${esc(title)}</h3>${message ? `<p id="ask-m">${esc(message)}</p>` : ''}</div>
      <button class="ask-btn ${destructive ? 'destr' : ''}" data-ask="ok">${esc(confirmLabel)}</button></div>
      <button class="ask-cancel" data-ask="cancel">Cancel</button></div>`;
    const box = $('.asksheet', root);
    const finish = (v) => {
      askOpen = null; root.innerHTML = ''; document.removeEventListener('keydown', onKey, true); root.onclick = null;
      if (prev && prev.focus && document.contains(prev)) prev.focus({ preventScroll: true });
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      else if (e.key === 'Tab') { const b = [...box.querySelectorAll('button')], i = b.indexOf(document.activeElement); e.preventDefault(); b[(i + (e.shiftKey ? -1 : 1) + b.length) % b.length].focus(); }
    };
    askOpen = finish;
    root.onclick = (e) => { const t = e.target.closest('[data-ask]'); if (t) finish(t.dataset.ask === 'ok'); };
    document.addEventListener('keydown', onKey, true);
    box.focus({ preventScroll: true });
  });
}

/* ---------- SVG bits ---------- */
function ring({ r, stroke, pct, color, size, track, label, attr = 'data-ring', extra = '' }) {
  const c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(1, pct)));
  const a11y = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"';
  return `<svg viewBox="0 0 ${size} ${size}" ${a11y}><circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}"${track === 'amber' ? ' style="stroke:var(--amber);opacity:.45"' : ''}/><circle ${attr} cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" style="transition:stroke-dashoffset .6s"/>${extra}</svg>`;
}
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
// Activity-ring style card: the arc is TODAY's completion; the dots are this week (Mon to Sun).
function streakCard({ label, st, dates, pct, color, meta, now, attr }) {
  const today = todayStr(now), set = new Set(dates), fz = new Set(st.frozenDates);
  const keep = now.getHours() >= 18 && !st.doneToday && st.current > 0;
  const days = weekDates().map((d, i) => {
    const on = set.has(d), f = !on && fz.has(d), td = d === today;
    return { l: DOW[i][0], cls: `${on ? 'on' : ''} ${f ? 'fz' : ''} ${td ? 'td' : ''}`, say: `${DOW[i]} ${on ? 'done' : f ? 'streak freeze' : td ? 'today, not yet' : d > today ? 'upcoming' : 'missed'}` };
  });
  const state_ = st.doneToday ? 'done' : pct > 0 ? `${Math.round(pct * 100)} per cent` : 'not yet';
  return `<div class="ringcard" style="--dc:${color}">${st.freezes > 0 ? `<span class="frz" aria-label="${st.freezes} streak freeze${st.freezes === 1 ? '' : 's'}">&#10052;&#xFE0E; ${st.freezes}</span>` : ''}
    <div class="ringwrap">${ring({ r: 52, stroke: 11, pct, color, size: 120, track: keep ? 'amber' : '', attr, label: `${label} today: ${state_}. Streak ${st.current} day${st.current === 1 ? '' : 's'}.` })}
    <div class="big"><div class="num">${st.current}</div><div class="unit">day${st.current === 1 ? '' : 's'} streak</div></div></div>
    <div class="ringlabel">${label}${st.doneToday ? `<span class="tick">${I.check}</span>` : ''}</div>
    <div class="ringmeta ${keep ? 'keep' : ''}">${keep ? 'Keep your streak' : meta}</div>
    <div class="week" role="img" aria-label="${label} this week: ${days.map((d) => d.say).join(', ')}">${days.map((d) => `<div class="${d.cls}" aria-hidden="true"><i></i>${d.l}</div>`).join('')}</div></div>`;
}

/* ---------- header / tabs ---------- */
function renderChrome() {
  $('#header').innerHTML = `<div class="brand"><button class="avatar" data-act="settings" aria-label="Settings">M</button><div class="wordmark">streaks&#10022;</div></div>
    <div class="pillbar"><button data-act="quick" aria-label="Quick log">${I.plus}</button><button data-act="settings" aria-label="Settings">${I.gear}</button></div>`;
  const tabs = [['today', 'Today', I.today], ['fitness', 'Fitness', I.fitness], ['tower', 'Tower', I.tower], ['fast', 'Fast', I.fast], ['progress', 'Progress', I.progress]];
  $('#tabbar').innerHTML = tabs.map(([id, l, ic]) => `<button class="${tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}"${tab === id ? ' aria-current="page"' : ''}>${ic}<span>${l}</span></button>`).join('');
  document.documentElement.style.setProperty('--tabh', ($('#tabbar').offsetHeight || 64) + 'px');
  renderPill();
}
// Running-fast accessory: glass pill above the tab bar on Today and Progress (hidden on Fast and under the session overlay).
const pillText = (ms) => { const m = Math.floor(Math.max(0, ms) / 60000); return `${Math.floor(m / 60)}:${pad(m % 60)}`; };
function renderPill() {
  const p = $('#fastpill'), run = runningFast(state), show = !!run && !sess && tab !== 'fast';
  p.hidden = !show; document.body.classList.toggle('has-pill', show);
  if (!show) return;
  p.innerHTML = `${I.moon}<span class="tnum" data-pill-elapsed>${pillText(Date.now() - new Date(run.start))}</span><span class="goal">of ${+run.goalHours}h</span>`;
  p.setAttribute('aria-label', `Fasting ${pillText(Date.now() - new Date(run.start))} of ${+run.goalHours} hours. Open Fast tab.`);
}

/* ---------- Today ---------- */
// Today's session card. Shown on Today and on Fitness.
function sessionHero(done) {
  const plan = sessionPlan(state);
  const lines = plan.moves.map((m) => `<div class="line">${I.bolt}<span>${esc(m.levelName)} &middot; ${m.needsCalibration ? 'test set first' : m.target + (m.unit === 'sec' ? ' sec' : ' reps') + (m.perSide ? ' each side' : '')}</span></div>`).join('');
  const buttons = done
    ? `<div class="donebar">Done today &#10003;</div><div class="sub-actions"><button class="link" data-act="startSession">Train again</button><button class="link" data-act="startMin">Minimum day (3 min)</button></div>`
    : `<button class="btn block" data-act="startSession">Start</button><div class="sub-actions"><button class="link" data-act="startMin">Minimum day (3 min)</button></div>`;
  return `<div class="section"><h2 class="title">Today's session</h2>
   <div class="hero"><div class="rowcard"><div class="poster ${esc(plan.dayId)}">${esc((dayShort[plan.dayId] || plan.dayName).toUpperCase())}<span class="spill o">Up next</span></div>
    <div class="rowbody"><div class="meta">Next in rotation</div><div class="rtitle">${esc(plan.dayName)} &middot; EMOM ${plan.minutes}</div>
    <div class="line">${I.clock}<span>${plan.minutes} min &middot; ${plan.workSec} s work, ${60 - plan.workSec} s rest</span></div>${lines}</div></div>${buttons}</div></div>`;
}
function viewToday() {
  const today = todayStr(), now = new Date();
  const trDates = trainingDates(state), fsDates = fastingDates(state, now);
  const tr = computeStreak(trDates, today);
  const fs = computeStreak(fsDates, today);
  const run = runningFast(state);
  const minH = state.settings.fastMinHours;
  const fHrs = run ? (now - new Date(run.start)) / 3.6e6 : 0;
  const fsPct = fs.doneToday ? 1 : run ? Math.min(1, fHrs / minH) : 0;
  const fsMeta = fs.doneToday ? 'Counted today' : run ? `${fmtH(fHrs)} of ${minH}h` : 'No fast yet today';
  const done = tr.doneToday;
  let html = `${sessionHero(done)}
  <div class="section"><div class="rings">${streakCard({ label: 'Training', st: tr, dates: trDates, pct: done ? 1 : 0, color: 'var(--green)', meta: done ? 'Done today' : 'Not trained yet', now })}${streakCard({ label: 'Fasting', st: fs, dates: fsDates, pct: fsPct, color: 'var(--purple)', meta: fsMeta, now, attr: 'data-fring' })}</div></div>`;
  if (!run) html += `<div class="section"><h2 class="title"><button class="titlebtn" data-act="tab" data-tab="fast">Fast <span class="chev" aria-hidden="true">&rsaquo;</span></button></h2>
   <button class="fastchip" data-act="tab" data-tab="fast"><div class="poster fast">FAST</div><div><div class="t">Start a fast</div><div class="small muted">Goal ${state.settings.fastGoalHours}h</div></div></button></div>`;
  const cards = [];
  const g = growthOffer(state, today);
  if (g) cards.push(`<div class="note"><h3>Ready for ${g.minutes}-minute sessions?</h3><p>You trained 5 or more days a week for 4 weeks in a row. You can add another move to each session.</p><div class="row"><button class="btn sm" data-act="growYes">Yes, grow</button><button class="link" data-act="growNo">Not now</button></div></div>`);
  if (barUnlockDue(state)) cards.push(`<div class="note"><h3>Get a pull-up bar</h3><p>You have maxed out the rows you can do with a kettlebell. A pull-up bar unlocks the next levels.</p><div class="row"><button class="btn sm" data-act="gotBar">I have a bar</button></div></div>`);
  if (backupDue(state, now)) cards.push(`<div class="note"><h3>Back up your data</h3><p>Your data lives only on this phone. Save a backup file now.</p><div class="row"><button class="btn sm" data-act="export">Export backup</button></div></div>`);
  if (cards.length) html += `<div class="section"><h2 class="title">For you</h2>${cards.join('')}</div>`;
  return html;
}

/* ---------- Fast ---------- */
function curGoal() { const r = runningFast(state); return r ? r.goalHours : state.settings.fastGoalHours; }
// Zero-style: the ring scale is the goal, so the arc hits 100% exactly at the goal.
const fastScale = (goal) => goal;
// Stage markers (4h, 12h, ...) sit on the ring, only when 0 < fromH < goal.
function stageMarks(hrs, scale, goal) {
  const c = 136, pt = (h, rad) => { const a = 2 * Math.PI * h / scale; return [(c + rad * Math.cos(a)).toFixed(1), (c + rad * Math.sin(a)).toFixed(1)]; };
  const hs = FAST_STAGES.map((s) => s.fromH).filter((h) => h > 0 && h < scale);
  let out = hs.map((h) => { const [x, y] = pt(h, 120), [lx, ly] = pt(h, 99);
    return `<circle class="mk ${hrs >= h ? 'on' : ''}" data-stage-h="${h}" cx="${x}" cy="${y}" r="4.5"/><text x="${lx}" y="${ly}" transform="rotate(90 ${lx} ${ly})" text-anchor="middle" dominant-baseline="central">${h}h</text>`; }).join('');
  return out;
}
function viewFast() {
  const run = runningFast(state), now = new Date();
  const goal = curGoal(), scale = fastScale(goal);
  const el = run ? now - new Date(run.start) : 0;
  const hrs = el / 3.6e6, st = fastStage(hrs);
  const fs = computeStreak(fastingDates(state), todayStr());
  const stats = fastStats(state, now);
  const pre = presets();
  const chips = pre.map((p) => `<button class="chip ${p.hours != null && p.hours === goal ? 'on' : ''}" data-act="preset" data-h="${p.hours ?? ''}">${esc(p.label)}</button>`).join('');
  let html = `<div class="section"><div class="fastring">${ring({ r: 120, stroke: 16, pct: run ? hrs / scale : 0, color: hrs >= goal && run ? 'var(--green)' : 'var(--purple)', size: 272, label: run ? `Fast progress: ${fmtH(hrs)} of a ${goal} hour goal` : `No fast running. Goal ${goal} hours.`, extra: stageMarks(hrs, scale, goal) })}
    <div class="mid"><div class="elapsed tnum" data-fast-elapsed>${fmtClock(el)}</div><div class="sub" data-fast-sub>${run ? subText(hrs, goal) : `Goal ${goal} hours`}</div></div></div>`;
  if (run) html += `<div class="cells"><label class="cell"><span class="cl">Started</span><span class="cv tnum">${esc(fmtWhen(run.start))}</span><span class="cs">Tap to edit</span><input id="fstart" type="datetime-local" aria-label="Started: ${esc(fmtWhen(run.start))}" value="${toLocalInput(run.start)}" max="${toLocalInput(new Date().toISOString())}" data-change="fastStart"></label>
    <button class="cell" data-act="goalSheet"><span class="cl">Goal ends</span><span class="cv tnum">${esc(fmtWhen(new Date(new Date(run.start).getTime() + run.goalHours * 3.6e6).toISOString()))}</span><span class="cs">Goal ${+run.goalHours}h &middot; tap to change</span></button></div>`;
  html += `<div class="stagebox"><div class="sl" data-stage-label>${run ? esc(st.label) : 'Not fasting'}</div><div class="sd" data-stage-detail>${run ? esc(st.detail) : 'Start a fast when you finish eating.'}</div>
    <div class="est">Estimates based on time only &mdash; bodies vary.</div></div>
    ${run ? '' : `<div class="chips">${chips}</div>`}
    <div class="actions" style="justify-content:center"><button class="btn" data-act="${run ? 'endFast' : 'startFast'}">${run ? 'End fast' : 'Start fast'}</button></div>`;
  const last = stats.history[stats.history.length - 1];
  const fsum = last ? `Last fast ${fmtH(last.hours)}. ${Math.min(7, stats.total)}-fast average ${fmtH(stats.avg7Hours)}.` : 'No completed fasts yet.';
  html += `</div><div class="section"><h2 class="title">History</h2>
    <div class="stats"><div class="stat"><b>${stats.history.length ? fmtH(stats.avg7Hours) : '-'}</b><span>7-fast avg</span></div><div class="stat"><b>${stats.total ? fmtH(stats.longestHours) : '-'}</b><span>Longest</span></div><div class="stat"><b>${fs.current}</b><span>Day streak</span></div></div>
    <p class="chartsum" style="margin-top:12px">${fsum}</p>
    <div class="chart">${fastChart(stats.history)}</div>
    <div class="hist">${stats.history.slice().reverse().map((h) => `<button data-act="editFast" data-id="${esc(h.id)}"><span>${esc(dmy(new Date(h.start)))}</span><span class="h tnum">${fmtH(h.hours)}</span></button>`).join('') || '<div class="empty">No completed fasts yet.</div>'}</div></div>`;
  return html;
}
function subText(hrs, goal) { return hrs >= goal ? `Goal reached &middot; +${fmtH(hrs - goal)}` : `${fmtH(goal - hrs)} to go &middot; goal ${goal}h`; }
function fastChart(h) {
  if (!h.length) return '<div class="empty" style="padding:20px;text-align:center">Your fasts will chart here.</div>';
  const W = 340, H = 150, pl = 26, pb = 18, pt = 8, n = 14;
  const max = Math.max(...h.map((x) => Math.max(x.hours, x.goalHours || 0)), 12) * 1.1;
  const bw = (W - pl) / n, y = (v) => pt + (H - pt - pb) * (1 - v / max);
  let g = [0, Math.round(max / 2 / 4) * 4, Math.floor(max / 4) * 4].filter((v, i, a) => a.indexOf(v) === i).map((v) => `<line x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${pl - 4}" y="${y(v) + 3}" text-anchor="end">${v}</text>`).join('');
  const off = n - h.length;
  const bars = h.map((x, i) => { const bx = pl + (i + off) * bw + 3, bh = (H - pt - pb) * x.hours / max;
    return `<rect x="${bx}" y="${H - pb - bh}" width="${bw - 6}" height="${Math.max(bh, 1)}" rx="4" fill="var(--purple)" opacity=".9"/><line x1="${bx - 2}" x2="${bx + bw - 4}" y1="${y(x.goalHours)}" y2="${y(x.goalHours)}" stroke="var(--text)" stroke-width="1.5" stroke-dasharray="2 2" opacity=".55"/><text x="${bx + (bw - 6) / 2}" y="${H - 5}" text-anchor="middle">${new Date(x.start).getDate()}</text>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Hours fasted for your last ${h.length} fast${h.length === 1 ? '' : 's'}, oldest first: ${h.map((x) => fmtH(x.hours)).join(', ')}. Dashed line is each goal.">${g}${bars}</svg><div class="legend"><span><i style="background:var(--purple)"></i>Hours fasted</span><span>- - goal</span></div>`;
}
function updateFastLive() {
  const run = runningFast(state); if (!run) return;
  const now = new Date(), el = now - new Date(run.start), hrs = el / 3.6e6, goal = run.goalHours;
  document.querySelectorAll('[data-fast-elapsed]').forEach((n) => { n.textContent = fmtClock(el); });
  document.querySelectorAll('[data-pill-elapsed]').forEach((n) => { n.textContent = pillText(el); });
  const pill = $('#fastpill'); if (pill && !pill.hidden) pill.setAttribute('aria-label', `Fasting ${pillText(el)} of ${+goal} hours. Open Fast tab.`);
  if (tab === 'today') {
    const fr = $('[data-fring]');
    if (fr) { const c = parseFloat(fr.getAttribute('stroke-dasharray')); fr.setAttribute('stroke-dashoffset', (c * (1 - Math.min(1, hrs / state.settings.fastMinHours))).toFixed(2)); }
  }
  const ringEl = $('[data-ring]'), sub = $('[data-fast-sub]');
  if (tab === 'fast' && ringEl) {
    const c = parseFloat(ringEl.getAttribute('stroke-dasharray'));
    ringEl.setAttribute('stroke-dashoffset', (c * (1 - Math.min(1, hrs / fastScale(goal)))).toFixed(2));
    ringEl.setAttribute('stroke', hrs >= goal ? 'var(--green)' : 'var(--purple)');
    if (sub) sub.innerHTML = subText(hrs, goal);
    const st = fastStage(hrs);
    $('[data-stage-label]').textContent = st.label; $('[data-stage-detail]').textContent = st.detail;
    document.querySelectorAll('[data-stage-h]').forEach((n) => n.classList.toggle('on', hrs >= +n.dataset.stageH));
  }
}

/* ---------- Progress ---------- */
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const daysIn = (dates, n, today) => { const set = new Set(dates); let c = 0; for (let i = 0; i < n; i++) if (set.has(addDays(today, -i))) c++; return c; };
function heatSvg(dates, color, name) {
  const today = todayStr();
  const st = computeStreak(dates, today);
  const weeks = heatmap(dates, st.frozenDates, today, 17);
  const c = 15, gp = 3, left = 14, top = 14;
  const W = left + weeks.length * (c + gp), H = top + 7 * (c + gp);
  let count = 0;
  let out = ['M', '', 'W', '', 'F', '', ''].map((t, i) => t ? `<text x="0" y="${top + i * (c + gp) + 11}">${t}</text>` : '').join('');
  let lastM = -1;
  weeks.forEach((w, x) => {
    const d0 = parseDate(w[0].date);
    if (d0.getMonth() !== lastM) { lastM = d0.getMonth(); out += `<text x="${left + x * (c + gp)}" y="9">${MON[lastM]}</text>`; }
    w.forEach((cell, y) => { if (cell.future) return;
      if (cell.on) count++;
      const fill = cell.on ? color : cell.frozen ? 'var(--frozen)' : 'var(--cell)';
      out += `<rect x="${left + x * (c + gp)}" y="${top + y * (c + gp)}" width="${c}" height="${c}" rx="4" fill="${fill}"><title>${cell.date}</title></rect>`; });
  });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${name} calendar for the last ${weeks.length} weeks: ${plural(count, 'day')} ${name === 'Training' ? 'trained' : 'fasted'}. Streak freeze days are light blue.">${out}</svg>`;
}
// Small line chart per move: ladder position by week. Line breaks at weeks with no sets.
function trendCard(t) {
  const last = [...t.points].reverse().find((p) => p.score != null);
  const head = last ? `Level ${last.idx + 1} of ${t.levelsTotal} &middot; ${Math.round(last.frac * 100)}%` : 'No sets in 8 weeks';
  const lab = `${t.name} ladder position by week over the last ${t.points.length} weeks, oldest first: ${t.points.map((p) => p.score == null ? 'no sets' : `level ${p.idx + 1} at ${Math.round(p.frac * 100)}%`).join(', ')}.`;
  // Y axis fits the data (at least 2 levels tall) so small gains still show.
  const sc = t.points.filter((p) => p.score != null).map((p) => p.score), lo = sc.length ? Math.floor(Math.min(...sc)) : 1, hi = Math.max(lo + 2, Math.ceil(Math.max(...sc, lo)));
  const W = 160, H = 56, px = 6, py = 6, n = t.points.length;
  const x = (i) => px + (n > 1 ? i * (W - 2 * px) / (n - 1) : (W - 2 * px) / 2), y = (v) => H - py - (H - 2 * py) * (v - lo) / (hi - lo);
  let d = '', pen = false, dots = '';
  t.points.forEach((p, i) => {
    if (p.score == null) { pen = false; return; }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.score).toFixed(1)}`; pen = true;
    dots += `<circle cx="${x(i).toFixed(1)}" cy="${y(p.score).toFixed(1)}" r="${p === last ? 4 : 2}" fill="var(--orange)"/>`;
  });
  const svg = last ? `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(lab)}"><path d="${d}" fill="none" stroke="var(--orange)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg>` : '<div class="muted">No sets in 8 weeks</div>';
  return `<div class="tcard"><div class="nm">${esc(t.name)}</div><div class="tv tnum">${last ? head : '&nbsp;'}</div>${svg}</div>`;
}
function evLabel(e) {
  const n = moveName(e.moveId), lv = levelName(e);
  switch (e.type) {
    case 'levelUp': return ['up', '&#9650;', `Level up: ${esc(lv)}`];
    case 'levelDown': return ['dn', '&#9660;', `Eased back to ${esc(lv)}`];
    case 'targetUp': return ['tg', '+', `${esc(n)} target now ${esc(e.value)}`];
    case 'pb': return ['pb', '&#9733;', `New best: ${esc(e.value)} ${esc(n.toLowerCase())}`];
    default: return ['tg', '&bull;', esc(e.type)];
  }
}
// Level card attributes. Cards for levels with no 3D guide yet are plain (not tappable).
const lvlAttrs = (m) => isGuidePending(m.moveId, m.level) ? '"' : ` tappable" role="button" tabindex="0" data-act="form" data-move="${esc(m.moveId)}" data-level="${m.level}" aria-label="Form guide: ${esc(m.name)}, ${esc(m.levelName)}"`;
// Rep totals card. Choice and open rows live in module variables so a re-render keeps them.
let repRange = 'week';            // 'week' | 'month' | 'all'
const repOpen = new Set();
const REP_RANGES = [['week', 'Week'], ['month', '30 days'], ['all', 'All time']];
const fmtN = (n) => n.toLocaleString('en-AU');
// Reps as a plain number. Seconds as "45 s", "2:05" or "12 min".
const fmtAmt = (n, unit) => unit !== 'sec' ? fmtN(n) : n < 60 ? `${n} s` : n < 600 ? `${Math.floor(n / 60)}:${pad(n % 60)}` : `${fmtN(Math.round(n / 60))} min`;
const noun = (id) => MOVE_NOUNS[id] || moveName(id);
function repCard(today) {
  const rt = repTotals(state, today), key = repRange === 'all' ? 'allTime' : repRange;
  const reps = rt.filter((m) => m.unit !== 'sec').reduce((a, m) => a + m.allTime, 0);
  const sec = rt.filter((m) => m.unit === 'sec').reduce((a, m) => a + m.allTime, 0);
  const head = !reps && !sec ? 'No reps yet' : `${fmtN(reps)} reps all time${sec ? ` + ${fmtAmt(sec, 'sec')} core` : ''}`;
  const seg = REP_RANGES.map(([id, l]) => `<button role="radio" aria-checked="${repRange === id}" class="${repRange === id ? 'on' : ''}" data-act="repRange" data-range="${id}">${l}</button>`).join('');
  const rows = rt.map((m) => {
    const open = repOpen.has(m.moveId), pid = `rt-${m.moveId}`;
    const lv = m.levels.length ? m.levels.map((l) => `<div class="rt-lv"><span>${esc(l.name)}</span><span class="tnum">${fmtAmt(l.allTime, m.unit)}</span></div>`).join('') : '<div class="rt-lv muted">Nothing logged yet.</div>';
    return `<div class="rt-item"><button class="rt-row" aria-expanded="${open}" aria-controls="${pid}" data-act="repRow" data-move="${esc(m.moveId)}"><span class="rt-nm">${esc(noun(m.moveId))}</span><span class="rt-num tnum">${fmtAmt(m[key], m.unit)}</span><span class="rt-chev" aria-hidden="true">&rsaquo;</span></button>
      <div class="rt-lvs" id="${pid}" role="group" aria-label="${esc(noun(m.moveId))} by level, all time"${open ? '' : ' hidden'}>${lv}</div></div>`;
  }).join('');
  return `<div class="section"><h2 class="title">Rep totals</h2><div class="reps"><p class="rt-head tnum">${head}</p>
    <div class="seg" role="radiogroup" aria-label="Rep totals period">${seg}</div>${rows}<p class="rt-note">Both sides counted. Core shows time held.</p></div></div>`;
}
// Segmented ladder: done steps full, current step part filled, the rest empty.
const ladder = (m) => Array.from({ length: m.levelsTotal }, (_, i) => `<span><i style="width:${i < m.idx ? 100 : i === m.idx ? Math.round(m.frac * 100) : 0}%"></i></span>`).join('');
function viewFitness() {
  const mp = moveProgress(state), today = todayStr();
  const done = computeStreak(trainingDates(state), today).doneToday;
  return `${sessionHero(done)}<div class="section"><h2 class="title">Levels</h2>
    ${mp.map((m) => `<div class="lvl${lvlAttrs(m)}><div class="top"><span class="nm">${esc(m.name)}</span><span class="tg">${m.idx === m.levelsTotal - 1 && m.frac === 1 ? '<span class="mastered">Mastered</span> ' : ''}Target ${m.target}/${m.range[1]}${m.unit === 'sec' ? 's' : ''}</span></div>
    <div class="ln">Level ${m.level + 1} of ${m.levelsTotal} &middot; ${esc(m.levelName)}${m.best ? ` &middot; best ${m.best}` : ''}</div><div class="ladder" aria-hidden="true">${ladder(m)}</div></div>`).join('')}</div>
  ${repCard(today)}
  <div class="section"><h2 class="title">Progress by move</h2><p class="chartsum">Your place on each ladder. Steps up are level-ups.</p><div class="trends">${moveTrend(state, today, 8).map(trendCard).join('')}</div></div>`;
}
function viewProgress() {
  const today = todayStr();
  const tdates = trainingDates(state), fdates = fastingDates(state);
  const ev = recentEvents(state, 10);
  const trSt = computeStreak(tdates, today), fsSt = computeStreak(fdates, today);
  const trN = daysIn(tdates, 7, today), fsN = daysIn(fdates, 7, today);
  return `<div class="section"><h2 class="title">Highlights</h2><div class="feed">${ev.map((e) => { const [c, ic, t] = evLabel(e); return `<div class="ev"><div class="bd ${c}">${ic}</div><div><div>${t}</div><div class="when">${esc(dmy(new Date(e.at)))}</div></div></div>`; }).join('') || '<div class="empty">Your level-ups and personal bests will show here.</div>'}</div></div>
  <div class="section"><h2 class="title">Consistency</h2>
    <div class="heat"><div class="hh"><span>Training</span><span class="muted">Best ${trSt.longest}</span></div><p class="chartsum">${trN} of the last 7 days.</p>${heatSvg(tdates, 'var(--green)', 'Training')}</div>
    <div class="heat"><div class="hh"><span>Fasting</span><span class="muted">Best ${fsSt.longest}</span></div><p class="chartsum">${fsN} of the last 7 days.</p>${heatSvg(fdates, 'var(--purple)', 'Fasting')}
    <div class="legend"><span><i style="background:var(--frozen)"></i>Streak freeze used</span></div></div></div>`;
}

/* ---------- sheets ---------- */
function toggle(on, act) { return `<button class="toggle ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="${act}"></button>`; }
function sheetHtml() {
  if (!sheet) return '';
  const s = state.settings;
  let title = '', body = '';
  if (sheet.type === 'settings') {
    title = 'Settings';
    const hoursOpts = (cur, list) => list.map((h) => `<option value="${h}" ${h === cur ? 'selected' : ''}>${h} hours</option>`).join('');
    body = `<div class="field"><label>Session length</label><span class="muted">${s.sessionMinutes} min</span></div>
      <div class="field"><label for="sfmin">Fast counts after</label><select id="sfmin" data-change="fastMin">${hoursOpts(s.fastMinHours, [8, 10, 12, 13, 14, 16])}</select></div>
      <div class="field"><label for="sfgoal">Default fast goal</label><select id="sfgoal" data-change="fastGoal">${hoursOpts(s.fastGoalHours, [...new Set([12, 13, 14, 16, 18, 20, 24, s.fastGoalHours])].sort((a, b) => a - b))}</select></div>
      <div class="field"><label for="swork">Work time each minute</label><select id="swork" data-change="workSec">${WORK_SEC_CHOICES.map((w) => `<option value="${w}" ${w === workSecOf() ? 'selected' : ''}>${w} s work &middot; ${60 - w} s rest</option>`).join('')}</select></div>
      <div class="field"><label>Sound</label>${toggle(s.soundOn, 'toggleSound')}</div>
      <div class="field"><label>I have a pull-up bar</label>${toggle(s.pullupBar, 'toggleBar')}</div>
      <div class="field"><label>Last backup</label><span class="muted">${s.lastBackupAt ? esc(dmy(new Date(s.lastBackupAt))) : 'Never'}</span></div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
        <button class="btn soft block" data-act="export">Export backup</button>
        <button class="btn soft block" data-act="import">Import backup</button>
        <input type="file" id="importFile" accept="application/json,.json" hidden>
        <button class="btn soft block red-text" data-act="reset">Reset all data</button></div>
      <p class="small muted" style="text-align:center;margin-top:14px">All data stays on this phone.</p>`;
  } else if (sheet.type === 'gear') {
    const r = gearSheet(ensureGame(state), sheet.slot, sheet.msg, sheet.id ?? null); title = r.title; body = r.body;
  } else if (sheet.type === 'inv') {
    const r = invSheet(ensureGame(state), sheet); title = r.title; body = r.body;
  } else if (sheet.type === 'quick') {
    title = 'Quick log';
    const run = runningFast(state);
    body = `<div class="menu"><button data-act="startSession">${I.today} Start today's session</button><button data-act="startMin">${I.bolt} Minimum day (3 min)</button>
      <button data-act="${run ? 'endFast' : 'startFast'}">${I.fast} ${run ? 'End fast' : 'Start fast'}</button></div>`;
  } else if (sheet.type === 'goal') {
    title = 'Fast goal';
    body = `<div class="field"><label for="gh">Goal (hours)</label><input id="gh" type="number" inputmode="decimal" min="1" max="72" step="0.5" value="${+curGoal()}"></div>
      <button class="btn block" data-act="saveGoal" style="margin-top:14px">Save</button>`;
  } else if (sheet.type === 'editFast') {
    const f = state.fasts.find((x) => x.id === sheet.id); if (!f) return '';
    title = 'Edit fast';
    body = `<div class="field"><label for="efs">Start</label><input id="efs" type="datetime-local" value="${toLocalInput(f.start)}"></div>
      <div class="field"><label for="efe">End</label><input id="efe" type="datetime-local" value="${f.end ? toLocalInput(f.end) : ''}"></div>
      <div class="field"><label for="efg">Goal (hours)</label><input id="efg" type="number" min="1" max="72" step="0.5" value="${f.goalHours}"></div>
      <div class="field" style="display:block"><label>Mood</label><div class="moods" style="margin-top:8px">${['&#128542;', '&#128528;', '&#128578;', '&#128513;', '&#129321;'].map((e, i) => `<button data-act="mood" data-m="${i + 1}" class="${f.mood === i + 1 ? 'on' : ''}">${e}</button>`).join('')}</div></div>
      <div class="field" style="display:block"><label for="efn">Note</label><textarea id="efn" class="note-in">${esc(f.note)}</textarea></div>
      <div class="actions" style="justify-content:space-between"><button class="btn" data-act="saveFast">Save</button><button class="link red" data-act="delFast">Delete</button></div>`;
  }
  return `<div class="scrim" data-act="closeSheet"></div><div class="sheet${sheet.type === 'inv' ? ' inv' : ''}" role="dialog" aria-label="${title}"><div class="grab"></div><div class="sh-head"><h3>${title}</h3><button class="avatar" data-act="closeSheet" aria-label="Close" style="width:32px;height:32px">${I.x.replace('class="ic"', 'class="ic sm"')}</button></div><div class="sh-body">${body}</div></div>`;
}
function renderSheet() {
  const root = $('#sheet-root'), old = $('.sh-body', root), sc = old ? old.scrollTop : 0;
  unmountInv(); root.innerHTML = sheetHtml();
  const nb = $('.sh-body', root); if (nb) nb.scrollTop = sc;
  document.body.classList.toggle('lock', !!sheet || !!sess);
  if (sheet && sheet.type === 'inv') mountInv(state, sheet);
}

/* ---------- render ---------- */
function render() {
  renderChrome();
  const v = $('#view');
  if (tab === 'tower') { syncRewards(state); offlineCatchUp(state); }
  v.innerHTML = tab === 'fast' ? viewFast() : tab === 'progress' ? viewProgress() : tab === 'fitness' ? viewFitness() : tab === 'tower' ? viewTower(state) : viewToday();
  renderSheet();
  if (tab === 'tower' && !sess && !sheet) mountTower(state, save); else unmountTower();
}

/* ---------- audio / wake lock ---------- */
let ac = null, wl = null;
function unlockAudio() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; } }
function beep(freq = 660, dur = 0.12, vol = 0.5) {
  if (!ac || !state.settings.soundOn) return;
  try {
    if (ac.state === 'suspended') ac.resume();
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = 'sine'; o.frequency.value = freq; o.connect(g); g.connect(ac.destination);
    // Quick attack and release from and to zero so there is no click.
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.setValueAtTime(vol, t + Math.max(0.01, dur - 0.04)); g.gain.linearRampToValueAtTime(0, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) { /* ignore */ }
}
// start/minute: a slot begins. tick: 3-2-1. rest: work ends. end: session over.
const BEEP = { start: [988, 0.25], minute: [988, 0.3], tick: [440, 0.08], rest: [523, 0.4], end: [784, 0.6] };
async function lockScreen() {
  try {
    if (!('wakeLock' in navigator)) throw new Error('none');
    wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; });
    if (sess) sess.wlOk = true;
  } catch (e) { if (sess) { sess.wlOk = false; if (sess.phase === 'run') renderSession(); } }
}
function unlockScreen() { try { if (wl) wl.release(); } catch (e) { /* ignore */ } wl = null; }

/* ---------- session flow ---------- */
function openSession(minimum) {
  unmountTower();
  const plan = sessionPlan(state, { minimum });
  const queue = minimum ? [] : plan.moves.filter((m) => m.needsCalibration).map((m) => m.moveId);
  sess = { phase: queue.length ? 'calib' : 'ready', minimum, plan, queue, ci: 0, calib: null, wlOk: null };
  if (queue.length) initCalib();
  sheet = null; renderSheet(); renderPill(); $('#overlay').hidden = false; document.body.classList.add('lock');
  renderSession();
}
function initCalib(level) {
  const id = sess.queue[sess.ci], pm = sess.plan.moves.find((m) => m.moveId === id);
  const lv = level ?? pm.level, r = rng(id, lv);
  sess.calib = { id, pm, level: lv, range: r, max: Math.round((r[0] + r[1]) / 2), result: null };
}
function closeSession() {
  clearInterval(ticker); ticker = null; unlockScreen(); sess = null;
  $('#overlay').hidden = true; $('#overlay').innerHTML = ''; $('#overlay').classList.remove('rest'); document.body.classList.remove('lock'); render();
}
const unitWord = (m) => m.unit === 'sec' ? 'seconds' : 'reps';
function stepperHtml(id, val, small) { return `<div class="stepper ${small ? 'sm' : ''}"><button data-act="step" data-w="${id}" data-d="-1" aria-label="Less">&minus;</button><input type="text" inputmode="numeric" pattern="[0-9]*" id="out-${id}" value="${val}" data-change="stepSet" data-w="${id}" aria-label="Value"><button data-act="step" data-w="${id}" data-d="1" aria-label="More">+</button></div>`; }
function nextUp(idx) {
  const p = sess.plan, n = p.slots[idx + 1];
  if (!n) return 'Last set. Finish strong.';
  const m = p.moves.find((x) => x.moveId === n.moveId);
  return `Next: ${esc(m.name)} &middot; ${esc(m.levelName)}${n.side ? ' &middot; ' + sideWord(n.side) : ''} &middot; target ${m.target}${m.unit === 'sec' ? ' sec' : ''}`;
}
// Value for a slot's log: the last value logged for the same move and side this session, else the target.
function fillLog(i) {
  const s = sess, sl = s.plan.slots[i];
  if (!sl || s.logs[i] !== null) return;
  for (let j = i - 1; j >= 0; j--) {
    const o = s.plan.slots[j];
    if (o.moveId === sl.moveId && o.side === sl.side && s.logs[j] !== null) { s.logs[i] = s.logs[j]; return; }
  }
  s.logs[i] = s.plan.moves.find((m) => m.moveId === sl.moveId).target;
}
function renderSession() {
  const o = $('#overlay'); if (!sess) return;
  const s = sess, p = s.plan;
  if (s.phase !== 'run') o.classList.remove('rest');
  let top = `<div class="ov-top"><span class="kicker">${esc(p.dayName)} &middot; ${s.minimum ? 'Minimum day' : 'EMOM ' + p.minutes}</span><button class="x" data-act="${s.phase === 'run' ? 'endEarly' : 'closeSess'}" aria-label="Close">${I.x}</button></div>`;
  let mid = '', bot = '';
  if (s.phase === 'calib') {
    const c = s.calib, lvl = levelOf(c.id, c.level), r = c.result;
    mid = `<div class="kicker">Test set ${s.ci + 1} of ${s.queue.length}</div><div class="mname">${esc(c.pm.name)}</div><div class="lname">${esc(lvl.name)} ${formChip(c.id, c.level, lvl.name)}</div><div class="cue">${esc(lvl.cue || '')}</div>`;
    if (!r) {
      mid += `<p class="muted" style="margin:14px 0 0">Do one max set with good form${lvl.perSide ? ' on one side' : ''}. How many ${unitWord(c.pm)} did you get?</p>${stepperHtml('calib', c.max)}`;
      bot = `<button class="btn block" data-act="calibGo">Log max set</button>`;
    } else if (r.tooEasy) {
      mid += `<div class="note" style="text-align:center"><h3>That looks easy</h3><p style="margin:0">Your target would be above the top of the range for this level.</p></div>`;
      bot = `<button class="btn block" data-act="calibNext">Test next level</button><button class="btn soft block" data-act="calibHere">Start here (${c.range[1]})</button>`;
    } else if (r.tooHard) {
      mid += `<div class="note" style="text-align:center"><h3>That looks hard</h3><p style="margin:0">Your target would be below the bottom of the range for this level.</p></div>`;
      bot = `<button class="btn block" data-act="calibPrev">Test easier level</button><button class="btn soft block" data-act="calibHere">Start here (${c.range[0]})</button>`;
    } else {
      mid += `<div class="target" style="margin-top:14px">Your target: ${r.target} ${c.pm.unit === 'sec' ? 'sec' : 'reps'}</div>`;
      bot = `<button class="btn block" data-act="calibOk">Continue</button>`;
    }
  } else if (s.phase === 'ready') {
    mid = `<div class="kicker">${s.minimum ? 'Minimum day' : 'Ready'}</div><div class="mname">${p.minutes} minutes</div>
      <div class="lname">${p.moves.map((m) => esc(m.name)).join(' &middot; ')}</div>
      <button class="tapstart" data-act="beginRun">Tap to start</button>
      <div class="cue">Each minute: ${p.workSec} s max effort, then ${60 - p.workSec} s rest. Log your reps in the rest.</div>
      ${s.wlOk === false ? '<div class="warn" style="align-self:center">Keep your screen on manually.</div>' : ''}`;
  } else if (s.phase === 'run') {
    const slot = p.slots[s.idx], pm = p.moves.find((m) => m.moveId === slot.moveId);
    const dots = p.slots.map((_, i) => `<i class="${i < s.idx ? 'done' : i === s.idx ? 'cur' : ''}"></i>`).join('');
    const prev = s.idx > 0 ? p.slots[s.idx - 1] : null;
    const nx = nextUp(s.idx);
    const side = slot.side ? ` &middot; ${sideWord(slot.side)}` : '';
    const label = `<div class="kicker" id="minLabel">Minute ${s.idx + 1} of ${p.minutes}${side}${s.pausedAt ? ' &middot; Paused' : ''}</div>`;
    const warn = s.wlOk === false ? '<div class="warn" style="align-self:center">Keep your screen on manually.</div>' : '';
    if (s.ph === 'work') {
      const effort = pm.rir2 ? 'Stop about 2 reps before failure.' : 'Max out with good form. Stop when the next rep would break form.';
      const beat = pm.unit === 'sec' ? `Hold up to ${s.workSec} s` : `Beat ${pm.target}`;
      mid = `${label}<div class="timer" id="timer">--:--</div><div class="dots">${dots}</div>
      <div class="mname">${esc(pm.name)}</div><div class="lname">${esc(pm.levelName)} ${formChip(pm.moveId, pm.level, pm.levelName)}</div><div class="cue">${esc(pm.cue)}</div>
      <div class="cue">${effort}</div>
      <div class="target" style="margin-top:8px">${beat}</div>
      ${prev ? `<div class="prevrow"><span>Last set</span>${stepperHtml('prev', s.logs[s.idx - 1], true)}</div>` : ''}${warn}`;
    } else {
      mid = `${label}<div class="restlabel">Rest</div><div class="timer" id="timer">--:--</div><div class="dots">${dots}</div>
      <div class="kicker" style="margin-top:12px">${pm.unit === 'sec' ? 'Seconds held' : 'Reps this set'}</div>${stepperHtml('log', s.logs[s.idx])}
      <div class="nextup" id="nextup">${nx}</div>${warn}`;
    }
    bot = `<div class="two"><button class="btn soft" data-act="pause">${s.pausedAt ? 'Resume' : 'Pause'}</button><button class="btn soft" data-act="endEarly">End early</button></div>`;
    o.classList.toggle('rest', s.ph === 'rest');
  } else if (s.phase === 'summary') {
    const sm = s.summary;
    mid = `<div class="celebrate">${sm.events.length ? '&#127881;' : '&#9989;'}</div><div class="mname">${sm.minimum ? 'Minimum day done' : 'Session done'}</div>
      <div class="lname">${sm.streak} day training streak</div>
      <table class="sumtable"><tr><th>Min</th><th>Move</th><th>${'Logged'}</th></tr>${sm.rows.map((r) => `<tr><td>${r.i}</td><td>${esc(r.name)}<div class="small muted">${esc(r.lvl)}${r.side ? ' &middot; ' + sideWord(r.side) : ''}</div></td><td>${r.reps}${r.unit === 'sec' ? 's' : ''}</td></tr>`).join('')}</table>
      ${sm.totals && sm.totals.length ? `<div class="sumtot"><div class="small muted">This session</div>${sm.totals.map((t) => `${esc(noun(t.moveId))} <b class="tnum">${fmtAmt(t.total, t.unit)}</b>${t.bothSides ? ' <span class="muted">(both sides)</span>' : ''}`).join(' &middot; ')}</div>` : ''}
      ${sm.events.map((e) => { const [, ic, t] = evLabel(e); return `<div class="evcard">${ic} ${t}</div>`; }).join('')}
      ${sm.sweat > 0 ? `<div class="evcard"><span aria-hidden="true">&#9889;</span> +${sm.sweat} Sweat earned &middot; spend it in Tower</div>` : ''}
      ${sm.minimum ? '<p class="small muted">Minimum days keep your streak. They do not change your targets.</p>' : ''}`;
    bot = sm.sweat > 0 ? `<div class="two"><button class="btn soft" data-act="closeSess">Done</button><button class="btn" data-act="toTower">Open Tower</button></div>` : `<button class="btn block" data-act="closeSess">Done</button>`;
  }
  const scroll = o.firstElementChild ? o.firstElementChild.scrollTop : 0;
  o.innerHTML = `<div class="ov">${top}<div class="ov-mid">${mid}</div><div class="ov-bot">${bot}</div></div>`;
  if (s.phase === 'run') tickSession();
  void scroll;
}
function startRun() {
  const s = sess; unlockAudio(); beep(...BEEP.start); lockScreen();
  s.phase = 'run'; s.startMs = Date.now(); s.pausedAt = null; s.pausedTotal = 0; s.idx = 0; s.ph = 'work'; s.lastTick = null;
  s.workSec = s.plan.workSec;
  s.logs = s.plan.slots.map(() => null);   // filled when a slot reaches its rest (see fillLog)
  clearInterval(ticker); ticker = setInterval(tickSession, 150);
  renderSession();
}
// One slot = one minute: work for workSec, then rest for the remainder.
function tickSession() {
  const s = sess; if (!s || s.phase !== 'run') return;
  const now = s.pausedAt ?? Date.now(), el = now - s.startMs - s.pausedTotal, total = s.plan.minutes * 60000;
  const workMs = s.workSec * 1000;
  if (el >= total) { beep(...BEEP.end); finishRun(s.plan.minutes); return; }
  const idx = Math.floor(el / 60000), within = el % 60000, ph = within < workMs ? 'work' : 'rest';
  if (idx !== s.idx || ph !== s.ph) {
    const newSlot = idx !== s.idx;
    for (let i = 0; i < idx; i++) fillLog(i);       // slots that ended (also if the tab slept)
    if (ph === 'rest') fillLog(idx);
    s.idx = idx; s.ph = ph; s.lastTick = null;
    if (!s.pausedAt) beep(...(newSlot ? BEEP.minute : BEEP.rest));
    renderSession(); return;
  }
  const rem = Math.ceil(((ph === 'work' ? workMs : 60000) - within) / 1000);
  const t = $('#timer');
  if (t) { t.textContent = `${pad(Math.floor(rem / 60))}:${pad(rem % 60)}`; t.classList.toggle('low', rem <= 3); }
  if (!s.pausedAt && rem <= 3 && s.lastTick !== rem) { s.lastTick = rem; beep(...BEEP.tick); }
}
function finishRun(completed) {
  const s = sess; if (!s) return;
  clearInterval(ticker); ticker = null; unlockScreen();
  const p = s.plan;
  for (let i = 0; i < completed; i++) fillLog(i);
  const sets = p.slots.slice(0, completed).map((sl, i) => { const m = p.moves.find((x) => x.moveId === sl.moveId); return { moveId: sl.moveId, level: m.level, reps: s.logs[i], ...(sl.side ? { side: sl.side } : {}) }; });
  const minimum = s.minimum || completed < p.minutes;
  const res = finishSession(state, { startedAt: new Date(s.startMs).toISOString(), endedAt: new Date().toISOString(), minimum, sets, minutes: p.minutes });
  state = res.state; try { save(state); } catch (e) { toast('Could not save.'); }
  const streak = computeStreak(trainingDates(state), todayStr()).current;
  let sweat = 0;   // what this session (and its level-up and PB events) paid into the Tower
  try {
    syncRewards(state); const g = ensureGame(state), last = state.sessions[state.sessions.length - 1];
    sweat = (g.paid['s:' + (last && last.id)] || 0) + (res.events || []).reduce((n, e) => n + (g.paid['e:' + e.id] || 0), 0);
    save(state);
  } catch (e) { sweat = 0; }
  s.summary = { sweat, minimum, events: res.events || [], streak, rows: sets.map((x, i) => ({ i: i + 1, name: moveName(x.moveId), lvl: levelName(x), side: x.side || null, reps: x.reps, unit: (getMove(x.moveId) || {}).unit })), totals: sessionTotals(sets) };
  s.phase = 'summary'; renderSession();
}
async function endEarly() {
  const s = sess; if (!s) return;
  const now = s.pausedAt ?? Date.now(), done = Math.min(s.plan.minutes, Math.floor((now - s.startMs - s.pausedTotal) / 60000));
  // Hold the clock while the sheet is open.
  const wasPaused = !!s.pausedAt; if (!wasPaused) s.pausedAt = Date.now();
  const resume = () => { if (!wasPaused && sess === s && s.pausedAt) { s.pausedTotal += Date.now() - s.pausedAt; s.pausedAt = null; } };
  if (done < 3) {
    if (await ask({ title: 'Discard this session?', message: 'Under 3 minutes does not count towards your streak.', confirmLabel: 'Discard session', destructive: true })) closeSession(); else resume();
    return;
  }
  if (await ask({ title: 'End the session now?', message: `${done} sets will be saved as a minimum day. Targets will not change.`, confirmLabel: 'End and save' })) finishRun(done); else resume();
}
function calibApply(level, target) {
  const s = sess, c = s.calib;
  state = applyCalibration(state, c.id, level, target); try { save(state); } catch (e) { /* ignore */ }
  s.ci++;
  if (s.ci < s.queue.length) { initCalib(); } else { s.plan = sessionPlan(state, { minimum: false }); s.phase = 'ready'; }
  renderSession();
}

/* ---------- export / import ---------- */
async function doExport() {
  const name = `streaks-backup-${todayStr()}.json`;
  let json; try { json = exportJSON(state); } catch (e) { toast('Export failed.'); return; }
  if (typeof json !== 'string') json = JSON.stringify(json, null, 2);
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'streaks backup' }); }
    else {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
  } catch (e) { if (e && e.name === 'AbortError') return; toast('Export failed.'); return; }
  commit(markBackedUp(state, new Date())); toast('Backup saved.');
}
async function doImport(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const r = importJSON(text); const next = r && r.state ? r.state : r;
    if (!next || !next.settings) throw new Error('bad');
    if (!(await ask({ title: 'Replace all data?', message: 'This replaces everything on this phone with the backup.', confirmLabel: 'Replace data', destructive: true }))) return;
    sheet = null; commit(next); toast('Backup imported.');
  } catch (e) { toast('That file is not a valid backup.'); }
}

/* ---------- actions ---------- */
const act = {
  tab: (el) => { tab = el.dataset.tab; sheet = null; render(); window.scrollTo(0, 0); },
  settings: () => { unmountTower(); sheet = { type: 'settings' }; renderSheet(); },
  quick: () => { unmountTower(); sheet = { type: 'quick' }; renderSheet(); },
  closeSheet: () => {
    if (sheet && sheet.back) { sheet = sheet.back; renderSheet(); return; }   // the forge opened from the inventory goes back to it
    sheet = null; renderSheet(); if (tab === 'tower' && !sess && !towerMounted()) mountTower(state, save);   // the inventory leaves the battle running, so there is nothing to remount
  },
  startSession: () => openSession(false),
  startMin: () => openSession(true),
  closeSess: () => closeSession(),
  toTower: () => { tab = 'tower'; sheet = null; closeSession(); window.scrollTo(0, 0); },
  growYes: () => commit(acceptGrowth(state)),
  growNo: () => commit(dismissGrowth(state, new Date())),
  gotBar: () => commit(setPullupBar(state, true)),
  export: () => doExport(),
  import: () => $('#importFile').click(),
  reset: async () => {
    if (!(await ask({ title: 'Reset all data?', message: 'This deletes all sessions, fasts and progress.', confirmLabel: 'Continue', destructive: true }))) return;
    if (await ask({ title: 'Really reset everything?', message: 'This cannot be undone.', confirmLabel: 'Reset everything', destructive: true })) { sheet = null; commit(defaultState(new Date())); toast('All data reset.'); }
  },
  toggleSound: () => { commit(withSettings(state, { soundOn: !state.settings.soundOn })); },
  toggleBar: () => { commit(setPullupBar(state, !state.settings.pullupBar)); },
  startFast: () => { sheet = null; commit(startFast(state, new Date(), state.settings.fastGoalHours)); },
  endFast: async () => {
    const run = runningFast(state); if (!run) return;
    if (await ask({ title: 'End this fast?', message: `You have fasted for ${fmtH((Date.now() - new Date(run.start)) / 3.6e6)}.`, confirmLabel: 'End fast' })) { sheet = null; commit(endFast(state, new Date())); }
  },
  goalSheet: () => { sheet = { type: 'goal' }; renderSheet(); },
  saveGoal: () => {
    const h = Number($('#gh').value);
    if (!(h >= 1 && h <= 72)) { toast('Enter a goal from 1 to 72 hours.'); return; }
    const run = runningFast(state); sheet = null;
    commit(run ? editFast(state, run.id, { goalHours: h }) : withSettings(state, { fastGoalHours: h }));
  },
  preset: (el) => {
    if (el.dataset.h === '') { act.goalSheet(); return; }   // Custom
    const h = Number(el.dataset.h), run = runningFast(state);
    commit(run ? editFast(state, run.id, { goalHours: h }) : withSettings(state, { fastGoalHours: h }));
  },
  editFast: (el) => { sheet = { type: 'editFast', id: el.dataset.id, mood: (state.fasts.find((f) => f.id === el.dataset.id) || {}).mood ?? null }; renderSheet(); },
  mood: (el) => { const m = Number(el.dataset.m); sheet.mood = sheet.mood === m ? null : m; document.querySelectorAll('.moods button').forEach((b) => b.classList.toggle('on', Number(b.dataset.m) === sheet.mood)); },
  saveFast: () => {
    const g = (id) => $('#' + id).value, s = g('efs'), e = g('efe');
    try {
      commit(editFast(state, sheet.id, { start: fromLocalInput(s), end: e ? fromLocalInput(e) : null, goalHours: Number(g('efg')) || 16, note: g('efn'), mood: sheet.mood }));
      sheet = null; renderSheet();
    } catch (err) { toast(err.message && /end/i.test(err.message) ? 'End must be after start.' : 'Could not save that change.'); }
  },
  delFast: async () => {
    const id = sheet && sheet.id; if (!id) return;
    if (await ask({ title: 'Delete this fast?', message: 'It will be removed from your history.', confirmLabel: 'Delete fast', destructive: true })) { sheet = null; commit(deleteFast(state, id)); }
  },
  step: (el) => {
    const w = el.dataset.w, d = Number(el.dataset.d), s = sess; if (!s) return;
    if (w === 'calib') { const u = s.calib.pm.unit === 'sec' ? 5 : 1; s.calib.max = Math.max(0, s.calib.max + d * u); $('#out-calib').value = s.calib.max; }
    else {
      const i = w === 'log' ? s.idx : s.idx - 1, pm = s.plan.moves.find((m) => m.moveId === s.plan.slots[i].moveId), u = pm.unit === 'sec' ? 5 : 1;
      fillLog(i); s.logs[i] = Math.max(0, s.logs[i] + d * u); $('#out-' + w).value = s.logs[i];
    }
  },
  calibGo: () => { const c = sess.calib; c.result = placeFromCalibration(state, c.id, c.level, c.max); renderSession(); },
  calibNext: () => { initCalib(sess.calib.level + 1); renderSession(); },
  calibPrev: () => { initCalib(sess.calib.level - 1); renderSession(); },
  calibHere: () => { const c = sess.calib, r = c.result; calibApply(r.level ?? c.level, r.tooEasy ? c.range[1] : c.range[0]); },
  calibOk: () => { const c = sess.calib; calibApply(c.result.level ?? c.level, c.result.target); },
  beginRun: () => startRun(),
  pause: () => { const s = sess; if (s.pausedAt) { s.pausedTotal += Date.now() - s.pausedAt; s.pausedAt = null; unlockAudio(); lockScreen(); } else { s.pausedAt = Date.now(); } renderSession(); },
  endEarly: () => endEarly(),
  repRange: (el) => { repRange = el.dataset.range; render(); },
  repRow: (el) => { const id = el.dataset.move; if (repOpen.has(id)) repOpen.delete(id); else repOpen.add(id); render(); },
  buyStat: (el) => { if (buyStat(ensureGame(state), el.dataset.stat)) { save(state); refreshTowerUi(state); } },
  buyFocus: (el) => { if (buyFocus(ensureGame(state), el.dataset.up)) { save(state); refreshTowerUi(state); } },
  buyTalent: (el) => { if (buyTalent(ensureGame(state), el.dataset.talent)) { save(state); refreshTowerUi(state); } },
  respec: () => { if (respec(ensureGame(state))) { save(state); refreshTowerUi(state); toast('Talents refunded.'); } },
  gearSheet: (el) => { unmountTower(); sheet = { type: 'gear', slot: el.dataset.slot, msg: '' }; renderSheet(); },
  // forge, lock and equip only re-render the sheet and patch the tab behind it, never the canvas
  forge: (el) => {
    const g = ensureGame(state), slot = el.dataset.slot, a = el.dataset.fa, i = Number(el.dataset.i) || 0, pick = el.dataset.id ? findItem(g, Number(el.dataset.id)) : null, it = pick || g.gear[slot], c = forgeCost(g, a, it), was = it && it.aff[i] && it.aff[i].id;
    if (forge(g, slot, a, i, Math.random, pick)) {
      const n = it, msg = a === 'reroll' ? `Rerolled ${AFF_NAME[was]} into ${AFF_NAME[n.aff[i].id]}.` : a === 'add' ? `Added ${AFF_NAME[n.aff[n.aff.length - 1].id]}.` : a === 'upgrade' ? `Upgraded to ${n.rarity}, added ${AFF_NAME[n.aff[n.aff.length - 1].id]}.` : `Tempered to level ${n.lvl}.`;
      sheet.msg = `${msg} Spent ${c} Focus.`; save(state); refreshTowerUi(state); renderSheet();
    }
  },
  // inventory: taps patch the open sheet in place (invPatch), so the preview, the battle canvas and the stats behind it are never rebuilt
  invSheet: () => { sheet = newInv(); renderSheet(); },
  heroTap: (el, e) => { if (tab === 'tower' && !sheet && !sess && heroHit(el, e)) act.invSheet(); },
  invSel: (el) => { const id = Number(el.dataset.id); sheet.sel = sheet.sel === id ? null : id; sheet.msg = ''; invPatch(state, sheet); },
  invTab: (el) => { sheet.slot = el.dataset.slot; const it = sheet.sel != null && findItem(ensureGame(state), sheet.sel); if (it && sheet.slot !== 'all' && it.slot !== sheet.slot) sheet.sel = null; sheet.msg = ''; invPatch(state, sheet); },
  invEquip: () => { const g = ensureGame(state), it = sheet.sel != null && findItem(g, sheet.sel); if (!it) return; const m = equipMsg(g, it); if (equip(g, it.id)) { sheet.msg = m; save(state); refreshTowerUi(state); invPatch(state, sheet); } },
  invLock: () => { if (sheet.sel != null && toggleLock(ensureGame(state), sheet.sel)) { const it = findItem(ensureGame(state), sheet.sel); sheet.msg = it.lock ? 'Locked.' : 'Unlocked.'; save(state); refreshTowerUi(state); invPatch(state, sheet); } },
  invForge: () => { const it = sheet.sel != null && findItem(ensureGame(state), sheet.sel); if (it) { sheet = { type: 'gear', slot: it.slot, id: it.id, msg: '', back: sheet }; renderSheet(); } },
  lockItem: (el) => { if (toggleLock(ensureGame(state), Number(el.dataset.id))) { sheet.msg = ''; save(state); renderSheet(); } },
  equipItem: (el) => { if (equip(ensureGame(state), Number(el.dataset.id))) { sheet.msg = 'Equipped.'; save(state); renderSheet(); } },
  ascend: async () => {
    const g = ensureGame(state); if (!canAscend(g)) return;
    if (!(await ask({ title: 'Ascend now?', message: 'Your floor resets (talents like Head start can raise it). You keep your best gear item, locked items, stats, Focus upgrades and currencies, and gain souls to spend in the Soul tree.', confirmLabel: 'Ascend' }))) return;
    const n = ascend(g); save(state); render(); toast(`Ascended. +${n} souls.`);
  },
  form: (el) => openForm(el.dataset.move, Number(el.dataset.level), el)
};
// 3D form guide: three.js and the viewer load only when it is first opened. The EMOM timer is independent of it.
let formMod = null;
async function openForm(moveId, level, opener) {
  try { formMod = formMod || await import('./form/viewer.js'); } catch (e) { toast('Could not load the form guide. Try again.'); return; }
  formMod.openForm({ moveId, level, opener });
}
const changes = {
  stepSet: (el) => {
    const s = sess; if (!s) return;
    const n = Math.max(0, Math.floor(Number(String(el.value).replace(/\D/g, ''))) || 0), w = el.dataset.w;
    if (w === 'calib') s.calib.max = n; else s.logs[w === 'log' ? s.idx : s.idx - 1] = n;
    el.value = n;
  },
  invSort: (el) => { if (sheet && sheet.type === 'inv') { sheet.sort = el.value; invPatch(state, sheet); } },
  fastMin: (el) => commit(withSettings(state, { fastMinHours: Number(el.value) })),
  fastGoal: (el) => commit(withSettings(state, { fastGoalHours: Number(el.value) })),
  workSec: (el) => commit(withSettings(state, { workSec: Number(el.value) })),
  fastStart: (el) => {
    const run = runningFast(state); if (!run || !el.value) return;
    try { commit(editFast(state, run.id, { start: fromLocalInput(el.value) })); } catch (e) { toast('Start must be before now.'); render(); }
  }
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el || !act[el.dataset.act]) return;
  act[el.dataset.act](el, e);
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id === 'importFile') { doImport(el.files[0]); el.value = ''; return; }
  const f = el.dataset && el.dataset.change; if (f && changes[f]) changes[f](el);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (sess && sess.phase === 'run') { if (ac && ac.state === 'suspended') ac.resume(); if (!wl && !sess.pausedAt) lockScreen(); tickSession(); }
  updateFastLive();
});

/* ---------- boot ---------- */
render();
setInterval(updateFastLive, 1000);
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
document.addEventListener('focusin', (e) => { const el = e.target; if (el.matches && el.matches('.stepper input')) setTimeout(() => el.select(), 0); });
