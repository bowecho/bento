import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { foodItem, foodRelationship, mealPlanItem } from "@/db/schema";
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
  const [foodRows, relationshipRows, planRows] = await Promise.all([
    db.select().from(foodItem).orderBy(asc(foodItem.name)),
    db.select().from(foodRelationship),
    db
      .select()
      .from(mealPlanItem)
      .orderBy(
        asc(mealPlanItem.planDate),
        asc(mealPlanItem.category),
        asc(mealPlanItem.createdAt),
      ),
  ]);

  const pairIds = new Map<string, string[]>();
  const avoidIds = new Map<string, string[]>();
  for (const relationship of relationshipRows) {
    const collection = relationship.kind === "pairs_well" ? pairIds : avoidIds;
    const current = collection.get(relationship.sourceFoodId) ?? [];
    current.push(relationship.targetFoodId);
    collection.set(relationship.sourceFoodId, current);
  }

  const foods: Food[] = foodRows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    pairsWellWithIds: pairIds.get(row.id) ?? [],
    avoidPairingWithIds: avoidIds.get(row.id) ?? [],
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
