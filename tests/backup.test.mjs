// Backup and data-protection tests. All fixtures are synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';
import * as B from '../js/backup.js';
import { importJSON, exportJSON } from '../js/store.js';

const D = (y, m, d, h = 12) => new Date(y, m - 1, d, h);
const fake = () => { const m = new Map(); return { m, all: async () => [...m.values()], put: async (r) => { m.set(r.key, structuredClone(r)); }, del: async (k) => { m.delete(k); } }; };
const synth = (n = 2, fasts = 1, floor) => {
  const s = L.defaultState(D(2026, 1, 1));
  s.sessions = Array.from({ length: n }, (_, i) => ({ id: `s${i}` }));
  s.fasts = Array.from({ length: fasts }, (_, i) => ({ id: `f${i}` }));
  if (floor != null) s.game = { floor };
  return s;
};

test('backupDue uses a 7 day interval', () => {
  const s = L.defaultState(D(2026, 1, 1));
  assert.equal(L.backupDue(s, D(2026, 1, 7)), false);
  assert.equal(L.backupDue(s, D(2026, 1, 9)), true);
  const b = L.markBackedUp(s, D(2026, 2, 1));
  assert.equal(L.backupDue(b, D(2026, 2, 7)), false);
  assert.equal(L.backupDue(b, D(2026, 2, 9)), true);
});

test('snapshot ring keeps 7, one per date', async () => {
  const st = fake(), s = synth();
  for (let d = 1; d <= 10; d++) assert.equal(await B.snapshot(st, s, D(2026, 3, d)), true);
  assert.equal(await B.snapshot(st, s, D(2026, 3, 10, 20)), false);   // same date, skipped
  const l = await B.listSnaps(st);
  assert.equal(l.length, 7);
  assert.deepEqual(l.map((x) => x.date), ['2026-03-10', '2026-03-09', '2026-03-08', '2026-03-07', '2026-03-06', '2026-03-05', '2026-03-04']);
  assert.ok(l[0].size > 0);
  await B.snapshot(st, s, D(2026, 3, 10), { label: 'before import', force: true });   // force replaces that date
  const l2 = await B.listSnaps(st);
  assert.equal(l2.length, 7); assert.equal(l2[0].label, 'before import');
});

test('empty state does not write a daily snapshot, and a broken store never throws', async () => {
  const st = fake();
  assert.equal(await B.snapshot(st, L.defaultState(D(2026, 1, 1)), D(2026, 3, 1)), false);
  assert.equal(await B.snapshot(null, synth(), D(2026, 3, 1)), false);
  const bad = { all: async () => { throw new Error('x'); }, put: async () => { throw new Error('x'); }, del: async () => {} };
  assert.equal(await B.snapshot(bad, synth(), D(2026, 3, 1)), false);
  assert.deepEqual(await B.listSnaps(bad), []);
});

test('restore offer when localStorage is empty or damaged', async () => {
  const st = fake(); await B.snapshot(st, synth(3, 1, 4), D(2026, 3, 1)); await B.snapshot(st, synth(5, 2, 6), D(2026, 3, 2));
  assert.equal((await B.restoreOffer(null, st)).date, '2026-03-02');
  assert.equal((await B.restoreOffer('{oops', st)).date, '2026-03-02');
  assert.equal(await B.restoreOffer(JSON.stringify(synth()), st), null);   // good data: no offer
  assert.equal(await B.restoreOffer(null, fake()), null);                  // no snapshot
  assert.equal(await B.restoreOffer(null, null), null);                    // no IndexedDB
  assert.match(B.restoreConfirm(await B.restoreOffer(null, st)).message, /5 sessions, 2 fasts, Tower floor 6/);
});

test('import confirm summary', () => {
  const next = importJSON(exportJSON(synth(12, 1, 7)));
  const c = B.importConfirm(next);
  assert.match(c.message, /12 sessions, 1 fast, Tower floor 7/);
  assert.doesNotMatch(B.importConfirm(importJSON(exportJSON(synth(0, 0)))).message, /Tower/);   // no floor, none shown
  assert.throws(() => importJSON('{"version":9}'));
});

test('backup card text says what is at risk', () => {
  assert.match(B.backupCardText(synth(40, 3, 9)), /40 sessions, 3 fasts, Tower floor 9/);
});

test('ensurePersist results', async () => {
  const nav = (persisted, persist) => ({ storage: { persisted: async () => persisted, persist: async () => persist } });
  assert.equal(await B.ensurePersist(nav(true, false)), 'Protected');
  assert.equal(await B.ensurePersist(nav(false, true)), 'Protected');
  assert.equal(await B.ensurePersist(nav(false, false)), 'Not protected');
  assert.equal(await B.ensurePersist({}), 'Not supported');
  assert.equal(await B.ensurePersist({ storage: { persisted: async () => { throw new Error('x'); }, persist() {} } }), 'Not supported');
});
