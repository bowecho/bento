import assert from "node:assert/strict";
import test from "node:test";
import { movePlannedFood } from "../lib/plan-order.ts";

function day(breakfast = [], snack = [], lunch = []) {
  return { breakfast, snack, lunch };
}

test("reorders foods within the same meal", () => {
  const plans = { "2026-07-13": day(["alpha", "beta", "gamma"]) };
  const result = movePlannedFood(
    plans,
    { foodId: "gamma", date: "2026-07-13", category: "breakfast" },
    { date: "2026-07-13", category: "breakfast", index: 0 },
  );

  assert.deepEqual(result["2026-07-13"].breakfast, ["gamma", "alpha", "beta"]);
  assert.deepEqual(plans["2026-07-13"].breakfast, ["alpha", "beta", "gamma"]);
});

test("moves a food between meals on the same day", () => {
  const plans = { "2026-07-13": day(["alpha", "beta"], ["gamma"]) };
  const result = movePlannedFood(
    plans,
    { foodId: "beta", date: "2026-07-13", category: "breakfast" },
    { date: "2026-07-13", category: "snack", index: 0 },
  );

  assert.deepEqual(result["2026-07-13"].breakfast, ["alpha"]);
  assert.deepEqual(result["2026-07-13"].snack, ["beta", "gamma"]);
});

test("moves a food to an ordered position on another day", () => {
  const plans = {
    "2026-07-13": day(["alpha"]),
    "2026-07-14": day([], [], ["beta", "gamma"]),
  };
  const result = movePlannedFood(
    plans,
    { foodId: "alpha", date: "2026-07-13", category: "breakfast" },
    { date: "2026-07-14", category: "lunch", index: 1 },
  );

  assert.deepEqual(result["2026-07-13"].breakfast, []);
  assert.deepEqual(result["2026-07-14"].lunch, ["beta", "alpha", "gamma"]);
});

test("removes the source when the destination already contains the food", () => {
  const plans = {
    "2026-07-13": day(["alpha"]),
    "2026-07-14": day([], [], ["beta", "alpha", "gamma"]),
  };
  const result = movePlannedFood(
    plans,
    { foodId: "alpha", date: "2026-07-13", category: "breakfast" },
    { date: "2026-07-14", category: "lunch", index: 3 },
  );

  assert.deepEqual(result["2026-07-13"].breakfast, []);
  assert.deepEqual(result["2026-07-14"].lunch, ["beta", "gamma", "alpha"]);
});
