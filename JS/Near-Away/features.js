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
  // Use the exact same source and form-building pipeline as Global Quiz.
  // The 1,025 species are expanded with PokéAPI varieties into the full pool
  // (currently 1,208 entries, depending on the live PokéAPI form data).
  let baseList = await getList();
  await getFilterMetadata();
  allPokemonList = baseList;

  if (typeof loadEvolutionChains !== "function" ||
      typeof decorateBaseList !== "function" ||
      typeof buildFormList !== "function") {
    throw new Error("Shared alternate-form logic was not loaded.");
  }

  await loadEvolutionChains();
  baseList = decorateBaseList(baseList);
  allPokemonList = baseList.concat(buildFormList(baseList));

  const feats = await loadFeatures(onProgress);
  dex = allPokemonList.map(p => {
    const speciesId = Number(p.isForm
      ? (formMeta.get(p.id)?.speciesId || p.speciesId)
      : p.id);
    const feature = feats[speciesId] || feats[p.id] || {
      s: p.name, gn: "", col: "", sh: "", hb: "", eg: [], k: 0,
      c: `solo-${speciesId || p.id}`
    };
    return {
      ...p,
      f: feature,
      types: pokemonTypes.get(p.id) || pokemonTypes.get(speciesId) || [],
      initial: (p.displayName || p.name || "?").charAt(0).toLowerCase(),
      region: regionOf(p.id)
    };
  });

  dexByName.clear();
  const addName = (name, pokemon) => {
    if (!name) return;
    const key = normalizeName(name);
    if (key && !dexByName.has(key)) dexByName.set(key, pokemon);
  };

  // Register regular Pokémon names first so alternate forms can never replace
  // the base Pokémon when a user types only its ordinary name.
  for (const p of dex) {
    if (p.isForm) continue;
    addName(p.name, p);
    addName(p.displayName, p);
    addName(p.f?.s, p);
    for (const alias of p.aliases || []) addName(alias, p);
  }

  // Alternate forms require their identifying word:
  // Mega -> "mega"; Gigantamax -> "gigantamax"; regional -> Alolan/Galarian/
  // Hisuian/Paldean. Never index raw API names like "raichu-alola" or "charizard-gmax".
  for (const p of dex) {
    if (!p.isForm) continue;
    const kind = formMeta.get(p.id)?.kind || p.kind;
    const candidates = [p.displayName, ...(p.aliases || [])];
    if (kind === "mega") {
      for (const name of candidates) if (/mega/i.test(name)) addName(name, p);
    } else if (kind === "gmax") {
      for (const name of candidates) {
        if (/gigantamax/i.test(name)) addName(name, p);
        else if (/eternamax/i.test(name)) addName(name, p);
      }
    } else if (kind === "regional") {
      const required = { alola: "alolan", galar: "galarian", hisui: "hisuian", paldea: "paldean" };
      const regionToken = required[formMeta.get(p.id)?.region || p.region] ||
        (candidates.join(" ").match(/\b(alolan|galarian|hisuian|paldean)\b/i) || [])[1];
      for (const name of candidates) {
        if (regionToken && normalizeName(name).includes(normalizeName(regionToken))) addName(name, p);
      }
    } else {
      // Other form types remain guessable by their full displayed form name.
      for (const name of candidates) addName(name, p);
    }
  }
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
