/* ======================================================================
 * hints.js
 * Hint system (text generation, toast, globe pulse).
 * ====================================================================== */

async function buildHintText(target, kind) {
  const speciesId = target.speciesId || target.id;
  if (kind === "letter") {
    const ch = (target.displayName || target.name || "").trim().charAt(0).toUpperCase();
    return ch ? `The name starts with “${ch}”.` : null;
  }
  if (kind === "types") {
    const types = pokemonTypes.get(target.id) || [];
    if (!types.length) return null;
    return types.length > 1 ? `Types: ${types.map(typeName).join(" / ")}.` : `Type: ${typeName(types[0])}.`;
  }
  if (kind === "color") {
    const color = await getSpeciesColor(speciesId);
    return color ? `Pokédex color: ${typeName(color)}.` : null;
  }
  if (kind === "pre") {
    if (target.isForm) {
      const fm = formMeta.get(target.id); if (!fm) return null;
      const label = { mega: "A Mega or Primal form of", regional: "A regional form of", gmax: "The Gigantamax form of" }[fm.kind] || "An alternate form of";
      return `${label} ${fm.baseName}.`;
    }
    const info = await getEvolutionInfo(speciesId);
    return info && info.from ? `It evolves from ${info.from}.` : null;
  }
  if (kind === "evo") {
    if (target.isForm) return null;
    const info = await getEvolutionInfo(speciesId);
    if (!info || !info.to.length) return null;
    const shown = info.to.slice(0, 3).join(", ");
    return `It evolves into ${shown}${info.to.length > 3 ? ` and ${info.to.length - 3} more` : ""}.`;
  }
  return null;
}

function updateHintUI() {
  const btn = $("hintBtn"); if (!btn) return;
  const done = pokemonList.length > 0 && encountered.size >= pokemonList.length;
  btn.disabled = !gameRunning || hintBusy || hintsLeft <= 0 || done;
  btn.textContent = hintBusy ? "💡 THINKING…" : (hintsLeft > 0 ? "💡 GET A HINT" : "💡 NO HINTS LEFT");
  $("hintCount").textContent = `${hintsLeft} of ${HINTS_PER_GAME} left`;
  $("hintList").innerHTML = hintLog.map((h, i) => {
    const found = encountered.has(h.id);
    return `<li data-id="${h.id}" class="${found ? "found" : ""}"><span class="hint-n">${i + 1}.</span><span>${escapeHTML(h.text)}</span>${found ? "" : '<span class="hint-go">SHOW ON GLOBE</span>'}</li>`;
  }).join("");
}

function showHintToast(text, n) {
  const el = $("hintToast");
  el.innerHTML = `<strong>💡 Hint ${n}/${HINTS_PER_GAME}</strong>${escapeHTML(text)}`;
  el.classList.add("show");
  clearTimeout(showHintToast.t);
  showHintToast.t = setTimeout(() => el.classList.remove("show"), 10000);
}

function pointToHint(id, holdMs = 8000) {
  globeHint = { id, until: performance.now() + holdMs };
  focusGlobeOnPokemon(id, holdMs);
  cancelAnimationFrame(hintPulseRaf);
  const tick = () => {
    if (!globeHint) return;
    if (performance.now() > globeHint.until) { globeHint = null; drawGlobe(); return; }
    if (!globeFocus) drawGlobe();
    hintPulseRaf = requestAnimationFrame(tick);
  };
  tick();
}

function resetHints() {
  hintsLeft = HINTS_PER_GAME; hintLog = []; hintedIds = new Set(); hintToken++; hintBusy = false;
  globeHint = null; cancelAnimationFrame(hintPulseRaf);
  const toast = $("hintToast"); if (toast) toast.classList.remove("show");
  updateHintUI();
}

async function useHint() {
  if (!gameRunning || hintBusy || hintsLeft <= 0) return;
  const pool = pokemonList.filter(p => !encountered.has(p.id));
  if (!pool.length) return;
  hintBusy = true; updateHintUI();
  const token = hintToken;
  try {
    const fresh = shuffle(pool.filter(p => !hintedIds.has(p.id)));
    const order = fresh.concat(shuffle(pool.filter(p => hintedIds.has(p.id)))).slice(0, 12);
    let result = null;
    for (const target of order) {
      for (const kind of shuffle(["letter", "types", "color", "pre", "evo"])) {
        const text = await buildHintText(target, kind);
        if (token !== hintToken) return;          // the game was reset while we were waiting
        if (text) { result = { target, text }; break; }
      }
      if (result) break;
    }
    if (!result) { const t = order[0]; result = { target: t, text: `The name starts with “${t.displayName.charAt(0).toUpperCase()}”.` }; }
    hintsLeft--;
    hintedIds.add(result.target.id);
    hintLog.push({ id: result.target.id, text: result.text });
    showHintToast(result.text, hintLog.length);
    $("settingsPanel").classList.remove("open");
    pointToHint(result.target.id);
  } finally {
    if (token === hintToken) hintBusy = false;
    updateHintUI();
  }
}
