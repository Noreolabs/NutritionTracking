/**
 * Nick's Nutrition Tracker — app logic.
 * All state lives in localStorage on this device. No server, no sync
 * between devices — this is the tradeoff for working fully offline.
 */

const STORAGE_KEY = "nutritionState";

// ── State load/save ──────────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { dayTypeOverrides: {}, completions: {}, lowStock: {} };
    const parsed = JSON.parse(raw);
    return {
      dayTypeOverrides: parsed.dayTypeOverrides || {},
      completions: parsed.completions || {},
      lowStock: parsed.lowStock || {},
    };
  } catch (err) {
    console.error("Failed to load state, starting fresh", err);
    return { dayTypeOverrides: {}, completions: {}, lowStock: {} };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let STATE = loadState();

function todayStr(d) {
  const date = d || new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ── Day type (weekly schedule + per-date override) ────────────────
function getScheduledDayType(d) {
  const date = d || new Date();
  return WEEKDAY_SCHEDULE[date.getDay()];
}

function getDayType(d) {
  const date = d || new Date();
  const key = todayStr(date);
  if (STATE.dayTypeOverrides[key]) return STATE.dayTypeOverrides[key];
  return getScheduledDayType(date);
}

function setDayType(dayType, d) {
  const date = d || new Date();
  const key = todayStr(date);
  STATE.dayTypeOverrides[key] = dayType;
  saveState(STATE);
}

// ── Completions ────────────────────────────────────────────────────
function isCompleted(itemId, d) {
  const key = todayStr(d || new Date());
  return !!(STATE.completions[key] && STATE.completions[key][itemId]);
}

function setCompleted(itemId, completed, d) {
  const key = todayStr(d || new Date());
  if (!STATE.completions[key]) STATE.completions[key] = {};
  STATE.completions[key][itemId] = completed;
  saveState(STATE);
}

// ── Low stock ──────────────────────────────────────────────────────
function isLowStock(ingredientName) {
  return !!STATE.lowStock[ingredientName];
}

function toggleLowStock(ingredientName) {
  STATE.lowStock[ingredientName] = !STATE.lowStock[ingredientName];
  saveState(STATE);
}

function getGroceryList() {
  return Object.keys(STATE.lowStock)
    .filter(name => STATE.lowStock[name])
    .map(name => ({ name, ...(INGREDIENT_INFO[name] || {}) }))
    .sort((a, b) => (a.category || "").localeCompare(b.category || "") || a.name.localeCompare(b.name));
}

// ── Week overview (for the swap strip) ────────────────────────────
function getWeekOverview() {
  const today = new Date();
  const monday = new Date(today);
  const dayOffset = (today.getDay() + 6) % 7; // days since Monday
  monday.setDate(today.getDate() - dayOffset);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const scheduled = getScheduledDayType(d);
    const actual = getDayType(d);
    days.push({
      date: todayStr(d),
      weekday: d.toLocaleDateString("en-US", { weekday: "short" }),
      dayType: actual,
      scheduledDayType: scheduled,
      isOverride: actual !== scheduled,
      isToday: todayStr(d) === todayStr(today),
    });
  }
  return days;
}

// ── Time parsing / countdown (unchanged logic from the kiosk version) ──
function parseTimeLabel(label) {
  if (!label) return null;
  const match = label.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let [, h, m, ap] = match;
  h = parseInt(h, 10);
  m = parseInt(m, 10);
  if (/pm/i.test(ap) && h !== 12) h += 12;
  if (/am/i.test(ap) && h === 12) h = 0;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function formatCountdown(target) {
  const diffMs = target - new Date();
  const pastDue = diffMs < 0;
  const abs = Math.abs(diffMs);
  const totalMin = Math.round(abs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return pastDue ? `${parts.join(" ")} overdue` : `in ${parts.join(" ")}`;
}

function groupBy(list, keyFn) {
  const map = new Map();
  for (const it of list) {
    const key = keyFn(it);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(it);
  }
  return map;
}

// ── Rendering ────────────────────────────────────────────────────
function renderAll() {
  const dayType = getDayType();
  const scheduled = getScheduledDayType();
  const targets = DAY_TARGETS[dayType];
  const meals = mealsForDayType(dayType);

  renderStatusBar(dayType, scheduled, targets, meals);
  renderWeekStrip();
  renderMeals(meals);
  renderSupplements();
  renderGroceries();
}

function renderStatusBar(dayType, scheduled, targets, meals) {
  const label = document.getElementById("day-label");
  label.textContent = dayType.toUpperCase() + " DAY";
  document.getElementById("day-toggle").className = "day-pill " + dayType;

  const warning = document.getElementById("day-warning");
  const isOverride = dayType !== scheduled;
  warning.classList.toggle("show", isOverride);
  warning.title = isOverride ? `Not the scheduled day — normally a ${scheduled} day` : "";

  document.getElementById("m-cal").textContent = targets.calories;
  document.getElementById("m-pro").textContent = targets.protein_g + "g";
  document.getElementById("m-carb").textContent = targets.carbs_g + "g";
  document.getElementById("m-fat").textContent = targets.fat_g + "g";

  const nextMeal = meals.find(m => !isCompleted(m.id));
  const nextText = document.getElementById("next-text");
  const ticker = document.getElementById("next-ticker");
  const nextLabel = ticker.querySelector(".next-label");
  if (!nextMeal) {
    ticker.classList.add("complete");
    nextLabel.textContent = "STATUS";
    nextText.textContent = "Fully Fed 🎉";
  } else {
    ticker.classList.remove("complete");
    nextLabel.textContent = "NEXT";
    const t = parseTimeLabel(nextMeal.time);
    nextText.textContent = t ? `${nextMeal.name} — ${formatCountdown(t)}` : `${nextMeal.name} — up next`;
  }
}

function renderWeekStrip() {
  const container = document.getElementById("week-strip");
  container.innerHTML = "";
  for (const day of getWeekOverview()) {
    const el = document.createElement("div");
    el.className = `week-day ${day.dayType}` + (day.isToday ? " today" : "") + (day.isOverride ? " override" : "");
    el.title = day.isOverride
      ? `${day.weekday}: ${day.dayType} (normally ${day.scheduledDayType}) — tap to swap back`
      : `${day.weekday}: ${day.dayType} — tap to swap`;
    el.innerHTML = `${day.weekday.slice(0, 2).toUpperCase()}<span class="override-dot"></span>`;
    el.addEventListener("click", () => {
      const next = day.dayType === "training" ? "rest" : "training";
      setDayType(next, new Date(day.date));
      renderAll();
    });
    container.appendChild(el);
  }
}

function renderMeals(meals) {
  const container = document.getElementById("meal-list");
  container.innerHTML = "";
  const activeMeal = meals.find(m => !isCompleted(m.id));

  for (const meal of meals) {
    const completed = isCompleted(meal.id);
    const isActive = activeMeal && meal.id === activeMeal.id;
    const row = document.createElement("div");
    row.className = "meal-row" + (completed ? " done" : "") + (isActive ? " active" : "");

    const header = document.createElement("div");
    header.className = "meal-header";
    header.innerHTML = `
      <span class="meal-status-dot"></span>
      <span class="meal-name">${meal.name}</span>
      <span class="meal-time">${meal.time || ""}</span>
    `;
    header.addEventListener("click", () => {
      setCompleted(meal.id, !completed);
      renderAll();
    });
    row.appendChild(header);

    const itemsWrap = document.createElement("div");
    itemsWrap.className = "meal-items";
    for (const it of meal.items) {
      const line = document.createElement("div");
      line.className = "meal-item";
      const altTag = it.altGroup ? ` <span class="item-alt">(alt ${it.altGroup})</span>` : "";
      const noteTag = it.notes ? ` <span class="item-alt">— ${it.notes}</span>` : "";
      const low = isLowStock(it.name);
      line.innerHTML = `
        <span class="item-name">${it.name}${altTag}${noteTag}</span>
        <span class="item-amount">${it.amount}</span>
        <button class="flag-low${low ? " active" : ""}" title="Mark running low">⚠</button>
      `;
      line.querySelector(".flag-low").addEventListener("click", (e) => {
        e.stopPropagation();
        toggleLowStock(it.name);
        renderAll();
      });
      itemsWrap.appendChild(line);
    }
    row.appendChild(itemsWrap);

    // Tap the header again to expand/collapse a non-active meal — fixes the
    // kiosk-era gap where only the active meal's ingredients were reachable.
    row.addEventListener("click", (e) => {
      if (e.target.closest(".flag-low")) return;
      if (isActive) return; // active meal's tap already toggles completion
      row.classList.toggle("expanded");
    });

    container.appendChild(row);
  }
}

function renderSupplements() {
  const container = document.getElementById("supplement-list");
  container.innerHTML = "";
  const groups = groupBy(DAILY_SUPPLEMENTS, s => s.timing);
  for (const [timing, items] of groups) {
    const groupEl = document.createElement("div");
    groupEl.className = "supp-group";
    groupEl.innerHTML = `<div class="supp-group-label">${timing}</div>`;
    for (const s of items) {
      const completed = isCompleted(s.id);
      const low = s.ingredientKey ? isLowStock(s.ingredientKey) : false;
      const row = document.createElement("div");
      row.className = "supp-row" + (completed ? " done" : "");
      const asNeededTag = s.category === "enzyme" ? '<span class="supp-badge">as needed</span>' : "";
      const flagBtn = s.ingredientKey
        ? `<button class="flag-low${low ? " active" : ""}" title="Mark running low">⚠</button>`
        : '<span class="flag-low-spacer"></span>';
      row.innerHTML = `
        <span class="supp-check"></span>
        <span class="supp-name">${s.name}</span>
        ${asNeededTag}
        <span class="supp-amount">${s.amount || ""}</span>
        ${flagBtn}
      `;
      row.addEventListener("click", () => {
        setCompleted(s.id, !completed);
        renderAll();
      });
      const flagEl = row.querySelector(".flag-low");
      if (flagEl) {
        flagEl.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleLowStock(s.ingredientKey);
          renderAll();
        });
      }
      groupEl.appendChild(row);
    }
    container.appendChild(groupEl);
  }
}

function renderGroceries() {
  const container = document.getElementById("grocery-list");
  container.innerHTML = "";
  const groceries = getGroceryList();
  if (!groceries.length) {
    container.innerHTML = '<div class="grocery-empty">Nothing flagged low right now.</div>';
    return;
  }
  const groups = groupBy(groceries, g => g.category || "other");
  for (const [category, items] of groups) {
    const catEl = document.createElement("div");
    catEl.className = "grocery-cat";
    catEl.innerHTML = `<div class="grocery-cat-label">${category}</div>`;
    for (const g of items) {
      const row = document.createElement("div");
      row.className = "grocery-row";
      row.textContent = g.name;
      catEl.appendChild(row);
    }
    container.appendChild(catEl);
  }
}

// ── Day pill click ──────────────────────────────────────────────
document.getElementById("day-toggle").addEventListener("click", () => {
  const current = getDayType();
  setDayType(current === "training" ? "rest" : "training");
  renderAll();
});

// ── Init ────────────────────────────────────────────────────────
function tickClock() {
  document.getElementById("clock").textContent =
    new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

renderAll();
tickClock();
setInterval(tickClock, 1000);
// Keep the "time until next meal" countdown fresh even with no taps.
setInterval(renderAll, 30000);

// ── Service worker registration (offline support) ─────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(err => {
      console.error("Service worker registration failed", err);
    });
  });
}
