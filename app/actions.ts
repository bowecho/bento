"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { foodCategory, foodItem, mealPlanItem } from "@/db/schema";
import { loadPlannerData } from "@/lib/planner-data";

const CategoryKeySchema = z.enum(["breakfast", "snack", "lunch"]);
const DateSchema = z.iso.date();

const FoodInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  categoryId: z.uuid(),
});

const CategoryInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
});

const DeleteCategoryInputSchema = z.object({
  id: z.uuid(),
  replacementCategoryId: z.uuid().optional(),
});

const ImportFoodsInputSchema = z.object({
  names: z.array(z.string().trim().min(1).max(80)).min(1).max(250),
  categoryId: z.uuid(),
});

const PlanItemSchema = z.object({
  date: DateSchema,
  category: CategoryKeySchema,
  foodId: z.uuid(),
});

async function ensureCategoryExists(categoryId: string) {
  const [category] = await getDb()
    .select({ id: foodCategory.id })
    .from(foodCategory)
    .where(eq(foodCategory.id, categoryId))
    .limit(1);
  if (!category) throw new Error("That category is no longer available.");
}

export async function createCategoryAction(
  input: z.input<typeof CategoryInputSchema>,
) {
  const { name } = CategoryInputSchema.parse(input);
  const db = getDb();
  const [duplicate] = await db
    .select({ name: foodCategory.name })
    .from(foodCategory)
    .where(sql`lower(${foodCategory.name}) = lower(${name})`)
    .limit(1);
  if (duplicate) throw new Error(`${duplicate.name} already exists.`);

  const [{ nextOrder }] = await db
    .select({ nextOrder: sql<number>`coalesce(max(${foodCategory.sortOrder}), 0) + 1` })
    .from(foodCategory);
  await db.insert(foodCategory).values({ name, sortOrder: Number(nextOrder ?? 1) });
  revalidatePath("/");
  return (await loadPlannerData()).categories;
}

export async function deleteCategoryAction(
  input: z.input<typeof DeleteCategoryInputSchema>,
) {
  const { id, replacementCategoryId } = DeleteCategoryInputSchema.parse(input);
  if (id === replacementCategoryId) {
    throw new Error("Choose a different category for those foods.");
  }

  const db = getDb();
  const categories = await db.select({ id: foodCategory.id }).from(foodCategory);
  if (!categories.some((category) => category.id === id)) {
    throw new Error("Category not found.");
  }
  if (categories.length <= 1) {
    throw new Error("Bento needs at least one food category.");
  }

  const [{ foodCount }] = await db
    .select({ foodCount: sql<number>`count(*)` })
    .from(foodItem)
    .where(eq(foodItem.categoryId, id));
  const hasFoods = Number(foodCount ?? 0) > 0;
  if (hasFoods && !replacementCategoryId) {
    throw new Error("Choose where to move the foods in this category.");
  }
  if (replacementCategoryId) await ensureCategoryExists(replacementCategoryId);

  await db.transaction(async (tx) => {
    if (hasFoods && replacementCategoryId) {
      await tx
        .update(foodItem)
        .set({ categoryId: replacementCategoryId, updatedAt: new Date() })
        .where(eq(foodItem.categoryId, id));
    }
    await tx.delete(foodCategory).where(eq(foodCategory.id, id));
  });

  revalidatePath("/");
  const data = await loadPlannerData();
  return { categories: data.categories, foods: data.foods };
}

export async function createFoodAction(input: z.input<typeof FoodInputSchema>) {
  const parsed = FoodInputSchema.parse(input);
  const db = getDb();
  const [duplicate] = await db
    .select({ name: foodItem.name })
    .from(foodItem)
    .where(sql`lower(${foodItem.name}) = lower(${parsed.name})`)
    .limit(1);
  if (duplicate) throw new Error(`${duplicate.name} is already in your library.`);

  await ensureCategoryExists(parsed.categoryId);
  await db.insert(foodItem).values(parsed);
  revalidatePath("/");
  return (await loadPlannerData()).foods;
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
  if (duplicate) throw new Error(`${duplicate.name} is already in your library.`);

  await ensureCategoryExists(parsed.categoryId);
  const [updated] = await db
    .update(foodItem)
    .set({ ...parsed, updatedAt: new Date() })
    .where(eq(foodItem.id, foodId))
    .returning({ id: foodItem.id });
  if (!updated) throw new Error("Food not found.");
  revalidatePath("/");
  return (await loadPlannerData()).foods;
}

export async function deleteFoodAction(id: string) {
  const foodId = z.uuid().parse(id);
  await getDb().delete(foodItem).where(eq(foodItem.id, foodId));
  revalidatePath("/");
  return (await loadPlannerData()).foods;
}

export async function importFoodsAction(
  input: z.input<typeof ImportFoodsInputSchema>,
) {
  const { names, categoryId } = ImportFoodsInputSchema.parse(input);
  await ensureCategoryExists(categoryId);
  const db = getDb();
  const current = await db.select({ name: foodItem.name }).from(foodItem);
  const existingNames = new Set(current.map(({ name }) => name.toLowerCase()));
  const newNames = [...new Map(
    names
      .filter((name) => !existingNames.has(name.toLowerCase()))
      .map((name) => [name.toLowerCase(), name]),
  ).values()];

  if (newNames.length > 0) {
    await db
      .insert(foodItem)
      .values(newNames.map((name) => ({ name, categoryId })))
      .onConflictDoNothing();
  }
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

export async function removePlanItemAction(input: z.input<typeof PlanItemSchema>) {
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
