import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Bento exposes its complete planning surface", async () => {
  const [page, app, layout, styles, actions, schema] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/bento-app.tsx", import.meta.url), "utf8"),
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
  assert.doesNotMatch(app, /Works for|Filter food categories|food\.categories|matching meal/);
  assert.match(app, /MonthPlanner/);
  assert.match(app, /application\/x-bento-food/);
  assert.doesNotMatch(app, /className="meal-add"|selection-banner|Select to add on touch devices/);
  assert.doesNotMatch(app, /Drop food here/);
  assert.match(page, /loadPlannerData/);
  assert.match(app, /createFoodAction/);
  assert.doesNotMatch(styles, /filter-row|category-choice|food-categories|mini-dot/);
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
  assert.match(actions, /google\/gemini-2\.5-flash-lite/);
  assert.match(actions, /process\.env\.OpenRouterKey/);
  assert.match(actions, /requireParameters: true/);
  assert.match(actions, /RATE_LIMIT_REQUESTS = 5/);
  assert.match(schema, /ai_generation_rate_limit/);
  assert.doesNotMatch(`${page}${app}${layout}`, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});
