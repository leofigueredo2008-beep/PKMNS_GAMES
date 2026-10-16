/* ======================================================================
 * api.js
 * Everything that talks to PokéAPI / sprite servers (plus localStorage caches).
 * ====================================================================== */

function spriteURL(id) { return spriteOverride.get(id) || (OFFICIAL + id + ".png") }
// Animated GIF sources for the technical sheet: the API's Showdown set first, then the same file by id
// (newer forms), then Black & White animated sprites, and finally the official artwork as a still image.
function spriteSources(data) {
  const sp = data.sprites || {};
  const showdown = sp.other?.showdown || {};
  const bw = sp.versions?.["generation-v"]?.["black-white"]?.animated || {};
  const art = sp.other?.["official-artwork"] || {};
  const home = sp.other?.home || {};
  const uniq = a => [...new Set(a.filter(Boolean))];
  return {
    gif: uniq([showdown.front_default, `${SPRITES}other/showdown/${data.id}.gif`, bw.front_default]),
    gifShiny: uniq([showdown.front_shiny, `${SPRITES}other/showdown/shiny/${data.id}.gif`, bw.front_shiny]),
    still: art.front_default || home.front_default || spriteURL(data.id),
    stillShiny: art.front_shiny || home.front_shiny || ""
  };
}

async function getList() {
  const key = "pokemon-quiz-list-1025";
  const cached = storage.get(key);
  if (cached) {
    try { const list = JSON.parse(cached); if (list.length >= DEX_SIZE) return list } catch (e) { }
  }
  const r = await fetch(`${API}/pokemon?limit=${DEX_SIZE}&offset=0`);
  if (!r.ok) throw new Error("PokéAPI list request failed");
  const data = await r.json();
  const list = data.results.map(x => ({
    id: Number(x.url.split("/").filter(Boolean).pop()),
    name: x.name, displayName: prettyName(x.name)
  })).sort((a, b) => a.id - b.id);
  storage.set(key, JSON.stringify(list));
  return list;
}

async function getFilterMetadata() {
  const cacheKey = "pokemon-quiz-filter-metadata-forms-v2";
  const cached = storage.get(cacheKey);
  if (cached) {
    try {
      const data = JSON.parse(cached);
      if (data.types && data.generations) {
        pokemonTypes = new Map(Object.entries(data.types).map(([id, types]) => [Number(id), types]));
        pokemonGenerations = new Map(Object.entries(data.generations).map(([id, gen]) => [Number(id), gen]));
        return;
      }
    } catch (e) { }
  }

  const [typeResults, generationResults] = await Promise.all([
    Promise.all(["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"].map(async type => {
      const r = await fetch(`${API}/type/${type}`); if (!r.ok) throw new Error("PokéAPI type request failed"); return r.json();
    })),
    Promise.all(Array.from({ length: 9 }, (_, i) => fetch(`${API}/generation/${i + 1}`).then(r => { if (!r.ok) throw new Error("PokéAPI generation request failed"); return r.json(); })))
  ]);

  pokemonTypes = new Map();
  typeResults.forEach(data => data.pokemon.forEach(entry => {
    const id = Number(entry.pokemon.url.split("/").filter(Boolean).pop());
    if (!pokemonTypes.has(id)) pokemonTypes.set(id, []); pokemonTypes.get(id).push(data.name);
  }));

  pokemonGenerations = new Map();
  generationResults.forEach((data, index) => data.pokemon_species.forEach(entry => {
    const id = Number(entry.url.split("/").filter(Boolean).pop());
    if (id <= DEX_SIZE) pokemonGenerations.set(id, index + 1);
  }));

  const typeObj = {}; pokemonTypes.forEach((v, k) => typeObj[k] = v);
  const genObj = {}; pokemonGenerations.forEach((v, k) => genObj[k] = v);
  storage.set(cacheKey, JSON.stringify({ types: typeObj, generations: genObj }));
}

async function loadEvolutionChains() {
  const cacheKey = "pokemon-quiz-species-meta-1025-v2";
  const ids = allPokemonList.map(p => p.id);
  const cached = storage.get(cacheKey);
  if (cached) {
    try {
      const obj = JSON.parse(cached);
      if (ids.every(id => Object.prototype.hasOwnProperty.call(obj, id))) {
        pokemonEvolutionChains = new Map(ids.map(id => [id, String(obj[id].c)]));
        speciesMeta = new Map(ids.map(id => [id, { s: obj[id].s, v: obj[id].v }]));
        return;
      }
    } catch (e) { }
  }

  const result = {};
  let cursor = 0, failures = 0;
  const workers = Array.from({ length: 24 }, async () => {
    while (cursor < allPokemonList.length) {
      const index = cursor++;
      const p = allPokemonList[index];
      try {
        const r = await fetch(`${API}/pokemon-species/${p.id}`);
        if (!r.ok) throw new Error("PokéAPI species request failed");
        const data = await r.json();
        const chainUrl = data.evolution_chain?.url || "";
        const chainId = chainUrl.split("/").filter(Boolean).pop() || `solo-${p.id}`;
        const varieties = (data.varieties || []).filter(v => !v.is_default).map(v => [v.pokemon.name, Number(v.pokemon.url.split("/").filter(Boolean).pop())]);
        result[p.id] = { c: String(chainId), s: data.name, v: varieties };
      } catch (e) {
        failures++;
        result[p.id] = { c: `solo-${p.id}`, s: p.name, v: [] };
      }
    }
  });
  await Promise.all(workers);
  pokemonEvolutionChains = new Map(ids.map(id => [id, String(result[id].c)]));
  speciesMeta = new Map(ids.map(id => [id, { s: result[id].s, v: result[id].v }]));
  if (!failures) { try { storage.set(cacheKey, JSON.stringify(result)); } catch (e) { } }
}

async function preloadSprites() {
  const total = pokemonList.length;
  let loaded = 0;
  const failed = new Set();
  const tick = () => { loaded++; updatePreloadProgress(loaded, total); };
  const jobs = pokemonList.map(p => new Promise(resolve => {
    const img = new Image();
    img.onload = () => { tick(); resolve() };
    img.onerror = () => {
      const fallback = new Image();
      fallback.onload = () => { spriteOverride.set(p.id, SPRITES + p.id + ".png"); tick(); resolve() };
      fallback.onerror = () => { failed.add(p.id); tick(); resolve() };
      fallback.src = SPRITES + p.id + ".png";
    };
    img.src = OFFICIAL + p.id + ".png";
  }));
  await Promise.all(jobs);
  return failed;
}
function updatePreloadProgress(done, total) {
  setLoading("Preparing your Pokédex...", `Preloading sprites: ${done} / ${total}`, 5 + (done / total) * 95);
}

async function getSpeciesColor(speciesId) {
  if (speciesColorCache.has(speciesId)) return speciesColorCache.get(speciesId);
  try {
    const r = await fetch(`${API}/pokemon-species/${speciesId}`);
    if (!r.ok) throw new Error("species request failed");
    const color = (await r.json()).color?.name || null;
    speciesColorCache.set(speciesId, color);
    return color;
  } catch (e) { return null; }
}

// {from: "Charmeleon"|null, to: ["Charizard"]} for a species, or null if it couldn't be loaded
async function getEvolutionInfo(speciesId) {
  const chainId = String(pokemonEvolutionChains.get(speciesId) || "");
  if (!chainId || chainId.startsWith("solo-")) return { from: null, to: [] };
  const familySize = allPokemonList.filter(p => !p.isForm && String(pokemonEvolutionChains.get(p.id)) === chainId).length;
  if (familySize <= 1) return { from: null, to: [] };
  let chain = evolutionChainCache.get(chainId);
  if (!chain) {
    try {
      const r = await fetch(`${API}/evolution-chain/${chainId}`);
      if (!r.ok) throw new Error("evolution chain request failed");
      chain = (await r.json()).chain;
      evolutionChainCache.set(chainId, chain);
    } catch (e) { return null; }
  }
  const speciesName = speciesMeta.get(speciesId)?.s;
  const find = (node, parent) => {
    if (node.species.name === speciesName) return { node, parent };
    for (const child of node.evolves_to || []) { const f = find(child, node); if (f) return f; }
    return null;
  };
  const hit = find(chain, null);
  if (!hit) return { from: null, to: [] };
  const nice = n => titleCase(n.split("-"));
  return { from: hit.parent ? nice(hit.parent.species.name) : null, to: (hit.node.evolves_to || []).map(c => nice(c.species.name)) };
}
