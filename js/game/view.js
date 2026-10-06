// Tower tab: HTML view plus the battle canvas. Isometric stone floor, chibi units, drawn at art resolution then scaled up crisp.
import { CONFIG, SLOTS, SLOT_STAT, TALENTS, ensureGame, heroStats, fight, advance, offlineCatchUp, statCost, focusCost, focusMax, canAscend, soulsFor, isBoss, atDoor, power, forgeCost, forgeBlock, stashMax, soulsLeft, talentCost, canRespec, lookOf, inventory, compareItem, findItem } from './engine.js';
import { getSprite, getHero, iconInfo, PAL, hexA } from './sprites.js';
import { AW, PAD, AH, HERO, FOE, mk, sceneFor, zoneOf, enemyKind, enemyName, isElite, traitLine, glow, hash } from './scene.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n) => { n = Math.round(n); if (n < 10000) return String(n); const u = ['k', 'M', 'B', 'T', 'Q']; let i = -1; let v = n; while (v >= 1000 && i < 4) { v /= 1000; i++; } return (v < 100 ? v.toFixed(1).replace(/\.0$/, '') : Math.round(v)) + u[i]; };
const pct = (x) => `${Math.round(x * 1000) / 10}%`;
const SLOT_NAME = { weapon: 'Weapon', armour: 'Armour', boots: 'Boots' }, STAT_NAME = { atk: 'Attack', hp: 'Health', spd: 'Speed' };

/* ---------- HTML ---------- */
const statVal = (g, stat, lv) => { const h = heroStats({ ...g, stats: { ...g.stats, [stat]: lv } }); return stat === 'spd' ? `${h.spd.toFixed(2)}/s` : fmt(h[stat]); };
const spdMaxed = (g) => CONFIG.spd.base + CONFIG.spd.per * g.stats.spd >= CONFIG.spd.max;
const GL = { sweat: '&#9889;', focus: '&#9670;', souls: '&#10022;' };
const btnTxt = (max, gl, cost) => max ? 'Max' : `<span aria-hidden="true">${GL[gl]}</span> ${fmt(cost)}`;
function statParts(g, stat) {
  const lv = g.stats[stat], max = stat === 'spd' && spdMaxed(g), cost = statCost(stat, lv);
  return { cost, off: max || g.sweat < cost, main: `<div class="tw-nm">${STAT_NAME[stat]} <span class="tw-lv">Lv ${lv}</span></div><div class="tw-sub tnum">${statVal(g, stat, lv)}${max ? ' (max base)' : ` &rarr; ${statVal(g, stat, lv + 1)}`}</div>`,
    label: max ? `${STAT_NAME[stat]} is at max level` : `Upgrade ${STAT_NAME[stat]} to level ${lv + 1} for ${cost} Sweat`, txt: btnTxt(max, 'sweat', cost) };
}
function statRow(g, stat) {
  const p = statParts(g, stat);
  return `<div class="tw-row" data-row="stat:${stat}"><div class="tw-main">${p.main}</div>
    <button class="btn sm tw-buy tnum" data-act="buyStat" data-stat="${stat}" data-cost="${p.cost}" aria-label="${esc(p.label)}" ${p.off ? 'disabled' : ''}>${p.txt}</button></div>`;
}
const RCOL = { common: 'var(--muted)', rare: 'var(--blue-text)', epic: 'var(--purple-text)' };
export const AFF_NAME = { lifesteal: 'Lifesteal', thorns: 'Thorns', critdmg: 'Crit damage', boss: 'Boss slayer', swift: 'Swift', guard: 'Guard', ward: 'Zone ward', train: 'Training' };
const AFF_DESC = { lifesteal: 'Heal {v} of damage dealt', thorns: 'Reflect {v} of damage taken', critdmg: '+{v} crit damage', boss: '+{v} damage to bosses', swift: '+{v} speed', guard: '{v} less damage taken', ward: '+{v} damage on floors with an enemy trait', train: '+{v} Sweat from sessions (30% max)' };
const affDesc = (a) => AFF_DESC[a.id].replace('{v}', pct(a.v));
const chips = (it) => (it.aff || []).map((a) => `<span class="tw-chip">${AFF_NAME[a.id]} ${pct(a.v)}</span>`).join('');
const pw = (it) => Math.round(power(it) * 10) / 10;
const itemName = (it) => `Tier ${it.tier} ${it.rarity}${it.lvl ? ` +${it.lvl}` : ''}`;
const itemLabel = (it) => `${itemName(it)}, power ${pw(it)}, +${pct(it.bonus)} ${STAT_NAME[SLOT_STAT[it.slot]]}${it.aff && it.aff.length ? ', ' + it.aff.map((a) => `${AFF_NAME[a.id]} ${pct(a.v)}`).join(', ') : ''}${it.lock ? ', locked' : ''}`;
export function gearHtml(g) {
  const rows = SLOTS.map((s) => { const it = g.gear[s];
    return `<button class="tw-row tw-gear" data-slot="${s}" data-act="gearSheet" aria-label="${esc(`${SLOT_NAME[s]}: ${it ? itemLabel(it) : 'empty'}. Opens the forge and stash`)}"><div class="tw-main"><div class="tw-nm">${SLOT_NAME[s]}${it ? ` <span class="tw-lv" style="color:${RCOL[it.rarity]}">${esc(itemName(it))}${it.lock ? ' &middot; locked' : ''}</span>` : ''}</div>
      <div class="tw-sub" style="color:${it ? RCOL[it.rarity] : 'var(--muted)'}">${it ? `+${pct(it.bonus)} ${STAT_NAME[SLOT_STAT[s]]} &middot; Power ${pw(it)}` : 'Empty. Bosses drop gear.'}</div>${it && it.aff.length ? `<div class="tw-chips">${chips(it)}</div>` : ''}</div><span class="tw-go" aria-hidden="true">&rsaquo;</span></button>`; }).join('');
  return rows + `<div class="tw-row tw-stashline"><div class="tw-sub">Stash ${g.stash.length}/${stashMax(g)}. Tap a slot to forge, lock or swap from the stash.</div>
    <button class="btn sm soft tw-buy" data-act="invSheet" aria-label="Open inventory: ${g.stash.length + SLOTS.filter((s) => g.gear[s]).length} items, try them on the hero">Inventory</button></div>`;
}
// The gear bottom sheet (app.js shows it): equipped item, forge, lock and the stash for one slot. msg is a short result line read out by VoiceOver.
export function gearSheet(g, slot, msg = '', id = null) {
  const it = id != null ? findItem(g, id) : g.gear[slot], cur = g.gear[slot], st = g.stash.filter((x) => x.slot === slot && x !== it), fb = (c, off, label, txt) => `<button class="btn sm tw-buy tnum" ${c} aria-label="${esc(label)}" ${off ? 'disabled' : ''}>${txt}</button>`;
  const act = (a, extra = '') => `data-act="forge" data-slot="${slot}" data-fa="${a}" ${id != null ? `data-id="${id}" ` : ''}${extra}`;
  const cost = (a) => forgeCost(g, a, it);
  const fbtn = (a, i, label, blockTxt) => { const bl = forgeBlock(it, a, i); return fb(act(a, `data-i="${i}"`), !!bl || g.focus < cost(a), bl ? `${label}: ${bl}` : g.focus < cost(a) ? `${label} costs ${cost(a)} Focus, you have ${Math.floor(g.focus)}` : `${label} for ${cost(a)} Focus`, bl ? esc(blockTxt || bl) : btnTxt(false, 'focus', cost(a))); };
  let body = `<p class="tw-fh tnum" aria-label="Focus ${Math.floor(g.focus)}">Focus <b><span aria-hidden="true">&#9670;</span> ${fmt(g.focus)}</b></p><p class="small muted tw-msg" role="status" aria-live="polite">${esc(msg)}</p>`;
  if (!it) body += `<div class="tw-card"><div class="tw-row"><div class="tw-sub">Empty slot. Bosses drop gear.${st.length ? ' Equip one from the stash below.' : ''}</div></div></div>`;
  else {
    if (it !== cur) body += `<p class="small muted">This item is in the stash. Your stats change only once you equip it.</p>`;
    const g2 = it.aff.map((a, i) => `<div class="tw-row"><div class="tw-main"><div class="tw-nm">${AFF_NAME[a.id]} <span class="tw-lv">${pct(a.v)}</span></div><div class="tw-sub">${esc(affDesc(a))}</div></div>${fbtn('reroll', i, `Reroll ${AFF_NAME[a.id]}`)}</div>`).join('');
    body += `<div class="tw-card"><div class="tw-row"><div class="tw-main"><div class="tw-nm" style="color:${RCOL[it.rarity]}">${esc(itemName(it))} ${SLOT_NAME[slot].toLowerCase()}</div><div class="tw-sub">+${pct(it.bonus)} ${STAT_NAME[SLOT_STAT[slot]]} &middot; Power ${pw(it)}</div></div>
      <button class="btn sm soft tw-buy" data-act="lockItem" data-id="${it.id}" aria-pressed="${it.lock}" aria-label="${it.lock ? 'Unlock' : 'Lock'} this ${SLOT_NAME[slot].toLowerCase()}. Locked items are never replaced by drops">${it.lock ? 'Locked' : 'Lock'}</button></div>${g2 || '<div class="tw-row"><div class="tw-sub">No affixes yet.</div></div>'}</div>
      <h4 class="tw-h4">Forge</h4><div class="tw-card">
      <div class="tw-row"><div class="tw-main"><div class="tw-nm">Add an affix</div><div class="tw-sub">One extra, once per item (up to ${CONFIG.maxAffix[it.rarity] + 1})</div></div>${fbtn('add', 0, 'Add an affix', it.added ? 'Done' : 'Full')}</div>
      <div class="tw-row"><div class="tw-main"><div class="tw-nm">Upgrade rarity</div><div class="tw-sub">${it.rarity === 'epic' ? 'Already epic' : `To ${it.rarity === 'common' ? 'rare' : 'epic'}: bigger bonus and a new affix`}</div></div>${fbtn('upgrade', 0, 'Upgrade rarity', 'Max')}</div>
      <div class="tw-row"><div class="tw-main"><div class="tw-nm">Temper <span class="tw-lv">Lv ${it.lvl || 0}</span></div><div class="tw-sub">+${Math.round(CONFIG.forge.temperPct * 100)}% base bonus each time, no limit</div></div>${fbtn('temper', 0, 'Temper')}</div></div>`;
  }
  body += `<h4 class="tw-h4">Stash <span class="tw-lv">${g.stash.length}/${stashMax(g)} in all</span></h4><div class="tw-card">` + (st.length ? st.map((x) => { const d = Math.round((power(x) - power(cur)) * 10) / 10;
    return `<div class="tw-row"><div class="tw-main"><div class="tw-nm" style="color:${RCOL[x.rarity]}">${esc(itemName(x))} <span class="tw-lv">Power ${pw(x)}${cur ? ` (${d >= 0 ? '+' : ''}${d})` : ''}</span></div><div class="tw-chips">${chips(x) || '<span class="tw-sub">No affixes</span>'}</div></div>
      <div class="tw-btns"><button class="btn sm soft" data-act="lockItem" data-id="${x.id}" aria-pressed="${x.lock}" aria-label="${x.lock ? 'Unlock' : 'Lock'} stashed ${esc(itemLabel(x))}">${x.lock ? 'Locked' : 'Lock'}</button>
      <button class="btn sm" data-act="equipItem" data-id="${x.id}" aria-label="${cur && cur.lock ? `Cannot equip, the equipped ${SLOT_NAME[slot].toLowerCase()} is locked` : `Equip ${esc(itemLabel(x))}`}" ${cur && cur.lock ? 'disabled' : ''}>Equip</button></div></div>`; }).join('') : '<div class="tw-row"><div class="tw-sub">Nothing stashed for this slot. Worse drops wait here (oldest scrapped for Sweat when full).</div></div>') + '</div>';
  return { title: SLOT_NAME[slot], body };
}
/* ---------- inventory: the bottom sheet with the hero preview, item grid, compare panel and try-on ---------- */
const KIND = { sword: 'short sword', longsword: 'longsword', axe: 'axe', spear: 'spear', greatsword: 'greatsword', tunic: 'tunic', vest: 'leather vest', chain: 'chainmail', plate: 'plate armour', cape: 'caped plate armour', cloth: 'cloth boots', leather: 'leather boots', iron: 'iron greaves' };
const lookKey = (it) => (it && (it.look || lookOf(it))) || '';
export const kindOf = (it) => KIND[lookKey(it).split('.')[1]] || SLOT_NAME[it.slot].toLowerCase();
export const tileLabel = (it, equipped) => `Tier ${it.tier} ${it.rarity} ${kindOf(it)}${it.lvl ? ` +${it.lvl}` : ''}, power ${pw(it)}${equipped ? ', equipped' : ''}${it.lock ? ', locked' : ''}`;
export const INV_TABS = [['all', 'All'], ['weapon', 'Weapon'], ['armour', 'Armour'], ['boots', 'Boots']], INV_SORTS = [['power', 'Power'], ['rarity', 'Rarity'], ['newest', 'Newest']];
export const newInv = (slot = 'all') => ({ type: 'inv', slot, sort: 'power', sel: null, msg: '' });
const LOCK_SVG = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z"/></svg>';
const SHORT = { 'short sword': 'Short sword', longsword: 'Longsword', axe: 'Axe', spear: 'Spear', greatsword: 'Greatsword', tunic: 'Tunic', 'leather vest': 'Vest', chainmail: 'Chainmail', 'plate armour': 'Plate', 'caped plate armour': 'Caped plate', 'cloth boots': 'Cloth', 'leather boots': 'Leather', 'iron greaves': 'Greaves' };
const icon = (look) => { const c = iconInfo(look); return `<img class="inv-ic" alt="" width="${c.w * c.s}" height="${c.h * c.s}" src="${c.url}">`; };
const tileHtml = ({ it, equipped }, sel) => `<button class="inv-tile r-${it.rarity}${sel ? ' on' : ''}" data-act="invSel" data-id="${it.id}" aria-pressed="${sel}" aria-label="${esc(tileLabel(it, equipped))}">
  <span class="inv-bd" aria-hidden="true">${equipped ? '<i class="inv-eq">Equipped</i>' : ''}${it.lock ? `<i class="inv-lk">${LOCK_SVG}</i>` : ''}</span>
  <span class="inv-ib">${icon(lookKey(it))}</span><span class="inv-t" aria-hidden="true">Tier ${it.tier}</span><span class="inv-k" aria-hidden="true">${esc(SHORT[kindOf(it)] || '')}</span></button>`;
const slotCount = (g, sl) => inventory(g, sl).length;
// the looks the preview wears: what is equipped, with the selected item tried on over its slot
export const gearLooks = (g, tryOn = null) => SLOTS.map((s) => lookKey(tryOn && tryOn.slot === s ? tryOn : g.gear[s]));
const STAT_FMT = { atk: (v) => fmt(v), hp: (v) => fmt(v), spd: (v) => `${v.toFixed(2)}/s` };
const dTxt = (d, unit = (v) => String(v), eps = 0.05) => Math.abs(d) < eps ? '<span class="inv-d">no change</span>' : `<span class="inv-d ${d > 0 ? 'up' : 'dn'}"><span aria-hidden="true">${d > 0 ? '+' : '-'}${unit(Math.abs(d))}</span><span class="sr">${d > 0 ? 'up' : 'down'} ${unit(Math.abs(d))}</span></span>`;
export function cmpHtml(g, ui) {
  const it = ui.sel != null ? findItem(g, ui.sel) : null, msg = ui.msg ? `<p class="inv-msg">${esc(ui.msg)}</p>` : '';
  if (!it) { const h = heroStats(g); return `${msg}<div class="inv-nm">Your hero</div><div class="inv-ln">Attack <b class="tnum">${fmt(h.atk)}</b></div><div class="inv-ln">Health <b class="tnum">${fmt(h.hp)}</b></div><div class="inv-ln">Speed <b class="tnum">${h.spd.toFixed(2)}/s</b></div><p class="inv-hint">Tap an item to compare it and try it on.</p>`; }
  const c = compareItem(g, it), nm = STAT_NAME[c.stat], f = STAT_FMT[c.stat];
  const pl = c.same ? `Power <b class="tnum">${pw(it)}</b> <span class="inv-d">worn now</span>` : `Power <b class="tnum">${pw(it)}</b> ${dTxt(c.dPower)}<span class="inv-vs">${c.cur ? `equipped is ${pw(c.cur)}` : 'slot is empty'}</span>`;
  const sl = c.same ? `${nm} <b class="tnum">${f(c.after)}</b>` : `${nm} <b class="tnum">${f(c.before)} &rarr; ${f(c.after)}</b> ${dTxt(c.dStat, (v) => c.stat === 'spd' ? v.toFixed(2) : fmt(v), c.stat === 'spd' ? 0.005 : 0.5)}`;
  return `${msg}<div class="inv-nm" style="color:${RCOL[it.rarity]}">${esc(itemName(it))} ${esc(kindOf(it))}${c.same ? '' : ' <span class="inv-try">Trying on</span>'}</div><div class="inv-ln">${pl}</div><div class="inv-ln">${sl}</div>${it.aff.length ? `<div class="tw-chips">${chips(it)}</div>` : '<div class="inv-hint">No affixes.</div>'}`;
}
// the three buttons under the preview: label, text, disabled, pressed
export function invActs(g, ui) {
  const it = ui.sel != null ? findItem(g, ui.sel) : null, none = 'Select an item first';
  if (!it) return [{ k: 'invEquip', txt: 'Equip', off: true, label: `Equip. ${none}` }, { k: 'invLock', txt: 'Lock', off: true, label: `Lock. ${none}` }, { k: 'invForge', txt: 'Forge', off: true, label: `Forge. ${none}` }];
  const cur = g.gear[it.slot], eq = cur === it, nm = `${itemName(it)} ${kindOf(it)}`;
  return [
    { k: 'invEquip', txt: eq ? 'Equipped' : 'Equip', off: eq || !!(cur && cur.lock), label: eq ? `${nm} is already equipped` : cur && cur.lock ? `Cannot equip, the equipped ${SLOT_NAME[it.slot].toLowerCase()} is locked` : `Equip ${nm}` },
    { k: 'invLock', txt: it.lock ? 'Unlock' : 'Lock', off: false, pressed: it.lock, label: `${it.lock ? 'Unlock' : 'Lock'} ${nm}. Locked items are never replaced by drops` },
    { k: 'invForge', txt: 'Forge', off: false, label: `Forge ${nm}: open the forge for this item` }];
}
const actHtml = (a) => `<button class="btn sm ${a.k === 'invEquip' ? '' : 'soft'}" data-act="${a.k}" data-inv-act="${a.k}" ${a.pressed !== undefined ? `aria-pressed="${a.pressed}"` : ''} aria-label="${esc(a.label)}" ${a.off ? 'disabled' : ''}>${a.txt}</button>`;
const gridHtml = (g, ui) => { const l = inventory(g, ui.slot, ui.sort); return l.length ? l.map((x) => tileHtml(x, x.it.id === ui.sel)).join('') : `<p class="inv-empty">No ${ui.slot === 'all' ? '' : SLOT_NAME[ui.slot].toLowerCase() + ' '}items yet. Bosses drop gear.</p>`; };
const prevLabel = (g, ui) => { const it = ui.sel != null ? findItem(g, ui.sel) : null, w = SLOTS.map((s) => (it && it.slot === s ? it : g.gear[s])).filter(Boolean); return `Your hero wearing ${w.length ? w.map((x) => `${x.rarity} ${kindOf(x)}`).join(', ') : 'no gear'}${it && g.gear[it.slot] !== it ? `. Trying on ${kindOf(it)}` : ''}`; };
export function invSheet(g, ui) {
  const it = ui.sel != null ? findItem(g, ui.sel) : null; if (!it) ui.sel = null;
  const body = `<div class="inv-top"><div class="inv-prev"><canvas id="inv-prev" role="img" aria-label="${esc(prevLabel(g, ui))}"></canvas></div>
      <div class="inv-cmp" id="inv-cmp" role="status" aria-live="polite" aria-atomic="true">${cmpHtml(g, ui)}</div></div>
    <div class="inv-acts" id="inv-acts">${invActs(g, ui).map(actHtml).join('')}</div>
    <div class="inv-bar"><div class="inv-tabs" role="tablist" aria-label="Item slot">${INV_TABS.map(([k, n]) => `<button class="inv-tab${ui.slot === k ? ' on' : ''}" role="tab" aria-selected="${ui.slot === k}" aria-controls="inv-grid" data-act="invTab" data-slot="${k}" aria-label="${n}, ${slotCount(g, k)} item${slotCount(g, k) === 1 ? '' : 's'}">${n}</button>`).join('')}</div>
      <label class="inv-sort"><select data-change="invSort" aria-label="Sort items by">${INV_SORTS.map(([k, n]) => `<option value="${k}" ${ui.sort === k ? 'selected' : ''}>&#8645; ${n}</option>`).join('')}</select></label></div>
    <div class="inv-grid" id="inv-grid" role="tabpanel" aria-label="Items">${gridHtml(g, ui)}</div>`;
  return { title: 'Inventory', body };
}
// Patch the open inventory in place after a tap: tiles, tabs, compare panel, buttons and the preview. Nothing is rebuilt, so the preview canvas keeps running and focus stays put.
export function invPatch(state, ui) {
  const g = ensureGame(state), root = document.getElementById('inv-grid'); if (!root) return;
  if (ui.sel != null && !findItem(g, ui.sel)) ui.sel = null;
  const fo = document.activeElement, fid = fo && root.contains(fo) ? fo.dataset.id : null;
  for (const b of document.querySelectorAll('.inv-tab')) { const on = b.dataset.slot === ui.slot; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); const n = slotCount(g, b.dataset.slot), nm = INV_TABS.find((t) => t[0] === b.dataset.slot)[1], lb = `${nm}, ${n} item${n === 1 ? '' : 's'}`; if (b.getAttribute('aria-label') !== lb) b.setAttribute('aria-label', lb); }
  const sort = document.querySelector('[data-change="invSort"]'); if (sort && sort.value !== ui.sort) sort.value = ui.sort;
  const gh = gridHtml(g, ui), key = JSON.stringify([ui.slot, ui.sort, ui.sel, inventory(g, ui.slot, ui.sort).map((x) => [x.it.id, x.it.lock, x.equipped, x.it.rarity, x.it.lvl])]);
  if (root.dataset.key !== key) { root.dataset.key = key; root.innerHTML = gh; if (fid) { const t = root.querySelector(`[data-id="${fid}"]`); if (t) t.focus({ preventScroll: true }); } }
  const cmp = document.getElementById('inv-cmp'), ch = cmpHtml(g, ui); if (cmp && cmp.innerHTML !== ch) cmp.innerHTML = ch;
  const acts = invActs(g, ui); document.querySelectorAll('[data-inv-act]').forEach((b, i) => { const a = acts[i]; if (b.textContent !== a.txt) b.textContent = a.txt; b.disabled = a.off; b.setAttribute('aria-label', a.label); if (a.pressed !== undefined) b.setAttribute('aria-pressed', a.pressed); });
  const pv = document.getElementById('inv-prev'), pl = prevLabel(g, ui); if (pv && pv.getAttribute('aria-label') !== pl) pv.setAttribute('aria-label', pl);
  if (IV) { IV.key = ''; invDraw(IV, Date.now()); }
}
// The preview: the hero at x4 on a stone tile, idle breathing and an occasional swing so the weapon shows. Reduced motion draws one still frame (and again when the look changes).
let IV = null;
const PW = 36, PH = 32;   // preview size in art pixels: the 32 x 28 hero with a little floor around it
export function unmountInv() { if (!IV) return; cancelAnimationFrame(IV.raf); IV = null; }
export function mountInv(state, ui) {
  unmountInv(); const cv = document.getElementById('inv-prev'); if (!cv) return;
  const dpr = window.devicePixelRatio || 1, sc = Math.max(1, Math.round(4 * dpr)), rm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  cv.width = PW * sc; cv.height = PH * sc; cv.style.width = PW * sc / dpr + 'px'; cv.style.height = PH * sc / dpr + 'px';
  const v = IV = { state, ui, cv, ctx: cv.getContext('2d'), sc, rm, raf: 0, key: '', t0: Date.now() };
  invDraw(v, v.t0);
  if (!rm) { const loop = () => { if (IV !== v) return; v.raf = requestAnimationFrame(loop); invDraw(v, Date.now()); }; v.raf = requestAnimationFrame(loop); }
}
function invDraw(v, now) {
  const g = ensureGame(v.state), it = v.ui.sel != null ? findItem(g, v.ui.sel) : null, t = (now - v.t0) % 3200;
  const f = v.rm ? 'idleA' : t < 2700 ? (Math.floor(t / 500) % 2 ? 'idleB' : 'idleA') : t < 2800 ? 'windup' : t < 2990 ? 'strike' : 'idleA', looks = gearLooks(g, it), key = f + '|' + looks.join('|');
  if (key === v.key) return; v.key = key;
  const { ctx, sc } = v, W = PW * sc, H = PH * sc, ox = 2, oy = 2; ctx.imageSmoothingEnabled = false;
  const ell = (cx, cy, rx, ry) => { for (let d = -ry; d <= ry; d++) { const h = Math.round(rx * Math.sqrt(1 - (d / (ry + 0.5)) ** 2)); ctx.fillRect((cx - h) * sc, (cy + d) * sc, 2 * h * sc, sc); } };
  ctx.fillStyle = PAL.coolD; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = PAL.coolM; ell(ox + 10, oy + 26, 13, 4); ctx.fillStyle = PAL.coolL; ell(ox + 10, oy + 25, 11, 2);   // stone floor tile
  ctx.fillStyle = hexA(PAL.ink, 0.4); ell(ox + 10, oy + 27, 9, 2);   // shadow
  ctx.drawImage(getHero(f, looks).img, ox * sc, oy * sc, 32 * sc, 28 * sc);
}
// 'Equipped Tier 5 epic axe. Attack 25 to 31.' Call it before equip(), since it reads the stats as they are now.
export function equipMsg(g, it) { const c = compareItem(g, it), f = STAT_FMT[c.stat]; return `Equipped ${itemName(it)} ${kindOf(it)}. ${STAT_NAME[c.stat]} ${f(c.before)} to ${f(c.after)}.`; }
// Tap on the battle canvas: true if it landed on the hero. Uses the same whole-number scaling as blit().
export function heroHit(cv, ev) {
  const dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect(), bw = Math.max(1, Math.round(cv.clientWidth * dpr)), s = Math.max(1, Math.ceil(bw / (AW + 2 * PAD))), ox = Math.floor((bw - (AW + 2 * PAD) * s) / 2);
  const ax = ((ev.clientX - r.left) * dpr - ox) / s, ay = (ev.clientY - r.top) * dpr / s;
  return Math.abs(ax - HERO[0]) <= 20 && ay >= HERO[1] - 36 && ay <= HERO[1] + 6;
}

const FOCUS_ROWS = [['endurance', 'Stamina', (g) => `+10% Sweat from training (now +${g.focusUp.endurance * Math.round(CONFIG.staminaPer * 100)}%)`], ['precision', 'Precision', (g) => `+2% crit (now ${pct(heroStats(g).crit)})`], ['luck', 'Luck', (g) => `+2% epic drops (now ${pct(CONFIG.rarity.epic.p + CONFIG.luckPer * g.focusUp.luck)})`]];
function focusParts(g, [id, nm, desc]) {
  const lv = g.focusUp[id], max = lv >= focusMax(id), cost = max ? 0 : focusCost(id, lv);
  return { cost, off: max || g.focus < cost, main: `<div class="tw-nm">${nm} <span class="tw-lv">Lv ${lv}/${focusMax(id)}</span></div><div class="tw-sub">${desc(g)}</div>`,
    label: max ? `${nm} is at max level` : `Upgrade ${nm} to level ${lv + 1} for ${cost} Focus`, txt: btnTxt(max, 'focus', cost) };
}
function focusRow(g, row) {
  const id = row[0], p = focusParts(g, row);
  return `<div class="tw-row" data-row="up:${id}"><div class="tw-main">${p.main}</div>
    <button class="btn sm tw-buy tnum" data-act="buyFocus" data-up="${id}" data-fcost="${p.cost}" aria-label="${esc(p.label)}" ${p.off ? 'disabled' : ''}>${p.txt}</button></div>`;
}
// Soul tree: each row shows the effect now and next, like the stat rows.
const TAL = {
  might: ['Might', (v) => `+${Math.round(v * 100)}% Attack`, 0.08], vigour: ['Vigour', (v) => `+${Math.round(v * 100)}% Health`, 0.08],
  head: ['Head start', (v) => `Start on floor ${1 + v}`, 5], wind: ['Second wind', (v) => `+${v} s boss timer`, 15],
  prospector: ['Prospector', (v) => `+${Math.round(v * 100)}% Sweat from sessions`, 0.10], hoarder: ['Hoarder', (v) => `${CONFIG.stash + v} stash slots`, 1],
  fortune: ['Fortune', (v) => `+${Math.round(v * 100)}% epic drops`, 0.02], ancestral: ['Ancestral forge', (v) => `-${Math.round(v * 100)}% forge cost`, 0.05]
};
function talentParts(g, k) {
  const [nm, fx] = TAL[k], d = CONFIG.talents[k], lv = g.talents[k], max = lv >= d.max, cost = max ? 0 : talentCost(k, lv), per = d.per;
  return { cost, off: max || soulsLeft(g) < cost, main: `<div class="tw-nm">${nm} <span class="tw-lv">Lv ${lv}/${d.max}</span></div><div class="tw-sub">${fx(lv * per)}${max ? '' : ` &rarr; ${fx((lv + 1) * per)}`}</div>`,
    label: max ? `${nm} is at max level` : `Upgrade ${nm} to level ${lv + 1} for ${cost} Souls`, txt: btnTxt(max, 'souls', cost) };
}
const talentRow = (g, k) => { const p = talentParts(g, k);
  return `<div class="tw-row" data-row="tal:${k}"><div class="tw-main">${p.main}</div><button class="btn sm tw-buy tnum" data-act="buyTalent" data-talent="${k}" aria-label="${esc(p.label)}" ${p.off ? 'disabled' : ''}>${p.txt}</button></div>`; };
function respecParts(g) {
  const ok = canRespec(g);
  return { cost: 0, off: !ok, main: `<div class="tw-nm">Refund all talents</div><div class="tw-sub">${g.respecUsed ? 'Used this ascension. Comes back when you ascend' : g.soulsSpent ? 'Free, once each ascension' : 'Nothing to refund yet'}</div>`,
    label: ok ? `Refund all ${g.soulsSpent} spent Souls for free, once per ascension` : g.respecUsed ? 'Refund used this ascension' : 'Nothing to refund', txt: 'Refund' };
}
const respecRow = (g) => { const p = respecParts(g);
  return `<div class="tw-row" data-row="respec"><div class="tw-main">${p.main}</div><button class="btn sm soft tw-buy" data-act="respec" aria-label="${esc(p.label)}" ${p.off ? 'disabled' : ''}>${p.txt}</button></div>`; };
const WAIT_TXT = 'Waiting at the boss door. Train to earn a key.';
export function awayHtml(a) {
  if (!a) return '';
  const hrs = a.seconds >= 3600 ? `${Math.round(a.seconds / 360) / 10} h` : `${Math.round(a.seconds / 60)} min`;
  const best = a.best ? ` Best drop: ${esc(a.best.rarity)} ${esc(SLOT_NAME[a.best.slot].toLowerCase())}, +${pct(a.best.bonus)}${a.best.power ? `, power ${Math.round(a.best.power * 10) / 10}` : ''}${a.best.equipped ? ' (equipped)' : ' (in the stash)'}.` : '';
  return `<div class="note tw-away"><h3>While you were away</h3><p>${hrs}${a.capped ? ' (the most it can count)' : ''}: your hero climbed ${a.floors} floor${a.floors === 1 ? '' : 's'} to floor ${a.to} and beat ${a.bosses} boss${a.bosses === 1 ? '' : 'es'}.${best}${a.waiting ? ` ${WAIT_TXT}` : ''}</p></div>`;
}
export const keysLabel = (n) => `${n} boss key${n === 1 ? '' : 's'}`;
const badgeText = (g) => {
  const z = zoneOf(g.floor).name, k = CONFIG.bossEvery - (g.floor % CONFIG.bossEvery), gr = g.grit >= 0.005 ? Math.round(g.grit * 100) : 0;
  const kc = `<span class="bk" role="img" aria-label="${keysLabel(g.keys)}"><span aria-hidden="true">&#128273;</span> ${g.keys}</span>`, door = atDoor(g);
  return `${kc}<span class="bl">${z} &middot; Floor ${g.floor} &middot; ${isBoss(g.floor) ? (door ? 'Boss door' : 'Boss') : `boss in ${k}`}${gr ? ` &middot; Grit +${gr}%` : ''}</span><span class="bs">${z} &middot; F${g.floor} &middot; ${isBoss(g.floor) ? (door ? 'door' : 'boss') : `boss ${k}`}${gr ? ` &middot; +${gr}%` : ''}</span>`;
};
// Narrow screens (or a long zone name) get the short text.
function fitBadge(b) {
  b.classList.remove('sm'); const box = b.parentElement;
  if (box && (box.clientWidth < 340 || b.scrollWidth > b.clientWidth + 1)) b.classList.add('sm');
}
// 'Crypt, floor 34: your hero fights a ghost. Crypt: enemies regenerate. Burst damage helps.'
export function canvasLabel(g) {
  const n = enemyName(g.floor, isBoss(g.floor)), who = isBoss(g.floor) ? `the ${n}` : `${/^[aeiou]/.test(n) ? 'an' : 'a'} ${n}`;
  if (atDoor(g)) return `${zoneOf(g.floor).name}, floor ${g.floor}: your hero waits at the closed door of ${who}. Train to earn a boss key.`;
  return `${zoneOf(g.floor).name}, floor ${g.floor}: your hero fights ${who}. ${traitLine(g.floor)}`;
}
export function viewTower(state) {
  const g = ensureGame(state);
  const cur = (ic, nm, key, v) => `<div class="tw-cur" role="group" data-twg="${key}" aria-label="${nm} ${Math.round(v)}"><span class="tw-ci" aria-hidden="true">${ic}</span><b class="tnum" data-tw="${key}" aria-hidden="true">${fmt(v)}</b><span aria-hidden="true">${nm}</span></div>`;
  const asc = g.tokens > 0 ? `<div class="section"><h2 class="title">Ascend</h2><div class="note tw-asc"><h3>Ascend token &times;${g.tokens}</h3><p>Reset to floor 1 for <b>+${soulsFor(g)} souls</b> (from floor ${g.runMax}). Souls are spent in the Soul tree and kept forever. Your best gear item and any locked items stay. Other slots and unlocked stash items reset. Stats, Focus upgrades and currencies stay.</p>
    <button class="btn sm" data-act="ascend" data-tw-asc ${canAscend(g) ? '' : 'disabled'}>Ascend</button>${canAscend(g) ? '' : `<p class="small muted" style="margin:8px 0 0">Reach floor ${CONFIG.ascendMinFloor} first. You are at ${g.runMax}.</p>`}</div></div>` : '';
  return `<div class="section"><div class="tw-battle"><div class="tw-badge tnum" id="tw-badge">${badgeText(g)}</div><canvas id="tw-canvas" role="img" data-act="heroTap" aria-label="${esc(canvasLabel(g))}"></canvas><div class="tw-live" id="tw-live" role="status" aria-live="polite"></div></div>
    <p class="tw-trait" id="tw-trait">${esc(traitLine(g.floor))}</p><p class="tw-wait" id="tw-wait" ${atDoor(g) ? '' : 'hidden'}>${WAIT_TXT}</p>
    <div id="tw-away">${awayHtml(g.away)}</div>
    <div class="tw-curs">${cur('&#9889;', 'Sweat', 'sweat', g.sweat)}${cur('&#9670;', 'Focus', 'focus', g.focus)}${cur('&#10022;', 'Souls', 'souls', soulsLeft(g))}</div></div>
  <div class="section"><h2 class="title">Hero</h2><div class="tw-card">${['atk', 'hp', 'spd'].map((s) => statRow(g, s)).join('')}</div></div>
  <div class="section"><h2 class="title">Gear</h2><div class="tw-card" id="tw-gear">${gearHtml(g)}</div></div>
  <div class="section"><h2 class="title">Focus upgrades</h2><div class="tw-card">${FOCUS_ROWS.map((r) => focusRow(g, r)).join('')}</div><p class="small muted tw-note">Spend Focus on the Forge too: tap a gear slot above.</p></div>
  <div class="section"><h2 class="title">Soul tree</h2><div class="tw-card" id="tw-souls">${TALENTS.map((k) => talentRow(g, k)).join('')}${respecRow(g)}</div></div>
  ${asc}
  <div class="section"><h2 class="title">How you earn</h2><div class="tw-card tw-how"><p><b><span aria-hidden="true">&#9889;</span> Sweat</b> from training. Full session 100, minimum day 40, times your streak bonus (up to &times;1.5). Only 2 sessions a day pay, the 2nd half.</p><p><b>&#9889; Bonus</b> level-up +300 and an Ascend token, new best +100.</p><p><b>&#9670; Focus</b> from fasts that reach your &ldquo;counts after&rdquo; hours: 30, plus 5 for each extra hour, up to 80.</p><p><b><span aria-hidden="true">&#128273;</span> Boss keys</b> from training: 1 for each session (the first 2 a day, minimum days count) and 1 more for a level-up. A boss needs a key. You hold up to ${CONFIG.keyCap}, and a lost boss fight keeps its key.</p><p><b>&#10022; Souls</b> from ascending, spent on talents. Missed days cost nothing. The hero keeps climbing.</p></div></div>`;
}

const R = (x, c, X, Y, w, h) => { x.fillStyle = c; x.fillRect(X, Y, w, h); };
// 3x5 pixel digits for damage numbers
const GLYPH = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001010010', 8: '111101111101111', 9: '111101111001111', k: '101101110101101', M: '101111111101101', '!': '010010010000010', B: '110101110101110', '.': '000000000000010', '-': '000000111000000', K: '101101110101101', O: '111101101101111' };
function text(x, s, X, Y, col = PAL.white, sc = 1) {
  const draw = (ox, oy, c) => { x.fillStyle = c; let cx = X + ox; for (const ch of s) { const gl = GLYPH[ch]; if (gl) for (let i = 0; i < 15; i++) if (gl[i] === '1') x.fillRect(cx + i % 3 * sc, Y + oy + Math.floor(i / 3) * sc, sc, sc); cx += 4 * sc; } };
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) draw(dx, dy, PAL.ink);
  draw(0, 0, col);
}
const textW = (s, sc = 1) => (s.length * 4 - 1) * sc;
function shadow(x, cx, cy, rx, ry) {
  x.fillStyle = hexA(PAL.ink, 0.4);
  for (let d = -ry; d <= ry; d++) { const h = Math.round(rx * Math.sqrt(1 - (d / ry) ** 2)); x.fillRect(cx - h, cy + d, 2 * h, 1); }
}
function bar(x, cx, y, w, f, col, ghost = f) {   // f is the real fill, ghost is the pale recent-damage segment behind it
  R(x, PAL.ink, cx - w / 2 - 1, y - 1, w + 2, 5); R(x, PAL.coolD, cx - w / 2, y, w, 3);
  const fw = Math.max(f > 0.002 ? 1 : 0, Math.round(w * Math.max(0, Math.min(1, f)))), gw = Math.round(w * Math.max(0, Math.min(1, ghost)));
  if (gw > fw) R(x, PAL.goldL, cx - w / 2 + fw, y, gw - fw, 3);
  R(x, col, cx - w / 2, y, fw, 3); R(x, hexA(PAL.white, 0.35), cx - w / 2, y, fw, 1);
}

// The boss door: stone posts and lintel, iron bars, a gold padlock. Drawn over the boss while the hero waits for a key.
function gate(x, cx, by) {
  const w = 32, h = 40, X = cx - w / 2, Y = by - h, mid = Y + 22;
  R(x, PAL.ink, X - 1, Y - 2, w + 2, h + 2);
  R(x, hexA(PAL.coolD, 0.7), X + 3, Y + 3, w - 6, h - 3);
  for (let i = 6; i < w - 5; i += 4) { R(x, PAL.coolM, X + i, Y + 3, 2, h - 3); R(x, PAL.coolL, X + i, Y + 3, 1, h - 3); }
  R(x, PAL.coolM, X + 3, mid, w - 6, 3); R(x, PAL.coolL, X + 3, mid, w - 6, 1);
  R(x, PAL.coolM, X, Y, 3, h); R(x, PAL.coolL, X, Y, 1, h); R(x, PAL.coolM, X + w - 3, Y, 3, h); R(x, PAL.coolD, X + w - 1, Y, 1, h);
  R(x, PAL.coolL, X - 1, Y - 2, w + 2, 4); R(x, PAL.coolM, X - 1, Y + 1, w + 2, 1);
  R(x, PAL.ink, cx - 4, mid - 1, 8, 8); R(x, PAL.goldM, cx - 3, mid, 6, 6); R(x, PAL.goldL, cx - 3, mid, 6, 1); R(x, PAL.woodM, cx - 1, mid + 2, 2, 3);
  R(x, PAL.goldL, cx - 2, mid - 3, 1, 3); R(x, PAL.goldL, cx + 1, mid - 3, 1, 3); R(x, PAL.goldM, cx - 2, mid - 4, 4, 1);
}

/* ---------- live loop ---------- */
let M = null;
const PAINT_MS = 1000 / 20 - 2;   // about 20 fps
const HITSTOP_MS = 80, SHAKE_MS = 240, SHAKE_PX = 2.5;   // live boss kill: freeze, then shake the screen 2 to 3 px
const STRIKE_MS = 190, HURT_MS = 140;   // strike frame length after the windup, and how long the hurt frame shows
const FIGHT = CONFIG.rest * 0.7, KO_AT = FIGHT + 0.15, EASE_MS = 130, GHOST_HOLD = 380, LIFT = { bat: 9, wisp: 6 };   // a lost try: fight for 7 s, hero falls just after, then the rest pause
export const towerMounted = () => !!M;
export function unmountTower() {
  if (!M) return;
  cancelAnimationFrame(M.raf); document.removeEventListener('visibilitychange', M.onVis); if (M.io) M.io.disconnect();
  try { M.save(M.state); } catch (e) { /* ignore */ }
  M = null;
}
const newBar = () => ({ v: 1, from: 1, t0: 0, ghost: 1, hit: -1e9 });
// opts.live: the boss floor to play as the live fight (hit-stop, shake, loot card). opts.tone(ok): the app plays a short tone.
export function mountTower(state, save, opts = {}) {
  unmountTower();
  const cv = document.getElementById('tw-canvas'); if (!cv) return;
  const g = ensureGame(state), now = Date.now();
  const [art, a] = mk(AW + 2 * PAD, AH), ctx = cv.getContext('2d');
  const rm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const m = M = { state, g, save, cv, ctx, art, a, scene: sceneFor(g.floor), rm, raf: 0, floor: g.floor, spawnT: now - 1000, S: null, key: '', hi: 0, fi: 0, hl: 0, fl: 0, lastProg: 0, eb: newBar(), hb: newBar(), down: 0, hLunge: -1e9, fLunge: -1e9, hFlash: -1e9, fFlash: -1e9, floats: [], lastSave: now, lastUi: 0, drawn: 0, vis: true, io: null, gearSig: '', cw: 0, ch: 0, live: opts.live ? { floor: opts.live, done: false } : null, tone: opts.tone || null, freeze: 0, shake: -1e9, msgAt: 0, loot: null };
  m.onVis = () => { if (document.visibilityState === 'hidden') { try { save(state); m.lastSave = Date.now(); } catch (e) { /* ignore */ } } };
  document.addEventListener('visibilitychange', m.onVis);
  if (g.away) { g.away = null; try { save(state); } catch (e) { /* ignore */ } }   // the banner shows once
  if (!g.lastTick) g.lastTick = now;
  if ('IntersectionObserver' in window) { m.io = new IntersectionObserver((es) => { const v = es[es.length - 1].isIntersecting; if (v && !m.vis) m.drawn = 0; m.vis = v; }); m.io.observe(cv); }   // no painting while the canvas is off screen
  paint(m, now);
  const loop = () => { m.raf = requestAnimationFrame(loop); tick(m); };
  m.raf = requestAnimationFrame(loop);
}
function tick(m) {
  const { g } = m, now = Date.now();
  if (now < m.freeze) { g.lastTick = now; return; }   // hit-stop: the whole fight holds for a beat on the killing blow
  let dt = (now - g.lastTick) / 1000;
  if (dt < 0) { g.lastTick = now; dt = 0; }
  if (dt > 30) {   // phone slept or tab was away: use the offline sim and show the banner
    const away = offlineCatchUp(m.state, now);
    const el = document.getElementById('tw-away'); if (el && away) { el.innerHTML = awayHtml(away); g.away = null; }
    m.key = ''; updateUi(m, now);
  } else if (dt > 0) {
    const s = advance(g, dt); g.lastTick = now;
    if (s.drops.length) { m.lastUi = 0; if (m.live && !m.live.done && s.bosses) { m.live.done = true; showLoot(m, s.drops[s.drops.length - 1]); } }
  }
  if (now - m.lastSave > 5000) { try { m.save(m.state); } catch (e) { /* ignore */ } m.lastSave = now; }
  if (now - m.lastUi > 1000) updateUi(m, now);
  if (!m.vis || now - m.drawn < (m.rm ? 500 : PAINT_MS)) return;   // sim runs every frame, painting is capped to save battery
  paint(m, now, m.drawn ? Math.min((now - m.drawn) / 1000, 0.25) : 0);
}
// Updates numbers, rows and button states in place, so the canvas and scene are never rebuilt (and VoiceOver keeps its focus).
export function refreshTowerUi(state) {
  const g = ensureGame(state);
  for (const [k, nm] of [['sweat', 'Sweat'], ['focus', 'Focus'], ['souls', 'Souls']]) {
    const v = k === 'souls' ? soulsLeft(g) : g[k], e = document.querySelector(`[data-tw="${k}"]`), t = fmt(v); if (e && e.textContent !== t) e.textContent = t;
    const gp = document.querySelector(`[data-twg="${k}"]`), l = `${nm} ${Math.round(v)}`; if (gp && gp.getAttribute('aria-label') !== l) gp.setAttribute('aria-label', l);
  }
  const patch = (key, p) => {
    const row = document.querySelector(`[data-row="${key}"]`); if (!row) return;
    const main = row.querySelector('.tw-main'), b = row.querySelector('.tw-buy');
    if (main.innerHTML !== p.main) main.innerHTML = p.main;
    if (b.innerHTML !== p.txt) b.innerHTML = p.txt;
    if (b.getAttribute('aria-label') !== p.label) b.setAttribute('aria-label', p.label);
    b.dataset.cost = p.cost; b.dataset.fcost = p.cost; b.disabled = p.off;
  };
  for (const st of ['atk', 'hp', 'spd']) patch('stat:' + st, statParts(g, st));
  for (const r of FOCUS_ROWS) patch('up:' + r[0], focusParts(g, r));
  for (const k of TALENTS) patch('tal:' + k, talentParts(g, k));
  patch('respec', respecParts(g));
  document.querySelectorAll('[data-tw-asc]').forEach((e) => { e.disabled = !canAscend(g); });
  const ge = document.getElementById('tw-gear'), gs = JSON.stringify([g.gear, g.stash.length, stashMax(g)]); if (ge && ge.dataset.sig !== gs) { ge.dataset.sig = gs; ge.innerHTML = gearHtml(g); }
}
function updateUi(m, now) {
  const { g } = m; m.lastUi = now;
  refreshTowerUi(m.state);
  const b = document.getElementById('tw-badge'); if (b) { const t = badgeText(g); if (b.innerHTML !== t) b.innerHTML = t; fitBadge(b); }
  const lb = canvasLabel(g); if (m.cv.getAttribute('aria-label') !== lb) m.cv.setAttribute('aria-label', lb);
  const tl = document.getElementById('tw-trait'), tt = traitLine(g.floor); if (tl && tl.textContent !== tt) tl.textContent = tt;
  const wt = document.getElementById('tw-wait'); if (wt) wt.hidden = !atDoor(g);
  if (m.msgAt && now - m.msgAt > 10000) closeLoot();   // the lost-fight note fades after 10 s
}
// The loot card and the lost-fight note live in #tw-live over the canvas.
const R_HEX = { common: PAL.steelL, rare: PAL.blueL, epic: PAL.purL };
export function closeLoot() { const el = document.getElementById('tw-live'); if (el) el.innerHTML = ''; if (M) { M.msgAt = 0; M.loot = null; } }
export function lootHtml(g, rec) {
  const it = rec, cur = g.gear[it.slot], stashed = !it.equipped && !!findItem(g, it.id), off = !stashed || !!(cur && cur.lock);
  return `<div class="tw-loot" role="group" aria-label="${esc(`Boss loot: ${itemLabel(it)}, ${it.equipped ? 'equipped' : stashed ? 'in the stash' : 'scrapped'}`)}"><div class="tw-lk">Boss down</div>
    <div class="tw-lr"><span class="tw-li" style="border-color:${R_HEX[it.rarity]}">${icon(lookKey(it))}</span><div class="tw-lm"><div class="tw-ln" style="color:${R_HEX[it.rarity]}">${esc(itemName(it))} ${esc(kindOf(it))}</div><div class="tw-lp">${it.rarity} &middot; Power ${pw(it)} &middot; +${pct(it.bonus)} ${STAT_NAME[SLOT_STAT[it.slot]]}</div></div></div>
    <div class="tw-chips">${chips(it) || '<span class="tw-sub">No traits</span>'}</div>
    <div class="tw-lb"><button class="btn sm" data-act="lootEquip" data-id="${it.id}" aria-label="${off ? (it.equipped ? 'Already equipped' : cur && cur.lock ? 'Cannot equip, the equipped item is locked' : 'Cannot equip') : `Equip ${esc(itemLabel(it))}`}" ${off ? 'disabled' : ''}>${it.equipped ? 'Equipped' : 'Equip'}</button><button class="btn sm soft" data-act="lootKeep" aria-label="Keep it and close">Keep</button></div></div>`;
}
function showLoot(m, rec) {
  const el = document.getElementById('tw-live'); if (!el) return;
  m.loot = rec; el.innerHTML = lootHtml(m.g, rec);
  const b = el.querySelector('button:not([disabled])'); if (b) b.focus({ preventScroll: true });
  if (m.tone) m.tone(true);
}
function showLost(m) {
  const el = document.getElementById('tw-live'); if (!el) return;
  el.innerHTML = '<div class="tw-lose">Not this time. Upgrade and try again. Your key is kept for this boss.</div>'; m.msgAt = Date.now();
  if (m.tone) m.tone(false);
}

/* ---------- the visual fight: discrete hits that add up to what the sim says ---------- */
// Every hit is an event. A won fight has round(t x speed) hero hits, the last one landing at the kill, and the foe hits once a second. Damage per hit is split from the real totals
// (crits weigh double, picked by a hash so a floor always plays the same). A lost try plays 7 s of real-rate hits scaled to the real totals, then the hero falls.
export function schedule(f, floor) {
  const h = f.hero, e = f.enemy, S = { win: f.win, hero: [], foe: [], ko: f.win ? null : KO_AT }, cm = h.critMult || 2, net = Math.max(0, f.net ?? e.atk), timer = f.timer || CONFIG.bossTimer;
  const win = f.win, span = win ? f.t : FIGHT, N = Math.max(1, Math.round(span * h.spd));
  const w = Array.from({ length: N }, (_, k) => (hash(floor * 131 + k, 17) < h.crit ? cm : 1)), sw = w.reduce((p, q) => p + q, 0);
  const tl = win ? f.t : f.late ? timer : isFinite(f.tDie) ? f.tDie : timer, dealt = win ? e.hp : Math.max(0, f.dps) * tl;   // sim seconds the fight really ran, and the damage done in them
  for (let k = 0; k < N; k++) S.hero.push({ t: span * (k + 1) / N, d: dealt * w[k] / sw, c: w[k] > 1 });
  const M = win ? Math.floor(f.t + 1e-9) : Math.floor(FIGHT), share = win ? 1 : f.late || !isFinite(f.tDie) ? Math.min(0.9, net * tl / h.hp) : 1;
  for (let j = 1; j <= M; j++) S.foe.push({ t: win ? j : FIGHT * j / M, d: win ? net : h.hp * share / M });
  return S;
}
const shown = (b, now, rm) => (rm ? b.v : b.from + (b.v - b.from) * Math.min(1, (now - b.t0) / EASE_MS) * (2 - Math.min(1, (now - b.t0) / EASE_MS)));   // ease out
function drop(b, d, now, quiet) {
  const cur = shown(b, now, quiet); b.from = cur; b.v = Math.max(0, b.v - d); b.t0 = quiet ? -1e9 : now; b.hit = now;
  if (quiet) { b.from = b.v; b.ghost = b.v; } else b.ghost = Math.max(b.ghost, cur);
}
function sync(m, f, now, dt) {
  const { g } = m, p = g.prog, fx = !m.rm, h = f.hero, e = f.enemy;
  const key = [g.floor, f.win, f.late, f.t.toFixed(3), h.spd, h.atk, h.hp, h.crit].join('|');
  if (key !== m.key || p + 0.01 < m.lastProg || now - m.drawn > 1500 || !m.S) {   // new floor, new try, a bought upgrade or a long gap: rebuild and catch up quietly
    m.key = key; m.S = schedule(f, g.floor); m.hi = m.fi = m.hl = m.fl = 0; m.down = 0; m.eb = newBar(); m.hb = newBar(); m.floats = [];
    if (m.floor !== g.floor) { m.floor = g.floor; m.spawnT = now; m.scene = sceneFor(g.floor); }
  }
  m.lastProg = p;
  const S = m.S, stale = (t) => !fx || t < p - 0.35;
  while (m.hl < S.hero.length && S.hero[m.hl].t - 0.1 <= p) { if (fx && !stale(S.hero[m.hl].t)) m.hLunge = now; m.hl++; }
  while (m.fl < S.foe.length && S.foe[m.fl].t - 0.11 <= p) { if (fx && !stale(S.foe[m.fl].t)) m.fLunge = now; m.fl++; }
  while (m.hi < S.hero.length && S.hero[m.hi].t <= p) {
    const k = S.hero[m.hi++], q = stale(k.t); drop(m.eb, k.d / e.hp, now, q);
    if (!q && m.live && !m.live.done && e.boss && f.win && g.floor === m.live.floor && m.hi === S.hero.length) { m.freeze = now + HITSTOP_MS; m.shake = now; }   // the killing blow of the live fight
    if (!q) { m.fFlash = now; if (m.floats.length < 10) m.floats.push({ s: fmt(k.d) + (k.c ? '!' : ''), x: FOE[0] + Math.round(Math.random() * 10 - 5), y: FOE[1] - (e.boss ? 46 : 40), t: now, c: k.c ? PAL.goldL : PAL.white, sc: k.c ? 2 : 1 }); }
  }
  while (m.fi < S.foe.length && S.foe[m.fi].t <= p) {
    const k = S.foe[m.fi++], q = stale(k.t); drop(m.hb, k.d / h.hp, now, q);
    if (!q) { m.hFlash = now; if (m.floats.length < 10) m.floats.push({ s: fmt(k.d), x: HERO[0] + Math.round(Math.random() * 8 - 4), y: HERO[1] - 42, t: now, c: PAL.redL, sc: 1 }); }
  }
  if (S.ko !== null && p >= S.ko && !m.down) {   // knocked down
    m.down = fx && p - S.ko < 0.35 ? now : now - 1000; drop(m.hb, 1, now, !fx || p - S.ko > 0.35);
    if (fx && p - S.ko < 0.35) m.floats.push({ s: 'KO', x: HERO[0], y: HERO[1] - 42, t: now, c: PAL.redL, sc: 1 });
    if (m.live && !m.live.done && e.boss && g.floor === m.live.floor) { m.live.done = true; showLost(m); }
  }
  for (const b of [m.eb, m.hb]) {   // the ghost holds a moment after a hit, then catches up
    const cur = shown(b, now, m.rm);
    if (m.rm || now - b.hit > GHOST_HOLD) b.ghost = m.rm ? cur : Math.max(cur, b.ghost - dt * 0.9); else b.ghost = Math.max(b.ghost, cur);
  }
}
function flicker(m, now) {
  const a = m.a;
  for (const l of m.scene.lights) { const n = (Math.sin(now / 90 + l.x * 1.7) + Math.sin(now / 53 + l.x * 0.6) + 2) / 4; glow(a, l, 0.02 + 0.13 * n * n); }
}
function paint(m, now, dt = 0) {
  const { g, a } = m, f = fight(g, g.floor), e = f.enemy, boss = e.boss, elite = !boss && isElite(g.floor), kind = enemyKind(g.floor, boss);
  sync(m, f, now, dt);
  const fx = !m.rm, p = g.prog, win = f.win;
  a.imageSmoothingEnabled = false;
  a.drawImage(m.scene.canvas, 0, 0);
  if (fx) flicker(m, now);
  const dying = win && p >= f.t, alive = win ? p < f.t + 0.5 : true;
  const spawn = Math.min(1, (now - m.spawnT) / 350), eA = fx ? (dying ? Math.max(0, 1 - (p - f.t) / 0.5) : 1) * spawn : (dying ? 0 : 1);
  const door = atDoor(g), down = !!m.down, walking = win && dying && fx;
  const bobH = walking && !down ? (Math.floor(now / 120) % 2) : 0;   // the walk after a kill: a 1 px hop
  // frames: idle breathes at about 2 fps; each scheduled hit plays windup then strike; being hit shows hurt; KO and death show down. Reduced motion: idle A only, plus down.
  const idle = fx && Math.floor(now / 500) % 2 ? 'idleB' : 'idleA';
  const act = (t0, wind) => { const t = now - t0; return !fx || t < 0 ? null : t < wind ? 'windup' : t < wind + STRIKE_MS ? 'strike' : null; };
  const ha = act(m.hLunge, 100), fa = act(m.fLunge, 110), hHurt = fx && now - m.hFlash < HURT_MS, fHurt = fx && now - m.fFlash < HURT_MS;
  const hf = down ? 'down' : hHurt ? 'hurt' : walking ? 'idleA' : ha || idle, ef = dying && fx ? 'down' : fHurt ? 'hurt' : fa || idle;
  const hs = getHero(hf, gearLooks(g)), es = getSprite(kind, ef, elite), ep = es.pad || 0;
  const hStep = hf === 'strike' ? 2 : hf === 'windup' ? -1 : 0, fStep = ef === 'strike' ? -2 : ef === 'windup' ? 1 : 0;   // the small step that goes with each frame
  const lift = dying ? 0 : (LIFT[kind] || 0) + (LIFT[kind] && fx ? Math.round(Math.sin(now / 260) * 2) : 0);
  shadow(a, HERO[0], HERO[1] + 1, 9, 3);
  if (alive && eA > 0) shadow(a, FOE[0], FOE[1] + 1, boss ? 13 : 9, boss ? 4 : 3);
  const hx = Math.round(HERO[0] - hs.px + hStep), hy = HERO[1] - hs.h + 3 - bobH, hurt = fx && now - m.hFlash < 80;
  if (down) { a.globalAlpha = 0.85; a.drawImage(hs.img, hx, hy); } else a.drawImage(hurt ? hs.flash : hs.img, hx, hy);
  a.globalAlpha = 1;
  const ex = Math.round(FOE[0] - es.px + fStep), ey = FOE[1] - es.h + 3 - lift;
  if (alive && eA > 0) { a.globalAlpha = eA; a.drawImage(fx && now - m.fFlash < 80 ? es.flash : es.img, ex - ep, ey - ep); a.globalAlpha = 1; }
  if (door) gate(a, FOE[0], FOE[1] + 2);   // closed gate in front of the boss while the hero has no key
  // bars: they only move on hits
  if (!down) bar(a, HERO[0], hy + hs.top - 5, 20, shown(m.hb, now, m.rm), PAL.greenM, m.hb.ghost);
  if (!door && alive && eA > 0.5) bar(a, FOE[0], Math.max(4, ey + es.top - 5), boss ? 28 : 20, shown(m.eb, now, m.rm), PAL.redM, m.eb.ghost);
  // floating numbers
  m.floats = m.floats.filter((fo) => now - fo.t < 900);
  for (const fo of m.floats) { const age = (now - fo.t) / 900; a.globalAlpha = age > 0.7 ? 1 - (age - 0.7) / 0.3 : 1; text(a, fo.s, Math.round(fo.x - textW(fo.s, fo.sc) / 2), Math.round(fo.y - 16 * (1 - (1 - age) ** 2)), fo.c, fo.sc); }
  a.globalAlpha = 1;
  blit(m); m.drawn = now;
}

// Scale the art buffer up by a whole number, centred and cropped at the sides, crisp on any pixel ratio.
function blit(m) {
  const { cv, ctx } = m, dpr = window.devicePixelRatio || 1, w = cv.clientWidth, bw = Math.max(1, Math.round(w * dpr));
  const s = Math.max(1, Math.ceil(bw / (AW + 2 * PAD))), bh = AH * s, ch = bh / dpr + 'px';
  if (cv.style.height !== ch) cv.style.height = ch;
  if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
  ctx.imageSmoothingEnabled = false;
  const ox = Math.floor((bw - (AW + 2 * PAD) * s) / 2), sk = !m.rm && Date.now() - m.shake < SHAKE_MS, sx = sk ? Math.round((Math.random() * 2 - 1) * SHAKE_PX * dpr) : 0, sy = sk ? Math.round((Math.random() * 2 - 1) * SHAKE_PX * dpr) : 0;
  ctx.fillStyle = PAL.ink; ctx.fillRect(0, 0, bw, bh);
  ctx.drawImage(m.art, 0, 0, AW + 2 * PAD, AH, ox + sx, sy, (AW + 2 * PAD) * s, bh);
}
