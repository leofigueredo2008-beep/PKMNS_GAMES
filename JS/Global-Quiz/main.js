/* ======================================================================
 * main.js
 * Event wiring and app bootstrap. Loaded last.
 * ====================================================================== */

$("pokemonInput").addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); submitPokemon() }
});
$("normalMode").addEventListener("click", () => setDifficulty("normal"));
$("hardMode").addEventListener("click", () => setDifficulty("hard"));
$("megaToggle").addEventListener("click", () => {
  megaEvolutionsEnabled = !megaEvolutionsEnabled;
  try { storage.set("pokemon-quiz-mega-evolutions", megaEvolutionsEnabled ? "on" : "off"); } catch (e) { }
  resetGame(); updateSettingsUI();
});
$("gigantamaxToggle").addEventListener("click", () => {
  gigantamaxEnabled = !gigantamaxEnabled;
  try { storage.set("pokemon-quiz-gigantamax", gigantamaxEnabled ? "on" : "off"); } catch (e) { }
  resetGame(); updateSettingsUI();
});
$("colorsToggle").addEventListener("click", () => {
  if (difficulty === "hard") return;
  globeColors = !globeColors;
  try { storage.set("pokemon-quiz-globe-colors", globeColors ? "on" : "off"); } catch (e) { }
  updateSettingsUI(); updateGenLegend(); drawGlobe();
});
$("settingsBtn").addEventListener("click", toggleSettings);
$("darkTheme").addEventListener("click", () => setTheme("dark"));
$("lightTheme").addEventListener("click", () => setTheme("light"));
setupGlobe();
setupPokemonCardClicks();
$("generationFilter").addEventListener("change", applyFilters);
$("typeFilter").addEventListener("change", applyFilters);
$("newGameBtn").addEventListener("click", startGame);
$("giveUpBtn").addEventListener("click", giveUp);
$("clearBtn").addEventListener("click", resetGame);
$("congratsAgain").addEventListener("click", resetGame);
$("hintBtn").addEventListener("click", useHint);
$("hintList").addEventListener("click", e => {
  const li = e.target.closest ? e.target.closest("li[data-id]") : null;
  if (!li || li.classList.contains("found")) return;
  const id = Number(li.dataset.id);
  if (!encountered.has(id)) { $("settingsPanel").classList.remove("open"); pointToHint(id, 6000); }
});
$("congratsClose").addEventListener("click", hideCongrats);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("congrats").classList.contains("hidden")) hideCongrats(); });

const savedTheme = storage.get("pokemon-quiz-theme");
if (savedTheme === "light") document.body.classList.add("light-theme");
updateSettingsUI();
startGame();
