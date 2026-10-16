/* Near or Away: Pokédex data (shared with Global Quiz) + similarity scoring. */
const FEATURES_KEY = "pokemon-quiz-species-features-v1";
const NEAR_RANK = 40, FAR_RANK = 250;      // zone limits: rank <= NEAR_RANK is "near", > FAR_RANK is "away"
let dex = [];
const dexByName = new Map();

async function loadFeatures(onProgress) {
  const cached = storage.get(FEATURES_KEY);
  if (cached) { try { const o = JSON.parse(cached); if (Object.keys(o).length >= DEX_SIZE) return o; } catch (e) { } }
  const out = {}; let next = 1, done = 0, failed = 0;
  const worker = async () => {
    while (next <= DEX_SIZE) {
      const id = next++;
      try {
        const r = await fetch(`${API}/pokemon-species/${id}`); if (!r.ok) throw new Error("species");
        const d = await r.json();
        const genus = (d.genera.find(g => g.language.name === "en")?.genus || "").replace(/ Pok[eé]mon$/i, "").toLowerCase();
        out[id] = {
          s: d.name, gn: genus, col: d.color?.name || "", sh: d.shape?.name || "", hb: d.habitat?.name || "",
          eg: (d.egg_groups || []).map(e => e.name), k: d.is_mythical ? 2 : d.is_legendary ? 1 : d.is_baby ? 3 : 0,
          c: (d.evolution_chain?.url || "").split("/").filter(Boolean).pop() || `solo-${id}`
        };
      } catch (e) { failed++; out[id] = { s: "", gn: "", col: "", sh: "", hb: "", eg: [], k: 0, c: `solo-${id}` }; }
      onProgress(++done / DEX_SIZE);
    }
  };
  await Promise.all(Array.from({ length: 24 }, worker));
  if (!failed) storage.set(FEATURES_KEY, JSON.stringify(out));
  return out;
}

async function buildDex(onProgress) {
  const list = await getList();               // api.js (same cache as Global Quiz)
  await getFilterMetadata();                  // api.js: fills pokemonTypes / pokemonGenerations
  const feats = await loadFeatures(onProgress);
  dex = list.filter(p => feats[p.id] && p.id <= DEX_SIZE).map(p => ({
    ...p, f: feats[p.id], types: pokemonTypes.get(p.id) || [], initial: p.displayName[0].toLowerCase(),
    // same regions as the globe: generations 1-9, Hisui (10) split from Gen VIII
    region: (p.id >= HISUI_SPECIES_FIRST && p.id <= HISUI_SPECIES_LAST) ? 10 : (pokemonGenerations.get(p.id) || 9)
  }));
  dexByName.clear();
  for (const p of dex) for (const n of [p.name, p.displayName, p.f.s]) if (n) dexByName.set(normalizeName(n), p);
}

// Higher = more similar. `why` lists the traits shared with the target.
function similarity(a, t) {
  const why = []; let s = 0;
  if (a.f.c === t.f.c) { s += 45; why.push("same evolution line"); }
  const shared = a.types.filter(x => t.types.includes(x));
  if (shared.length) { s += 14 * shared.length; why.push("type " + shared.map(typeName).join("/")); }
  if (shared.length && shared.length === t.types.length && shared.length === a.types.length) s += 4;
  if (a.region === t.region) { s += 8; why.push("same region"); }
  if (a.f.k && a.f.k === t.f.k) { s += 12; why.push(["", "legendary", "mythical", "baby"][a.f.k]); }
  if (a.f.col && a.f.col === t.f.col) { s += 8; why.push(a.f.col + " color"); }
  if (a.f.sh && a.f.sh === t.f.sh) { s += 6; why.push("similar body shape"); }
  if (a.f.gn && a.f.gn === t.f.gn) { s += 10; why.push(`"${a.f.gn}" Pokémon`); }
  const eg = a.f.eg.filter(x => t.f.eg.includes(x));
  if (eg.length) { s += 5 * eg.length; why.push("egg group " + eg.join("/")); }
  if (a.f.hb && a.f.hb === t.f.hb) { s += 4; why.push("habitat " + a.f.hb); }
  if (a.initial === t.initial) { s += 3; why.push("same initial"); }
  return { score: s + 1 / (1 + Math.abs(a.id - t.id)), why };   // dex distance only breaks ties
}

function rankAgainst(target) {
  const rows = dex.map(p => ({ p, ...similarity(p, target) })).sort((x, y) => y.score - x.score);
  const ranks = new Map();
  rows.forEach((r, i) => ranks.set(r.p.id, i + 1));
  return ranks;
}

function zoneOf(rank) { return rank === 1 ? "correct" : rank <= NEAR_RANK ? "near" : rank > FAR_RANK ? "away" : "mid"; }
