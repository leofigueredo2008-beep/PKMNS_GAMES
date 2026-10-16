/* ======================================================================
 * globe-render.js
 * Canvas rendering, focus animation and pointer/wheel interaction for the globe.
 * ====================================================================== */

function resizeGlobe() {
  const canvas = $("globeCanvas"); if (!canvas) return;
  const rect = canvas.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(rect.width * dpr)); canvas.height = Math.max(1, Math.floor(rect.height * dpr));
}
function globeTargets() {
  if (!globeDistribution.size) globeDistribution = buildGlobeDistribution();
  return pokemonList.map(p => {
    const pos = globeDistribution.get(p.id);
    return { ...p, lat: pos?.lat ?? 0, lon: pos?.lon ?? 0 };
  });
}
function getGlobeTarget(id) {
  if (!globeDistribution.size) globeDistribution = buildGlobeDistribution();
  const pos = globeDistribution.get(id);
  return pos ? { lat: pos.lat, lon: pos.lon } : null;
}

function focusGlobeOnPokemon(id, holdMs = 3500) {
  const target = getGlobeTarget(id);
  if (!target) return;
  const x = Math.cos(target.lat) * Math.cos(target.lon);
  const y = Math.sin(target.lat);
  const z = Math.cos(target.lat) * Math.sin(target.lon);
  const desiredY = Math.atan2(x, z);
  const rotatedZ = Math.sqrt(x * x + z * z);
  const desiredX = Math.atan2(y, rotatedZ);
  const fromX = globeRotation.x;
  const fromY = globeRotation.y;
  const toY = fromY + normalizeAngle(desiredY - fromY);
  globeFocusId = id;
  globeFocus = { id, start: performance.now(), duration: 900, fromX, fromY, toX: desiredX, toY };
  cancelAnimationFrame(globeAnimation);
  startGlobeAnimation();
}

function rotateXYZ(x, y, z) {
  const cy = Math.cos(globeRotation.y), sy = Math.sin(globeRotation.y); let nx = x * cy - z * sy, nz = x * sy + z * cy; x = nx; z = nz;
  const cx = Math.cos(globeRotation.x), sx = Math.sin(globeRotation.x); let ny = y * cx - z * sx; nz = y * sx + z * cx; y = ny; z = nz;
  return { x, y, z };
}
function rotatePoint(lat, lon) {
  return rotateXYZ(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
}

// Generation layers: spherical Voronoi cells grouped per generation. They partition the sphere,
// so a layer can never sit on top of another one, and only the visible hemisphere is painted.
function drawGenerationLayers(ctx, cx, cy, radius, mode = "fill") {
  if (!globeTerritory) return;
  const paths = new Map();
  for (const cell of globeTerritory) {
    const n = cell.V.length;
    const R = new Array(n); let front = false;
    for (let k = 0; k < n; k++) { const v = cell.V[k]; R[k] = rotateXYZ(v[0], v[1], v[2]); if (R[k].z > 0) front = true; }
    if (!front) continue;
    // clip to the visible hemisphere (z>=0), keeping track of real generation borders
    const pts = [], flags = [];
    for (let k = 0; k < n; k++) {
      const A = R[(k + n - 1) % n], B = R[k], f = cell.bnd[k];
      const cut = () => { const t = A.z / (A.z - B.z); let x = A.x + t * (B.x - A.x), y = A.y + t * (B.y - A.y); const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };
      if (B.z >= 0) {
        if (A.z < 0) { pts.push(cut()); flags.push(false); }
        pts.push(B); flags.push(f);
      } else if (A.z >= 0) { pts.push(cut()); flags.push(f); }
    }
    if (pts.length < 3) continue;
    let entry = paths.get(cell.gen);
    if (!entry) { entry = { fill: new Path2D(), edge: new Path2D() }; paths.set(cell.gen, entry); }
    const sx = q => cx + q.x * radius, sy = q => cy - q.y * radius;
    entry.fill.moveTo(sx(pts[0]), sy(pts[0]));
    for (let k = 1; k < pts.length; k++) entry.fill.lineTo(sx(pts[k]), sy(pts[k]));
    entry.fill.closePath();
    for (let k = 0; k < pts.length; k++) {
      if (!flags[k]) continue;
      const P = pts[(k + pts.length - 1) % pts.length], Q = pts[k];
      entry.edge.moveTo(sx(P), sy(P)); entry.edge.lineTo(sx(Q), sy(Q));
    }
  }
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.clip();
  if (mode === "borders") {
    // colors off (Normal mode): keep the borders between generations, neutral and without fill
    const light = document.body.classList.contains("light-theme");
    ctx.lineWidth = 3; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.strokeStyle = light ? "rgba(60,72,92,.62)" : "rgba(225,235,255,.55)";
    paths.forEach(entry => ctx.stroke(entry.edge));
    ctx.restore();
    return;
  }
  paths.forEach((entry, gen) => {
    const color = GENERATION_COLORS[gen] || GENERATION_COLORS[9];
    ctx.fillStyle = color.fill; ctx.fill(entry.fill);
    // border is clipped to its own continent, so two layers never paint over each other
    ctx.save(); ctx.clip(entry.fill);
    ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.strokeStyle = color.stroke; ctx.stroke(entry.edge);
    ctx.restore();
  });
  ctx.restore();
}

// Latitude/longitude grid that rotates with the globe and only shows on the front face
function drawGlobeGrid(ctx, cx, cy, radius, color) {
  ctx.save(); ctx.globalAlpha = .18; ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
  const line = (fn) => { let prev = null; for (let d = 0; d <= 360; d += 4) { const q = fn(d * Math.PI / 180); if (prev && prev.z > 0 && q.z > 0) { ctx.moveTo(cx + prev.x * radius, cy - prev.y * radius); ctx.lineTo(cx + q.x * radius, cy - q.y * radius); } prev = q; } };
  for (let lat = -60; lat <= 60; lat += 30) { const a = lat * Math.PI / 180; line(t => rotatePoint(a, t)); }
  for (let lon = 0; lon < 360; lon += 30) { const o = lon * Math.PI / 180; line(t => rotatePoint(t - Math.PI / 2, o)); }
  ctx.stroke(); ctx.restore();
}

function drawGlobe() {
  const canvas = $("globeCanvas"); if (!canvas || view !== "globe") return;
  const ctx = canvas.getContext("2d"); const dpr = Math.min(window.devicePixelRatio || 1, 2); const w = canvas.width / dpr, h = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2; const baseRadius = Math.min(w, h) * .34;
  const zoomScale = globeZoom;
  const radius = baseRadius * zoomScale * globeScale;
  const refRadius = radius / globeScale;
  ctx.save();
  const light = document.body.classList.contains("light-theme");
  const globeMain = light ? "#dde6f0" : "#314b78"; const globeMid = light ? "#b9c9dc" : "#172746"; const globeDark = light ? "#8499b4" : "#080d18";
  const globeEdge = light ? "#6d82a0" : "#53698f"; const globeGrid = light ? "#5d7390" : "#b7c5e2";
  const grd = ctx.createRadialGradient(cx - radius * .35, cy - radius * .45, radius * .08, cx, cy, radius * 1.08); grd.addColorStop(0, globeMain); grd.addColorStop(.62, globeMid); grd.addColorStop(1, globeDark);
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fillStyle = grd; ctx.fill(); ctx.strokeStyle = globeEdge; ctx.lineWidth = 2; ctx.stroke();
  drawGlobeGrid(ctx, cx, cy, radius, globeGrid);
  if (difficulty !== "hard") drawGenerationLayers(ctx, cx, cy, radius, colorsVisible() ? "fill" : "borders");

  const pts = globeTargets()
    .map(p => ({ ...p, pt: rotatePoint(p.lat, p.lon) }))
    .filter(p => p.pt.z > -.08)
    .sort((a, b) => a.pt.z - b.pt.z);

  const layout = pts.map(p => {
    const x = cx + p.pt.x * radius;
    const y = cy - p.pt.y * radius;
    const depth = .55 + .45 * Math.max(0, p.pt.z);
    return { ...p, x, y, depth, baseSize: refRadius * .105 * depth };
  });

  const cellSize = Math.max(6, radius * .07);
  const cells = new Map();
  for (let i = 0; i < layout.length; i++) {
    const p = layout[i];
    const gx = Math.floor(p.x / cellSize), gy = Math.floor(p.y / cellSize);
    const key = gx + "," + gy;
    let arr = cells.get(key); if (!arr) { arr = []; cells.set(key, arr); } arr.push(i);
  }
  for (let i = 0; i < layout.length; i++) {
    const p = layout[i];
    const gx = Math.floor(p.x / cellSize), gy = Math.floor(p.y / cellSize);
    let nearest = Infinity;
    for (let ox = -2; ox <= 2; ox++) for (let oy = -2; oy <= 2; oy++) {
      const arr = cells.get((gx + ox) + "," + (gy + oy)); if (!arr) continue;
      for (const j of arr) { if (i === j) continue; const q = layout[j]; const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < nearest) nearest = d; }
    }
    const safeSize = Number.isFinite(nearest) ? Math.max(1.2, nearest * .72) : p.baseSize;
    p.spriteSize = Math.min(p.baseSize, safeSize);
    p.dotRadius = Number.isFinite(nearest) ? Math.max(1, Math.min(refRadius * .012, nearest * .30)) : Math.max(1, refRadius * .012);
  }

  // Only what is on the visible face is drawn / clickable
  const visibleLayout = layout.filter(p => p.pt.z > 0);
  // --- (generation layers are drawn earlier, before the sprites) ---
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.clip();
  const focusedId = globeFocusId;
  globeHits = [];
  for (const p of visibleLayout) {
    const { x, y, depth, spriteSize } = p;
    const found = encountered.has(p.id); const revealed = gaveUp && !found;
    const r = p.dotRadius;
    if (found || revealed) {
      let img = globeImageCache.get(p.id);
      if (!img) { img = new Image(); img.src = spriteURL(p.id); globeImageCache.set(p.id, img); img.onload = () => { if (view === "globe") drawGlobe() }; }
      if (img.complete && img.naturalWidth) {
        const size = spriteSize; ctx.save(); ctx.globalAlpha = .72 + .28 * depth;
        if (focusedId === p.id) { ctx.beginPath(); ctx.arc(x, y, size * .72, 0, Math.PI * 2); ctx.strokeStyle = light ? "#d68f12" : "#ffcb05"; ctx.lineWidth = 3; ctx.shadowBlur = 10; ctx.shadowColor = light ? "rgba(214,143,18,.38)" : "rgba(255,203,5,.45)"; ctx.stroke(); ctx.shadowBlur = 0; }
        ctx.beginPath(); ctx.arc(x, y, size * .55, 0, Math.PI * 2); ctx.fillStyle = revealed ? (light ? "rgba(210,98,107,.18)" : "rgba(251,113,133,.18)") : (light ? "rgba(229,162,58,.20)" : "rgba(255,203,5,.10)"); ctx.fill();
        if (revealed) { ctx.strokeStyle = light ? "#d2626b" : "#fb7185"; ctx.lineWidth = 2; ctx.stroke(); }
        ctx.drawImage(img, x - size / 2, y - size / 2, size, size); ctx.restore();
      }
    } else {
      if (difficulty !== "hard") { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = light ? "#7d8793" : "#596274"; ctx.fill(); } // Hard: the dots still exist (spacing/hits) but are invisible
    }
    if (!found && !revealed && globeHint && globeHint.id === p.id) {
      const pulse = .5 + .5 * Math.sin(performance.now() / 1000 * 5);
      const rr = Math.max(r * 3.2, spriteSize * .5) * (1 + .12 * pulse);
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2);
      ctx.fillStyle = light ? "rgba(229,162,58,.25)" : "rgba(255,203,5,.20)"; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = light ? "#d68f12" : "#ffcb05"; ctx.stroke();
      ctx.fillStyle = light ? "#8a5a00" : "#ffe27a"; ctx.font = `900 ${Math.round(rr * 1.1)}px Inter,system-ui,sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", x, y + 1);
      ctx.restore();
    }
    const hitRadius = found || revealed ? Math.max(r + 10, spriteSize / 2) : r + 10;
    globeHits.push({ p, x, y, r: hitRadius, clickable: found || revealed });
  }
  ctx.restore();
  ctx.restore();
  $("globeZoom").textContent = "Zoom " + Math.round(globeZoom * 100) + "%";
}

function startGlobeAnimation() {
  cancelAnimationFrame(globeAnimation);
  const tick = () => {
    if (view !== "globe") return;
    if (globeFocus) {
      const now = performance.now();
      const t = Math.min(1, (now - globeFocus.start) / globeFocus.duration);
      const eased = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      globeRotation.x = globeFocus.fromX + (globeFocus.toX - globeFocus.fromX) * eased;
      globeRotation.y = globeFocus.fromY + (globeFocus.toY - globeFocus.fromY) * eased;
      drawGlobe();
      if (t < 1) { globeAnimation = requestAnimationFrame(tick); }
      else { globeRotation.x = globeFocus.toX; globeRotation.y = globeFocus.toY; globeFocus = null; drawGlobe(); }
      return;
    }
    drawGlobe();
  };
  tick();
}

function globePointerDown(e) { globeFocus = null; globeDragging = true; globePointerMoved = false; globeLast = { x: e.clientX, y: e.clientY }; globePointerStart = { x: e.clientX, y: e.clientY }; $("globeCanvas").classList.add("grabbing"); $("globeCanvas").setPointerCapture?.(e.pointerId); }
function globePointerMove(e) { if (!globeDragging) return; const dx = e.clientX - globeLast.x, dy = e.clientY - globeLast.y; globeLast = { x: e.clientX, y: e.clientY }; if (Math.hypot(e.clientX - globePointerStart.x, e.clientY - globePointerStart.y) > 6) globePointerMoved = true; globeRotation.y += dx * .008; globeRotation.x = Math.max(-1.2, Math.min(1.2, globeRotation.x + dy * .008)); drawGlobe(); }
function globePointerUp(e) { if (!globePointerMoved) { const rect = $("globeCanvas").getBoundingClientRect(); const px = e.clientX - rect.left, py = e.clientY - rect.top; let best = null, bestDist = Infinity; for (const hit of globeHits) { if (!hit.clickable) continue; const d = Math.hypot(px - hit.x, py - hit.y); if (d <= hit.r && d < bestDist) { best = hit; bestDist = d; } } if (best) selectPokemon(best.p.id); } globeDragging = false; $("globeCanvas").classList.remove("grabbing"); }
function globeWheel(e) {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.10 : 0.9090909091;
  globeZoom = Math.max(0.01, Math.min(10, globeZoom * factor));
  drawGlobe();
}

function setupGlobe() { const c = $("globeCanvas"); c.addEventListener("pointerdown", globePointerDown); c.addEventListener("pointermove", globePointerMove); c.addEventListener("pointerup", globePointerUp); c.addEventListener("pointercancel", globePointerUp); c.addEventListener("wheel", globeWheel, { passive: false }); window.addEventListener("resize", () => { if (view === "globe") { resizeGlobe(); drawGlobe() } else if (view === "regional" && difficulty === "normal") { renderRegions() } }); }
