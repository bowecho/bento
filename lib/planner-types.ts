export const CATEGORIES = ["Breakfast", "Snack", "Lunch"] as const;
export type Category = (typeof CATEGORIES)[number];
export type CategoryKey = "breakfast" | "snack" | "lunch";

export type Food = {
  id: string;
  name: string;
  categories: Category[];
  createdAt: number;
};

export type DayPlan = Record<CategoryKey, string[]>;
export type Plans = Record<string, DayPlan>;
