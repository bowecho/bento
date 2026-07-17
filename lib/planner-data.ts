import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { foodItem, mealPlanItem } from "@/db/schema";
import {
  type DayPlan,
  type Food,
  type Plans,
} from "@/lib/planner-types";

function emptyDay(): DayPlan {
  return { breakfast: [], snack: [], lunch: [] };
}

export async function loadPlannerData() {
  const db = getDb();
  const [foodRows, planRows] = await Promise.all([
    db.select().from(foodItem).orderBy(asc(foodItem.name)),
    db
      .select()
      .from(mealPlanItem)
      .orderBy(
        asc(mealPlanItem.planDate),
        asc(mealPlanItem.category),
        asc(mealPlanItem.createdAt),
      ),
  ]);

  const foods: Food[] = foodRows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.getTime(),
  }));

  const plans: Plans = {};
  for (const row of planRows) {
    const day = plans[row.planDate] ?? emptyDay();
    day[row.category].push(row.foodId);
    plans[row.planDate] = day;
  }

  return { foods, plans };
}
