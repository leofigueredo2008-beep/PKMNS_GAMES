/* ======================================================================
 * config.js
 * Constants and static data (API URLs, colors, form rules, regions).
 * ====================================================================== */

const API = "https://pokeapi.co/api/v2";
const OFFICIAL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/";
const SPRITES = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";
const DEX_SIZE = 1025;

// Mapeamento de cores vibrantes para as fronteiras de cada geração
const GENERATION_COLORS = {
  1: { stroke: 'rgba(255, 75, 75, 0.90)', fill: 'rgba(255, 75, 75, 0.30)' },   // Gen 1 (Vermelho Kanto)
  2: { stroke: 'rgba(255, 215, 0, 0.90)', fill: 'rgba(255, 215, 0, 0.30)' },   // Gen 2 (Dourado Johto)
  3: { stroke: 'rgba(0, 230, 118, 0.90)', fill: 'rgba(0, 230, 118, 0.30)' },   // Gen 3 (Verde Hoenn)
  4: { stroke: 'rgba(0, 229, 255, 0.90)', fill: 'rgba(0, 229, 255, 0.30)' },   // Gen 4 (Cyan Sinnoh)
  5: { stroke: 'rgba(213, 0, 249, 0.90)', fill: 'rgba(213, 0, 249, 0.30)' },   // Gen 5 (Roxo Unova)
  6: { stroke: 'rgba(255, 64, 129, 0.90)', fill: 'rgba(255, 64, 129, 0.30)' },  // Gen 6 (Rosa Kalos)
  7: { stroke: 'rgba(255, 145, 0, 0.90)', fill: 'rgba(255, 145, 0, 0.30)' },   // Gen 7 (Laranja Alola)
  8: { stroke: 'rgba(61, 90, 255, 0.90)', fill: 'rgba(61, 90, 255, 0.30)' },   // Gen 8 (Azul Galar)
  9: { stroke: 'rgba(29, 233, 182, 0.90)', fill: 'rgba(29, 233, 182, 0.30)' },  // Gen 9 (Turquesa Paldea)
  10: { stroke: 'rgba(184, 115, 60, 0.92)', fill: 'rgba(184, 115, 60, 0.32)' },  // Hisui (Cobre) - sub-region of Gen 8
  11: { stroke: 'rgba(255, 105, 180, 0.96)', fill: 'rgba(255, 105, 180, 0.34)' } // Extras: all alternate forms
};

const GEN_REGION_NAMES = { 1: "Kanto", 2: "Johto", 3: "Hoenn", 4: "Sinnoh", 5: "Unova", 6: "Kalos", 7: "Alola", 8: "Galar", 9: "Paldea", 10: "Hisui", 11: "Extras" };

const HINTS_PER_GAME = 3;

// ===== ALTERNATE FORMS (Mega, regional, Gigantamax, Rotom/Oricorio/Castform-style forms...) =====
// Forms are read from PokéAPI (/pokemon-species -> varieties, ids 10001+). Cosmetic/event-only entries listed here are skipped.
const FORM_EXCLUDE = /(-totem|-cap$|-starter$|-cosplay$|-rock-star$|-belle$|-pop-star$|-phd$|-libre$)/;
const REGION_ADJ = { alola: "Alolan", galar: "Galarian", hisui: "Hisuian", paldea: "Paldean" };
const REGION_GEN = { alola: 7, galar: 8, hisui: 8, paldea: 9 };

// Globe/legend regions: 1-9 = generations, 10 = Hisui. Hisui is part of Generation VIII (the generation filter
// still treats it as 8) but it has its own continent, colour and legend entry.
const HISUI_SPECIES_FIRST = 899, HISUI_SPECIES_LAST = 905;

// All alternate-form entries belong to one dedicated Extras continent, regardless of their origin generation or type.
const EXTRAS_REGION = 11;

// Only these species share one discovery across their alternate forms.
// Mega, regional, Gigantamax and Eternamax are never grouped by this rule.
const SEPARATE_FORM_KINDS = new Set(["mega", "regional", "gmax"]);
const GROUPED_FORM_SPECIES = new Set([
  386, // Deoxys
  351, // Castform
  487, // Giratina
  484, // Palkia
  483, // Dialga
  492, // Shaymin
  413, // Wormadam
  479, // Rotom
  647, // Keldeo
  550, // Basculin
  648, // Meloetta
  646, // Kyurem
  641, 642, 645, 905, // Tornadus, Thundurus, Landorus, Enamorus (Therian forms)
  555, // Darmanitan: Unovan and Galarian groups stay separate
  658, // Greninja
  710, // Pumpkaboo (size forms)
  711, // Gourgeist (size forms)
  718, // Zygarde
  678, // Meowstic (male/female; Mega forms are a separate group if supplied by the data)
  681, // Aegislash
  774, // Minior (Meteor and Core forms)
  801, // Magearna (base forms; Mega forms are a separate group if supplied by the data)
  741, // Oricorio (styles)
  778, // Mimikyu (Disguised and Busted)
  800, // Necrozma (Dusk Mane, Dawn Wings, Ultra)
  744, 745, // Rockruff and Lycanroc (forms)
  746, // Wishiwashi (Solo and School forms)
  720, // Hoopa (Confined and Unbound forms)
  670, // Floette (flower colors and Eternal Flower form)
  875, // Eiscue (Ice Face / Noice Face)
  877, // Morpeko (Full Belly / Hangry)
  901, // Ursaluna (regular / Bloodmoon)
  876, // Indeedee (male / female)
  888, 889, // Zacian and Zamazenta (Crowned forms)
  849, // Toxtricity (Amped / Low Key; Gigantamax is a separate group)
  893, // Zarude (regular / Dada)
  892, // Urshifu (Single Strike / Rapid Strike)
  845, // Cramorant (Gulping / Gorging)
  902, // Basculegion (male / female)
  898, // Calyrex (base, Ice Rider, Shadow Rider)
  982, // Dudunsparce (Two-Segment / Three-Segment)
  1007, 1008, // Koraidon and Miraidon
  1017, // Ogerpon (mask forms)
  128, // Tauros: base and Paldean Combat / Blaze / Aqua breeds share one discovery
  999, // Gimmighoul: Chest Form and Roaming Form share one discovery
  931, // Squawkabilly (plumage colors)
  925, // Maushold (Family of Three / Family of Four)
  916, // Oinkologne (male / female; also accept the user's spelling "Oikologne")
  1024, // Terapagos (Normal / Terastal / Stellar)
  978, // Tatsugiri (Curly / Droopy / Stretchy; Mega is a separate group if supplied)
  964  // Palafin (Zero / Hero)
]);

const regions = [
  { name: "Kanto", start: 1, end: 151 },
  { name: "Johto", start: 152, end: 251 },
  { name: "Hoenn", start: 252, end: 386 },
  { name: "Sinnoh", start: 387, end: 493 },
  { name: "Unova", start: 494, end: 649 },
  { name: "Kalos", start: 650, end: 721 },
  { name: "Alola", start: 722, end: 809 },
  { name: "Galar", start: 810, end: 898 },
  { name: "Hisui", start: 899, end: 905 },
  { name: "Paldea", start: 906, end: 1025 },
  { name: "Extras", kind: "extras" }
];

// Continent seeds: Gen IV on the north cap, I/II/III around it, V/VIII/IX in the middle belt, VI/VII on the south cap.
// Generations that share many evolution lines are neighbours.
const GENERATION_SEEDS = {
  11: { lat: 0.15, lon: -3.0 }, // Dedicated continent for all alternate forms
  4: { lat: 1.25, lon: 0 },
  1: { lat: 0.45, lon: 0 },
  2: { lat: 0.45, lon: 2.1 },
  3: { lat: 0.45, lon: -2.1 },
  5: { lat: -0.35, lon: 1.05 },
  9: { lat: -0.35, lon: 3.14 },
  8: { lat: -0.35, lon: -1.05 },
  10: { lat: -1.0, lon: -1.15 },   // Hisui: right next to Galar (Gen VIII), between Kalos and Alola
  6: { lat: -1.0, lon: 0.5 },
  7: { lat: -1.0, lon: 3.6 }
};
