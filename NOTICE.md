# Third-party code and data

FossFitness is licensed under GPL-3.0-or-later. It includes or builds on the following.

## Data

- **USDA FoodData Central** (SR Legacy and FNDDS), U.S. Department of Agriculture, Agricultural Research Service.
  Public domain (CC0 1.0). `app/src/lib/usdaFoods.json`, `app/src/lib/curatedMicros.json`.
  <https://fdc.nal.usda.gov/>
- **MenuStat**: "DOHMH MenuStat (Historical)", NYC Department of Health and Mental Hygiene, via NYC Open Data
  (dataset qgc5-ecnb), menu items from the largest US restaurant chains, 2017–2018. Used under the
  [NYC Open Data Terms of Use](https://opendata.cityofnewyork.us/overview/#termsofuse).
  `app/src/lib/restaurantFoods.json` (built by `app/scripts/build_menustat.py`).
  <https://data.cityofnewyork.us/Health/DOHMH-MenuStat/qgc5-ecnb>
  Restaurant and product names belong to their owners and are used only to identify menu items.
- **Tesseract English model** (`eng.traineddata` from tessdata_fast), Apache-2.0.
  `app/modules/label-ocr/android/src/main/assets/tessdata/`. <https://github.com/tesseract-ocr/tessdata_fast>

## Libraries (fetched at build time)

| Project | License |
|---|---|
| React Native, Expo SDK modules | MIT |
| Tesseract4Android 4.9.0 (Tesseract 5.5.1, Leptonica 1.85.0, libjpeg, libpng) | Apache-2.0 (Leptonica: BSD-2-Clause; libjpeg/libpng: their own permissive licenses) |
| react-native-svg, react-native-safe-area-context, AsyncStorage | MIT |
| react-native-health-connect, AndroidX (incl. Health Connect client) | MIT / Apache-2.0 |

`app/patches/` modifies expo-notifications, expo-application and expo-modules-core (MIT); the changes are
offered under the same MIT terms as the originals.
