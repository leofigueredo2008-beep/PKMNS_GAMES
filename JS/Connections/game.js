/* Connections: link Pokémon by one shared characteristic, using the Near or Away Pokédex pool. */
const $c = id => document.getElementById(id);
let cnCurrent = null;
let cnChain = [];
let cnOptions = [];
let cnTrait = null;
let cnScore = 0;
let cnStreak = 0;
let cnLocked = false;

const cnTraits = [
  { id: "type", title: (p, value) => "the " + typeName(value) + " type", values: p => p.types || [], match: (p, value) => (p.types || []).includes(value), display: value => typeName(value) + " type" },
  { id: "evolution", title: () => "the same evolution line", value: p => p.f?.c || "", match: (p, value) => !!value && value === (p.f?.c || ""), display: () => "evolution line" },
  { id: "region", title: (p, value) => "the " + (GEN_REGION_NAMES[value] || "same") + " region", value: p => p.region, match: (p, value) => p.region === value, display: value => (GEN_REGION_NAMES[value] || "same") + " region" },
  { id: "color", title: (p, value) => "the " + value + " color", value: p => p.f?.col || "", match: (p, value) => !!value && p.f?.col === value, display: value => value + " color" },
  { id: "shape", title: p => "a similar body shape", value: p => p.f?.sh || "", match: (p, value) => !!value && p.f?.sh === value, display: () => "body shape" },
  { id: "egg", title: (p, value) => "the " + value.replace(/-/g, " ") + " egg group", values: p => p.f?.eg || [], match: (p, value) => (p.f?.eg || []).includes(value), display: value => value.replace(/-/g, " ") + " egg group" },
  { id: "habitat", title: (p, value) => "the " + value.replace(/-/g, " ") + " habitat", value: p => p.f?.hb || "", match: (p, value) => !!value && p.f?.hb === value, display: value => value.replace(/-/g, " ") + " habitat" },
  { id: "genus", title: (p, value) => "the " + value + " Pokémon category", value: p => p.f?.gn || "", match: (p, value) => !!value && p.f?.gn === value, display: value => value + " Pokémon category" }
];

function cnPick(list) { return list[Math.floor(Math.random() * list.length)]; }
function cnShuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function cnEsc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}
function cnSprite(p) {
  return `<img src="${OFFICIAL}${p.id}.png" alt="${cnEsc(p.displayName)}" loading="lazy" onerror="this.onerror=null;this.src='${SPRITES}${p.id}.png'">`;
}
function cnCandidatesForTrait(trait, current) {
  const possibleValues = trait.values ? trait.values(current) : [trait.value(current)];
  return possibleValues.filter(value => value !== "" && value !== null && value !== undefined).flatMap(value => {
    const matches = dex.filter(p => p.id !== current.id && trait.match(p, value));
    return matches.length ? [{ trait, value, matches }] : [];
  });
}
function cnBuildRound() {
  cnLocked = false;
  const historyIds = new Set(cnChain.map(p => p.id));
  const traits = cnShuffle(cnTraits.flatMap(trait => cnCandidatesForTrait(trait, cnCurrent)));
  let selected = null;
  for (const candidate of traits) {
    const correctPool = candidate.matches.filter(p => !historyIds.has(p.id));
    const wrongPool = dex.filter(p => p.id !== cnCurrent.id && !historyIds.has(p.id) && !candidate.trait.match(p, candidate.value));
    if (correctPool.length && wrongPool.length >= 2) {
      selected = { ...candidate, correct: cnPick(correctPool), wrong: cnShuffle(wrongPool).slice(0, 2) };
      break;
    }
  }
  if (!selected) {
    cnChain = [cnCurrent];
    cnBuildRound();
    return;
  }
  cnTrait = selected;
  cnOptions = cnShuffle([selected.correct, ...selected.wrong]);
  $c("clue").textContent = selected.trait.title(cnCurrent, selected.value);
  $c("options").innerHTML = cnOptions.map(p => `
    <button class="cn-option" type="button" data-id="${p.id}" aria-label="Choose ${cnEsc(p.displayName)}">
      ${cnSprite(p)}<span>${cnEsc(p.displayName)}</span>
    </button>
  `).join("");
  $c("options").querySelectorAll(".cn-option").forEach(button => {
    button.addEventListener("click", () => cnChoose(Number(button.dataset.id), button));
  });
  $c("score").textContent = cnScore;
  $c("streak").textContent = cnStreak;
  $c("chainCount").textContent = cnChain.length + (cnChain.length === 1 ? " Pokémon" : " Pokémon");
  cnRenderChain();
}
function cnRenderChain() {
  $c("chain").innerHTML = cnChain.map((p, i) => `
    <div class="cn-pokemon${i === cnChain.length - 1 ? " current" : ""}">
      ${cnSprite(p)}
      <div class="cn-pokemon-info"><span class="cn-pokemon-name">${cnEsc(p.displayName)}</span><span class="cn-pokemon-sub">${i === 0 ? "Starting Pokémon" : i === cnChain.length - 1 ? "Current link" : "Connection " + i}</span></div>
      ${i < cnChain.length - 1 ? '<span class="cn-link-arrow">↓</span>' : ""}
    </div>
  `).join("");
  $c("chain").scrollTop = $c("chain").scrollHeight;
}
function cnChoose(id, button) {
  if (cnLocked) return;
  const chosen = cnOptions.find(p => p.id === id);
  if (!chosen) return;
  cnLocked = true;
  $c("options").querySelectorAll(".cn-option").forEach(b => { b.disabled = true; });
  if (chosen.id !== cnTrait.correct.id) {
    button.classList.add("wrong");
    const correctButton = $c("options").querySelector(`[data-id="${cnTrait.correct.id}"]`);
    if (correctButton) correctButton.classList.add("correct");
    cnStreak = 0;
    $c("streak").textContent = cnStreak;
    $c("message").className = "cn-message bad";
    $c("message").textContent = "Not quite! The connection was " + cnTrait.trait.display(cnTrait.value) + ". Try this link again.";
    window.setTimeout(() => {
      if (cnCurrent) cnBuildRound();
    }, 1050);
    return;
  }
  button.classList.add("correct");
  cnChain.push(chosen);
  cnCurrent = chosen;
  cnScore++;
  cnStreak++;
  $c("message").className = "cn-message good";
  $c("message").textContent = "Connected! " + cnTrait.trait.display(cnTrait.value) + " links these Pokémon.";
  cnRenderChain();
  $c("score").textContent = cnScore;
  $c("streak").textContent = cnStreak;
  $c("chainCount").textContent = cnChain.length + " Pokémon";
  window.setTimeout(cnBuildRound, 650);
}
function cnNewGame() {
  cnScore = 0;
  cnStreak = 0;
  cnCurrent = cnPick(dex);
  cnChain = [cnCurrent];
  $c("message").className = "cn-message";
  $c("message").textContent = "Find a Pokémon that matches the clue.";
  cnBuildRound();
}
async function startConnections() {
  try {
    await buildDex(f => { $c("loadingText").textContent = "Loading Pokémon data… " + Math.round(f * 100) + "%"; });
    $c("loading").classList.add("hidden");
    cnNewGame();
  } catch (error) {
    console.error(error);
    $c("loadingText").textContent = "Could not load Pokémon data. Check your connection and reload.";
  }
}
$c("newGame").addEventListener("click", () => { if (dex.length) cnNewGame(); });
startConnections();
