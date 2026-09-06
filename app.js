/**
 * Nick's Nutrition Tracker — app logic.
 * All state lives in localStorage on this device. No server, no sync
 * between devices — this is the tradeoff for working fully offline.
 */

const STORAGE_KEY = "nutritionState";

// ── State load/save ──────────────────────────────────────────────
function loadState() {
  const empty = { dayTypeOverrides: {}, completions: {}, lowStock: {}, planEdits: { mealItems: {}, targets: {} } };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return {
      dayTypeOverrides: parsed.dayTypeOverrides || {},
      completions: parsed.completions || {},
      lowStock: parsed.lowStock || {},
      planEdits: {
        mealItems: (parsed.planEdits && parsed.planEdits.mealItems) || {},
        targets: (parsed.planEdits && parsed.planEdits.targets) || {},
      },
    };
  } catch (err) {
    console.error("Failed to load state, starting fresh", err);
    return empty;
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

// Parsing a plain "YYYY-MM-DD" string with `new Date(str)` interprets it as
// UTC midnight, not local midnight — in any timezone behind UTC (all of the
// US), that silently rolls back to the previous day. This parses it using
// local date components instead, so round-tripping through todayStr() always
// lands on the same calendar day it started as.
function parseLocalDateStr(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
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

// ── Plan edits ─────────────────────────────────────────────────────
// data.js is the "official" plan — it's what gets replaced wholesale when
// a new coach PDF comes in. This layer lets you tweak amounts/targets
// yourself in the app without touching that file. Edits are keyed by
// WEEKDAY (0=Sun..6=Sat, matching Date.getDay()) + mealId + ingredient,
// so you can customize just Mondays and Tuesdays, say, and leave every
// other day running the standard plan.
function mealItemKey(weekday, mealId, ingredientName) {
  return weekday + "::" + mealId + "::" + ingredientName;
}

function getMealItemEdit(weekday, mealId, ingredientName) {
  return STATE.planEdits.mealItems[mealItemKey(weekday, mealId, ingredientName)];
}

function setMealItemEdit(weekday, mealId, ingredientName, amount) {
  STATE.planEdits.mealItems[mealItemKey(weekday, mealId, ingredientName)] = amount;
  saveState(STATE);
}

function clearMealItemEdit(weekday, mealId, ingredientName) {
  delete STATE.planEdits.mealItems[mealItemKey(weekday, mealId, ingredientName)];
  saveState(STATE);
}

function getTargetEdits(weekday) {
  return STATE.planEdits.targets[weekday] || {};
}

function setTargetEdit(weekday, field, value) {
  if (!STATE.planEdits.targets[weekday]) STATE.planEdits.targets[weekday] = {};
  STATE.planEdits.targets[weekday][field] = value;
  saveState(STATE);
}

function clearTargetEdit(weekday, field) {
  if (STATE.planEdits.targets[weekday]) delete STATE.planEdits.targets[weekday][field];
  saveState(STATE);
}

function resetAllPlanEdits(weekday) {
  delete STATE.planEdits.targets[weekday];
  const prefix = weekday + "::";
  for (const key of Object.keys(STATE.planEdits.mealItems)) {
    if (key.startsWith(prefix)) delete STATE.planEdits.mealItems[key];
  }
  saveState(STATE);
}

function weekdayHasEdits(weekday) {
  if (STATE.planEdits.targets[weekday] && Object.keys(STATE.planEdits.targets[weekday]).length) return true;
  const prefix = weekday + "::";
  return Object.keys(STATE.planEdits.mealItems).some(k => k.startsWith(prefix));
}

// Returns meals for this day type with any edits for this specific
// weekday applied — this is what the rest of the app should render,
// not mealsForDayType() directly, so edits show up everywhere.
function getEffectiveMeals(dayType, weekday) {
  return mealsForDayType(dayType).map(meal => ({
    ...meal,
    items: meal.items.map(it => {
      const edit = getMealItemEdit(weekday, meal.id, it.name);
      return edit !== undefined ? { ...it, amount: edit } : it;
    }),
  }));
}

function getEffectiveTargets(dayType, weekday) {
  return { ...DAY_TARGETS[dayType], ...getTargetEdits(weekday) };
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
// viewingDate lets you tap any day in the week strip to see/edit that
// day's plan without waiting for it to actually arrive. Resets to today
// on reload — it's a navigation choice, not saved state.
let viewingDate = new Date();

function renderAll() {
  const dayType = getDayType(viewingDate);
  const scheduled = getScheduledDayType(viewingDate);
  const weekday = viewingDate.getDay();
  const targets = getEffectiveTargets(dayType, weekday);
  const meals = getEffectiveMeals(dayType, weekday);
  const isToday = todayStr(viewingDate) === todayStr(new Date());

  renderStatusBar(dayType, scheduled, targets, meals, isToday);
  renderWeekStrip();
  renderMeals(meals);
  renderSupplements(dayType);
  renderGroceries();
  renderSettings();
}

function renderStatusBar(dayType, scheduled, targets, meals, isToday) {
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

  const nextText = document.getElementById("next-text");
  const ticker = document.getElementById("next-ticker");
  const nextLabel = ticker.querySelector(".next-label");

  if (!isToday) {
    // Countdown/overdue math doesn't mean anything for a day that isn't
    // actually happening right now — show what you're looking at instead.
    ticker.classList.remove("complete");
    nextLabel.textContent = "VIEWING";
    nextText.textContent = viewingDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    return;
  }

  const nextMeal = meals.find(m => !isCompleted(m.id, viewingDate));
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
  const viewingKey = todayStr(viewingDate);
  for (const day of getWeekOverview()) {
    const el = document.createElement("div");
    const isViewing = day.date === viewingKey;
    el.className = `week-day ${day.dayType}` + (day.isToday ? " today" : "") + (day.isOverride ? " override" : "") + (isViewing ? " viewing" : "");
    el.title = day.isOverride
      ? `${day.weekday}: ${day.dayType} (normally ${day.scheduledDayType}) — tap to view`
      : `${day.weekday}: ${day.dayType} — tap to view`;
    el.innerHTML = `${day.weekday.slice(0, 2).toUpperCase()}<span class="override-dot"></span>`;
    el.addEventListener("click", () => {
      viewingDate = parseLocalDateStr(day.date);
      renderAll();
    });
    container.appendChild(el);
  }
}

function renderMeals(meals) {
  const container = document.getElementById("meal-list");
  container.innerHTML = "";
  const activeMeal = meals.find(m => !isCompleted(m.id, viewingDate));

  for (const meal of meals) {
    const completed = isCompleted(meal.id, viewingDate);
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
      setCompleted(meal.id, !completed, viewingDate);
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

    if (meal.supplementReminder) {
      const reminderSupps = DAILY_SUPPLEMENTS.filter(s => s.timing === meal.supplementReminder);
      if (reminderSupps.length) {
        const callout = document.createElement("div");
        callout.className = "supp-callout";
        callout.innerHTML = `💊 Also take: ${reminderSupps.map(s => s.name).join(", ")} <span class="supp-callout-link">→ Supplements</span>`;
        callout.addEventListener("click", (e) => {
          e.stopPropagation();
          switchPage("supplements");
        });
        itemsWrap.appendChild(callout);
      }
    }

    // Tap the header again to expand/collapse a non-active meal — fixes the
    // kiosk-era gap where only the active meal's ingredients were reachable.
    row.addEventListener("click", (e) => {
      if (e.target.closest(".flag-low") || e.target.closest(".supp-callout")) return;
      if (isActive) return; // active meal's tap already toggles completion
      row.classList.toggle("expanded");
    });

    container.appendChild(row);
  }
}

function renderSupplements(dayType) {
  const container = document.getElementById("supplement-list");
  container.innerHTML = "";
  const visible = DAILY_SUPPLEMENTS.filter(s => !s.onlyOnDayType || s.onlyOnDayType === dayType);
  const groups = groupBy(visible, s => s.timing);
  for (const [timing, items] of groups) {
    const groupEl = document.createElement("div");
    groupEl.className = "supp-group";
    groupEl.innerHTML = `<div class="supp-group-label">${timing}</div>`;
    for (const s of items) {
      const completed = isCompleted(s.id, viewingDate);
      const low = s.ingredientKey ? isLowStock(s.ingredientKey) : false;
      const row = document.createElement("div");
      row.className = "supp-row" + (completed ? " done" : "");
      const flagBtn = s.ingredientKey
        ? `<button class="flag-low${low ? " active" : ""}" title="Mark running low">⚠</button>`
        : '<span class="flag-low-spacer"></span>';
      row.innerHTML = `
        <span class="supp-check"></span>
        <span class="supp-name">${s.name}</span>
        <span class="supp-amount">${s.amount || ""}</span>
        ${flagBtn}
      `;
      row.addEventListener("click", () => {
        setCompleted(s.id, !completed, viewingDate);
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

// ── Settings / in-app plan editor ─────────────────────────────────
// Which weekday's plan is being edited — independent of viewingDate, and
// independent of day TYPE, since the whole point is letting e.g. Monday
// and Tuesday diverge from the standard training-day plan while every
// other training day stays as-is. Defaults to today's weekday.
let settingsWeekday = null;

const TARGET_FIELDS = [
  { key: "calories", label: "Calories" },
  { key: "protein_g", label: "Protein (g)" },
  { key: "carbs_g", label: "Carbs (g)" },
  { key: "fat_g", label: "Fat (g)" },
];

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun, values match Date.getDay()
const WEEKDAY_SHORT = { 0: "SU", 1: "MO", 2: "TU", 3: "WE", 4: "TH", 5: "FR", 6: "SA" };
const WEEKDAY_FULL = { 0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday" };

function renderSettings() {
  if (settingsWeekday === null) settingsWeekday = new Date().getDay();
  const settingsDT = WEEKDAY_SCHEDULE[settingsWeekday];

  const daytypeContainer = document.getElementById("settings-daytype");
  daytypeContainer.innerHTML = "";
  for (const wd of WEEKDAY_ORDER) {
    const btn = document.createElement("button");
    btn.className = "settings-weekday-btn " + WEEKDAY_SCHEDULE[wd] + (wd === settingsWeekday ? " active" : "");
    btn.innerHTML = WEEKDAY_SHORT[wd] + (weekdayHasEdits(wd) ? '<span class="edit-dot"></span>' : "");
    btn.title = WEEKDAY_FULL[wd] + " — " + WEEKDAY_SCHEDULE[wd];
    btn.addEventListener("click", () => {
      settingsWeekday = wd;
      renderAll();
    });
    daytypeContainer.appendChild(btn);
  }

  document.getElementById("settings-weekday-label").textContent =
    `Editing ${WEEKDAY_FULL[settingsWeekday]} — ${settingsDT === "training" ? "Training Day" : "Rest Day"} plan`;

  const effectiveTargets = getEffectiveTargets(settingsDT, settingsWeekday);
  const targetEdits = getTargetEdits(settingsWeekday);
  const targetsContainer = document.getElementById("settings-targets");
  targetsContainer.innerHTML = "";
  for (const f of TARGET_FIELDS) {
    const isEdited = targetEdits[f.key] !== undefined;
    const row = document.createElement("div");
    row.className = "settings-target-row";
    row.innerHTML = `
      <label>${f.label}</label>
      <input type="number" inputmode="numeric" value="${effectiveTargets[f.key]}">
      <button class="reset-field-btn${isEdited ? " show" : ""}" title="Reset to plan default">↺</button>
    `;
    const input = row.querySelector("input");
    input.addEventListener("change", () => {
      const val = parseInt(input.value, 10);
      if (!isNaN(val)) {
        setTargetEdit(settingsWeekday, f.key, val);
        renderAll();
      }
    });
    row.querySelector(".reset-field-btn").addEventListener("click", () => {
      clearTargetEdit(settingsWeekday, f.key);
      renderAll();
    });
    targetsContainer.appendChild(row);
  }

  const mealListContainer = document.getElementById("settings-meal-list");
  mealListContainer.innerHTML = "";
  for (const meal of mealsForDayType(settingsDT)) {
    const row = document.createElement("div");
    row.className = "meal-row expanded";
    row.innerHTML = `<div class="meal-header"><span class="meal-name">${meal.name}</span><span class="meal-time">${meal.time || ""}</span></div>`;

    const itemsWrap = document.createElement("div");
    itemsWrap.className = "meal-items";
    for (const it of meal.items) {
      const edit = getMealItemEdit(settingsWeekday, meal.id, it.name);
      const currentAmount = edit !== undefined ? edit : it.amount;
      const line = document.createElement("div");
      line.className = "meal-item settings-item";
      line.innerHTML = `
        <span class="item-name">${it.name}</span>
        <input type="text" class="amount-input" value="${currentAmount}">
        <button class="reset-field-btn${edit !== undefined ? " show" : ""}" title="Reset to plan default">↺</button>
      `;
      const input = line.querySelector("input");
      input.addEventListener("change", () => {
        setMealItemEdit(settingsWeekday, meal.id, it.name, input.value);
        renderAll();
      });
      line.querySelector(".reset-field-btn").addEventListener("click", () => {
        clearMealItemEdit(settingsWeekday, meal.id, it.name);
        renderAll();
      });
      itemsWrap.appendChild(line);
    }
    row.appendChild(itemsWrap);
    mealListContainer.appendChild(row);
  }
}

document.getElementById("reset-all-btn").addEventListener("click", () => {
  if (confirm(`Reset all your edits for ${WEEKDAY_FULL[settingsWeekday]} back to the plan defaults?`)) {
    resetAllPlanEdits(settingsWeekday);
    renderAll();
  }
});

// ── Day pill click ──────────────────────────────────────────────
document.getElementById("day-toggle").addEventListener("click", () => {
  const current = getDayType(viewingDate);
  setDayType(current === "training" ? "rest" : "training", viewingDate);
  renderAll();
});

// ── Page navigation (bottom tab bar) ─────────────────────────────
function switchPage(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === "page-" + page));
  document.querySelectorAll(".bottom-nav button").forEach(b => b.classList.toggle("active", b.dataset.page === page));
}

document.querySelectorAll(".bottom-nav button").forEach(btn => {
  btn.addEventListener("click", () => switchPage(btn.dataset.page));
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
