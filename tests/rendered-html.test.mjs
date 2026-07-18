import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Bento exposes its complete planning surface", async () => {
  const [page, app, chooser, categories, layout, styles, actions, schema] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/bento-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/food-chooser.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/food-categories.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /BentoApp/);
  assert.match(page, /A happier week, one meal at a time/);
  assert.match(app, /Food library/);
  assert.match(app, /Generate week/);
  assert.doesNotMatch(app, /Generate menu for|onGenerateDay|day-sparkle/);
  assert.match(app, /Replace this week\?/);
  assert.match(app, /Shopping list/);
  assert.doesNotMatch(app, /Gentle guidance|variety-legend/);
  assert.match(app, /Import foods/);
  assert.match(app, /Drag any food into any meal/);
  assert.doesNotMatch(app, /Works for|food\.categories|matching meal/);
  assert.match(app, /Filter food categories/);
  assert.match(categories, /Protein.*Fruit.*Vegetable.*Dairy.*Grain & Starch.*Pantry & Extras/s);
  assert.match(app, /Automatic organization/);
  assert.match(app, /Bento will choose the best category/);
  assert.match(app, /MonthPlanner/);
  assert.match(app, /application\/x-bento-food/);
  assert.doesNotMatch(app, /className="meal-add"|selection-banner|Select to add on touch devices/);
  assert.doesNotMatch(app, /Drop food here/);
  assert.match(page, /loadPlannerData/);
  assert.match(app, /createFoodAction/);
  assert.doesNotMatch(styles, /mini-dot/);
  assert.match(app, /Choose theme and appearance/);
  assert.match(app, /Appearance mode/);
  assert.doesNotMatch(app, /Toggle light or dark mode/);
  assert.match(app, /Ink.*Cobalt.*Ruby.*Evergreen.*Saffron.*Amethyst.*Lagoon.*Tangerine.*Rosewood.*Iris.*Moss.*Espresso/s);
  assert.match(`${app}${layout}`, /bento-theme/);
  assert.match(`${app}${layout}`, /bento-color-theme/);
  assert.match(styles, /\[data-theme="dark"\]/);
  assert.doesNotMatch(styles, /\.day-card:nth-child/);
  assert.match(styles, /\.day-card \{[^}]*background: #fff;/);
  assert.match(styles, /\.day-card\.today[^}]*background: #fff;/);
  assert.match(styles, /\.month-weekdays[^}]*background: var\(--accent-soft\)/);
  assert.match(styles, /data-palette="cobalt"/);
  assert.match(styles, /data-palette="espresso"/);
  assert.doesNotMatch(styles, /\.meal-zone-heading > div\s*\{[^}]*background/);
  assert.match(layout, /openGraph/);
  assert.match(layout, /\/og\.png/);
  assert.match(styles, /@media \(max-width: 620px\)/);
  assert.match(actions, /google\/gemini-2\.5-flash/);
  assert.match(actions, /process\.env\.OpenRouterKey/);
  assert.match(actions, /requireParameters: true/);
  assert.match(actions, /RATE_LIMIT_REQUESTS = 5/);
  assert.match(actions, /MAX_GENERATION_ATTEMPTS = 3/);
  assert.match(actions, /InvalidGeneratedWeekError/);
  assert.match(actions, /Math\.floor\(foods\.length \/ 6\)/);
  assert.match(actions, /CompatibilityReviewSchema/);
  assert.match(actions, /conventional children’s breakfast, snack, and lunchbox choices/);
  assert.match(actions, /violatesExplicitPairingGuidance/);
  assert.match(app, /Pairs well with/);
  assert.match(app, /Don’t pair with/);
  assert.match(chooser, /selectedIds/);
  assert.match(chooser, /aria-pressed/);
  assert.doesNotMatch(app, /Use food names or short guidance|pairing-text-area/);
  assert.match(actions, /categorizeFoodNames/);
  assert.match(actions, /bento_food_categories/);
  assert.match(actions, /FOOD_CATEGORIZATION_MODEL/);
  assert.match(schema, /food_relationship/);
  assert.match(schema, /food_category/);
  assert.match(schema, /ai_generation_rate_limit/);
  assert.doesNotMatch(`${page}${app}${layout}`, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});
