#!/usr/bin/env python3
"""Build src/lib/restaurantFoods.json from NYC DOHMH MenuStat (Historical).

Data: NYC Open Data "DOHMH MenuStat (Historical)" (dataset qgc5-ecnb), menu items and
nutrition from the largest US restaurant chains, 2017-2018:
  https://data.cityofnewyork.us/api/views/qgc5-ecnb/rows.csv?accessType=DOWNLOAD
Used under the NYC Open Data terms of use.

Usage: python3 scripts/build_menustat.py <menustat.csv> [out.json]

Each row: [id, item name, chain, kcal, protein, carbs, fat, fiber, servingLabel, grams|null, micro]
with nutrition PER SERVING. grams is null when the chain gave no weight; the app then logs
it per serving. micro follows the order in build_usda_foods.py (MICROS).
"""
import csv
import json
import os
import re
import sys

ML_PER_FLOZ = 29.5735
G_PER_OZ = 28.3495
# Positions in the app's micronutrient list (lib/nutrients.js): satFat, transFat, cholesterol, sodium, sugars, potassium.
MICRO_COLS = [("Saturated_Fat", 0), ("Trans_Fat", 1), ("Cholesterol", 2), ("Sodium", 3), ("Sugar", 4), ("Potassium", 6)]
SKIP_CATEGORIES = {"Toppings & Ingredients"}  # sauces, cheese slices... mostly noise next to whole dishes


def num(s):
    try:
        v = float(s)
        return v if v >= 0 else None
    except (TypeError, ValueError):
        return None


def clean(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


def main():
    src = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "src", "lib", "restaurantFoods.json")
    latest = {}
    with open(src, newline="", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            if num(r["Calories"]) is None or r["Food_Category"] in SKIP_CATEGORIES:
                continue
            if r.get("Limited_Time_Offer") == "1" or r.get("Regional") == "1":
                continue
            k = r["Menu_Item_ID"]
            if k not in latest or r["Year"] > latest[k]["Year"]:
                latest[k] = r
    rows, seen = [], set()
    for r in sorted(latest.values(), key=lambda r: (r["restaurant"].lower(), r["Item_Name"].lower())):
        chain, item = clean(r["restaurant"]), clean(r["Item_Name"])
        if not chain or not item:
            continue
        size, unit = num(r["Serving_Size"]), clean(r["Serving_Size_Unit"]).lower()
        grams = None
        label = "1 serving"
        if size:
            if unit == "g":
                grams, label = size, f"1 serving ({size:g} g)"
            elif unit == "fl oz":
                grams, label = size * ML_PER_FLOZ, f"{size:g} fl oz"
            elif unit == "oz":
                grams, label = size * G_PER_OZ, f"{size:g} oz"
            elif unit == "ml":
                grams, label = size, f"{size:g} ml"
        hh = clean(r.get("Serving_Size_household"))
        if hh and len(hh) <= 30:
            label = f"{hh}" + (f" ({label})" if grams else "")
        key = (chain.lower(), item.lower(), round(grams or 0))
        if key in seen:
            continue
        seen.add(key)
        r1 = lambda v: round(v, 1) if v is not None else 0
        micro = [None] * 7
        for col, i in MICRO_COLS:
            micro[i] = num(r.get(col))
        while micro and micro[-1] is None:
            micro.pop()
        rows.append([f"ms-{r['Menu_Item_ID']}", item, chain, round(num(r["Calories"])), r1(num(r["Protein"])),
                     r1(num(r["Carbohydrates"])), r1(num(r["Total_Fat"])), r1(num(r["Dietary_Fiber"])),
                     label[:50], round(grams, 1) if grams else None, micro])
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(rows, fh, ensure_ascii=False, separators=(",", ":"))
    chains = {}
    for r in rows:
        chains[r[2]] = chains.get(r[2], 0) + 1
    print(f"{len(rows)} items from {len(chains)} chains → {out_path} ({os.path.getsize(out_path) // 1024} KB)")


if __name__ == "__main__":
    main()
