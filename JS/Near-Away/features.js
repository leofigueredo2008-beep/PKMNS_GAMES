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

function isNearAwayAllowedForm(p) {
  if (!p?.isForm) return true;

  const meta = formMeta.get(p.id) || p;
  const kind = meta.kind || p.kind;
  const formName = `${p.name || ""} ${p.displayName || ""} ${(p.aliases || []).join(" ")}`;

  // Keep Mega, Primal, Gigantamax, Eternamax, and regional forms.
  if (kind === "mega" && /\b(mega|primal)\b/i.test(formName)) return true;
  if (kind === "gmax" && /\b(gigantamax|eternamax)\b/i.test(formName)) return true;
  if (kind === "regional") return true;

  // Keep visually distinct male/female forms when exposed as named varieties.
  if (/\b(male|female)\b/i.test(formName)) return true;

  // Any other form qualifies only if its type combination differs from base.
  const speciesId = Number(meta.speciesId || p.speciesId);
  const baseTypes = pokemonTypes.get(speciesId) || [];
  const formTypes = pokemonTypes.get(p.id) || baseTypes;
  const normalizeTypes = types => [...types].sort().join("|");
  return normalizeTypes(formTypes) !== normalizeTypes(baseTypes);
}

async function buildDex(onProgress) {
  // Preserve every ordinary Pokémon, but limit alternate forms to the requested categories.
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
  const allForms = buildFormList(baseList);
  allPokemonList = baseList.concat(allForms.filter(isNearAwayAllowedForm));

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

  // Ordinary names always resolve to the regular/base Pokémon.
  for (const p of dex) {
    if (p.isForm) continue;
    addName(p.name, p);
    addName(p.displayName, p);
    addName(p.f?.s, p);
    for (const alias of p.aliases || []) addName(alias, p);
  }

  // Mega/Gigantamax/regional forms require their identifying word.
  for (const p of dex) {
    if (!p.isForm) continue;
    const kind = formMeta.get(p.id)?.kind || p.kind;
    const candidates = [p.displayName, ...(p.aliases || [])];
    if (kind === "mega") {
      for (const name of candidates) if (/\b(mega|primal)\b/i.test(name)) addName(name, p);
    } else if (kind === "gmax") {
      for (const name of candidates) {
        if (/gigantamax/i.test(name)) addName(name, p);
        else if (/eternamax/i.test(name)) addName(name, p);
      }
    } else if (kind === "regional") {
      const speciesId = Number(formMeta.get(p.id)?.speciesId || p.speciesId);
      const regionToken = (candidates.join(" ").match(/\b(alolan|galarian|hisuian|paldean)\b/i) || [])[1];
      if (speciesId === 128) {
        // The Paldean Combat Breed is entered as "paldean tauros";
        // the other Paldean breeds must explicitly include "aqua" or "blaze".
        const combined = normalizeName(candidates.join(" "));
        if (combined.includes("paldean")) {
          if (combined.includes("aqua")) {
            for (const name of candidates) {
              if (normalizeName(name).includes("paldean") && normalizeName(name).includes("aqua")) addName(name, p);
            }
            addName("paldean tauros aqua", p);
          } else if (combined.includes("blaze")) {
            for (const name of candidates) {
              if (normalizeName(name).includes("paldean") && normalizeName(name).includes("blaze")) addName(name, p);
            }
            addName("paldean tauros blaze", p);
          } else if (combined.includes("combat")) {
            for (const name of candidates) {
              if (normalizeName(name).includes("paldean") && normalizeName(name).includes("combat")) addName(name, p);
            }
            addName("paldean tauros", p);
          }
        }
      } else {
        for (const name of candidates) {
          if (regionToken && normalizeName(name).includes(normalizeName(regionToken))) addName(name, p);
        }
      }
    } else if (kind === "mega" && candidates.some(name => /\bprimal\b/i.test(name))) {
      for (const name of candidates) if (/\bprimal\b/i.test(name)) addName(name, p);
    } else if (kind === "gmax" && candidates.some(name => /\beternamax\b/i.test(name))) {
      for (const name of candidates) if (/\beternamax\b/i.test(name)) addName(name, p);
    } else {
      for (const name of candidates) addName(name, p);
    }
  }
}

// Categorize the requested alternate forms for similarity hints.
function nearAwayFormHint(p) {
  if (!p?.isForm) return "";
  const meta = formMeta.get(p.id) || p;
  const kind = meta.kind || p.kind;
  const name = `${p.name || ""} ${p.displayName || ""} ${(p.aliases || []).join(" ")}`;
  if (kind === "gmax" && /\bgigantamax\b/i.test(name)) return "Gigantamax";
  if (kind === "mega" && /\bmega\b/i.test(name)) return "Mega Evolution";
  if (kind === "regional") return "Regional Form";
  return "";
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
  // Form-category hints appear only when the secret Pokémon and the guess
  // are both alternate forms in the same requested category.
  const guessedFormHint = nearAwayFormHint(a);
  const targetFormHint = nearAwayFormHint(t);
  if (guessedFormHint && guessedFormHint === targetFormHint) {
    s += 9;
    why.push(guessedFormHint);
  }

  // Alternate forms never receive the "same initial" hint.
  if (!a.isForm && !t.isForm && a.initial === t.initial) {
    s += 3;
    why.push("same initial");
  }
  return { score: s + 1 / (1 + Math.abs(a.id - t.id)), why };   // dex distance only breaks ties
}

function rankAgainst(target) {
  const rows = dex.map(p => ({ p, ...similarity(p, target) })).sort((x, y) => y.score - x.score);
  const ranks = new Map();
  rows.forEach((r, i) => ranks.set(r.p.id, i + 1));
  return ranks;
}

function zoneOf(rank) { return rank === 1 ? "correct" : rank <= NEAR_RANK ? "near" : rank > FAR_RANK ? "away" : "mid"; }
