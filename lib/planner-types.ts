import type { FoodCategory } from "@/lib/food-categories";

export const CATEGORIES = ["Breakfast", "Snack", "Lunch"] as const;
export type Category = (typeof CATEGORIES)[number];
export type CategoryKey = "breakfast" | "snack" | "lunch";

export type Food = {
  id: string;
  name: string;
  category: FoodCategory;
  pairsWellWithIds: string[];
  avoidPairingWithIds: string[];
  createdAt: number;
};

export type DayPlan = Record<CategoryKey, string[]>;
export type Plans = Record<string, DayPlan>;
