"""Builds scripts/indb-foods.json from the Indian Nutrient Databank spreadsheet.

    python3 scripts/extract-indb.py /path/to/INDB.xlsx

INDB.xlsx comes from https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-
Values are per serving where INDB gives a serving, otherwise per 100 g.
Added sugar uses INDB's "free sugar" figure, flagged as approximate.
Syrup-soaked sweets (rasgulla, rasmalai) are left out of the list because INDB counts all the syrup.

INDB counts all the oil a recipe calls for, including the full pan of oil used
for deep frying, so deep-fried dishes come out far too high (a single poori at
over 900 kcal). Dishes that are mostly fat and energy-dense are therefore left
out; see `mostly_frying_oil`.
"""
import json
import os
import sys

import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
UNIT_NAMES = {'parantha': 'paratha'}
# Units that describe a whole batch, not a helping; these dishes are stored per 100 g instead.
BATCH_UNITS = {'chicken', 'dish', 'jar', 'souffle dish'}


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def mostly_frying_oil(kcal_100g, fat_100g):
    """True when a dish is energy-dense and over 70% of its energy is fat."""
    return kcal_100g > 300 and fat_100g * 9 / kcal_100g > 0.7


def main(xlsx):
    ws = openpyxl.load_workbook(xlsx, read_only=True, data_only=True).worksheets[0]
    rows = ws.iter_rows(values_only=True)
    head = [str(h) for h in next(rows)]
    ix = {h: i for i, h in enumerate(head)}
    by_code = {r[ix['food_code']]: r for r in rows if r[ix['food_code']]}

    out, skipped = [], []
    for line in open(os.path.join(HERE, 'food-spec-indb.tsv'), encoding='utf-8'):
        if not line.strip() or line.startswith('#'):
            continue
        code, name, aliases = [c.strip() for c in line.rstrip('\n').split('|')]
        r = by_code.get(code)
        if r is None:
            skipped.append(f'{name}: code {code} not found')
            continue
        get = lambda col: num(r[ix[col]])
        if get('energy_kcal') and get('fat_g') is not None and mostly_frying_oil(get('energy_kcal'), get('fat_g')):
            skipped.append(f'{name}: deep-fried, INDB counts all the frying oil ({round(get("energy_kcal"))} kcal per 100 g)')
            continue
        unit = str(r[ix['servings_unit']] or '').strip()
        per_serving = [get(f'unit_serving_{k}') for k in ('energy_kcal', 'protein_g', 'carb_g', 'fat_g', 'freesugar_g')]
        if unit and unit not in BATCH_UNITS and all(v is not None for v in per_serving[:4]):
            kcal, protein, carbs, fat, sugar = per_serving
            serving = f'1 {UNIT_NAMES.get(unit, unit)}'
        else:
            kcal, protein, carbs, fat, sugar = [get(k) for k in ('energy_kcal', 'protein_g', 'carb_g', 'fat_g', 'freesugar_g')]
            serving = '100 g'
        if None in (kcal, protein, carbs, fat):
            skipped.append(f'{name}: missing nutrients')
            continue
        food = {
            'id': f'indb-{code}', 'name': name, 'serving': serving,
            'calories': round(kcal, 1), 'protein': round(protein, 1), 'carbs': round(carbs, 1),
            'fats': round(fat, 1), 'sugar': round(min(sugar or 0, carbs), 1),
            # INDB's free-sugar figure can include milk and fruit sugars, so it is shown as approximate.
            'sugarApprox': True,
            'source': 'the Indian Nutrient Databank (INDB)', 'indbName': str(r[ix['food_name']]).strip(),
        }
        if aliases:
            food['aliases'] = [a.strip() for a in aliases.split(',') if a.strip()]
        out.append(food)

    json.dump(out, open(os.path.join(HERE, 'indb-foods.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(f'Wrote {len(out)} INDB foods')
    for s in skipped:
        print('SKIPPED', s)
    for f in out:
        est = 4 * f['protein'] + 4 * f['carbs'] + 9 * f['fats']
        if f['calories'] > 15 and abs(est - f['calories']) / f['calories'] > 0.3:
            print(f"CHECK {f['name']}: {f['calories']} kcal vs {round(est)} from macros")
        if f['serving'] == '100 g':
            print(f"NOTE {f['name']}: no serving in INDB, stored per 100 g")
        elif f['calories'] > 650 or f['calories'] < 8:
            print(f"CHECK {f['name']}: {f['calories']} kcal per {f['serving']}")


if __name__ == '__main__':
    main(sys.argv[1])
