/* Connections: discover the single shared trait without being told what it is. */
const $c = id => document.getElementById(id);
let cnCurrent = null, cnChain = [], cnOptions = [], cnTrait = null;
let cnScore = 0, cnStreak = 0, cnLocked = false;
const cnDetailCache = new Map();
const CN_EASY_ROUNDS = 10;
const CN_INTERMEDIATE_ROUNDS = 10;

const cnTraits = [
  { id: "type", tier: 0, value: p => p.types || [], match: (p, v) => (p.types || []).includes(v), label: v => typeName(v) + " type" },
  { id: "evolution", tier: 0, value: p => p.f?.c || "", match: (p, v) => !!v && p.f?.c === v, label: () => "same evolution line" },
  { id: "color", tier: 0, value: p => p.f?.col || "", match: (p, v) => !!v && p.f?.col === v, label: v => v + " color" },
  { id: "shape", tier: 0, value: p => p.f?.sh || "", match: (p, v) => !!v && p.f?.sh === v, label: () => "similar body shape" },
  { id: "habitat", tier: 1, value: p => p.f?.hb || "", match: (p, v) => !!v && p.f?.hb === v, label: v => v.replace(/-/g, " ") + " habitat" },
  { id: "region", tier: 1, value: p => p.region ?? null, match: (p, v) => v != null && p.region != null && p.region === v, label: v => (GEN_REGION_NAMES[v] || "same") + " region" },
  { id: "egg", tier: 1, value: p => p.f?.eg || [], match: (p, v) => (p.f?.eg || []).includes(v), label: v => v.replace(/-/g, " ") + " egg group" },
  { id: "genus", tier: 1, value: p => p.f?.gn || "", match: (p, v) => !!v && p.f?.gn === v, label: v => v + " Pokémon category" },
  { id: "move", tier: 2, value: p => cnDetails(p).then(d => d.moves), async: true, label: v => "can learn " + v.replace(/-/g, " ") },
  { id: "ability", tier: 2, value: p => cnDetails(p).then(d => d.abilities), async: true, label: v => "shares the " + v.replace(/-/g, " ") + " ability" },
  ...["attack", "defense", "special-attack", "special-defense", "speed"].map(stat => ({
    id: "stat:" + stat, tier: 2, async: true, stat,
    label: v => "same " + stat.replace("special-", "special ").replace(/-/g, " ") + " stat value (" + v + ")"
  }))
];
function cnPick(a) { return a[Math.floor(Math.random() * a.length)]; }
function cnShuffle(a) { const b = a.slice(); for (let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; }
function cnEsc(v) { return String(v ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[ch]); }
function cnSprite(p) { return `<img src="${OFFICIAL}${p.id}.png" alt="${cnEsc(p.displayName)}" loading="lazy" onerror="this.onerror=null;this.src='${SPRITES}${p.id}.png'">`; }
function cnTier() { return cnScore < CN_EASY_ROUNDS ? 0 : cnScore < CN_EASY_ROUNDS + CN_INTERMEDIATE_ROUNDS ? 1 : 2; }
function cnTierName() { return ["Easy","Intermediate","Hard"][cnTier()]; }
async function cnDetails(p) {
  if (cnDetailCache.has(p.id)) return cnDetailCache.get(p.id);
  const task = (async () => {
    const r = await fetch(`${API}/pokemon/${p.id}`);
    if (!r.ok) throw new Error("Could not load Pokémon battle data");
    const d = await r.json();
    return {
      moves: [...new Set((d.moves || []).map(m => m.move.name))],
      abilities: [...new Set((d.abilities || []).map(a => a.ability.name))],
      stats: Object.fromEntries((d.stats || []).map(s => [s.stat.name, s.base_stat]))
    };
  })();
  cnDetailCache.set(p.id, task);
  try { return await task; } catch (e) { cnDetailCache.delete(p.id); throw e; }
}
function cnValues(trait, p, details) {
  if (trait.id === "move") return details.moves;
  if (trait.id === "ability") return details.abilities;
  if (trait.stat) return [details.stats[trait.stat]];
  const value = trait.value(p);
  return Array.isArray(value) ? value : [value];
}
function cnTraitMatches(trait, a, b, da, db) {
  const av = cnValues(trait, a, da).filter(v => v !== "" && v !== null && v !== undefined && !(typeof v === "number" && !Number.isFinite(v)));
  const bv = cnValues(trait, b, db).filter(v => v !== "" && v !== null && v !== undefined && !(typeof v === "number" && !Number.isFinite(v)));
  return av.some(v => bv.includes(v));
}
async function cnDataFor(p, tier) { return tier === 2 ? cnDetails(p) : null; }
async function cnFindConnection(a, b, tier, da, db) {
  for (const trait of cnTraits.filter(t => t.tier <= tier).sort((a, b) => b.tier - a.tier)) {
    if (trait.tier === 2 && tier < 2) continue;
    if (cnTraitMatches(trait, a, b, da, db)) {
      const av = cnValues(trait, a, da), bv = cnValues(trait, b, db);
      const value = av.find(v => v !== "" && v !== null && v !== undefined && bv.includes(v));
      return { trait, value };
    }
  }
  return null;
}
async function cnConnectionOptions(current, tier, historyIds) {
  const candidates = cnShuffle(dex.filter(p => p.id !== current.id && !historyIds.has(p.id)));
  // Hard-mode traits need battle data. Sample a broad pool to avoid requesting all 1,000+ entries.
  // Use a larger hard-mode pool: after excluding Pokémon already in the chain,
  // a small random sample may not contain two valid distractors.
  const pool = tier === 2 ? candidates.slice(0, 240) : candidates;
  const currentDetails = tier === 2 ? await cnDetails(current) : null;
  const candidateRows = [];
  for (let i = 0; i < pool.length; i += tier === 2 ? 12 : 10000) {
    const batch = pool.slice(i, i + (tier === 2 ? 12 : 10000));
    const rows = await Promise.all(batch.map(async p => {
      try { return { p, details: tier === 2 ? await cnDetails(p) : null }; }
      catch { return null; }
    }));
    candidateRows.push(...rows.filter(Boolean));
  }
  const valid = [];
  for (const row of candidateRows) {
    const connection = await cnFindConnection(current, row.p, tier, currentDetails, row.details);
    if (connection) valid.push({ ...row, connection });
  }
  if (!valid.length) return null;
  // Select a valid answer, then ensure neither distractor has ANY valid connection to the current Pokémon.
  for (const answer of cnShuffle(valid)) {
    const distractors = [];
    for (const row of cnShuffle(candidateRows)) {
      if (row.p.id === answer.p.id) continue;
      const connection = await cnFindConnection(current, row.p, tier, currentDetails, row.details);
      if (!connection) distractors.push(row.p);
      if (distractors.length === 2) break;
    }
    if (distractors.length === 2) return { answer: answer.p, connection: answer.connection, options: cnShuffle([answer.p, ...distractors]) };
  }
  return null;
}
function cnSetMessage(text, type = "") { $c("message").className = "cn-message" + (type ? " " + type : ""); $c("message").textContent = text; }
async function cnBuildRound() {
  cnLocked = true;
  $c("options").innerHTML = "";
  $c("tierProgress").textContent = cnTier() === 0
    ? `Easy ${cnScore + 1}/${CN_EASY_ROUNDS}`
    : cnTier() === 1 ? `Intermediate ${cnScore - CN_EASY_ROUNDS + 1}/${CN_INTERMEDIATE_ROUNDS}` : "Hard mode";
  cnSetMessage("Finding a unique connection…");
  const historyIds = new Set(cnChain.map(p => p.id));
  try {
    let round = await cnConnectionOptions(cnCurrent, cnTier(), historyIds);
    if (!round) {
      // If the remaining chain blocks every candidate, start a fresh chain with the same current Pokémon.
      cnChain = [cnCurrent];
      round = await cnConnectionOptions(cnCurrent, cnTier(), new Set([cnCurrent.id]));
    }
    if (!round) throw new Error("No unique connection could be found for this Pokémon.");
    cnTrait = { correct: round.answer, trait: round.connection.trait, value: round.connection.value };
    cnOptions = round.options;
    $c("options").innerHTML = cnOptions.map(p => `
      <button class="cn-option" type="button" data-id="${p.id}" aria-label="Choose ${cnEsc(p.displayName)}">
        ${cnSprite(p)}<span>${cnEsc(p.displayName)}</span>
      </button>`).join("");
    $c("options").querySelectorAll(".cn-option").forEach(button => button.addEventListener("click", () => cnChoose(Number(button.dataset.id), button)));
    cnLocked = false;
    cnRenderChain();
    $c("score").textContent = cnScore;
    $c("streak").textContent = cnStreak;
    $c("chainCount").textContent = cnChain.length + " Pokémon";
    cnSetMessage("Which Pokémon connects? Look closely at the three options.");
  } catch (error) {
    console.error(error);
    cnSetMessage("Could not create a unique connection. Start a new game to try again.", "bad");
  }
}
function cnRenderChain() {
  $c("chain").innerHTML = cnChain.map((p, i) => `
    <div class="cn-pokemon${i === cnChain.length - 1 ? " current" : ""}">
      ${cnSprite(p)}
      <div class="cn-pokemon-info"><span class="cn-pokemon-name">${cnEsc(p.displayName)}</span><span class="cn-pokemon-sub">${i === 0 ? "Starting Pokémon" : i === cnChain.length - 1 ? "Current link" : "Connection " + i}</span></div>
      ${i < cnChain.length - 1 ? '<span class="cn-link-arrow">↓</span>' : ""}
    </div>`).join("");
  $c("chain").scrollTop = $c("chain").scrollHeight;
}
async function cnChoose(id, button) {
  if (cnLocked) return;
  const chosen = cnOptions.find(p => p.id === id);
  if (!chosen) return;
  cnLocked = true;
  $c("options").querySelectorAll(".cn-option").forEach(b => { b.disabled = true; });
  if (chosen.id !== cnTrait.correct.id) {
    button.classList.add("wrong");
    cnStreak = 0;
    $c("streak").textContent = cnStreak;
    cnSetMessage("Not this one. Try to spot the shared characteristic and choose again.", "bad");
    window.setTimeout(cnBuildRound, 900);
    return;
  }
  button.classList.add("correct");
  cnChain.push(chosen);
  cnCurrent = chosen;
  cnScore++;
  cnStreak++;
  cnSetMessage(chosen.displayName + " connects to " + cnChain[cnChain.length - 2].displayName + " through: " + cnTrait.trait.label(cnTrait.value) + ".", "good");
  cnRenderChain();
  $c("score").textContent = cnScore;
  $c("streak").textContent = cnStreak;
  $c("chainCount").textContent = cnChain.length + " Pokémon";
  window.setTimeout(cnBuildRound, 1500);
}
function cnNewGame() {
  cnScore = 0; cnStreak = 0; cnCurrent = cnPick(dex); cnChain = [cnCurrent];
  cnSetMessage("Look for the hidden connection between the Pokémon.");
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
