// Builds src/data/foods.json from scripts/food-spec.tsv (USDA FoodData Central),
// scripts/food-spec-branded.tsv (Open Food Facts) and scripts/indb-foods.json
// (Indian dishes, produced by scripts/extract-indb.py).
//
//   USDA_API_KEY=... node scripts/build-food-library.mjs
//
// Values are stored per serving, to one decimal place.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const here = (p) => new URL(p, import.meta.url);
const rows = (file) =>
  existsSync(here(file))
    ? readFileSync(here(file), 'utf8').split('\n').filter((l) => l.trim() && !l.startsWith('#')).map((l) => l.split('|').map((c) => c.trim()))
    : [];
const round1 = (n) => Math.round(n * 10) / 10;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, headers = {}) {
  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(250 + attempt * 800);
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return await res.json();
    } catch {
      /* retry */
    }
  }
  throw new Error(`Could not fetch ${url}`);
}

// USDA nutrient ids. Energy is reported under different ids in different datasets.
const ENERGY = [1008, 2047, 2048];
const PROTEIN = [1003];
const FAT = [1004];
const CARBS = [1005];
const SUGARS = [2000, 1063];

const sugarFor = (rule, total) => (rule === '0' ? 0 : total);

async function usdaFoods() {
  const key = process.env.USDA_API_KEY;
  const out = [];
  for (const [name, fdcId, , label, grams, rule, aliases] of rows('./food-spec.tsv')) {
    const food = await getJson(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}`, key ? { 'X-Api-Key': key } : {});
    const per100 = (ids) => {
      for (const id of ids) {
        const hit = food.foodNutrients?.find((n) => n.nutrient?.id === id && typeof n.amount === 'number');
        if (hit) return hit.amount;
      }
      return null;
    };
    const [kcal, protein, fat, carbs] = [per100(ENERGY), per100(PROTEIN), per100(FAT), per100(CARBS)];
    if ([kcal, protein, fat, carbs].some((v) => v === null)) {
      console.warn(`SKIPPED ${name}: missing nutrients in USDA record ${fdcId}`);
      continue;
    }
    const f = Number(grams) / 100;
    out.push({
      id: `usda-${fdcId}`, name, serving: `${label} (${grams} g)`,
      calories: round1(kcal * f), protein: round1(protein * f), carbs: round1(carbs * f), fats: round1(fat * f),
      sugar: round1(sugarFor(rule, per100(SUGARS) ?? 0) * f),
      ...(rule === 'A' ? { sugarApprox: true } : {}),
      ...(aliases ? { aliases: aliases.split(',').map((a) => a.trim()).filter(Boolean) } : {}),
      source: 'USDA FoodData Central', usdaDescription: food.description,
    });
  }
  return out;
}

async function brandedFoods() {
  const out = [];
  for (const [name, brand, code, label, amount, unit, rule, aliases] of rows('./food-spec-branded.tsv')) {
    const data = await getJson(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,nutriments`,
      { 'User-Agent': 'MealGlimpseFoodLibrary/1.0' },
    );
    const n = data.product?.nutriments ?? {};
    const [kcal, protein, fat, carbs] = [n['energy-kcal_100g'], n.proteins_100g, n.fat_100g, n.carbohydrates_100g];
    if ([kcal, protein, fat, carbs].some((v) => typeof v !== 'number')) {
      console.warn(`SKIPPED ${name}: incomplete label data for barcode ${code}`);
      continue;
    }
    const f = Number(amount) / 100;
    const added = n['added-sugars_100g'];
    const total = typeof n.sugars_100g === 'number' ? n.sugars_100g : 0;
    const exactAdded = typeof added === 'number';
    out.push({
      id: `off-${code}`, name, brand, serving: `${label} (${amount} ${unit})`,
      calories: round1(kcal * f), protein: round1(protein * f), carbs: round1(carbs * f), fats: round1(fat * f),
      sugar: round1((rule === '0' ? 0 : exactAdded ? added : total) * f),
      ...(rule === 'A' && !exactAdded ? { sugarApprox: true } : {}),
      ...(aliases ? { aliases: aliases.split(',').map((a) => a.trim()).filter(Boolean) } : {}),
      source: 'Open Food Facts',
    });
  }
  return out;
}

const indbFoods = JSON.parse(readFileSync(here('./indb-foods.json'), 'utf8'));
const foods = [...(await usdaFoods()), ...(await brandedFoods()), ...indbFoods].sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(here('../src/data/foods.json'), JSON.stringify(foods, null, 1) + '\n');
console.log(`Wrote ${foods.length} foods`);

// Sanity report: calories should roughly equal 4p + 4c + 9f (alcohol aside).
for (const f of foods) {
  const est = 4 * f.protein + 4 * f.carbs + 9 * f.fats;
  if (f.calories > 15 && Math.abs(est - f.calories) / f.calories > 0.25) {
    console.log(`CHECK ${f.name}: ${f.calories} kcal vs ${Math.round(est)} from macros`);
  }
}
