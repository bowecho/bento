import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Bento exposes a simple manual planning surface", async () => {
  const [page, app, layout, styles, actions, schema, plannerData, packageFile] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/bento-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/planner-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /BentoApp/);
  assert.match(page, /loadPlannerData/);
  assert.match(page, /initialCategories/);
  assert.match(app, /Food library/);
  assert.match(app, /Shopping list/);
  assert.match(app, /Import foods/);
  assert.match(app, /Manage categories/);
  assert.match(app, /New category/);
  assert.match(app, /Remove category/);
  assert.match(app, /Move foods to/);
  assert.match(app, /Category for these foods/);
  assert.match(app, /MonthPlanner/);
  assert.match(app, /application\/x-bento-food/);
  assert.match(app, /createCategoryAction/);
  assert.match(app, /deleteCategoryAction/);
  assert.match(app, /createFoodAction/);
  assert.match(app, /categoryId/);
  assert.doesNotMatch(app, /Generate week|Replace this week\?|Generate menu for/);
  assert.doesNotMatch(app, /Gentle guidance|variety-legend|variety-card|recent use/i);
  assert.doesNotMatch(app, /Pairs well with|Don’t pair with|pairing/i);
  assert.doesNotMatch(app, /times? this week|usage-badge/i);
  assert.doesNotMatch(app, /Drag any food into any meal|Drop food here/);
  assert.doesNotMatch(app, /Bento’s suggestions prioritize variety/);
  assert.doesNotMatch(app, /className="meal-add"|selection-banner|Select to add on touch devices/);

  assert.match(schema, /food_category_record/);
  assert.match(schema, /categoryId: uuid\("category_id"\)/);
  assert.doesNotMatch(schema, /food_relationship|ai_generation_rate_limit|food_relationship_kind/);
  assert.match(plannerData, /categories.*foods.*plans/s);
  assert.doesNotMatch(actions, /OpenRouter|openrouter|generateWeek|categorize|relationship|rate.limit/i);
  assert.doesNotMatch(packageFile, /@openrouter\/sdk/);

  assert.match(app, /Choose theme and appearance/);
  assert.match(app, /Appearance mode/);
  assert.match(app, /Ink.*Cobalt.*Ruby.*Evergreen.*Saffron.*Amethyst.*Lagoon.*Tangerine.*Rosewood.*Iris.*Moss.*Espresso/s);
  assert.match(`${app}${layout}`, /bento-theme/);
  assert.match(`${app}${layout}`, /bento-color-theme/);
  assert.match(styles, /\[data-theme="dark"\]/);
  assert.doesNotMatch(styles, /\.day-card:nth-child/);
  assert.match(styles, /\.day-card \{[^}]*background: #fff;/);
  assert.match(styles, /\.day-card\.today[^}]*background: #fff;/);
  assert.doesNotMatch(styles, /touch-tip|planner-footnote|food-chooser|variety-card|usage-badge/);
  assert.match(styles, /\.category-manager-list/);
  assert.match(layout, /openGraph/);
  assert.match(layout, /\/og\.png/);
  assert.match(styles, /@media \(max-width: 620px\)/);
  assert.doesNotMatch(`${page}${app}${layout}`, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});
