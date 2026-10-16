/* ======================================================================
 * forms.js
 * Alternate-form logic: grouping rules, form list building, sheet form switcher.
 * ====================================================================== */

function regionOf(id) { return pokemonRegions.get(id) || pokemonGenerations.get(id) || 9; }

function formSpeciesId(p) {
  if (!p) return null;
  return Number(p.isForm ? (formMeta.get(p.id)?.speciesId || p.speciesId) : p.id) || null;
}

function isGroupedTaurosRegionalForm(p) {
  if (!p?.isForm || formSpeciesId(p) !== 128) return false;
  const meta = formMeta.get(p.id) || p;
  if ((meta.kind || p.kind) !== "regional") return false;
  const name = `${p.name || ""} ${p.displayName || ""}`.toLowerCase();
  // Only Paldean Tauros breeds belong to the shared Tauros-form group.
  return name.includes("paldea") || name.includes("paldean") ||
    /tauros-(combat|blaze|aqua)/.test(String(p.name || "").toLowerCase());
}

function isGalarianDarmanitanForm(p) {
  if (!p?.isForm || formSpeciesId(p) !== 555) return false;
  const rawName = String(p.name || "").toLowerCase();
  const displayName = String(p.displayName || "").toLowerCase();
  return rawName.includes("-galar-") || displayName.startsWith("galarian darmanitan");
}

function isGalarianDarmanitanZenForm(p) {
  return isGalarianDarmanitanForm(p) && /-zen(?:-|$)/i.test(String(p.name || ""));
}

function isGalarianDarmanitanRepresentative(p) {
  return isGalarianDarmanitanForm(p) && !isGalarianDarmanitanZenForm(p);
}

function isSeparateMegaGroupSpecies(sid) { return sid === 678 || sid === 801 || sid === 978; }

function isGroupedMegaForm(p) {
  if (!p?.isForm) return false;
  const sid = formSpeciesId(p);
  const kind = formMeta.get(p.id)?.kind || p.kind;
  return isSeparateMegaGroupSpecies(sid) && kind === "mega";
}

function megaFormsForSpecies(sid) {
  return allPokemonList.filter(p => isGroupedMegaForm(p) && formSpeciesId(p) === sid)
    .sort((a, b) => a.id - b.id);
}

function isGroupedMegaRepresentative(p) {
  if (!isGroupedMegaForm(p)) return false;
  return megaFormsForSpecies(formSpeciesId(p))[0]?.id === p.id;
}

function isToxtricityGigantamaxForm(p) {
  return !!p?.isForm && formSpeciesId(p) === 849 && (formMeta.get(p.id)?.kind || p.kind) === "gmax";
}

function toxtricityGigantamaxForms() {
  return allPokemonList.filter(isToxtricityGigantamaxForm).sort((a, b) => a.id - b.id);
}

function isToxtricityGigantamaxRepresentative(p) {
  return isToxtricityGigantamaxForm(p) && toxtricityGigantamaxForms()[0]?.id === p.id;
}

function isUrshifuGigantamaxForm(p) {
  return !!p?.isForm && formSpeciesId(p) === 892 && (formMeta.get(p.id)?.kind || p.kind) === "gmax";
}
function urshifuGigantamaxForms() {
  return allPokemonList.filter(isUrshifuGigantamaxForm).sort((a, b) => a.id - b.id);
}
function isUrshifuGigantamaxRepresentative(p) {
  return isUrshifuGigantamaxForm(p) && urshifuGigantamaxForms()[0]?.id === p.id;
}

function formGroupSpeciesId(p) {
  if (!p) return null;
  const sid = formSpeciesId(p);
  if (!sid) return null;
  // Kantonian Tauros is an independent discovery; only Paldean breeds share a group.
  if (sid === 128 && !p.isForm) return null;
  if (p.isForm) {
    const kind = formMeta.get(p.id)?.kind || p.kind;
    // Galarian Darmanitan forms form their own group, separate from Unovan Darmanitan.
    if (isGalarianDarmanitanForm(p)) return null;
    // Mega and Gigantamax forms remain separate visible globe points. Their toggles
    // control whether they need individual typing, not whether they are displayed.
    if (kind === "mega" || kind === "gmax") return null;
    if (SEPARATE_FORM_KINDS.has(kind) && !isGroupedTaurosRegionalForm(p)) return null;
    // Do not merge arbitrary forms: only the explicitly requested species qualify.
    if (!GROUPED_FORM_SPECIES.has(sid)) return null;
  }
  return sid;
}

function shouldMergeForm(form) {
  if (!form?.isForm) return false;
  // Keep one default visible discovery for Galarian Darmanitan; when a type
  // filter requires it, its matching type-changing forms can split out.
  if (isGalarianDarmanitanForm(form)) return !isGalarianDarmanitanRepresentative(form);
  if (isGroupedMegaForm(form)) return !isGroupedMegaRepresentative(form);
  if (isToxtricityGigantamaxForm(form)) return !isToxtricityGigantamaxRepresentative(form);
  if (isUrshifuGigantamaxForm(form)) return !isUrshifuGigantamaxRepresentative(form);
  if (!formGroupSpeciesId(form)) return false;
  return true;
}

function formsForSheet(id) {
  const selected = allPokemonList.find(p => p.id === id);
  const sid = formSpeciesId(selected);
  if (!sid) return [];
  if (sid === 128) {
    if (!selected?.isForm) return selected ? [selected] : [];
    if (isGroupedTaurosRegionalForm(selected)) {
      return allPokemonList.filter(p => isGroupedTaurosRegionalForm(p))
        .sort((a, b) => a.id - b.id);
    }
    return [selected];
  }
  if (!GROUPED_FORM_SPECIES.has(sid)) return selected ? [selected] : [];
  if (isGroupedMegaForm(selected)) return megaFormsForSpecies(sid);
  if (isToxtricityGigantamaxForm(selected)) return toxtricityGigantamaxForms();
  if (isUrshifuGigantamaxForm(selected)) return urshifuGigantamaxForms();
  if (isGalarianDarmanitanForm(selected)) {
    return allPokemonList.filter(p => isGalarianDarmanitanForm(p))
      .sort((a, b) => Number(isGalarianDarmanitanZenForm(a)) - Number(isGalarianDarmanitanZenForm(b)) || a.id - b.id);
  }
  return allPokemonList.filter(p => formSpeciesId(p) === sid && !isGalarianDarmanitanForm(p))
    .filter(p => !p.isForm || (!SEPARATE_FORM_KINDS.has(formMeta.get(p.id)?.kind || p.kind) && !isGroupedMegaForm(p) && !isToxtricityGigantamaxForm(p) && !isUrshifuGigantamaxForm(p)) || isGroupedTaurosRegionalForm(p))
    .sort((a, b) => Number(a.isForm) - Number(b.isForm) || a.id - b.id);
}

// Turns "charizard-mega-x" into a proper name, a category and the other names a player might type
function describeForm(speciesName, formName) {
  const suffix = formName.startsWith(speciesName + "-") ? formName.slice(speciesName.length + 1) : formName;
  const toks = suffix.split("-");
  const sp = titleCase(speciesName.split("-"));
  const has = t => toks.includes(t);
  const without = (...ts) => titleCase(toks.filter(t => !ts.includes(t)));
  const aliases = [normalizeName(formName)];
  let kind = "other", display, region = null;
  const regionTok = toks.find(t => REGION_ADJ[t]);
  if (has("mega")) {
    kind = "mega"; const rest = without("mega");
    display = `Mega ${sp}${rest ? " " + rest : ""}`;
    aliases.push(normalizeName(`mega ${sp} ${rest}`), normalizeName(`${sp} mega ${rest}`));
  } else if (has("primal")) {
    kind = "mega";
    display = `Primal ${sp}`;
    aliases.push(normalizeName(`primal ${sp}`));
  } else if (has("gmax") || has("eternamax")) {
    kind = "gmax"; const label = has("gmax") ? "Gigantamax" : "Eternamax"; const rest = without("gmax", "eternamax");
    display = `${label} ${sp}${rest ? " " + rest : ""}`;
    aliases.push(normalizeName(`${label} ${sp} ${rest}`), normalizeName(`${sp} ${label} ${rest}`));
    if (has("gmax")) aliases.push(normalizeName(`gmax ${sp} ${rest}`), normalizeName(`${sp} gmax ${rest}`));
  } else if (regionTok) {
    kind = "regional"; region = regionTok; const adj = REGION_ADJ[regionTok]; const rest = without(regionTok);
    display = `${adj} ${sp}${rest ? " " + rest : ""}`;
    aliases.push(normalizeName(`${adj} ${sp} ${rest}`), normalizeName(`${regionTok} ${sp} ${rest}`), normalizeName(`${sp} ${adj} ${rest}`));
  } else {
    display = `${sp} ${titleCase(toks)}`;
    aliases.push(normalizeName(display), normalizeName(`${titleCase(toks)} ${sp}`));
  }
  return { kind, display, toks, region, aliases: [...new Set(aliases)] };
}

// Base Pokémon whose API name carries a form suffix (deoxys-normal, giratina-altered...) can also be typed by species name
function decorateBaseList(list) {
  for (const p of list) {
    const meta = speciesMeta.get(p.id);
    p.isForm = false; p.kind = "base"; p.speciesId = p.id; p.aliases = [];
    pokemonRegions.set(p.id, (p.id >= HISUI_SPECIES_FIRST && p.id <= HISUI_SPECIES_LAST) ? 10 : (pokemonGenerations.get(p.id) || 9));
    if (meta && meta.s && normalizeName(meta.s) !== normalizeName(p.name)) p.aliases.push(normalizeName(meta.s));
  }
  return list;
}

// Creates one playable entry per alternate form and registers generation / types / evolution family for it
function buildFormList(baseList) {
  formMeta.clear();
  const forms = [];
  const baseById = new Map(baseList.map(p => [p.id, p]));
  const seen = new Set();
  for (const [sid, meta] of speciesMeta) {
    const base = baseById.get(sid); if (!base) continue;
    const speciesGen = pokemonGenerations.get(sid) || 9;
    const speciesRegion = regionOf(sid);
    for (const [fname, fid] of meta.v) {
      if (!fid || fid <= DEX_SIZE || seen.has(fid) || FORM_EXCLUDE.test(fname)) continue;
      seen.add(fid);
      const d = describeForm(meta.s, fname);
      // Mega / Primal / Gigantamax / other forms live where their origin Pokémon lives; regional forms keep their own debut generation
      let gen = speciesGen, region = speciesRegion;
      if (d.kind === "regional") { gen = REGION_GEN[d.region]; region = d.region === "hisui" ? 10 : gen; }
      pokemonGenerations.set(fid, gen);
      // Mega/Gigantamax stay beside their origin Pokémon; regional forms join their debut generation.
      // Deoxys/Castform forms stay with their original Hoenn species rather than the Extras continent.
      const groupedHoennForm = [351, 386].includes(sid);
      pokemonRegions.set(fid, ["mega", "gmax"].includes(d.kind) || d.kind === "regional" || groupedHoennForm || GROUPED_FORM_SPECIES.has(sid) || sid === 555 ? region : EXTRAS_REGION);
      if (!pokemonTypes.has(fid) && pokemonTypes.has(sid)) pokemonTypes.set(fid, pokemonTypes.get(sid));
      pokemonEvolutionChains.set(fid, pokemonEvolutionChains.get(sid) || `solo-${sid}`);
      formMeta.set(fid, { speciesId: sid, baseName: base.displayName, kind: d.kind });
      forms.push({ id: fid, name: fname, displayName: d.display, aliases: d.aliases, kind: d.kind, isForm: true, speciesId: sid });
    }
  }
  forms.sort((a, b) => a.speciesId - b.speciesId || a.id - b.id);
  return forms;
}
