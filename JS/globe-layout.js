/* ======================================================================
 * globe-layout.js
 * Places every Pokémon on the sphere and builds the generation territories.
 * ====================================================================== */

// ===== GLOBE DISTRIBUTION =====
// The sphere points (Fibonacci lattice) are IDENTICAL to before, so spacing and sprite size are untouched.
// Only the assignment "which Pokémon sits on which point" and the generation layers changed.

function buildGlobeDistribution() {
  const N = pokemonList.length;
  const count = Math.max(1, N);
  globeTerritory = null;
  // More Pokémon than the original 1025 -> the globe grows by the same factor, so the gap between
  // pictures and the picture size stay exactly what they were.
  globeScale = Math.max(1, Math.sqrt(N / DEX_SIZE));
  const positions = new Map();
  if (!N) return positions;

  // 1. Same lattice as before
  const raw = [];
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(1 - 2 * (i + 0.5) / count);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const lat = Math.PI / 2 - phi;
    const lon = theta % (Math.PI * 2);
    raw.push({ lat, lon, x: Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.sin(lon) });
  }
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  // nearest neighbours (used for Voronoi cells and for growing evolution families)
  const K = Math.min(count - 1, 14);
  const knn = raw.map((p, i) => {
    const arr = [];
    for (let j = 0; j < count; j++) if (j !== i) arr.push([j, dot(p, raw[j])]);
    arr.sort((a, b) => b[1] - a[1]);
    return arr.slice(0, K).map(e => e[0]);
  });
  const nbrs = knn.map(a => a.slice(0, 7));

  // 2. Generation members
  const members = new Map();
  for (const p of pokemonList) {
    const g = regionOf(p.id);
    if (!members.has(g)) members.set(g, []);
    members.get(g).push(p);
  }
  const gens = [...members.keys()].sort((a, b) => a - b);
  const M = gens.length;
  const target = gens.map(g => members.get(g).length);

  // 3. One compact continent per generation (weighted Voronoi / power diagram with exact capacities)
  const assign = new Int16Array(count);
  if (M > 1) {
    const cen = gens.map(g => {
      const s = GENERATION_SEEDS[g] || { lat: 0, lon: 0 };
      return { x: Math.cos(s.lat) * Math.cos(s.lon), y: Math.sin(s.lat), z: Math.cos(s.lat) * Math.sin(s.lon) };
    });
    const w = new Float64Array(M);
    const score = (i, m) => dot(raw[i], cen[m]) + w[m];
    for (let it = 0; it < 600; it++) {
      const counts = new Array(M).fill(0);
      for (let i = 0; i < count; i++) {
        let best = 0, bs = -Infinity;
        for (let m = 0; m < M; m++) { const s = score(i, m); if (s > bs) { bs = s; best = m; } }
        assign[i] = best; counts[best]++;
      }
      if (counts.every((c, m) => c === target[m])) break;
      const lr = 0.6 * (1 - it / 600) + 0.05;
      for (let m = 0; m < M; m++) w[m] += lr * (target[m] - counts[m]) / count;
    }
    // exact balancing: move the cheapest border points from oversized to undersized continents
    const counts = new Array(M).fill(0);
    for (let i = 0; i < count; i++) counts[assign[i]]++;
    for (let guard = 0; guard < 6000; guard++) {
      const over = counts.findIndex((c, m) => c > target[m]);
      if (over < 0) break;
      let bi = -1, bh = -1, bm = Infinity;
      for (let i = 0; i < count; i++) {
        if (assign[i] !== over) continue;
        const so = score(i, over);
        for (let h = 0; h < M; h++) {
          if (counts[h] >= target[h]) continue;
          const mg = so - score(i, h);
          if (mg < bm) { bm = mg; bi = i; bh = h; }
        }
      }
      if (bi < 0) break;
      assign[bi] = bh; counts[over]--; counts[bh]++;
    }
  }
  const cellGen = Array.from(assign, m => gens[m]);
  const regionPts = gens.map(() => []);
  for (let i = 0; i < count; i++) regionPts[assign[i]].push(i);
  const centroid = new Map();
  gens.forEach((g, m) => {
    let x = 0, y = 0, z = 0;
    for (const i of regionPts[m]) { x += raw[i].x; y += raw[i].y; z += raw[i].z; }
    const l = Math.hypot(x, y, z) || 1;
    centroid.set(g, { x: x / l, y: y / l, z: z / l });
  });

  // 4. Evolution families side by side inside each continent
  const chainOf = p => String(pokemonEvolutionChains.get(p.id) || `solo-${p.id}`);
  const chainGens = new Map();
  for (const p of pokemonList) {
    const c = chainOf(p), g = regionOf(p.id);
    if (!chainGens.has(c)) chainGens.set(c, new Set());
    chainGens.get(c).add(g);
  }
  const chord = (i, j) => Math.hypot(raw[i].x - raw[j].x, raw[i].y - raw[j].y, raw[i].z - raw[j].z);

  gens.forEach((g, m) => {
    const free = new Set(regionPts[m]);
    const cen = centroid.get(g);
    const freeDeg = j => { let d = 0; for (const n of nbrs[j]) if (free.has(n)) d++; return d; };

    const groupMap = new Map();
    for (const p of members.get(g)) {
      const c = chainOf(p);
      if (!groupMap.has(c)) groupMap.set(c, []);
      groupMap.get(c).push(p);
    }
    const groups = [...groupMap.entries()].map(([chain, list]) => {
      list.sort((a, b) => (a.speciesId || a.id) - (b.speciesId || b.id) || a.id - b.id);
      let vx = 0, vy = 0, vz = 0, cross = false;
      for (const og of chainGens.get(chain)) {
        if (og === g) continue;
        const c = centroid.get(og); if (!c) continue;
        vx += c.x; vy += c.y; vz += c.z; cross = true;
      }
      const l = Math.hypot(vx, vy, vz);
      return { chain, list, pull: cross && l > 1e-6 ? { x: vx / l, y: vy / l, z: vz / l } : null, minId: list[0].id };
    });

    const place = (group, start) => {
      const chosen = [start]; free.delete(start);
      while (chosen.length < group.list.length) {
        let best = -1, bs = Infinity;
        for (const c of chosen) for (const j of nbrs[c]) {
          if (!free.has(j)) continue;
          const s = chord(start, j) + 0.04 * freeDeg(j);
          if (s < bs) { bs = s; best = j; }
        }
        if (best < 0) {
          for (const j of free) { const s = chord(start, j); if (s < bs) { bs = s; best = j; } }
        }
        if (best < 0) break;
        chosen.push(best); free.delete(best);
      }
      group.list.forEach((p, k) => {
        const pt = raw[chosen[Math.min(k, chosen.length - 1)]];
        positions.set(p.id, { lat: pt.lat, lon: pt.lon });
      });
      return chosen[chosen.length - 1];
    };

    // families that also live in another generation go to the border facing that generation
    const crossGroups = groups.filter(x => x.pull).sort((a, b) => b.list.length - a.list.length || a.minId - b.minId);
    for (const grp of crossGroups) {
      let start = -1, bd = -Infinity;
      for (const j of free) {
        const d = dot(raw[j], grp.pull) - 0.03 * freeDeg(j);
        if (d > bd) { bd = d; start = j; }
      }
      if (start >= 0) place(grp, start);
    }
    // everything else sweeps through the continent in Pokédex order
    const rest = groups.filter(x => !x.pull).sort((a, b) => a.minId - b.minId);
    let prev = -1;
    for (const grp of rest) {
      let start = -1, bs = Infinity;
      for (const j of free) {
        let s;
        if (prev < 0) s = dot(raw[j], cen) + 0.02 * freeDeg(j);
        else s = chord(prev, j) + 0.06 * freeDeg(j);
        if (s < bs) { bs = s; start = j; }
      }
      if (start < 0) break;
      prev = place(grp, start);
    }
  });

  // 5. Territory cells (spherical Voronoi) -> generation layers that partition the sphere
  if (count >= 12) {
    const spacing = Math.sqrt(4 * Math.PI / count);
    const s = Math.min(2.5, 2.2 * spacing);
    const cells = [];
    for (let i = 0; i < count; i++) {
      const p = [raw[i].x, raw[i].y, raw[i].z];
      const ref = Math.abs(p[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      let u = [p[1] * ref[2] - p[2] * ref[1], p[2] * ref[0] - p[0] * ref[2], p[0] * ref[1] - p[1] * ref[0]];
      const ul = Math.hypot(...u); u = u.map(c => c / ul);
      const v = [p[1] * u[2] - p[2] * u[1], p[2] * u[0] - p[0] * u[2], p[0] * u[1] - p[1] * u[0]];
      const corner = (a, b) => { const q = [p[0] + s * (a * u[0] + b * v[0]), p[1] + s * (a * u[1] + b * v[1]), p[2] + s * (a * u[2] + b * v[2])]; const l = Math.hypot(...q); return q.map(c => c / l); };
      let V = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
      let L = [-1, -1, -1, -1];
      for (const j of knn[i]) {
        const nrm = [raw[i].x - raw[j].x, raw[i].y - raw[j].y, raw[i].z - raw[j].z];
        const oV = [], oL = []; const n = V.length;
        for (let k = 0; k < n; k++) {
          const A = V[(k + n - 1) % n], B = V[k], lab = L[k];
          const da = dot3(A, nrm), db = dot3(B, nrm);
          const cut = () => { const t = da / (da - db); const q = [A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1]), A[2] + t * (B[2] - A[2])]; const l = Math.hypot(...q) || 1; return [q[0] / l, q[1] / l, q[2] / l]; };
          if (db >= 0) {
            if (da < 0) { oV.push(cut()); oL.push(j); }
            oV.push(B); oL.push(lab);
          } else if (da >= 0) {
            oV.push(cut()); oL.push(lab);
          }
        }
        V = oV; L = oL;
        if (V.length < 3) break;
      }
      if (V.length < 3) continue;
      // densify long edges so big cells (small filtered sets) still follow the sphere
      const dV = [], dL = []; const n = V.length;
      for (let k = 0; k < n; k++) {
        const A = V[(k + n - 1) % n], B = V[k];
        const ang = Math.acos(Math.max(-1, Math.min(1, dot3(A, B))));
        const segs = Math.max(1, Math.ceil(ang / 0.12));
        for (let t = 1; t < segs; t++) {
          const f = t / segs; const q = [A[0] + f * (B[0] - A[0]), A[1] + f * (B[1] - A[1]), A[2] + f * (B[2] - A[2])];
          const l = Math.hypot(...q) || 1; dV.push([q[0] / l, q[1] / l, q[2] / l]); dL.push(L[k]);
        }
        dV.push(B); dL.push(L[k]);
      }
      cells.push({ gen: cellGen[i], V: dV, bnd: dL.map(lab => lab >= 0 && cellGen[lab] !== cellGen[i]) });
    }
    globeTerritory = cells;
  }

  return positions;
}
