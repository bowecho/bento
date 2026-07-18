export const FOOD_CATEGORIES = [
  { key: "protein", label: "Protein" },
  { key: "fruit", label: "Fruit" },
  { key: "vegetable", label: "Vegetable" },
  { key: "dairy", label: "Dairy" },
  { key: "grain_starch", label: "Grain & Starch" },
  { key: "pantry_extra", label: "Pantry & Extras" },
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number]["key"];

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> =
  Object.fromEntries(
    FOOD_CATEGORIES.map(({ key, label }) => [key, label]),
  ) as Record<FoodCategory, string>;
