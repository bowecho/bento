import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Bento exposes its complete planning surface", async () => {
  const [page, app, layout, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/bento-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /BentoApp/);
  assert.match(page, /A happier week, one meal at a time/);
  assert.match(app, /Food library/);
  assert.match(app, /Generate week/);
  assert.match(app, /Shopping list/);
  assert.match(app, /Import foods/);
  assert.match(app, /MonthPlanner/);
  assert.match(app, /application\/x-bento-food/);
  assert.match(page, /loadPlannerData/);
  assert.match(app, /createFoodAction/);
  assert.doesNotMatch(app, /localStorage/);
  assert.match(layout, /openGraph/);
  assert.match(layout, /\/og\.png/);
  assert.match(styles, /@media \(max-width: 620px\)/);
  assert.doesNotMatch(`${page}${app}${layout}`, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});
