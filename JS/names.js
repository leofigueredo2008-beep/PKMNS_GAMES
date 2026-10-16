/* ======================================================================
 * names.js
 * Name index, answer resolution and typo detection.
 * ====================================================================== */

function buildNameIndex(list) {
  const m = new Map();
  for (const p of list) m.set(normalizeName(p.name), p);
  for (const p of list) for (const a of (p.aliases || [])) if (!m.has(a)) m.set(a, p);
  return m;
}
function rebuildNameIndex() {
  // Form names are display-only: the quiz accepts the shared/base species name.
  // Keep the full index separately so the app can still recognize excluded entries.
  pokemonByName = buildNameIndex(pokemonList.filter(p => !p.isForm));
  allPokemonByName = buildNameIndex(allPokemonList);
  for (const form of allPokemonList) {
    if (!form.isForm || !formGroupSpeciesId(form)) continue;
    const sid = formMeta.get(form.id)?.speciesId || form.speciesId;
    if (!sid) continue;
    const base = allPokemonList.find(p => !p.isForm && p.id === sid);
    if (!base) continue;
    const baseNames = [base.name, base.displayName, ...(base.aliases || [])];
    // A common name can target another visible form only when that form is
    // grouped by the ordinary-form rules; mandatory prefixed forms stay separate.
    for (const name of baseNames) {
      const key = normalizeName(name);
      if (key && !pokemonByName.has(key) && pokemonList.some(p => p.id === form.id)) pokemonByName.set(key, form);
    }
  }
}

function resolveCommonNameEntry(normalized) {
  const base = allPokemonList.find(p => !p.isForm &&
    [p.name, p.displayName, ...(p.aliases || [])].some(name => normalizeName(name) === normalized));
  if (!base) return null;
  if (GROUPED_FORM_SPECIES.has(base.id)) {
    // Re-entering the common name always resolves to the one base discovery;
    // hidden form IDs must never become extra discoveries behind the scenes.
    return pokemonList.find(p => !p.isForm && p.id === base.id) ||
      pokemonList.find(p => p.isForm && formSpeciesId(p) === base.id && formGroupSpeciesId(p) === base.id) || null;
  }
  const candidates = pokemonList.filter(p => p.id === base.id ||
    (p.isForm && Number(formMeta.get(p.id)?.speciesId || p.speciesId) === base.id && formGroupSpeciesId(p)));
  if (!candidates.length) return null;
  // Existing form-specific behavior for all non-listed species remains unchanged.
  return candidates.find(p => !encountered.has(p.id)) || candidates[0];
}

function resolveSpecificFormEntry(normalized) {
  // The Paldean Tauros group is discovered with the explicit name.
  if (["paldeantauros", "taurospaldean"].includes(normalized)) {
    return pokemonList.find(p => isGroupedTaurosRegionalForm(p)) || null;
  }

  // Accept both requested spellings for the Galarian Darmanitan discovery.
  if (["galariandarmanitan", "galardarmanitan"].includes(normalized)) {
    return pokemonList.find(p => isGalarianDarmanitanRepresentative(p)) || null;
  }
  // Accept the user's alternate spelling for Oinkologne.
  if (normalized === "oikologne") {
    return pokemonList.find(p => !p.isForm && p.id === 916) || null;
  }
  // Mega Meowstic / Mega Magearna / Mega Tatsugiri, when present in the form data,
  // have their own grouped discovery separate from the base species.
  if (["megameowstic", "meowsticmega"].includes(normalized)) {
    return pokemonList.find(p => isGroupedMegaRepresentative(p) && formSpeciesId(p) === 678)
      || pokemonList.find(p => !p.isForm && p.id === 678) || null;
  }
  if (["gigantamaxtoxtricity", "gmaxtoxtricity", "toxtricitygigantamax"].includes(normalized)) {
    return pokemonList.find(isToxtricityGigantamaxRepresentative) || null;
  }
  if (["gigantamaxurshifu", "urshifugigantamax", "gmaxurshifu"].includes(normalized)) {
    return pokemonList.find(isUrshifuGigantamaxRepresentative) || null;
  }
  if (["megamagearna", "magearnamega"].includes(normalized)) {
    return pokemonList.find(p => isGroupedMegaRepresentative(p) && formSpeciesId(p) === 801)
      || pokemonList.find(p => !p.isForm && p.id === 801) || null;
  }
  if (["megatatsugiri", "tatsugirimega"].includes(normalized)) {
    return pokemonList.find(p => isGroupedMegaRepresentative(p) && formSpeciesId(p) === 978)
      || pokemonList.find(p => !p.isForm && p.id === 978) || null;
  }
  const form = allPokemonList.find(p => p.isForm &&
    [p.name, p.displayName, ...(p.aliases || [])].some(name => normalizeName(name) === normalized));
  if (!form) return null;
  const kind = formMeta.get(form.id)?.kind || form.kind;
  // Mega, regional, Gigantamax and Eternamax forms must be entered using
  // their generated prefixed display name (e.g. Mega Charizard X, Alolan Raichu).
  if (isGalarianDarmanitanForm(form)) {
    // Either Galarian name discovers the one Galarian entry (standard + Zen sheet).
    return pokemonList.find(p => isGalarianDarmanitanRepresentative(p)) || null;
  }
  const formSpeciesIdValue = Number(formMeta.get(form.id)?.speciesId || form.speciesId);
  if (isGroupedMegaForm(form)) {
    return pokemonList.find(p => isGroupedMegaRepresentative(p) && formSpeciesId(p) === formSpeciesIdValue) || null;
  }
  if (isToxtricityGigantamaxForm(form)) {
    return pokemonList.find(isToxtricityGigantamaxRepresentative) || null;
  }
  if (isUrshifuGigantamaxForm(form)) {
    return pokemonList.find(isUrshifuGigantamaxRepresentative) || null;
  }
  if (SEPARATE_FORM_KINDS.has(kind) && !isToxtricityGigantamaxForm(form) && !isUrshifuGigantamaxForm(form) && !isGroupedTaurosRegionalForm(form)) {
    const allowed = normalizeName(form.displayName) === normalized;
    if (!allowed) return null;
    return pokemonList.find(p => p.id === form.id) || null;
  }
  const speciesId = Number(formMeta.get(form.id)?.speciesId || form.speciesId);
  // Only the user-listed species accept alternate-form names as aliases for
  // the single base discovery. Other forms remain separate discoveries.
  if (GROUPED_FORM_SPECIES.has(speciesId) && !isToxtricityGigantamaxForm(form)) {
    if (isGroupedMegaForm(form)) {
      return pokemonList.find(p => isGroupedMegaRepresentative(p) && formSpeciesId(p) === speciesId) || null;
    }
    return pokemonList.find(p => !p.isForm && p.id === speciesId) ||
      pokemonList.find(p => p.isForm && formSpeciesId(p) === speciesId && formGroupSpeciesId(p) === speciesId) || null;
  }
  const visibleForm = pokemonList.find(p => p.id === form.id);
  if (visibleForm) return visibleForm;
  if (!shouldMergeForm(form)) return null;
  return pokemonList.find(p => p.id === speciesId) || null;
}

function findClosePokemon(input) {
  const value = normalizeName(input);
  if (!value || value.length < 3 || !allPokemonList.length) return null;
  let best = null, bestDistance = Infinity;
  for (const p of allPokemonList) {
    const name = normalizeName(p.name);
    const limit = Math.max(1, Math.floor(Math.max(value.length, name.length) * 0.25));
    if (Math.abs(value.length - name.length) > limit) continue;
    const distance = levenshteinDistance(value, name);
    if (distance <= limit && distance < bestDistance) { best = p; bestDistance = distance; }
  }
  return best;
}
