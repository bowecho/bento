export const CATEGORIES = ["Breakfast", "Snack", "Lunch"] as const;
export type Category = (typeof CATEGORIES)[number];
export type CategoryKey = "breakfast" | "snack" | "lunch";

export type Food = {
  id: string;
  name: string;
  pairsWellWith: string;
  avoidPairingWith: string;
  createdAt: number;
};

export type DayPlan = Record<CategoryKey, string[]>;
export type Plans = Record<string, DayPlan>;
