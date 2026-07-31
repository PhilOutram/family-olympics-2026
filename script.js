/* =========================================================================
   Family Olympics 2026  -  scoring app
   Data lives in localStorage on this device.
   ========================================================================= */

'use strict';

const APP_VERSION = 'v1.3.0';
const STORE_KEY = 'family-olympics-2026';
const DB_ROOT = 'olympics2026/events';   // Realtime Database path for all scores
const RANK_POINTS = [5, 4, 3, 2, 1];   // 1st..5th
const RESET_CODE = '2026';              // 4-digit code required to wipe the shared board

/*
 * Firebase web config. This is a PUBLIC client identifier, not a secret - Google
 * designs it to ship in browser code, and it must be here for the app to work. It
 * grants no access on its own; who can read/write is controlled by the Realtime
 * Database Security Rules, not by keeping this key hidden. Rotating or hiding it
 * achieves nothing (any replacement is equally public). GitHub's secret scanner
 * flags the generic "AIza..." Google key shape, so this is a known false positive.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyB3hrN6-OwwTwf5ItyDQ-ev0aTuyZYL6bw',
  authDomain: 'family-olympics-80223.firebaseapp.com',
  databaseURL: 'https://family-olympics-80223-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'family-olympics-80223',
  storageBucket: 'family-olympics-80223.firebasestorage.app',
  messagingSenderId: '531475781359',
  appId: '1:531475781359:web:f1f75cac74f0d44c37ed1a',
};

/* ----- Teams (5 = the five Olympic ring colours) ----- */
const TEAMS = [
  { id: 1, members: ['Rick', 'Cara', 'Jo'], color: 'var(--blue)',   ring: 'Blue'   },
  { id: 2, members: ['Phil', 'Hal'],        color: 'var(--yellow)', ring: 'Yellow' },
  { id: 3, members: ['Kezi', 'Cam'],        color: 'var(--black)',  ring: 'Black'  },
  { id: 4, members: ['Claire', 'Max'],      color: 'var(--green)',  ring: 'Green'  },
  { id: 5, members: ['Zoe', 'Benny'],        color: 'var(--red)',    ring: 'Red'    },
];
const teamById = (id) => TEAMS.find((t) => t.id === id);
const teamLabel = (id) => `Team ${id}`;
const teamMembers = (id) => teamById(id).members.join(', ');

/* ----- Events ----- */
const EVENTS = [
  { id: 'home', name: 'Medals', icon: '🏅', type: 'home' },

  // Round-robin 2v2 grids: 1 point per win
  { id: 'tt',        name: 'Table Tennis',   icon: '🏓', type: 'grid', note: 'Everyone plays everyone · up to 21 · 1 pt per win' },
  { id: 'badminton', name: 'Badminton',      icon: '🏸', type: 'grid', note: 'Everyone plays everyone · up to 21 · 1 pt per win' },
  { id: 'petanque',  name: 'Pétanque',       icon: '🎯', type: 'grid', note: 'Everyone plays everyone · up to 7 · 1 pt per win' },
  { id: 'molkky',    name: 'Mölkky',         icon: '🎳', type: 'grid', note: 'Everyone plays everyone · 1 pt per win' },
  { id: 'zoggies',   name: 'Zoggies',        icon: '🥽', type: 'grid', note: 'Everyone plays everyone · up to 7 · 1 pt per win' },

  // Team-combination matches: winPts to every team on the winning side
  { id: 'volleyball', name: 'Volleyball', icon: '🏐', type: 'combo', winPts: 3,
    note: '6v6 · up to 11 · 3 pts per win',
    matches: [ { a: [1, 2], b: [3, 4, 5] }, { a: [1, 5], b: [2, 3, 4] }, { a: [2, 4, 5], b: [1, 3] } ] },
  { id: 'frisbee', name: 'Ultimate Frisbee', icon: '🥏', type: 'combo', winPts: 3,
    note: 'No moving with the frisbee · point for a catch in the end zone · up to 3 goals · 3 pts per win',
    matches: [ { a: [2, 3, 5], b: [1, 4] }, { a: [1, 5], b: [2, 3, 4] }, { a: [3, 4, 5], b: [1, 2] } ] },
  { id: 'football', name: 'Football', icon: '⚽', type: 'combo', winPts: 3,
    note: '6v6 · 3 pts per win · (line-ups editable per match)',
    matches: [ { a: [1, 2, 3], b: [4, 5] } ] },

  // Ranked events: finish 1st..5th -> 5,4,3,2,1
  { id: 'ttworld',   name: 'TT Around the World',       icon: '🌍', type: 'ranked', note: 'Played ×5 · finishing order scores 5-4-3-2-1' },
  { id: 'obstacle',  name: 'Obstacle Relay',            icon: '🏃', type: 'ranked', note: '5 for 1st … 1 for last' },
  { id: 'synchro',   name: 'Synchro Pool Jumping',      icon: '🤽', type: 'ranked', note: '5 for 1st … 1 for last' },
  { id: 'swimrelay', name: 'Swimming Relay',            icon: '🏊', type: 'ranked', note: '5 for 1st … 1 for last' },
];

/* =========================================================================
   State  -  live-shared via Firebase, cached in localStorage for offline
   ========================================================================= */
function loadLocal() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
  catch (e) { return {}; }
}
function saveLocal() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
}
let state = loadLocal();   // instant first paint from cache; Firebase overwrites when it connects

let db = null;
let applyingRemote = false;   // guard so remote snapshots don't echo back as writes

function initSync() {
  try {
    if (typeof firebase === 'undefined') { setSyncStatus('nolib'); return; }
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();

    // Everyone's live scores stream in here.
    db.ref(DB_ROOT).on('value', (snap) => {
      applyingRemote = true;
      state = snap.val() || {};
      saveLocal();
      rerender();
      applyingRemote = false;
    });

    // Connection indicator in the footer.
    db.ref('.info/connected').on('value', (s) => setSyncStatus(s.val() ? 'live' : 'off'));
  } catch (e) {
    db = null;
    setSyncStatus('off');
  }
}

/* Persist one event's scores to Firebase (per-event = no clobbering between events). */
function saveEvent(evId) {
  saveLocal();
  if (applyingRemote || !db) return;
  const val = state[evId];
  db.ref(DB_ROOT + '/' + evId).set(val && Object.keys(val).length ? val : null).catch(() => {});
}

function setSyncStatus(status) {
  const n = document.getElementById('sync');
  if (!n) return;
  if (status === 'live') { n.textContent = '● Live · shared'; n.className = 'sync live'; }
  else if (status === 'nolib') { n.textContent = '○ Offline (this device)'; n.className = 'sync off'; }
  else { n.textContent = '○ Offline · will sync'; n.className = 'sync off'; }
}

/* pair key helpers for grid events */
const pairKey = (x, y) => (x < y ? `${x}-${y}` : `${y}-${x}`);

/* =========================================================================
   Scoring - points per team, per event
   ========================================================================= */
function gridPoints(ev) {
  const res = state[ev.id] || {};
  const pts = {};
  TEAMS.forEach((t) => (pts[t.id] = 0));
  Object.entries(res).forEach(([key, winnerId]) => {
    if (winnerId) pts[winnerId] += 1;   // 1 pt per win
  });
  return pts;
}
function comboPoints(ev) {
  const res = state[ev.id] || {};
  const pts = {};
  TEAMS.forEach((t) => (pts[t.id] = 0));
  ev.matches.forEach((m, i) => {
    const w = res[i];                    // 'a' | 'b' | undefined
    if (w === 'a' || w === 'b') m[w].forEach((tid) => (pts[tid] += ev.winPts));
  });
  return pts;
}
function rankedPoints(ev) {
  const res = state[ev.id] || {};       // { teamId: position(1..5) }
  const pts = {};
  TEAMS.forEach((t) => (pts[t.id] = 0));
  Object.entries(res).forEach(([tid, pos]) => {
    if (pos >= 1 && pos <= 5) pts[tid] = RANK_POINTS[pos - 1];
  });
  return pts;
}
function eventPoints(ev) {
  if (ev.type === 'grid') return gridPoints(ev);
  if (ev.type === 'combo') return comboPoints(ev);
  if (ev.type === 'ranked') return rankedPoints(ev);
  return {};
}
function totals() {
  const tot = {};
  TEAMS.forEach((t) => (tot[t.id] = 0));
  EVENTS.forEach((ev) => {
    if (ev.type === 'home') return;
    const p = eventPoints(ev);
    TEAMS.forEach((t) => (tot[t.id] += p[t.id] || 0));
  });
  return tot;
}

/* Games played so far, per team (only counts games with a recorded result). */
function gamesPlayed() {
  const gp = {};
  TEAMS.forEach((t) => (gp[t.id] = 0));
  EVENTS.forEach((ev) => {
    const res = state[ev.id] || {};
    if (ev.type === 'grid') {
      // each decided pairing = one game for both teams in it
      Object.keys(res).forEach((key) => {
        if (!res[key]) return;
        key.split('-').forEach((id) => (gp[Number(id)] += 1));
      });
    } else if (ev.type === 'combo') {
      ev.matches.forEach((m, i) => {
        if (res[i] !== 'a' && res[i] !== 'b') return;
        m.a.concat(m.b).forEach((tid) => (gp[tid] += 1));
      });
    } else if (ev.type === 'ranked') {
      // a ranked event counts as one game for any team that has a placement
      Object.entries(res).forEach(([tid, pos]) => {
        if (pos >= 1 && pos <= 5) gp[Number(tid)] += 1;
      });
    }
  });
  return gp;
}

/* Total distinct games recorded across the whole Olympics. */
function totalGamesPlayed() {
  let n = 0;
  EVENTS.forEach((ev) => {
    const res = state[ev.id] || {};
    if (ev.type === 'grid') {
      n += Object.keys(res).filter((k) => res[k]).length;
    } else if (ev.type === 'combo') {
      n += ev.matches.filter((m, i) => res[i] === 'a' || res[i] === 'b').length;
    } else if (ev.type === 'ranked') {
      if (Object.values(res).some((pos) => pos >= 1 && pos <= 5)) n += 1;
    }
  });
  return n;
}

/* =========================================================================
   Small render helpers
   ========================================================================= */
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const swatch = (id) => `<span class="sw" style="background:${teamById(id).color}"></span>`;

function miniTally(pts) {
  const wrap = el('div', 'mini-tally');
  TEAMS.forEach((t) => {
    wrap.appendChild(el('span', 'mt',
      `${swatch(t.id)} ${teamLabel(t.id)}: ${pts[t.id] || 0}`));
  });
  return wrap;
}

/* =========================================================================
   HOME  -  medal tally + teams
   ========================================================================= */
function renderHome() {
  const view = document.getElementById('view');
  const tot = totals();
  const gp = gamesPlayed();
  const ranked = TEAMS.slice().sort((a, b) => tot[b.id] - tot[a.id]);
  const max = Math.max(1, ...TEAMS.map((t) => tot[t.id]));

  // Podium (top 3)
  const podCard = el('div', 'card');
  podCard.appendChild(el('h2', null, '🏅 Medal Tally'));
  const totalGames = totalGamesPlayed();
  podCard.appendChild(el('p', 'event-note',
    `Total Olympic points across every event · <b>${totalGames}</b> game${totalGames === 1 ? '' : 's'} played so far.`));

  const podium = el('div', 'podium');
  const order = [ranked[1], ranked[0], ranked[2]];       // silver, gold, bronze layout
  const medals = ['🥈', '🥇', '🥉'];
  const pill = ['s', 'g', 'b'];
  order.forEach((t, i) => {
    if (!t) return;
    const col = el('div', 'pod-col');
    col.innerHTML =
      `<div class="medal">${medals[i]}</div>` +
      `<div class="p-name">${swatch(t.id)} ${teamLabel(t.id)}</div>` +
      `<div class="p-pts">${tot[t.id]}</div>` +
      `<div class="pillar ${pill[i]}"></div>`;
    podium.appendChild(col);
  });
  podCard.appendChild(podium);

  // Full leaderboard
  ranked.forEach((t, i) => {
    const row = el('div', 'lb-row');
    row.style.gridTemplateColumns = '26px 14px 1fr auto';
    row.innerHTML =
      `<div class="lb-rank">${i + 1}</div>` +
      `<div class="lb-swatch" style="background:${t.color}"></div>` +
      `<div class="lb-name"><b>${teamLabel(t.id)}</b><div class="lb-members">${teamMembers(t.id)}</div></div>` +
      `<div class="lb-ptswrap"><div class="lb-pts">${tot[t.id]}</div>` +
        `<div class="lb-games">${gp[t.id]} played</div></div>` +
      `<div class="lb-bar-wrap"><div class="lb-bar" style="width:${(tot[t.id] / max) * 100}%;background:${t.color}"></div></div>`;
    podCard.appendChild(row);
  });
  view.appendChild(podCard);

  // Teams
  const teamCard = el('div', 'card');
  teamCard.appendChild(el('h2', null, '👥 The Teams'));
  teamCard.appendChild(el('p', 'event-note', 'Eleven of us · five teams · four pairs and a trio.'));
  const grid = el('div', 'teams-grid');
  TEAMS.forEach((t) => {
    const c = el('div', 'team-card');
    c.style.setProperty('--tc', t.color);
    c.innerHTML =
      `<h3>${teamLabel(t.id)}</h3>` +
      `<div class="members">${teamMembers(t.id)}</div>` +
      `<div class="ring-name">${t.ring} ring</div>`;
    grid.appendChild(c);
  });
  teamCard.appendChild(grid);
  view.appendChild(teamCard);
}

/* =========================================================================
   GRID event  (round robin, 1 pt per win)
   ========================================================================= */
function renderGrid(ev) {
  const view = document.getElementById('view');
  const card = el('div', 'card');
  card.appendChild(el('h2', null, `${ev.icon} ${ev.name}`));
  card.appendChild(el('p', 'event-note', ev.note));

  if (!state[ev.id]) state[ev.id] = {};
  const res = state[ev.id];
  const pts = gridPoints(ev);

  const wrap = el('div', 'rr-wrap');
  const table = el('table', 'rr');

  // header row
  const thead = el('tr');
  thead.appendChild(el('th', 'corner', ''));
  TEAMS.forEach((t) => thead.appendChild(el('th', null,
    `${swatch(t.id)}<br>${teamLabel(t.id).replace('Team ', 'T')}`)));
  thead.appendChild(el('th', 'ptshead', 'Pts'));
  table.appendChild(thead);

  // body
  TEAMS.forEach((rowT) => {
    const tr = el('tr');
    const rh = el('td', 'rowhead',
      `<span class="swatch" style="background:${rowT.color}"></span>${teamLabel(rowT.id)}`);
    tr.appendChild(rh);

    TEAMS.forEach((colT) => {
      if (rowT.id === colT.id) { tr.appendChild(el('td', 'cell blocked', '')); return; }
      const key = pairKey(rowT.id, colT.id);
      const winner = res[key];
      let cls = 'cell empty', txt = '';
      if (winner === rowT.id) { cls = 'cell win'; txt = '1'; }
      else if (winner === colT.id) { cls = 'cell loss'; txt = '0'; }
      const td = el('td', cls, txt);
      td.addEventListener('click', () => {
        // tap = "this row team won"; tap again clears
        if (res[key] === rowT.id) delete res[key];
        else res[key] = rowT.id;
        saveEvent(ev.id);
        rerender();
      });
      tr.appendChild(td);
    });

    tr.appendChild(el('td', 'cell ptscol', String(pts[rowT.id])));
    table.appendChild(tr);
  });

  wrap.appendChild(table);
  card.appendChild(wrap);
  card.appendChild(el('p', 'hint',
    'Tap a cell to record that <b>row</b> team beat that <b>column</b> team (they get <b>1</b>, opponent <b>0</b>). Tap again to clear.'));

  const reset = el('button', 'btn', 'Clear this event');
  reset.style.marginTop = '10px';
  reset.addEventListener('click', () => { state[ev.id] = {}; saveEvent(ev.id); rerender(); });
  card.appendChild(reset);

  view.appendChild(card);
}

/* =========================================================================
   COMBO event  (team-combination matches)
   ========================================================================= */
function renderCombo(ev) {
  const view = document.getElementById('view');
  const card = el('div', 'card');
  card.appendChild(el('h2', null, `${ev.icon} ${ev.name}`));
  card.appendChild(el('p', 'event-note', ev.note));

  if (!state[ev.id]) state[ev.id] = {};
  const res = state[ev.id];

  const sideChips = (teamIds) => teamIds.map((id) =>
    `<span class="chip"><span class="sw" style="background:${teamById(id).color}"></span>${teamLabel(id)}</span>`).join('');

  ev.matches.forEach((m, i) => {
    const mc = el('div', 'match');
    const head = el('div', 'match-head');
    head.innerHTML = `<span class="mno">Match ${i + 1}</span>`;
    mc.appendChild(head);

    const sides = el('div', 'sides');
    const winner = res[i];

    const sideA = el('div', 'side' + (winner === 'a' ? ' win' : ''));
    sideA.innerHTML = `<div class="side-label">Side A</div>${sideChips(m.a)}<div class="win-badge">✓ Winner · +${ev.winPts}</div>`;
    sideA.addEventListener('click', () => {
      res[i] = (res[i] === 'a') ? null : 'a'; saveEvent(ev.id); rerender();
    });

    const vs = el('div', 'vs', 'vs');

    const sideB = el('div', 'side' + (winner === 'b' ? ' win' : ''));
    sideB.innerHTML = `<div class="side-label">Side B</div>${sideChips(m.b)}<div class="win-badge">✓ Winner · +${ev.winPts}</div>`;
    sideB.addEventListener('click', () => {
      res[i] = (res[i] === 'b') ? null : 'b'; saveEvent(ev.id); rerender();
    });

    sides.appendChild(sideA); sides.appendChild(vs); sides.appendChild(sideB);
    mc.appendChild(sides);
    card.appendChild(mc);
  });

  const pts = comboPoints(ev);
  const tot = el('div', 'event-total');
  tot.innerHTML = '<span class="lbl">Points this event</span>';
  card.appendChild(tot);
  card.appendChild(miniTally(pts));

  card.appendChild(el('p', 'hint', 'Tap the winning side. Every team on it gets ' + ev.winPts + ' points. Tap again to undo.'));
  view.appendChild(card);
}

/* =========================================================================
   RANKED event  (finish 1st..5th -> 5,4,3,2,1)
   ========================================================================= */
function renderRanked(ev) {
  const view = document.getElementById('view');
  const card = el('div', 'card');
  card.appendChild(el('h2', null, `${ev.icon} ${ev.name}`));
  card.appendChild(el('p', 'event-note', ev.note));

  if (!state[ev.id]) state[ev.id] = {};
  const res = state[ev.id];   // teamId -> position

  card.appendChild(el('p', 'section-title', 'Tap each team\'s finishing position'));

  TEAMS.forEach((t) => {
    const row = el('div', 'rank-row');
    const pos = res[t.id];
    const pts = pos ? RANK_POINTS[pos - 1] : 0;
    row.innerHTML =
      `<span class="sw" style="background:${t.color}"></span>` +
      `<div><div class="rn">${teamLabel(t.id)}</div><div class="rmem">${teamMembers(t.id)}</div></div>`;

    const right = el('div');
    right.style.display = 'flex';
    right.style.alignItems = 'center';
    right.style.gap = '10px';

    const btns = el('div', 'pos-btns');
    [1, 2, 3, 4, 5].forEach((p) => {
      const b = el('button', 'pos-btn' + (pos === p ? ' sel' : ''), String(p));
      b.dataset.p = p;
      b.addEventListener('click', () => {
        // clear this position from any other team (positions are unique)
        Object.keys(res).forEach((k) => { if (res[k] === p) delete res[k]; });
        if (res[t.id] === p) delete res[t.id]; else res[t.id] = p;
        saveEvent(ev.id); rerender();
      });
      btns.appendChild(b);
    });
    right.appendChild(btns);
    right.appendChild(el('div', 'rank-pts', pts ? '+' + pts : '–'));
    row.appendChild(right);
    card.appendChild(row);
  });

  card.appendChild(el('p', 'hint', '1st = 5 pts, 2nd = 4, 3rd = 3, 4th = 2, 5th = 1. Tap a selected number to clear it.'));

  const reset = el('button', 'btn', 'Clear this event');
  reset.style.marginTop = '4px';
  reset.addEventListener('click', () => { state[ev.id] = {}; saveEvent(ev.id); rerender(); });
  card.appendChild(reset);

  view.appendChild(card);
}

/* =========================================================================
   Tabs + routing
   ========================================================================= */
let currentTab = 'home';

function renderTabs() {
  const tabs = document.getElementById('tabs');
  tabs.innerHTML = '';
  EVENTS.forEach((ev) => {
    const t = el('div', 'tab' + (ev.id === currentTab ? ' active' : ''),
      `<span class="ic">${ev.icon}</span>${ev.name}`);
    t.addEventListener('click', () => {
      currentTab = ev.id;
      window.scrollTo({ top: 0 });
      rerender();
    });
    tabs.appendChild(t);
  });
}

function rerender() {
  renderTabs();
  const view = document.getElementById('view');
  view.innerHTML = '';
  const ev = EVENTS.find((e) => e.id === currentTab) || EVENTS[0];
  if (ev.type === 'home') renderHome();
  else if (ev.type === 'grid') renderGrid(ev);
  else if (ev.type === 'combo') renderCombo(ev);
  else if (ev.type === 'ranked') renderRanked(ev);
}

/* =========================================================================
   Anthem + splash
   ========================================================================= */
const anthem = document.getElementById('anthem');
let muted = false;

function playAnthem() {
  anthem.volume = 0.7;
  const p = anthem.play();
  if (p && p.catch) p.catch(() => { /* blocked until a real tap */ });
}
function updateMuteBtn() {
  document.getElementById('muteBtn').textContent = muted || anthem.paused ? '🔇' : '🔊';
}

document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('splash').classList.add('hide');
  playAnthem();
  updateMuteBtn();
});

document.getElementById('muteBtn').addEventListener('click', () => {
  if (anthem.paused) { muted = false; playAnthem(); }
  else { anthem.pause(); muted = true; }
  updateMuteBtn();
});

document.getElementById('resetAllBtn').addEventListener('click', () => {
  const entered = prompt('This wipes the shared scoreboard for EVERYONE and cannot be undone.\n\nEnter the 4-digit reset code to continue:');
  if (entered === null) return;                 // cancelled
  if (entered.trim() !== RESET_CODE) { alert('Incorrect code - scoreboard not changed.'); return; }
  state = {}; saveLocal();
  if (db) db.ref(DB_ROOT).remove().catch(() => {});
  currentTab = 'home'; rerender();
});

/* =========================================================================
   Boot
   ========================================================================= */
document.getElementById('version').textContent = APP_VERSION;
rerender();
updateMuteBtn();
initSync();
