/* ======================================================================
 * ui.js
 * DOM rendering helpers: HUD, loading screen, settings UI, congrats, legacy grid views.
 * ====================================================================== */

// "color -> region" key, shown only while the generation colors are visible (Normal mode, colors ON)
function updateGenLegend() {
  const el = $("genLegend"); if (!el) return;
  if (!colorsVisible()) { el.classList.remove("show"); el.innerHTML = ""; return; }
  const gens = [...new Set(pokemonList.map(p => regionOf(p.id)))].sort((a, b) => a - b);
  el.innerHTML = '<div class="gen-legend-title">Regions</div>' + gens.map(g => {
    const c = GENERATION_COLORS[g] || GENERATION_COLORS[9];
    const members = pokemonList.filter(p => regionOf(p.id) === g);
    const found = members.filter(p => encountered.has(p.id)).length;
    return `<span class="gen-chip"><i style="background:${c.stroke}"></i><span>${GEN_REGION_NAMES[g] || "Gen " + g} <b class="legend-count">${found}/${members.length}</b></span></span>`;
  }).join("");
  el.classList.add("show");
}

function updateMiniHUD() {
  const missing = Math.max(0, pokemonList.length - encountered.size);
  const timerText = $("timer")?.textContent || "00:00";
  if ($("miniTimer")) $("miniTimer").textContent = timerText;
  if ($("missingCount")) $("missingCount").textContent = String(missing);
}
function setLastTyped(value) {
  const clean = String(value || "").trim();
  if ($("lastTyped")) $("lastTyped").textContent = clean ? clean : "—";
}
function setLoading(title, text, percent) {
  $("loadingTitle").textContent = title;
  $("loadingText").textContent = text;
  $("loadingBar").style.width = percent + "%";
  $("loadingPercent").textContent = Math.round(percent) + "%";
}
function showLoading() { $("loading").classList.remove("hidden") }
function hideLoading() { $("loading").classList.add("hidden") }

function hideCongrats() { $("congrats").classList.add("hidden"); document.querySelectorAll(".confetti-piece").forEach(n => n.remove()); }
function launchConfetti() {
  const colors = Object.values(GENERATION_COLORS).map(c => c.stroke.replace(/[\d.]+\)$/, "1)"));
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[i % colors.length];
    piece.style.animationDuration = (2.4 + Math.random() * 2.4) + "s";
    piece.style.animationDelay = (Math.random() * 0.8) + "s";
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 6000);
  }
}

function regionMembers(region) {
  if (region.kind === "extras") return pokemonList.filter(p => p.isForm && !["mega", "gmax", "regional"].includes(formMeta.get(p.id)?.kind || p.kind));
  if (region.name === "Hisui") return pokemonList.filter(p => (!p.isForm && p.id >= region.start && p.id <= region.end) || (p.isForm && regionOf(p.id) === 10));
  return pokemonList.filter(p => {
    if (region.kind) return p.kind === region.kind;
    if (!p.isForm) return p.id >= region.start && p.id <= region.end;
    const kind = formMeta.get(p.id)?.kind || p.kind;
    // Count enabled Mega/Gigantamax discoveries in the region of their base species.
    if (kind === "mega" || kind === "gmax") {
      const speciesId = Number(formMeta.get(p.id)?.speciesId || p.speciesId || 0);
      return speciesId >= region.start && speciesId <= region.end;
    }
    return false;
  });
}

function renderHard() {
  const ordered = gaveUp ? pokemonList : [...encountered.values()].sort((a, b) => a.id - b.id);
  $("hardGrid").innerHTML = ordered.map(p => `
<div class="pokemon ${gaveUp && !encountered.has(p.id) ? "revealed" : ""}" data-pokemon-id="${p.id}" tabindex="0" role="button" title="Open technical data sheet">
<div class="pokemon-number">${dexNumber(p.id)}</div>
<img src="${spriteURL(p.id)}" alt="${escapeHTML(p.name)}" loading="eager"
onerror="this.onerror=null;this.src='${SPRITES}${p.id}.png'">
<div class="pokemon-name">${escapeHTML(p.displayName || p.name)}</div>
</div>`).join("");
}

function renderRegions() {
  const columnCount = window.innerWidth <= 650 ? 1 : (window.innerWidth <= 900 ? 2 : 3);
  const buckets = Array.from({ length: columnCount }, () => []);
  regions.forEach((region, index) => buckets[index % columnCount].push(region));
  $("regionGrid").innerHTML = buckets.map(bucket => `<div class="regions-column">${bucket.map(region => {
    const members = regionMembers(region);
    const found = members.filter(p => encountered.has(p.id)).length;
    const missing = members.length - found;
    const percent = members.length ? found / members.length * 100 : 0;
    const cards = members.map(p => {
      const foundPokemon = encountered.has(p.id);
      if (!foundPokemon && !gaveUp) {
        return `<div class="pokemon missing" title="Not encountered"><div aria-hidden="true">???</div></div>`;
      }
      return `<div class="pokemon ${foundPokemon ? "" : "revealed"}" data-pokemon-id="${p.id}" tabindex="0" role="button" title="Open technical data sheet">
<div class="pokemon-number">${dexNumber(p.id)}</div>
<img src="${spriteURL(p.id)}" alt="${escapeHTML(p.displayName)}" loading="eager" onerror="this.onerror=null;this.src='${SPRITES}${p.id}.png'">
<div class="pokemon-name">${escapeHTML(p.displayName)}</div>
</div>`;
    }).join("");
    if (!members.length) return "";
    return `<section class="region-box">
<div class="region-header"><div class="region-name">${region.name} <span class="region-count">${found}/${members.length}</span></div></div>
<div class="region-bar"><div class="region-bar-fill" style="width:${percent}%"></div></div>
<div class="region-pokemon">${cards}</div>
</section>`;
  }).join("")}</div>`).join("");
}

function render() {
  updateMiniHUD(); updateHintUI(); updateGenLegend();
  const generation = $("generationFilter").value;
  const type = $("typeFilter").value;
  const genLabel = generation === "all" ? "All Generations" : `Gen ${generation}`;
  const typeLabel = type === "all" ? "All Types" : type.charAt(0).toUpperCase() + type.slice(1);
  const difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  const viewLabel = view === "regional" ? "Regional" : "Globe";
  $("score").textContent = `${encountered.size} / ${pokemonList.length}`;
  $("dexLabel").textContent = `${difficultyLabel} • ${viewLabel}`;
  $("progressBar").style.width = (pokemonList.length ? encountered.size / pokemonList.length * 100 : 0) + "%";

  $("encounteredTitle").textContent = "3D Pokémon Globe";
  $("hardGrid").classList.add("hidden");
  $("regionGrid").classList.add("hidden");
  $("globeWrap").classList.add("active");
  const legendHidden = $("legendHidden");
  if (legendHidden) legendHidden.style.display = difficulty === "hard" ? "none" : "";
  resizeGlobe(); drawGlobe();
}

function message(text, type) {
  const el = $("message"); el.textContent = text; el.className = "message " + type;
  clearTimeout(message.timeout); message.timeout = setTimeout(() => el.textContent = "", 1500);
}
function updateSettingsUI() {
  $("normalMode").classList.toggle("active", difficulty === "normal");
  $("hardMode").classList.toggle("active", difficulty === "hard");
  const hard = difficulty === "hard";
  const colorBtn = $("colorsToggle"), on = colorsVisible();
  colorBtn.textContent = on ? "ON" : "OFF";
  colorBtn.classList.toggle("active", on);
  colorBtn.setAttribute("aria-pressed", String(on));
  colorBtn.disabled = hard;
  $("colorsNote").textContent = hard ? "Always off in Hard mode (no colors, no borders)." : "Show or hide the generation colors. The borders stay.";
  const megaBtn = $("megaToggle"), gmaxBtn = $("gigantamaxToggle");
  megaBtn.textContent = `MEGA: ${megaEvolutionsEnabled ? "ON" : "OFF"}`;
  megaBtn.classList.toggle("active", megaEvolutionsEnabled);
  megaBtn.setAttribute("aria-pressed", String(megaEvolutionsEnabled));
  gmaxBtn.textContent = `GIGANTAMAX: ${gigantamaxEnabled ? "ON" : "OFF"}`;
  gmaxBtn.classList.toggle("active", gigantamaxEnabled);
  gmaxBtn.setAttribute("aria-pressed", String(gigantamaxEnabled));
  const light = document.body.classList.contains("light-theme");
  $("lightTheme").classList.toggle("active", light);
  $("darkTheme").classList.toggle("active", !light);
}
function setDifficulty(newDifficulty) {
  difficulty = newDifficulty;
  updateSettingsUI();
  render();
}
function toggleSettings() {
  $("settingsPanel").classList.toggle("open");
}
function setTheme(theme) {
  document.body.classList.toggle("light-theme", theme === "light");
  storage.set("pokemon-quiz-theme", theme);
  updateSettingsUI();
  drawGlobe(); // the canvas uses theme colors, so repaint it
}
