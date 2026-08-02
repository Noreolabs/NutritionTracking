/**
 * Nick's Nutrition Tracker — plan data.
 * Transcribed from: Nick_Phase1_Nutrition_Plan.pdf (Restructure Phase)
 *
 * This is the ONLY file that needs to change when the coach sends a new
 * plan — everything else (app.js, styles) reads from this. IDs on meals
 * and supplements are stable strings (not auto-increment) since this is
 * plain data now, not a database.
 */

const DAY_TARGETS = {
  training: { calories: 3350, protein_g: 250, carbs_g: 420, fat_g: 50 },
  rest:     { calories: 2525, protein_g: 250, carbs_g: 230, fat_g: 60 },
};

// Weekly schedule: Mon/Tue/Thu/Fri/Sat = training, Wed/Sun = rest.
// JS Date.getDay(): Sunday=0, Monday=1, ... Saturday=6
const WEEKDAY_SCHEDULE = {
  0: "rest",     // Sunday
  1: "training", // Monday
  2: "training", // Tuesday
  3: "rest",     // Wednesday
  4: "training", // Thursday
  5: "training", // Friday
  6: "training", // Saturday
};

// category: gut_protocol | enzyme | creatine | daily_supp
const DAILY_SUPPLEMENTS = [
  { id: "supp-1",  name: "Water", amount: "10 oz", timing: "Morning — first thing, before food", category: "gut_protocol", notes: null, ingredientKey: null },
  { id: "supp-2",  name: "Redmond Re-Lyte electrolytes", amount: "1 serving", timing: "Morning — first thing, before food", category: "gut_protocol", notes: null, ingredientKey: "Redmond Re-Lyte electrolytes" },
  { id: "supp-3",  name: "Aloe vera juice", amount: "3 oz", timing: "Morning — first thing, before food", category: "gut_protocol", notes: null, ingredientKey: "Aloe vera juice (inner filet, sugar-free)" },
  { id: "supp-4",  name: "Glutamine", amount: "10 g", timing: "Morning — first thing, before food", category: "gut_protocol", notes: null, ingredientKey: "Glutamine" },
  { id: "supp-5",  name: "Lemon, squeezed", amount: "1/2 lemon or 1 oz juice", timing: "Morning — first thing, before food", category: "gut_protocol", notes: null, ingredientKey: "Lemon" },
  { id: "supp-6",  name: "Silver Fern digestive enzyme", amount: "1 serving", timing: "10–15 min before Meal 1", category: "enzyme", notes: "Optional for now — add as food volume climbs", ingredientKey: "Silver Fern digestive enzyme" },
  { id: "supp-7",  name: "Dr's Best Pepsin GI", amount: "1 serving", timing: "10–15 min before Meal 1", category: "enzyme", notes: "Optional for now — add as food volume climbs", ingredientKey: "Dr's Best Pepsin GI" },
  { id: "supp-8",  name: "Creatine", amount: "10 g", timing: "Training: intra-workout shake / Rest: morning protocol or Meal 1", category: "creatine", notes: "Does not get skipped, even on rest days", ingredientKey: "Creatine" },
  { id: "supp-9",  name: "Fish oil", amount: "1 serving", timing: "With Meal 2", category: "daily_supp", notes: null, ingredientKey: "Fish oil" },
  { id: "supp-10", name: "Vitamin D", amount: "1 serving", timing: "With Meal 2", category: "daily_supp", notes: null, ingredientKey: "Vitamin D" },
  { id: "supp-11", name: "Vitamin K", amount: "1 serving", timing: "With Meal 2", category: "daily_supp", notes: null, ingredientKey: "Vitamin K" },
  { id: "supp-12", name: "Vitamin C", amount: "1 serving", timing: "With Meal 2", category: "daily_supp", notes: null, ingredientKey: "Vitamin C" },
  { id: "supp-13", name: "Milk Thistle", amount: "1 serving", timing: "With Meal 2", category: "daily_supp", notes: null, ingredientKey: "Milk Thistle" },
  { id: "supp-14", name: "P5P", amount: "1 serving", timing: "With Meal 2", category: "daily_supp", notes: null, ingredientKey: "P5P" },
  { id: "supp-15", name: "Magnesium", amount: "1 serving", timing: "At night", category: "daily_supp", notes: null, ingredientKey: "Magnesium" },
  { id: "supp-16", name: "Zinc", amount: "1 serving", timing: "At night", category: "daily_supp", notes: null, ingredientKey: "Zinc" },
];

// Ingredient metadata (unit + category) keyed by name — used for the
// grocery/low-stock list's grouping and units.
const INGREDIENT_INFO = {
  "Whey isolate": { unit: "serving", category: "protein" },
  "Oats (Bob's Red Mill)": { unit: "g", category: "carb" },
  "Frozen strawberries": { unit: "g", category: "produce" },
  "Natural peanut butter": { unit: "g", category: "fat" },
  "Organic cinnamon": { unit: "tsp", category: "spice" },
  "Liquid egg whites": { unit: "g", category: "protein" },
  "Omega-3 whole eggs": { unit: "egg", category: "protein" },
  "Red or yukon potato": { unit: "g", category: "carb" },
  "Ground beef 93% lean (grass fed)": { unit: "oz", category: "protein" },
  "Jasmine rice": { unit: "g", category: "carb" },
  "Dark green veggies": { unit: "g", category: "produce" },
  "Kimchi": { unit: "serving", category: "produce" },
  "Caramel rice cakes": { unit: "cake", category: "carb" },
  "Cream of rice": { unit: "g", category: "carb" },
  "EAAs": { unit: "serving", category: "supplement" },
  "Carb powder": { unit: "serving", category: "supplement" },
  "Creatine": { unit: "g", category: "supplement" },
  "Chicken breast": { unit: "oz", category: "protein" },
  "Ground turkey": { unit: "oz", category: "protein" },
  "Dates (medjool)": { unit: "g", category: "produce" },
  "Pineapple": { unit: "g", category: "produce" },
  "Almonds": { unit: "g", category: "fat" },
  "Avocado": { unit: "each", category: "fat" },
  "Water (intra-workout)": { unit: "L", category: "liquid" },
  "Redmond Re-Lyte electrolytes": { unit: "serving", category: "supplement" },
  "Aloe vera juice (inner filet, sugar-free)": { unit: "oz", category: "liquid" },
  "Glutamine": { unit: "g", category: "supplement" },
  "Lemon": { unit: "each", category: "produce" },
  "Silver Fern digestive enzyme": { unit: "serving", category: "supplement" },
  "Dr's Best Pepsin GI": { unit: "serving", category: "supplement" },
  "Fish oil": { unit: "serving", category: "supplement" },
  "Vitamin D": { unit: "serving", category: "supplement" },
  "Vitamin K": { unit: "serving", category: "supplement" },
  "Vitamin C": { unit: "serving", category: "supplement" },
  "Milk Thistle": { unit: "serving", category: "supplement" },
  "P5P": { unit: "serving", category: "supplement" },
  "Magnesium": { unit: "serving", category: "supplement" },
  "Zinc": { unit: "serving", category: "supplement" },
};

// item: { name, amount, altGroup, notes }
function item(name, amount, altGroup, notes) {
  return { name, amount, altGroup: altGroup || null, notes: notes || null };
}

const MEALS = [
  // ── Training day ──
  { id: "training-1", dayType: "training", name: "Meal 1", time: "9:00 AM", items: [
    item("Whey isolate", "1.5 servings", null, "37.5g protein"),
    item("Oats (Bob's Red Mill)", "85 g"),
    item("Frozen strawberries", "150 g"),
    item("Natural peanut butter", "15 g"),
    item("Organic cinnamon", "1/2 tsp", null, "insulin sensitivity"),
  ]},
  { id: "training-2", dayType: "training", name: "Meal 2", time: "11:30 AM", items: [
    item("Liquid egg whites", "250 g"),
    item("Omega-3 whole eggs", "2 eggs"),
    item("Red or yukon potato", "400 g", null, "cooked, or plain hash browns"),
  ]},
  { id: "training-3", dayType: "training", name: "Meal 3", time: "2:00 PM", items: [
    item("Ground beef 93% lean (grass fed)", "6 oz", null, "cooked"),
    item("Red or yukon potato", "200 g", 1, "cooked"),
    item("Jasmine rice", "130 g", 1, "cooked"),
    item("Dark green veggies", "100 g"),
    item("Kimchi", "1 serving", null, "optional"),
  ]},
  { id: "training-4", dayType: "training", name: "Meal 4 — Pre-Workout", time: "4:30–4:45 PM", items: [
    item("Whey isolate", "2 servings", null, "50g protein"),
    item("Caramel rice cakes", "7 cakes", 1),
    item("Cream of rice", "90 g", 1, "dry"),
    item("Natural peanut butter", "15 g"),
  ]},
  { id: "training-5", dayType: "training", name: "Intra-Workout", time: "sip 10 min prior, drink throughout", items: [
    item("EAAs", "1 serving"),
    item("Carb powder", "1 serving", null, "25g carbs"),
    item("Creatine", "10 g"),
    item("Water (intra-workout)", "1 L", null, "minimum"),
  ]},
  { id: "training-6", dayType: "training", name: "Meal 5 — Post-Workout", time: "8:30–9:00 PM", items: [
    item("Chicken breast", "7 oz", 1, "cooked"),
    item("Ground turkey", "7 oz", 1, "cooked"),
    item("Jasmine rice", "320 g", null, "cooked"),
    item("Dates (medjool)", "60 g", 2, "~3 medjool"),
    item("Pineapple", "150 g", 2),
  ]},
  // ── Rest day ──
  { id: "rest-1", dayType: "rest", name: "Meal 1", time: "9:00 AM", items: [
    item("Whey isolate", "1.5 servings", null, "37.5g protein"),
    item("Oats (Bob's Red Mill)", "50 g"),
    item("Frozen strawberries", "150 g"),
    item("Natural peanut butter", "20 g"),
    item("Organic cinnamon", "1/2 tsp"),
  ]},
  { id: "rest-2", dayType: "rest", name: "Meal 2", time: "11:30 AM", items: [
    item("Liquid egg whites", "250 g"),
    item("Omega-3 whole eggs", "3 eggs"),
    item("Red or yukon potato", "250 g", null, "cooked, or plain hash browns"),
  ]},
  { id: "rest-3", dayType: "rest", name: "Meal 3", time: "2:00 PM", items: [
    item("Ground beef 93% lean (grass fed)", "6 oz", null, "cooked"),
    item("Red or yukon potato", "200 g", 1, "cooked"),
    item("Jasmine rice", "130 g", 1, "cooked"),
    item("Dark green veggies", "100 g"),
    item("Kimchi", "1 serving", null, "optional"),
  ]},
  { id: "rest-4", dayType: "rest", name: "Meal 4", time: "5:00 PM", items: [
    item("Chicken breast", "6 oz", 1, "cooked"),
    item("Ground turkey", "6 oz", 1, "cooked"),
    item("Jasmine rice", "150 g", null, "cooked"),
  ]},
  { id: "rest-5", dayType: "rest", name: "Meal 5", time: "8:30 PM", items: [
    // Option A: chicken or turkey. Option B: egg white + whole egg combo.
    item("Chicken breast", "5 oz", 1, "cooked — Option A"),
    item("Ground turkey", "5 oz", 1, "cooked — Option A"),
    item("Liquid egg whites", "225 g", 2, "Option B, pair with 1 whole egg"),
    item("Omega-3 whole eggs", "1 egg", 2, "Option B, pair with egg whites above"),
    item("Dark green veggies", "100 g"),
    item("Almonds", "15 g", 3),
    item("Avocado", "1/4 each", 3),
  ]},
];

function mealsForDayType(dayType) {
  return MEALS.filter(m => m.dayType === dayType);
}
