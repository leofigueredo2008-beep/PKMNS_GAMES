/* ======================================================================
 * state.js
 * Mutable game state shared by all modules (classic scripts share one global scope).
 * ====================================================================== */

let pokemonList = [];
let allPokemonList = [];
let pokemonByName = new Map();
let allPokemonByName = new Map();
let pokemonTypes = new Map();
let pokemonGenerations = new Map();
let pokemonEvolutionChains = new Map();
let encountered = new Map();
let attempts = 0;
let startedAt = 0;
let timerId = null;
let gameRunning = false;
let difficulty = "normal";
let view = "globe";
let globeColors = storage.get("pokemon-quiz-globe-colors") !== "off"; // player preference

// Enabled by default to preserve the current quiz pool. When disabled, forms
// are represented by their base Pokémon and are not separate discoveries.
let megaEvolutionsEnabled = storage.get("pokemon-quiz-mega-evolutions") !== "off";
let gigantamaxEnabled = storage.get("pokemon-quiz-gigantamax") !== "off";
// colours are always off in Hard mode, otherwise they follow the preference
function colorsVisible() { return globeColors && difficulty !== "hard"; }

let gaveUp = false;

let hintsLeft = HINTS_PER_GAME, hintLog = [], hintedIds = new Set(), hintToken = 0, hintBusy = false;
let globeHint = null, hintPulseRaf = 0;   // pulsing "?" marker on the hinted (undiscovered) spot
let globeRotation = { x: -0.12, y: 0.2 };
let globeZoom = 1;
let globeDragging = false;
let globeLast = { x: 0, y: 0 };
let globeAnimation = 0;
let globeHits = [];
let globeFocus = null;
let globeFocusId = null;
const globeImageCache = new Map();
const pokemonDetailsCache = new Map();
let selectedPokemonId = null;
let activeCryAudio = null;
let globePointerStart = { x: 0, y: 0 };
let globePointerMoved = false;

const pokemonRegions = new Map();

const formMeta = new Map();   // form id -> {speciesId, baseName, kind}

let speciesMeta = new Map();  // species id -> {s: species name, v: [[formName, formId], ...]}

let globeScale = 1;

const spriteOverride = new Map();

let globeTerritory = null;

let globeDistribution = new Map();

const speciesColorCache = new Map();
const evolutionChainCache = new Map();
