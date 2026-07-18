"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { foodCategory, foodItem, mealPlanItem } from "@/db/schema";
import { loadPlannerData } from "@/lib/planner-data";
import { adjustedDropIndex } from "@/lib/plan-order";

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

const AddPlanItemSchema = PlanItemSchema.extend({
  toIndex: z.number().int().min(0).max(100).optional(),
});

const MovePlanItemSchema = z.object({
  foodId: z.uuid(),
  fromDate: DateSchema,
  fromCategory: CategoryKeySchema,
  toDate: DateSchema,
  toCategory: CategoryKeySchema,
  toIndex: z.number().int().min(0).max(100),
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

export async function addPlanItemAction(input: z.input<typeof AddPlanItemSchema>) {
  const item = AddPlanItemSchema.parse(input);
  const db = getDb();
  await db.transaction(async (tx) => {
    const destination = await tx
      .select({ id: mealPlanItem.id, foodId: mealPlanItem.foodId })
      .from(mealPlanItem)
      .where(
        and(
          eq(mealPlanItem.planDate, item.date),
          eq(mealPlanItem.category, item.category),
        ),
      )
      .orderBy(mealPlanItem.sortOrder, mealPlanItem.createdAt);
    if (destination.some((row) => row.foodId === item.foodId)) return;

    const [inserted] = await tx
      .insert(mealPlanItem)
      .values({
        planDate: item.date,
        category: item.category,
        foodId: item.foodId,
        sortOrder: destination.length,
      })
      .returning({ id: mealPlanItem.id, foodId: mealPlanItem.foodId });
    if (!inserted) throw new Error("Bento couldn’t add that food.");

    const ordered = [...destination];
    const targetIndex = Math.min(item.toIndex ?? ordered.length, ordered.length);
    ordered.splice(targetIndex, 0, inserted);
    for (const [sortOrder, row] of ordered.entries()) {
      await tx
        .update(mealPlanItem)
        .set({ sortOrder })
        .where(eq(mealPlanItem.id, row.id));
    }
  });
  revalidatePath("/");
}

export async function movePlanItemAction(
  input: z.input<typeof MovePlanItemSchema>,
) {
  const item = MovePlanItemSchema.parse(input);
  const db = getDb();

  const moved = await db.transaction(async (tx) => {
    const [source] = await tx
      .select({ id: mealPlanItem.id })
      .from(mealPlanItem)
      .where(
        and(
          eq(mealPlanItem.planDate, item.fromDate),
          eq(mealPlanItem.category, item.fromCategory),
          eq(mealPlanItem.foodId, item.foodId),
        ),
      )
      .limit(1);
    if (!source) throw new Error("That planned food is no longer available.");

    const sameMeal = item.fromDate === item.toDate
      && item.fromCategory === item.toCategory;
    const destination = await tx
      .select({ id: mealPlanItem.id, foodId: mealPlanItem.foodId })
      .from(mealPlanItem)
      .where(
        and(
          eq(mealPlanItem.planDate, item.toDate),
          eq(mealPlanItem.category, item.toCategory),
        ),
      )
      .orderBy(mealPlanItem.sortOrder, mealPlanItem.createdAt);
    const existingDestinationIndex = destination.findIndex(
      (row) => row.foodId === item.foodId,
    );
    if (!sameMeal && existingDestinationIndex >= 0) return false;

    let movedRow: (typeof destination)[number] | undefined = destination[existingDestinationIndex];
    if (!sameMeal) {
      await tx.delete(mealPlanItem).where(eq(mealPlanItem.id, source.id));
      if (!movedRow) {
        [movedRow] = await tx
          .insert(mealPlanItem)
          .values({
            planDate: item.toDate,
            category: item.toCategory,
            foodId: item.foodId,
            sortOrder: destination.length,
          })
          .returning({ id: mealPlanItem.id, foodId: mealPlanItem.foodId });
      }
    } else {
      movedRow = destination.find((row) => row.id === source.id);
    }
    if (!movedRow) throw new Error("Bento couldn’t move that food.");

    const destinationWithoutMoved = destination.filter(
      (row) => row.id !== movedRow.id,
    );
    const targetIndex = adjustedDropIndex(
      existingDestinationIndex,
      item.toIndex,
      destinationWithoutMoved.length,
    );
    destinationWithoutMoved.splice(targetIndex, 0, movedRow);
    for (const [sortOrder, row] of destinationWithoutMoved.entries()) {
      await tx
        .update(mealPlanItem)
        .set({ sortOrder })
        .where(eq(mealPlanItem.id, row.id));
    }

    if (!sameMeal) {
      const sourceRemainder = await tx
        .select({ id: mealPlanItem.id })
        .from(mealPlanItem)
        .where(
          and(
            eq(mealPlanItem.planDate, item.fromDate),
            eq(mealPlanItem.category, item.fromCategory),
          ),
        )
        .orderBy(mealPlanItem.sortOrder, mealPlanItem.createdAt);
      for (const [sortOrder, row] of sourceRemainder.entries()) {
        await tx
          .update(mealPlanItem)
          .set({ sortOrder })
          .where(eq(mealPlanItem.id, row.id));
      }
    }
    return true;
  });

  if (moved) revalidatePath("/");
  return { moved };
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
