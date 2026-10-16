/* ======================================================================
 * game.js
 * Game flow: filters, clock, start/reset/give up, answer submission.
 * ====================================================================== */

function applyFilters() {
  hideCongrats(); resetHints();
  const generation = $("generationFilter").value;
  const type = $("typeFilter").value;

  const inGeneration = p =>
    generation === "all" || pokemonGenerations.get(p.id) === Number(generation);
  const hasType = p =>
    type === "all" || (pokemonTypes.get(p.id) || []).includes(type);

  // Keep one globe entry per technical-sheet group. With a type filter,
  // use the matching form as the visible representative when the base
  // Pokémon does not have that type (e.g. Rotom-Heat for Fire).
  const groupedSpeciesAdded = new Set();
  const filtered = [];

  for (const p of allPokemonList) {
    const sid = formGroupSpeciesId(p);
    if (sid && GROUPED_FORM_SPECIES.has(sid)) {
      // Urshifu has two independent discoveries: its regular styles and its Gigantamax styles.
      // They share species ID 892, so use distinct keys to prevent one group hiding the other.
      const discoveryGroupKey = isUrshifuGigantamaxForm(p) ? "urshifu-gigantamax" : sid;
      if (groupedSpeciesAdded.has(discoveryGroupKey)) continue;
      const group = formsForSheet(p.id);
      const eligible = group.filter(form => inGeneration(form) && hasType(form));
      if (!eligible.length) continue;

      const base = eligible.find(form => !form.isForm);
      const chosen = type === "all"
        ? (base || eligible[0])
        : (base || eligible.find(form => form.isForm) || eligible[0]);

      if (chosen) {
        filtered.push(chosen);
        groupedSpeciesAdded.add(discoveryGroupKey);
      }
      continue;
    }

    if (
      !shouldMergeForm(p) &&
      inGeneration(p) &&
      hasType(p)
    ) {
      filtered.push(p);
    }
  }

  pokemonList = filtered;
  rebuildNameIndex();
  globeDistribution = buildGlobeDistribution();
  encountered = new Map(); attempts = 0; gaveUp = false; gameRunning = true;
  closeDataSheet();
  clearInterval(timerId); startClock();
  $("pokemonInput").value = ""; $("message").textContent = ""; $("lastFound").textContent = ""; setLastTyped(""); updateMiniHUD();
  render(); $("pokemonInput").focus();
}

function startClock() {
  startedAt = Date.now();
  clearInterval(timerId);
  $("timer").textContent = "00:00";
  updateMiniHUD();
  timerId = setInterval(() => {
    if (gameRunning) {
      const t = formatTime(Math.floor((Date.now() - startedAt) / 1000));
      $("timer").textContent = t;
      $("miniTimer").textContent = t;
    }
  }, 250);
}

async function startGame() {
  hideCongrats(); resetHints();
  clearInterval(timerId);
  gameRunning = false;
  encountered = new Map(); attempts = 0; gaveUp = false; pokemonList = []; pokemonByName = new Map(); allPokemonByName = new Map();
  closeDataSheet();
  $("hardGrid").innerHTML = ""; $("regionGrid").innerHTML = "";
  $("message").textContent = ""; $("lastFound").textContent = ""; $("pokemonInput").value = ""; setLastTyped(""); updateMiniHUD();
  showLoading(); setLoading("Loading Pokédex...", "Getting Pokémon names and IDs from PokéAPI.", 0);

  try {
    allPokemonList = await getList();
    setLoading("Loading filters...", "Getting Pokémon types and generations from PokéAPI.", 3);
    await getFilterMetadata();
    setLoading("Organizing the globe...", "Grouping generations and evolution families.", 3.5);
    await loadEvolutionChains();
    setLoading("Finding alternate forms...", "Mega Evolutions, regional forms and other forms from PokéAPI.", 3.8);
    allPokemonList = decorateBaseList(allPokemonList);
    allPokemonList = allPokemonList.concat(buildFormList(allPokemonList));
    pokemonList = allPokemonList;
    setLoading("Preparing sprites...", `Found ${pokemonList.length} Pokémon and forms.`, 4);
    const failedSprites = await preloadSprites();
    if (failedSprites.size) { // forms without any picture can't be played
      allPokemonList = allPokemonList.filter(p => !(p.isForm && failedSprites.has(p.id)));
      pokemonList = allPokemonList;
    }
    // Apply the active generation/type filters on the very first load too.
    // Previously the initial startup rendered allPokemonList directly and only
    // applied grouped-form deduplication after a filter control changed.
    hideLoading();
    applyFilters();
  } catch (error) {
    console.error(error); hideLoading();
    alert("Could not load PokéAPI. Please check your internet connection and try again.");
  }
}

function finishGame() {
  gameRunning = false; clearInterval(timerId);
  const gen = $("generationFilter").value, type = $("typeFilter").value;
  const scope = [];
  if (gen !== "all") scope.push(`Generation ${gen}`);
  if (type !== "all") scope.push(`${typeName(type)} type`);
  const total = pokemonList.length;
  $("congratsText").innerHTML = `You discovered all <strong>${total}</strong> Pokémon${scope.length ? ` (${scope.join(" • ")})` : ""}!<br>Time: <strong>${$("timer").textContent}</strong> · Attempts: <strong>${attempts}</strong><br><span style="opacity:.75">Congratulations, Pokémon Master! 🎉</span>`;
  $("congrats").classList.remove("hidden");
  launchConfetti();
}

function submitPokemon() {
  if (!gameRunning) return;
  const input = $("pokemonInput").value.trim();
  if (!input) return;
  setLastTyped(input);
  attempts++;
  const normalized = normalizeName(input);
  let pokemon = pokemonByName.get(normalized);
  const commonNameEntry = resolveCommonNameEntry(normalized);
  if (commonNameEntry) pokemon = commonNameEntry;
  // Specific alternate-form names are accepted for grouped species too. If a
  // type filter splits forms, the exact form name selects that exact entry;
  // otherwise it resolves to the one shared species discovery.
  const specificFormEntry = resolveSpecificFormEntry(normalized);
  if (specificFormEntry) pokemon = specificFormEntry;
  const nationalPokemon = allPokemonByName.get(normalized);

  if (!pokemon && nationalPokemon) {
    message("This Pokémon doesn't belong here.", "bad");
    $("pokemonInput").select();
    render();
    return;
  }

  if (!pokemon) {
    const closePokemon = findClosePokemon(input);
    if (closePokemon) {
      message("Are you sure you spelled that correctly?", "bad");
      $("pokemonInput").select();
      render();
      return;
    }
    message("That isn't a Pokémon. Check the name and try again.", "bad");
    $("pokemonInput").select();
    render();
    return;
  }

  if (encountered.has(pokemon.id)) {
    message(`${pokemon.displayName} was already encountered!`, "bad");
    focusGlobeOnPokemon(pokemon.id); // same function used when a Pokémon is discovered: rotate the globe to it
    $("pokemonInput").select(); render(); return;
  }

  if (globeHint && globeHint.id === pokemon.id) globeHint = null;
  encountered.set(pokemon.id, { id: pokemon.id, name: pokemon.displayName, sprite: spriteURL(pokemon.id) });
  // If a form category is disabled, typing the base species discovers its
  // Mega/Gigantamax entries too, while their individual globe markers remain visible.
  if (!pokemon.isForm) {
    const baseSpeciesId = pokemon.id;
    for (const form of pokemonList) {
      if (!form.isForm || encountered.has(form.id)) continue;
      const meta = formMeta.get(form.id) || {};
      const kind = meta.kind || form.kind;
      if (Number(meta.speciesId || form.speciesId) !== baseSpeciesId) continue;
      if ((kind === "mega" && !megaEvolutionsEnabled) || (kind === "gmax" && !gigantamaxEnabled)) {
        encountered.set(form.id, { id: form.id, name: form.displayName, sprite: spriteURL(form.id) });
      }
    }
  }
  $("pokemonInput").value = "";
  $("lastFound").textContent = `Last: ${dexNumber(pokemon.id)} ${pokemon.displayName}`;
  updateMiniHUD();
  message(`✓ ${dexNumber(pokemon.id)} ${pokemon.displayName} encountered!`, "good");
  if (view === "globe") focusGlobeOnPokemon(pokemon.id);
  render();
  if (pokemonList.length && encountered.size >= pokemonList.length) finishGame();
}

function giveUp() {
  if (!gameRunning || gaveUp) return;
  gaveUp = true; gameRunning = false;
  clearInterval(timerId);
  $("pokemonInput").value = "";
  message(`Game over! ${pokemonList.length - encountered.size} Pokémon were still undiscovered.`, "bad");
  render();
}
function resetGame() {
  hideCongrats(); resetHints();
  gaveUp = false; encountered = new Map(); attempts = 0; gameRunning = true;
  closeDataSheet(); $("timer").textContent = "00:00";
  $("pokemonInput").value = ""; $("message").textContent = ""; $("lastFound").textContent = ""; setLastTyped("");
  render(); startClock(); $("pokemonInput").focus();
}
