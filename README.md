# MacroMeter

A calm, safe calorie-deficit and macro tracker. React + Vite, deployed on Vercel. All personal data stays in the browser (localStorage) with export/import backups.

## Features

- **Onboarding**: name, sex, age, height, current and goal weight, optional body fat %, activity level. Blocks underweight goals (BMI < 18.5) and under-18 users.
- **Safe deficit picker** (same approach as fatcalc.com/rwl):
  - Mifflin-St Jeor resting metabolic rate × physical activity level (1.4–2.2)
  - Body fat estimated from BMI (Jackson et al. 2002) if you don't enter it
  - Intakes listed in 100 kcal steps, never below 1,200 kcal (women) / 1,500 kcal (men)
  - Each option rated **Safe**, **Firm** or **Not recommended** (hidden) using: deficit vs. the most your fat stores can supply per day (Alpert, ~69 kcal per kg of fat), weekly loss above 1% of body weight, deficit above 25% of maintenance
  - Time to goal from a dynamic model after Kevin Hall (NIH): fat and lean mass tracked separately, expenditure falls as you lose weight, plus adaptive thermogenesis. Reproduces fatcalc's worked example (~70 weeks). Run `npm run test:calc` to check.
- **Macros** after picking a deficit: Higher protein (30/45/25), Balanced (20/50/30), Lower carb (35/30/35) or custom.
- **Intuitive eating mode** (Settings): hides all calorie numbers. The day shows as a filling circle with protein/carbs/fat circles, each food shows a small fill dot, and quick add works by portion size.
- **Barcode scanner** for snacks and ingredients (camera, works on iPhone and Android over https), with product data from [Open Food Facts](https://world.openfoodfacts.org). Unknown barcodes can be added once and are remembered.
- **Create → I made it / From a label / Just numbers** (type calories and macros you already know).
- **Create → I made it**: name a smoothie, shake or snack, list ingredients with an amount and unit (g, ml, tsp, tbsp, cup, scoop, piece…), and get per-ingredient and per-serving nutrition. Add up to 4 photos (packs, nutrition labels, the finished dish) and Gemini reads the labels for exact numbers, or works out the ingredients itself if you leave the list empty. It's saved to your meals for re-logging or sending to the cookbook. **From a label** keeps the manual nutrition-label form.
- **Search**: ~100 everyday foods built in (instant, offline, per-portion e.g. "1 large egg"), packaged products from Open Food Facts via a server-side search with a backup source, and "Ask Gemini" for anything else.
- **Scan**: *Barcode* (live camera) or *Photo* — one photo of anything: a barcode in shot is looked up first; otherwise Gemini reads the package label or estimates the meal on the plate.
- **Eating out**: describe a restaurant or takeaway order (Taco Bell, McDonald's, mamak…) including mixed rice stalls, with an optional photo for an AI estimate that uses chains' published nutrition where known.
- **Plan start date** in Settings: progress, start weight and the chart are measured from it.
- **Kitchen**
  - *On hand*: list ingredients you have (type or scan)
  - *Ideas*: menu suggestions from a built-in recipe library ranked by what you have and what fits your remaining day; optional AI chef (see below)
  - *Cook*: build a meal ingredient-by-ingredient while cooking, set servings, log a serving
  - *Saved meals*: re-log or edit meals
- **Cookbook**: send any meal's name and ingredient list to your Google Doc; you write the method yourself.
- **Progress**: weigh-ins, history, chart with projection, progress bar, predicted goal date (model) and your real trend, plus a prompt to recalculate the plan when your weight has changed by 2 kg.
- Light/dark mode, installable to the home screen (PWA manifest).

## Run locally

```bash
npm install
npm run dev
```

The `/api` functions only run on Vercel (or with `npx vercel dev`). Without them the app still works; the cookbook falls back to sending directly to Google.

## Deploy to Vercel

1. Push this repo to GitHub:
   ```bash
   git remote add origin https://github.com/<you>/macrometer.git
   git push -u origin main
   ```
2. In Vercel: **Add New → Project → Import** the repo. The framework (Vite) and settings come from `vercel.json`. Click **Deploy**.
3. Optional AI features (photo estimates, eating-out estimates, AI chef): in the Vercel project, **Settings → Environment Variables**, add `GEMINI_API_KEY` with a free key from [Google AI Studio](https://aistudio.google.com/apikey) (optionally `GEMINI_MODEL`, default `gemini-3.5-flash-lite`), or `ANTHROPIC_API_KEY` for Claude. Redeploy and the features switch on automatically.

Open the Vercel link on your phone and use **Add to Home Screen** to install it.

## Link your Google Doc cookbook

1. Open (or create) your cookbook Google Doc → **Extensions → Apps Script**.
2. Replace the code with [`google-apps-script/Cookbook.gs`](google-apps-script/Cookbook.gs) and save.
3. Optional: set `SECRET` in the script to a password.
4. **Deploy → New deployment → Web app**, *Execute as: Me*, *Who has access: Anyone*. Authorise, then copy the Web app URL (ends in `/exec`).
5. In MacroMeter → **Settings → Cookbook**, paste the doc link, the Web app URL and the secret (if set). Tap **Send a test**.

Each meal is appended as a heading with its ingredient list and an empty "Method" section.

## Project layout

```
api/                    Vercel functions (cookbook proxy, food search, AI chef, photo/restaurant/recipe estimates)
google-apps-script/     Script to paste into your Google Doc
public/                 Icons and manifest
scripts/check-calc.ts   Sanity checks for the maths
src/lib/calc.ts         BMR/TDEE, body fat, safety rules, dynamic weight model, macros
src/lib/store.ts        Local state + persistence
src/lib/foodApi.ts      Open Food Facts search + barcode lookup
src/lib/recipes.ts      Built-in recipe library and pantry matching
src/screens/            Onboarding, PlanPicker, Today, AddFood, Kitchen, Progress, Settings
```

## Disclaimer

Estimates only, not medical advice. If you're pregnant, breastfeeding, under 18 or managing a health condition, talk to a doctor before starting a deficit.
