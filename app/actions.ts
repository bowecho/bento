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

const ImportFoodItemSchema = z.object({
  name: z.string().trim().min(1).max(80),
  categoryName: z.string().trim().min(1).max(40).optional(),
});

const ImportFoodsInputSchema = z.object({
  items: z.array(ImportFoodItemSchema).min(1).max(250),
  fallbackCategoryId: z.uuid(),
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
  const { items, fallbackCategoryId } = ImportFoodsInputSchema.parse(input);
  const db = getDb();

  await db.transaction(async (tx) => {
    const categoryRows = await tx
      .select({
        id: foodCategory.id,
        name: foodCategory.name,
        sortOrder: foodCategory.sortOrder,
      })
      .from(foodCategory);
    if (!categoryRows.some((category) => category.id === fallbackCategoryId)) {
      throw new Error("That default category is no longer available.");
    }

    const categoriesByName = new Map(
      categoryRows.map((category) => [category.name.toLowerCase(), category]),
    );
    let nextSortOrder = Math.max(0, ...categoryRows.map((category) => category.sortOrder)) + 1;
    const requestedCategories = new Map<string, string>();
    for (const item of items) {
      if (!item.categoryName) continue;
      const key = item.categoryName.toLowerCase();
      if (!categoriesByName.has(key)) requestedCategories.set(key, item.categoryName);
    }

    for (const [key, name] of requestedCategories) {
      const [created] = await tx
        .insert(foodCategory)
        .values({ name, sortOrder: nextSortOrder })
        .onConflictDoNothing()
        .returning({
          id: foodCategory.id,
          name: foodCategory.name,
          sortOrder: foodCategory.sortOrder,
        });
      nextSortOrder += 1;

      if (created) {
        categoriesByName.set(key, created);
        continue;
      }

      const [existing] = await tx
        .select({
          id: foodCategory.id,
          name: foodCategory.name,
          sortOrder: foodCategory.sortOrder,
        })
        .from(foodCategory)
        .where(sql`lower(${foodCategory.name}) = lower(${name})`)
        .limit(1);
      if (!existing) throw new Error(`Bento couldn’t create the ${name} category.`);
      categoriesByName.set(key, existing);
    }

    const currentFoods = await tx.select({ name: foodItem.name }).from(foodItem);
    const existingNames = new Set(currentFoods.map(({ name }) => name.toLowerCase()));
    const newItems = [...new Map(
      items
        .filter((item) => !existingNames.has(item.name.toLowerCase()))
        .map((item) => [item.name.toLowerCase(), item]),
    ).values()];

    if (newItems.length > 0) {
      await tx
        .insert(foodItem)
        .values(newItems.map((item) => ({
          name: item.name,
          categoryId: item.categoryName
            ? categoriesByName.get(item.categoryName.toLowerCase())?.id ?? fallbackCategoryId
            : fallbackCategoryId,
        })))
        .onConflictDoNothing();
    }
  });

  revalidatePath("/");
  const data = await loadPlannerData();
  return { categories: data.categories, foods: data.foods };
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
