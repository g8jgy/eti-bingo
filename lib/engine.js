// Pure game rules: cards, patterns, standings. No I/O.

export const CENTER = 12;

export const LINES = (() => {
  const L = [];
  for (let r = 0; r < 5; r++) L.push([0, 1, 2, 3, 4].map((c) => r * 5 + c));
  for (let c = 0; c < 5; c++) L.push([0, 1, 2, 3, 4].map((r) => r * 5 + c));
  L.push([0, 6, 12, 18, 24]);
  L.push([4, 8, 12, 16, 20]);
  return L;
})();

// Round goals. Simulated with 70 players and a 36-square pool: first line ~draw 9,
// two lines ~draw 16, first full card ~draw 32.
export const GOALS = {
  1: { key: 'line', label: 'Any line', short: 'Line' },
  2: { key: 'twoLines', label: 'Two lines', short: 'Two lines' },
  3: { key: 'blackout', label: 'Full card', short: 'Full card' },
};

function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashStr(String(seed));
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 25 cells: 24 of the pool's square indexes in a seeded order, -1 for the free center.
export function makeCells(seed, poolSize) {
  const order = shuffle([...Array(poolSize).keys()], rng(seed)).slice(0, 24);
  order.splice(CENTER, 0, -1);
  return order;
}

export function cardKey(cells) {
  return cells.join(',');
}

const unmarkedIn = (line, set) => line.reduce((n, i) => n + (set.has(i) ? 0 : 1), 0);

// Squares still needed to satisfy the goal.
export function toGo(goalKey, marks) {
  const set = marks instanceof Set ? marks : new Set(marks);
  set.add(CENTER);
  if (goalKey === 'blackout') return 25 - set.size;
  if (goalKey === 'line') return Math.min(...LINES.map((l) => unmarkedIn(l, set)));
  // two lines: best pair of lines, counting shared cells once
  let best = 99;
  for (let i = 0; i < LINES.length; i++) {
    for (let j = i + 1; j < LINES.length; j++) {
      const u = new Set([...LINES[i], ...LINES[j]]);
      let n = 0;
      for (const c of u) if (!set.has(c)) n++;
      if (n < best) best = n;
    }
  }
  return best;
}

export function completedLines(marks) {
  const set = new Set(marks); set.add(CENTER);
  return LINES.filter((l) => l.every((i) => set.has(i)));
}

// Sort summaries for the leaderboard. Each summary: { id, n, t, m:[cells], c, ms, w }
export function standings(sums, goalKey) {
  const rows = sums.map((s) => {
    const marks = new Set(s.m || []); marks.add(CENTER);
    return { id: s.id, name: s.n, table: s.t, marks: marks.size - 1, toGo: toGo(goalKey, marks), won: s.w || 0 };
  });
  // Past winners can't win again, so they sit below everyone still in the hunt.
  rows.sort((a, b) => (a.won ? 1 : 0) - (b.won ? 1 : 0) || a.toGo - b.toGo || b.marks - a.marks || a.name.localeCompare(b.name));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}
