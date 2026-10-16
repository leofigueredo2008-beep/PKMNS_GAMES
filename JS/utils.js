/* ======================================================================
 * utils.js
 * Generic helpers with no dependency on game state.
 * ====================================================================== */

// localStorage can throw (private mode, blocked cookies, quota). These wrappers never do.
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* ignore */ } }
};

const $ = id => document.getElementById(id);

function normalizeName(name) {
  return name.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.:'’\-_\s]/g, "").trim();
}
function prettyName(name) {
  return name.split("-").map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(" ");
}
function dexNumber(id) { const m = formMeta.get(id); return "#" + String(m ? m.speciesId : id).padStart(3, "0") }
function escapeHTML(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])) }
function formatTime(seconds) {
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

function typeName(name) { return name.charAt(0).toUpperCase() + name.slice(1) }

function titleCase(words) { return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "); }

const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; };

function levenshteinDistance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++)prev[j] = curr[j];
  }
  return prev[b.length];
}

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}
