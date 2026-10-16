/* Near or Away: round flow and rendering. */
let target = null, ranks = new Map(), guesses = [], solved = false, gaveUpNA = false;
const $n = id => document.getElementById(id);

// distance from center (0..1) on a log scale, so the first ranks get most of the room
const radiusOf = rank => rank === 1 ? 0 : 0.1 + 0.88 * Math.log(rank) / Math.log(Math.max(2, dex.length));
const AREA = 46;   // marker radius at distance 1, in % of the board width

function newRound() {
  target = dex[Math.floor(Math.random() * dex.length)];
  ranks = rankAgainst(target); guesses = []; solved = false; gaveUpNA = false;
  const t = $n("target");
  t.style.setProperty("--rn", (radiusOf(NEAR_RANK) * AREA * 2) + "%");
  t.style.setProperty("--rf", (radiusOf(FAR_RANK) * AREA * 2) + "%");
  $n("msg").textContent = ""; $n("guess").value = ""; $n("guess").disabled = false; $n("guess").focus();
  render();
}

function sprite(p) { return `<img src="${OFFICIAL}${p.id}.png" alt="${escapeHTML(p.displayName)}" onerror="this.onerror=null;this.src='${SPRITES}${p.id}.png'">`; }

function render() {
  const center = $n("center");
  const reveal = solved || gaveUpNA;
  center.className = "na-center" + (solved ? " z-correct" : "");
  center.innerHTML = reveal ? sprite(target) : "?";
  $n("markers").innerHTML = guesses.filter(g => g.rank !== 1).map(g => {
    const a = g.p.id * 2.399963, r = radiusOf(g.rank) * AREA;
    return `<div class="na-marker z-${zoneOf(g.rank)}" style="left:${50 + r * Math.cos(a)}%;top:${50 + r * Math.sin(a)}%" title="${escapeHTML(g.p.displayName)} · #${g.rank}">${sprite(g.p)}</div>`;
  }).join("");
  const last = guesses[guesses.length - 1];
  $n("why").textContent = last && !solved ? `${last.p.displayName}: ${last.why.length ? last.why.join(" • ") : "nothing in common"}` : "";
  const sorted = guesses.slice().sort((a, b) => a.rank - b.rank);
  
  hideFloatingHint();

  $n("list").innerHTML = sorted.map(g => `
    <li class="z-${zoneOf(g.rank)}${g === last ? " latest" : ""}">
      ${sprite(g.p)}
      <span class="nm">
        ${escapeHTML(g.p.displayName)}
        ${createHintHistoryHTML(g.why)}
      </span>
      <span class="rk">#${g.rank}</span>
       <span class="bar">
       <b style="width:${Math.max(3, 100 * (1 - Math.log(g.rank) / Math.log(dex.length)))}%"></b>
      </span>
    </li>
  `).join("");

}

function closestName(v) {
  if (v.length < 3) return null;
  let best = null, bd = Infinity;
  for (const [k, p] of dexByName) {
    if (Math.abs(k.length - v.length) > 2) continue;
    const d = levenshteinDistance(v, k);
    if (d <= Math.max(1, Math.floor(v.length * 0.25)) && d < bd) { best = p; bd = d; }
  }
  return best;
}

function submitGuess() {
  if (solved || gaveUpNA) return;
  const raw = $n("guess").value.trim(); if (!raw) return;
  const key = normalizeName(raw), p = dexByName.get(key);
  if (!p) { const c = closestName(key); say(c ? `Not found. Did you mean ${c.displayName}?` : "That isn't a Pokémon.", "bad"); return; }
  if (guesses.some(g => g.p.id === p.id)) { say(`${p.displayName} was already guessed.`, "bad"); $n("guess").select(); return; }
  const rank = ranks.get(p.id), why = p.id === target.id ? [] : similarity(p, target).why;
  guesses.push({ p, rank, why }); $n("guess").value = "";
  if (rank === 1) { solved = true; $n("guess").disabled = true; say(`🎉 It's ${p.displayName}! Found in ${guesses.length} guess${guesses.length > 1 ? "es" : ""}.`, "good"); }
  else say(`${p.displayName} — #${rank} of ${dex.length}`, zoneOf(rank) === "away" ? "bad" : "good");
  render();
}

function say(t, cls) { const m = $n("msg"); m.textContent = t; m.className = "na-msg " + (cls || ""); }
function giveUp() { if (solved || gaveUpNA) return; gaveUpNA = true; $n("guess").disabled = true; say(`It was ${target.displayName}.`, "bad"); render(); }

async function startNear() {
  try {
    await buildDex(f => { $n("loadingText").textContent = `Loading Pokémon data… ${Math.round(f * 100)}%`; });
    $n("loading").classList.add("hidden");
    newRound();
  } catch (e) { console.error(e); $n("loadingText").textContent = "Could not load PokéAPI. Check your connection and reload."; }
}



function createHintHistoryHTML(hints) {
  const escapeAttr = value =>
    String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const messages = hints && hints.length
    ? hints
    : ["nothing in common"];

  return `
    <span class="na-hint-history"
          tabindex="0"
          role="button"
          aria-label="View hints"
          data-hints="${escapeAttr(messages.join(" • "))}">
      ⓘ
    </span>
  `;
}


let activeHintTrigger = null;
let floatingHint = null;

function getFloatingHint() {
  if (!floatingHint) {
    floatingHint = document.createElement("div");
    floatingHint.className = "na-floating-hint";
    floatingHint.setAttribute("role", "tooltip");
    document.body.appendChild(floatingHint);

    floatingHint.addEventListener("pointerleave", event => {
      if (activeHintTrigger &&
          activeHintTrigger.closest("li")?.contains(event.relatedTarget)) {
        return;
      }

      hideFloatingHint();
    });
  }

  return floatingHint;
}

function positionFloatingHint(trigger) {
  const tip = getFloatingHint();
  const row = trigger.closest("li");
  if (!row) return;

  const rect = row.getBoundingClientRect();

  tip.style.display = "block";

  const tipRect = tip.getBoundingClientRect();
  const margin = 12;

  let left = Math.max(
    margin,
    Math.min(rect.left, window.innerWidth - tipRect.width - margin)
  );

  let top = rect.top - tipRect.height;

  if (top < margin) {
    top = Math.min(
      rect.bottom,
      window.innerHeight - tipRect.height - margin
    );
  }

  tip.style.left = `${left}px`;
  tip.style.top = `${Math.max(margin, top)}px`;
}

function showFloatingHint(trigger) {
  if (!trigger) return;

  activeHintTrigger = trigger;

  const tip = getFloatingHint();
  tip.textContent = (trigger.dataset.hints || "nothing in common")
    .replace(/ • /g, "\n");

  positionFloatingHint(trigger);
}

function hideFloatingHint() {
  if (floatingHint) {
    floatingHint.style.display = "none";
  }

  activeHintTrigger = null;
}

const hintList = $n("list");

hintList.addEventListener("pointerover", event => {
  const row = event.target.closest("li");
  if (!row || !hintList.contains(row)) return;

  const trigger = row.querySelector(".na-hint-history");
  if (trigger && trigger !== activeHintTrigger) {
    showFloatingHint(trigger);
  }
});

hintList.addEventListener("pointerout", event => {
  const row = event.target.closest("li");

  if (!row || !activeHintTrigger ||
      !row.contains(activeHintTrigger)) return;

  if (event.relatedTarget &&
      (row.contains(event.relatedTarget) ||
       floatingHint?.contains(event.relatedTarget))) {
    return;
  }

  hideFloatingHint();
});

hintList.addEventListener("focusin", event => {
  const trigger = event.target.closest(".na-hint-history");
  if (trigger) showFloatingHint(trigger);
});

hintList.addEventListener("focusout", event => {
  if (!event.relatedTarget ||
      !event.relatedTarget.classList?.contains("na-hint-history")) {
    hideFloatingHint();
  }
});

window.addEventListener("scroll", () => {
  if (activeHintTrigger) {
    positionFloatingHint(activeHintTrigger);
  }
}, true);

window.addEventListener("resize", () => {
  if (activeHintTrigger) {
    positionFloatingHint(activeHintTrigger);
  }
});



$n("guess").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); submitGuess(); } });
$n("newGame").addEventListener("click", newRound);
$n("giveUp").addEventListener("click", giveUp);
const themeSaved = storage.get("pokemon-quiz-theme");
if (themeSaved === "light") document.body.classList.add("light-theme");
startNear();

