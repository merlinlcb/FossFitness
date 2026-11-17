#!/usr/bin/env python3
"""Build src/lib/usdaFoods.json from USDA FoodData Central CSV downloads.

Data: USDA FoodData Central (public domain, CC0). Download the CSV zips from
https://fdc.nal.usda.gov/download-datasets/ and unzip them:
  - SR Legacy (FoodData_Central_sr_legacy_food_csv_2018-04)
  - Survey / FNDDS (FoodData_Central_survey_food_csv_2024-10-31)

Usage:
  python3 scripts/build_usda_foods.py <sr_legacy_dir> <fndds_dir> [out.json]

Output rows match the hand-made list in foods.js:
  [id, name, category, kcal, protein, carbs, fat, fiber, [[label, grams], ...]]
with nutrition per 100 g. Ids are "usda-<fdc_id>" and never change between runs,
so saved favourites and recent foods keep working after a rebuild.
"""
import csv
import json
import os
import re
import sys

MAX_SERVINGS = 4

# Micronutrients kept per food, in this order (the app's lib/nutrients.js uses the same order).
# [key, SR Legacy nutrient id, FNDDS nutrient number]
MICROS = [
    ["satFat", "1258", "606"], ["transFat", "1257", None], ["cholesterol", "1253", "601"], ["sodium", "1093", "307"],
    ["sugars", "2000", "269"], ["addedSugars", "1235", None], ["potassium", "1092", "306"], ["calcium", "1087", "301"],
    ["iron", "1089", "303"], ["magnesium", "1090", "304"], ["zinc", "1095", "309"], ["phosphorus", "1091", "305"],
    ["selenium", "1103", "317"], ["copper", "1098", "312"], ["manganese", "1101", None], ["vitaminA", "1106", "320"],
    ["vitaminC", "1162", "401"], ["vitaminD", "1114", "328"], ["vitaminE", "1109", "323"], ["vitaminK", "1185", "430"],
    ["thiamin", "1165", "404"], ["riboflavin", "1166", "405"], ["niacin", "1167", "406"], ["vitaminB6", "1175", "415"],
    ["folate", "1190", "435"], ["vitaminB12", "1178", "418"], ["choline", "1180", "421"],
]


def micro_list(n):
    out = []
    for key, _, _ in MICROS:
        v = n.get(key)
        out.append(None if v is None else (round(v, 3) if v < 1 else round(v, 1)))
    while out and out[-1] is None:
        out.pop()
    return out
SAUCES = "Sauces, Soups & Spices"

# SR Legacy food_category ids → app categories (None = leave out).
SR_CATEGORIES = {
    1: "Dairy & Eggs", 2: SAUCES, 3: None, 4: "Nuts & Fats", 5: "Protein", 6: SAUCES,
    7: "Protein", 8: "Grains & Bread", 9: "Fruit", 10: "Protein", 11: "Vegetables",
    12: "Nuts & Fats", 13: "Protein", 14: "Drinks", 15: "Protein", 16: "Protein",
    17: "Protein", 18: "Grains & Bread", 19: "Snacks & Sweets", 20: "Grains & Bread",
    21: "Meals & Fast Food", 22: "Meals & Fast Food", 23: "Snacks & Sweets", 24: None,
    25: "Meals & Fast Food", 26: None, 27: None, 28: "Drinks",
}


def fndds_category(code):
    """WWEIA food category code → app category (None = leave out)."""
    c = int(code)
    if c in (1402, 7208, 7220):
        return "Drinks"
    if c == 2502:
        return "Dairy & Eggs"
    if c == 2804:
        return "Nuts & Fats"
    if c in (8006, 8008):
        return "Dairy & Eggs"
    if c == 9802:
        return "Protein"
    if 1000 <= c < 2000:
        return "Dairy & Eggs"
    if 2000 <= c < 3000:
        return "Protein"
    if 3000 <= c < 4000:
        return "Meals & Fast Food"
    if 4000 <= c < 5000:
        return "Grains & Bread"
    if 5000 <= c < 6000:
        return "Snacks & Sweets"
    if 6000 <= c < 6400:
        return "Fruit"
    if 6400 <= c < 7000:
        return "Vegetables"
    if 7000 <= c < 8000:
        return "Drinks"
    if 8000 <= c < 8400:
        return "Nuts & Fats"
    if 8400 <= c < 8800:
        return SAUCES
    if 8800 <= c < 9000:
        return "Snacks & Sweets"
    return None  # baby food, formula, human milk, uncategorised


def read(path):
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def num(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def fmt_amount(a):
    if a is None:
        return ""
    fractions = {0.25: "¼", 0.5: "½", 0.75: "¾", 0.33: "⅓", 0.333: "⅓", 0.67: "⅔", 0.667: "⅔"}
    whole = int(a)
    frac = round(a - whole, 3)
    if frac == 0:
        return str(whole)
    sym = fractions.get(frac) or fractions.get(round(frac, 2))
    if sym:
        return (str(whole) if whole else "") + sym
    return ("%g" % round(a, 2))


def clean_label(s):
    s = re.sub(r"\s+", " ", s).strip(" ,")
    return s[:40]


def nutrients(path, ids):
    """fdc_id → {key: amount} for the nutrient ids we use."""
    out = {}
    for r in read(path):
        key = ids.get(r["nutrient_id"])
        if key:
            out.setdefault(r["fdc_id"], {})[key] = num(r["amount"])
    return out


def build_sr(d):
    units = {r["id"]: r["name"] for r in read(os.path.join(d, "measure_unit.csv"))}
    # SR Legacy uses nutrient ids; 2047/2048 are fallbacks for energy.
    nut = nutrients(os.path.join(d, "food_nutrient.csv"),
                    {"1008": "kcal", "2047": "kcal_a", "2048": "kcal_s", "1003": "protein",
                     "1005": "carbs", "1004": "fat", "1079": "fiber", **{m[1]: m[0] for m in MICROS}})
    portions = {}
    for r in sorted(read(os.path.join(d, "food_portion.csv")), key=lambda r: (r["fdc_id"], int(r["seq_num"] or 0))):
        g = num(r["gram_weight"])
        if not g or g < 0.1:
            continue
        unit = units.get(r["measure_unit_id"], "")
        unit = "" if unit in ("undetermined", "") else unit
        amount = fmt_amount(num(r["amount"]))
        mod = r["modifier"].strip()
        label = " ".join(x for x in (amount, unit) if x)
        if mod:
            label = f"{label}, {mod}" if unit else f"{label} {mod}"
        portions.setdefault(r["fdc_id"], []).append((clean_label(label), round(g, 2)))
    foods = []
    for r in read(os.path.join(d, "food.csv")):
        cat = SR_CATEGORIES.get(int(r["food_category_id"] or 0))
        if not cat:
            continue
        name = r["description"].strip()
        if cat == "Fruit" and "juice" in name.lower():
            cat = "Drinks"
        foods.append((r["fdc_id"], name, cat, nut.get(r["fdc_id"], {}), portions.get(r["fdc_id"], [])))
    return foods


def build_fndds(d):
    # FNDDS food_nutrient uses the old nutrient numbers (208 = energy, ...).
    nut = nutrients(os.path.join(d, "food_nutrient.csv"),
                    {"208": "kcal", "203": "protein", "205": "carbs", "204": "fat", "291": "fiber",
                     **{m[2]: m[0] for m in MICROS if m[2]}})
    portions = {}
    for r in sorted(read(os.path.join(d, "food_portion.csv")), key=lambda r: (r["fdc_id"], int(r["seq_num"] or 0))):
        g = num(r["gram_weight"])
        desc = r["portion_description"].strip()
        if not g or g < 0.1 or not desc or "not specified" in desc.lower():
            continue
        portions.setdefault(r["fdc_id"], []).append((clean_label(desc), round(g, 2)))
    foods = []
    for r in read(os.path.join(d, "food.csv")):
        cat = fndds_category(r["food_category_id"] or 9999)
        if not cat:
            continue
        foods.append((r["fdc_id"], r["description"].strip(), cat, nut.get(r["fdc_id"], {}), portions.get(r["fdc_id"], [])))
    return foods


# Hand-picked USDA entries for hand-made foods the word matcher gets wrong.
PINS = {
    "Grapes": "Grapes, red or green (European type, such as Thompson seedless), raw",
    "Watermelon": "Watermelon, raw", "Tomato": "Tomatoes, raw", "Bell pepper": "Peppers, sweet, green, cooked, boiled, drained, without salt",
    "Broccoli, cooked": "Broccoli, cooked, boiled, drained, without salt", "Corn, cooked": "Corn, sweet, yellow, cooked, boiled, drained, without salt",
    "Green beans, cooked": "Beans, snap, green, cooked, boiled, drained, without salt", "Cauliflower, cooked": "Cauliflower, cooked, boiled, drained, without salt",
    "Peas, cooked": "Peas, green, cooked, boiled, drained, without salt", "Salad greens": "Lettuce, green leaf, raw",
    "Brown rice, cooked": "Rice, brown, cooked, no added fat", "Rolled oats, dry": "Cereals, oats, regular and quick, not fortified, dry",
    "Crackers": "Crackers, saltine", "Pancakes": "Pancakes, plain", "Bacon, cooked": "Pork, cured, bacon, cooked, baked",
    "Salmon, cooked": "Fish, salmon, Atlantic, farmed, cooked, dry heat", "Shrimp, cooked": "Shrimp, steamed or boiled",
    "Turkey, deli slices": "Turkey, prepackaged or deli, luncheon meat",
    "Black beans, cooked": "Beans, black, mature seeds, cooked, boiled, without salt", "Lentils, cooked": "Lentils, mature seeds, cooked, boiled, without salt",
    "Chickpeas, cooked": "Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt",
    "Egg": "Egg, whole, raw", "Milk, 2%": "Milk, reduced fat (2%)", "Yogurt, fruit flavored": "Yogurt, low fat milk, fruit",
    "Cottage cheese, 2%": "Cheese, cottage, lowfat, 2% milkfat", "Milk chocolate bar": "Candies, milk chocolate",
    "Donut, glazed": "Doughnut, yeast type", "Blueberry muffin": "Muffin, blueberry, commercially prepared, low-fat",
    "Chocolate cake": "Cake, chocolate, commercially prepared with chocolate frosting, in-store bakery",
    "Cheese pizza": "Pizza, cheese, from restaurant or fast food, NS as to type of crust",
    "Pepperoni pizza": "Pizza with pepperoni, from restaurant or fast food, NS as to type of crust",
    "Cheeseburger": "Cheeseburger, from fast food, 1 medium patty", "Chicken burrito": "Burrito, chicken, cheese",
    "Fried chicken": "Chicken breast, fried, coated, skin / coating eaten, from fast food / restaurant",
    "Caesar salad": "Caesar salad, with romaine, no dressing",
    "Grilled chicken salad": "Chicken or turkey garden salad, chicken and/or turkey, tomato and/or carrots, other vegetables, no dressing",
    "Mac and cheese": "Macaroni or noodles with cheese", "California roll": "Sushi roll, California",
    "Coffee, black": "Coffee, brewed", "Latte (2% milk)": "Coffee, Latte", "Soda (cola)": "Soft drink, cola",
    "Protein shake (RTD)": "Nutritional drink or shake, high protein, ready-to-drink, NFS",
    "Liquor (80 proof)": "Alcoholic beverage, distilled, all (gin, rum, vodka, whiskey) 80 proof",
    "Mixed fruit cup": "Fruit cocktail, (peach and pineapple and pear and grape and cherry), canned, juice pack, solids and liquids",
    "Cereal, flakes": "Cereal, corn flakes, plain", "Dark chocolate (70%)": "Chocolate, dark, 70-85% cacao solids",
    "Popcorn, buttered": "Popcorn, movie theater, with added butter", "Hummus": "Hummus, plain",
    "Ground beef 85%, cooked": "Beef, ground, 85% lean meat / 15% fat, crumbles, cooked, pan-browned",
    "Steak, sirloin, cooked": "Beef, steak, sirloin, lean only eaten",
    "Chicken breast, cooked": "Chicken breast, baked, broiled, or roasted, skin not eaten, from raw",
    "Chicken thigh, cooked": "Chicken thigh, baked, broiled, or roasted, skin not eaten, from raw",
    "Spaghetti with meat sauce": "Spaghetti with meat sauce, frozen entree", "Sausage link": "Sausage, NFS",
    "Fried rice": "Rice, fried, NFS", "Granola bar": "Cereal or granola bar (General Mills Nature Valley Crunchy Granola Bar)",
    "Protein bar": "Nutrition bar (Snickers Marathon Protein Bar)", "Brown rice": "Rice, brown, cooked, no added fat",
    "Waffle": "Waffle, NFS",
    "Granola": "Cereal, granola", "Hamburger bun": "Roll, white, hamburger bun", "Beef taco": "Taco, corn tortilla, beef, cheese",
    "Walnuts": "Nuts, walnuts, english", "White rice, cooked": "Rice, white, cooked, no added fat", "White bread": "Bread, white",
    "Whole wheat bread": "Bread, whole wheat", "Flour tortilla": "Tortilla, flour", "Corn tortilla": "Tortilla, corn",
    "Cheddar cheese": "Cheese, Cheddar", "Mozzarella, part-skim": "Cheese, Mozzarella, part skim",
    "Greek yogurt, plain nonfat": "Yogurt, Greek, nonfat milk, plain", "Tuna, canned in water": "Fish, tuna, white, canned in water, drained solids",
    "Zucchini": "Squash, summer, zucchini, includes skin, raw", "Mashed potatoes": "Potato, mashed, NFS",
    "Chocolate chip cookie": "Cookie, chocolate chip", "Chicken noodle soup": "Soup, chicken noodle, canned, prepared with equal volume water",
    "Protein powder (whey)": "Beverages, Protein powder whey based", "Sweet tea": "Tea, iced, brewed, black, pre-sweetened with sugar",
    "White fish, cooked": "Fish, white, mixed species, grilled", "Diet soda": "Soft drink, cola, diet", "French fries": "French fries, from fast food / restaurant", "Oatmeal, cooked": "Oatmeal, NFS", "Instant ramen": None, "Pork chop, cooked": None,
}

STOP = {"cooked", "raw", "the", "and", "or", "with", "a", "of", "plain", "regular", "fresh"}


def words(s):
    return [w for w in re.findall(r"[a-z]+", s.lower()) if w not in STOP]


def match_curated(rows, foods_js):
    """Borrow micronutrients for the hand-made foods in foods.js from a close USDA match:
    every word of the name appears in the USDA name and calories are within 20%."""
    raw = open(foods_js, encoding="utf-8").read()
    out, report = {}, []
    for name, kcal in re.findall(r"\[\'([^']+)\', '[^']+', (\d+(?:\.\d+)?),", raw.replace("\\'", "\u2019")):
        want = words(name.replace("\u2019", "'"))
        if not want:
            continue
        real = name.replace("\u2019", "'")
        best = None
        if real in PINS:
            pick = next((r for r in rows if PINS[real] and r[1] == PINS[real] and len(r) > 9 and r[9]), None)
            if pick:
                best = ((0, 0), pick)
            rows_to_try = []
        else:
            rows_to_try = rows
        for r in rows_to_try:
            if len(r) < 10 or not r[9]:
                continue
            have = set(words(r[1]))
            first = words(r[1])[:1]
            # Every word must appear, and the USDA name must start with the same thing.
            if first and first[0][:4] == want[0][:4] and all(any(h.startswith(w[:5]) for h in have) for w in want):
                k = float(kcal)
                if (k == 0 and r[3] <= 5) or (k > 0 and abs(r[3] - k) <= 0.2 * k):
                    score = (len(r[9]), -len(r[1]))
                    if not best or score > best[0]:
                        best = (score, r)
        slug = re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", name.replace("\u2019", "'").lower()))
        if best:
            out["db-" + slug] = best[1][9]
            report.append("  %-32s <- %s" % (name, best[1][1][:70]))
        else:
            report.append("  %-32s    (no match)" % name)
    print("curated matches:\n" + "\n".join(report))
    return out


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    sr_dir, fndds_dir = sys.argv[1], sys.argv[2]
    out_path = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(__file__), "..", "src", "lib", "usdaFoods.json")
    rows = []
    seen = set()
    # FNDDS first: its names read like everyday food ("Pizza, cheese, from restaurant").
    for fdc_id, name, cat, n, servings in build_fndds(fndds_dir) + build_sr(sr_dir):
        kcal = n.get("kcal") if n.get("kcal") is not None else n.get("kcal_a", n.get("kcal_s"))
        if kcal is None:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        r1 = lambda v: round(v or 0, 1)
        uniq = []
        for label, g in servings:
            if label and label not in [u[0] for u in uniq]:
                uniq.append([label, g])
        if not uniq and cat == "Drinks":
            uniq = [["1 cup (8 fl oz)", 240]]
        rows.append([f"usda-{fdc_id}", name, cat, round(kcal), r1(n.get("protein")), r1(n.get("carbs")),
                     r1(n.get("fat")), r1(n.get("fiber")), uniq[:MAX_SERVINGS], micro_list(n)])
    rows.sort(key=lambda r: r[1].lower())
    curated = match_curated(rows, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "lib", "foods.js"))
    with open(os.path.join(os.path.dirname(out_path), "curatedMicros.json"), "w", encoding="utf-8") as fh:
        json.dump(curated, fh, ensure_ascii=False, separators=(",", ":"))
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(rows, fh, ensure_ascii=False, separators=(",", ":"))
    by_cat = {}
    for r in rows:
        by_cat[r[2]] = by_cat.get(r[2], 0) + 1
    print(f"{len(rows)} foods → {out_path} ({os.path.getsize(out_path) // 1024} KB)")
    for c, k in sorted(by_cat.items(), key=lambda x: -x[1]):
        print(f"  {k:5d}  {c}")


if __name__ == "__main__":
    main()
