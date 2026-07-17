"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { foodItem, mealPlanItem } from "@/db/schema";
import { loadPlannerData } from "@/lib/planner-data";

const CategoryKeySchema = z.enum(["breakfast", "snack", "lunch"]);
const DateSchema = z.iso.date();

const FoodInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

const PlanItemSchema = z.object({
  date: DateSchema,
  category: CategoryKeySchema,
  foodId: z.uuid(),
});

function toFood(row: typeof foodItem.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.getTime(),
  };
}

export async function createFoodAction(input: z.input<typeof FoodInputSchema>) {
  const parsed = FoodInputSchema.parse(input);
  const db = getDb();
  const [duplicate] = await db
    .select()
    .from(foodItem)
    .where(sql`lower(${foodItem.name}) = lower(${parsed.name})`)
    .limit(1);

  if (duplicate) {
    throw new Error(`${duplicate.name} is already in your library.`);
  }

  const [created] = await db
    .insert(foodItem)
    .values(parsed)
    .returning();
  if (!created) throw new Error("Failed to create food");
  revalidatePath("/");
  return toFood(created);
}

export async function updateFoodAction(
  id: string,
  input: z.input<typeof FoodInputSchema>,
) {
  const foodId = z.uuid().parse(id);
  const parsed = FoodInputSchema.parse(input);
  const db = getDb();
  const [duplicate] = await db
    .select({ id: foodItem.id, name: foodItem.name })
    .from(foodItem)
    .where(sql`lower(${foodItem.name}) = lower(${parsed.name}) and ${foodItem.id} <> ${foodId}`)
    .limit(1);

  if (duplicate) {
    throw new Error(`${duplicate.name} is already in your library.`);
  }

  const [updated] = await db
    .update(foodItem)
    .set({ ...parsed, updatedAt: new Date() })
    .where(eq(foodItem.id, foodId))
    .returning();
  if (!updated) throw new Error("Food not found");
  revalidatePath("/");
  return toFood(updated);
}

export async function deleteFoodAction(id: string) {
  const foodId = z.uuid().parse(id);
  await getDb().delete(foodItem).where(eq(foodItem.id, foodId));
  revalidatePath("/");
}

export async function importFoodsAction(
  input: z.input<typeof FoodInputSchema>[],
) {
  const foods = z.array(FoodInputSchema).min(1).max(1000).parse(input);
  const db = getDb();

  await db.transaction(async (tx) => {
    const current = await tx.select().from(foodItem);
    const byName = new Map(current.map((row) => [row.name.toLowerCase(), row]));

    for (const food of foods) {
      const key = food.name.toLowerCase();
      const existing = byName.get(key);
      if (!existing) {
        const [created] = await tx.insert(foodItem).values(food).returning();
        if (created) byName.set(key, created);
      }
    }
  });

  revalidatePath("/");
  return (await loadPlannerData()).foods;
}

export async function addPlanItemAction(input: z.input<typeof PlanItemSchema>) {
  const item = PlanItemSchema.parse(input);
  await getDb()
    .insert(mealPlanItem)
    .values({ planDate: item.date, category: item.category, foodId: item.foodId })
    .onConflictDoNothing();
  revalidatePath("/");
}

export async function addPlanItemsAction(
  input: z.input<typeof PlanItemSchema>[],
) {
  const items = z.array(PlanItemSchema).max(500).parse(input);
  if (items.length === 0) return;

  await getDb()
    .insert(mealPlanItem)
    .values(
      items.map((item) => ({
        planDate: item.date,
        category: item.category,
        foodId: item.foodId,
      })),
    )
    .onConflictDoNothing();
  revalidatePath("/");
}

export async function removePlanItemAction(
  input: z.input<typeof PlanItemSchema>,
) {
  const item = PlanItemSchema.parse(input);
  await getDb()
    .delete(mealPlanItem)
    .where(
      and(
        eq(mealPlanItem.planDate, item.date),
        eq(mealPlanItem.category, item.category),
        eq(mealPlanItem.foodId, item.foodId),
      ),
    );
  revalidatePath("/");
}
