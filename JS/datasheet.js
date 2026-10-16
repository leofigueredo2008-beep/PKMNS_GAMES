/* ======================================================================
 * datasheet.js
 * Technical data side sheet (sprite, types, cry, form switcher).
 * ====================================================================== */

function closeDataSheet() {
  selectedPokemonId = null;
  if (activeCryAudio) { activeCryAudio.pause(); activeCryAudio.currentTime = 0; activeCryAudio = null; }
  const sheet = $("dataSheet"), layout = $("gameLayout");
  sheet.className = "data-sheet";
  sheet.setAttribute("aria-hidden", "true");
  sheet.innerHTML = "";
  layout.classList.remove("sheet-open");
}
function renderDataSheetLoading(name) {
  const sheet = $("dataSheet"), layout = $("gameLayout");
  layout.classList.add("sheet-open");
  sheet.className = "data-sheet open";
  sheet.setAttribute("aria-hidden", "false");
  sheet.innerHTML = `<div class="data-sheet-kicker">Pokémon Technical Data</div><div class="data-sheet-header"><div><div class="data-sheet-name">${escapeHTML(name)}</div><div class="data-sheet-number">Loading...</div></div><button class="sheet-close" type="button" aria-label="Close technical data sheet">×</button></div><div class="data-sheet-visual"><div class="data-sheet-loading">Loading Pokémon data...</div></div>`;
  sheet.querySelector(".sheet-close").addEventListener("click", closeDataSheet);
}
async function selectPokemon(id) {
  const base = allPokemonList.find(p => p.id === id) || pokemonList.find(p => p.id === id);
  if (!base) return;
  selectedPokemonId = id;
  if (pokemonDetailsCache.has(id)) { renderDataSheet(pokemonDetailsCache.get(id)); return; }
  renderDataSheetLoading(base.displayName);
  try {
    const r = await fetch(`${API}/pokemon/${id}`);
    if (!r.ok) throw new Error("PokéAPI Pokémon request failed");
    const data = await r.json();
    const detail = {
      id: data.id,
      name: data.name,
      displayName: base.displayName || prettyName(data.name),
      types: (data.types || []).sort((a, b) => a.slot - b.slot).map(x => x.type.name),
      ...spriteSources(data),
      cry: data.cries?.latest || data.cries?.legacy || ""
    };
    pokemonDetailsCache.set(id, detail);
    if (selectedPokemonId === id) renderDataSheet(detail);
  } catch (error) {
    console.error(error);
    if (selectedPokemonId === id) {
      const sheet = $("dataSheet");
      sheet.className = "data-sheet open";
      sheet.setAttribute("aria-hidden", "false");
      sheet.innerHTML = `<div class="data-sheet-kicker">Pokémon Technical Data</div><div class="data-sheet-header"><div><div class="data-sheet-name">${escapeHTML(base.displayName)}</div><div class="data-sheet-number">${dexNumber(base.id)}</div></div><button class="sheet-close" type="button" aria-label="Close technical data sheet">×</button></div><div class="data-sheet-visual"><div class="data-sheet-loading">Could not load detailed PokéAPI data.</div></div>`;
      sheet.querySelector(".sheet-close").addEventListener("click", closeDataSheet);
    }
  }
}
// Whole-number upscaling keeps small pixel GIFs sharp instead of blurry
function fitSpriteToBox(img, box) {
  if (img.classList.contains("still")) return;
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const bw = box.clientWidth - 28, bh = box.clientHeight - 44;
  if (!nw || !nh || bw <= 0 || bh <= 0) return;
  const scale = Math.floor(Math.min(bw / nw, bh / nh));
  if (scale >= 1) { img.style.width = (nw * scale) + "px"; img.style.height = (nh * scale) + "px"; }
  else { img.style.width = "auto"; img.style.height = "auto"; }
}
function mountSheetSprite(sheet, data) {
  const box = sheet.querySelector(".data-sheet-visual");
  const badge = box.querySelector(".sprite-badge");
  const buttons = [...sheet.querySelectorAll(".sprite-toggle button")];
  let shiny = false;
  const show = () => {
    const urls = (shiny ? data.gifShiny : data.gif).slice();
    const still = (shiny && data.stillShiny) ? data.stillShiny : data.still;
    const old = box.querySelector(".data-sheet-gif");
    const img = new Image();
    img.className = "data-sheet-gif"; img.decoding = "async";
    img.alt = `${data.displayName}${shiny ? " (shiny)" : ""} animated sprite`;
    let i = 0;
    const next = () => {
      if (i < urls.length) { img.classList.remove("still"); img.removeAttribute("style"); badge.textContent = "ANIMATED GIF"; img.src = urls[i++]; }
      else if (!img.classList.contains("still")) { img.classList.add("still"); img.removeAttribute("style"); badge.textContent = "OFFICIAL ARTWORK"; img.src = still; }
    };
    img.onerror = next;
    img.onload = () => fitSpriteToBox(img, box);
    next();
    if (old) old.replaceWith(img); else box.appendChild(img);
  };
  buttons.forEach(btn => btn.addEventListener("click", () => {
    if (btn.disabled) return;
    shiny = btn.dataset.shiny === "1";
    buttons.forEach(b => b.classList.toggle("active", b === btn));
    show();
  }));
  show();
}
function renderDataSheet(data) {
  const types = (data.types || []).map(type => `<span class="type-chip">${escapeHTML(typeName(type))}</span>`).join("");
  const sheet = $("dataSheet"), layout = $("gameLayout");
  layout.classList.add("sheet-open");
  sheet.className = "data-sheet open";
  sheet.setAttribute("aria-hidden", "false");
  if (activeCryAudio) { activeCryAudio.pause(); activeCryAudio.currentTime = 0; activeCryAudio = null; }
  sheet.innerHTML = `
<div class="data-sheet-kicker">Pokémon Technical Data</div>
<div class="data-sheet-header"><div><div class="data-sheet-name">${escapeHTML(data.displayName)}</div><div class="data-sheet-number">${dexNumber(data.id)}</div></div><button class="sheet-close" type="button" aria-label="Close technical data sheet">×</button></div>
${formsForSheet(data.id).length > 1 ? `<div class="form-switcher" aria-label="Switch Pokémon form">${formsForSheet(data.id).map(form => `<button type="button" data-form-id="${form.id}" class="${form.id === data.id ? 'active' : ''}">${escapeHTML(form.displayName || prettyName(form.name))}</button>`).join('')}</div>` : ''}
<div class="data-sheet-visual"><span class="sprite-badge">ANIMATED GIF</span></div>
<div class="sprite-toggle"><button type="button" data-shiny="0" class="active">Normal</button><button type="button" data-shiny="1"${(data.gifShiny.length || data.stillShiny) ? "" : " disabled"}>Shiny</button></div>
<div class="data-sheet-source">Animated sprites: <a href="https://github.com/PokeAPI/sprites" target="_blank" rel="noopener noreferrer">PokéAPI Sprites</a> (Showdown set)</div>
<div class="data-sheet-row"><div class="data-sheet-label">Name</div><div>${escapeHTML(data.displayName)}</div></div>
<div class="data-sheet-row"><div class="data-sheet-label">Number</div><div>${dexNumber(data.id)}</div></div>
${formMeta.has(data.id) ? `<div class="data-sheet-row"><div class="data-sheet-label">Form of</div><div>${escapeHTML(formMeta.get(data.id).baseName)}</div></div>` : ""}
<div class="data-sheet-row"><div class="data-sheet-label">Type</div><div class="type-list">${types || "Unknown"}</div></div>
<div class="data-sheet-row"><div class="data-sheet-label">Cry</div><div>${data.cry ? `<audio id="sheetCry" class="cry-player" controls preload="auto" src="${escapeHTML(data.cry)}"></audio>` : "No cry available"}</div></div>
`;
  sheet.querySelector(".sheet-close").addEventListener("click", closeDataSheet);
  sheet.querySelectorAll(".form-switcher [data-form-id]").forEach(button => {
    button.addEventListener("click", () => selectPokemon(Number(button.dataset.formId)));
  });
  mountSheetSprite(sheet, data);

  if (data.cry) {
    const audio = $("sheetCry");
    activeCryAudio = audio;
    audio.play().catch(() => { });
  }
}

function setupPokemonCardClicks() {
  const pane = $("viewPane");
  if (!pane) return;
  const activate = e => {
    const card = e.target.closest?.(".pokemon[data-pokemon-id]");
    if (!card || !pane.contains(card)) return;
    const id = Number(card.dataset.pokemonId);
    if (Number.isFinite(id)) selectPokemon(id);
  };
  pane.addEventListener("click", activate);
  pane.addEventListener("keydown", e => { if (e.key !== "Enter" && e.key !== " ") return; const card = e.target.closest?.(".pokemon[data-pokemon-id]"); if (!card || !pane.contains(card)) return; e.preventDefault(); const id = Number(card.dataset.pokemonId); if (Number.isFinite(id)) selectPokemon(id); });
}
