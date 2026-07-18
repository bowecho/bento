"use server";

import { createHash } from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { aiGenerationRateLimit, foodItem, mealPlanItem } from "@/db/schema";
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

const GenerateWeekInputSchema = z.object({
  dates: z.array(DateSchema).length(7),
  overwrite: z.boolean().default(false),
});

const GeneratedMealSchema = z.array(z.string()).min(1).max(3);
const GeneratedDaySchema = z.object({
  date: DateSchema,
  breakfast: GeneratedMealSchema,
  snack: GeneratedMealSchema,
  lunch: GeneratedMealSchema,
});
const GeneratedWeekSchema = z.object({
  days: z.array(GeneratedDaySchema).length(7),
});

const WEEK_GENERATION_MODEL = "google/gemini-2.5-flash";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1_000;
const RATE_LIMIT_REQUESTS = 5;
const MAX_GENERATION_FOODS = 250;
const MAX_GENERATION_ATTEMPTS = 3;

class InvalidGeneratedWeekError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidGeneratedWeekError";
  }
}

async function getOpenRouterClient() {
  const apiKey = process.env.OpenRouterKey;
  if (!apiKey) {
    throw new Error("AI menu generation isn’t configured yet.");
  }

  const { OpenRouter } = await import("@openrouter/sdk");
  return new OpenRouter({
    apiKey,
    appTitle: "Bento",
    httpReferer: "https://bento-taupe.vercel.app",
    timeoutMs: 45_000,
  });
}

function ensureConsecutiveDates(dates: string[]) {
  const asDays = dates.map((date) => Date.parse(`${date}T12:00:00Z`));
  for (let index = 1; index < asDays.length; index += 1) {
    if (asDays[index] - asDays[index - 1] !== 86_400_000) {
      throw new Error("Bento can only generate one consecutive week at a time.");
    }
  }
}

function generatedWeekJsonSchema(
  dates: string[],
  foodTokens: string[],
  maxFoodsPerMeal: number,
) {
  const meal = {
    type: "array",
    items: { type: "string", enum: foodTokens },
    minItems: 1,
    maxItems: maxFoodsPerMeal,
    uniqueItems: true,
  };

  return {
    type: "object",
    properties: {
      days: {
        type: "array",
        minItems: 7,
        maxItems: 7,
        items: {
          type: "object",
          properties: {
            date: { type: "string", enum: dates },
            breakfast: meal,
            snack: meal,
            lunch: meal,
          },
          required: ["date", "breakfast", "snack", "lunch"],
          additionalProperties: false,
        },
      },
    },
    required: ["days"],
    additionalProperties: false,
  };
}

function validateGeneratedWeek(
  content: string,
  dates: string[],
  tokenToFood: Map<string, { id: string; name: string }>,
) {
  let generated: z.infer<typeof GeneratedWeekSchema>;
  try {
    generated = GeneratedWeekSchema.parse(JSON.parse(content));
  } catch {
    throw new InvalidGeneratedWeekError("Bento couldn’t validate that menu. Please try again.");
  }

  const generatedByDate = new Map(generated.days.map((day) => [day.date, day]));
  if (generatedByDate.size !== dates.length || dates.some((date) => !generatedByDate.has(date))) {
    throw new InvalidGeneratedWeekError("Bento didn’t plan every day. Please try again.");
  }

  const categories = ["breakfast", "snack", "lunch"] as const;
  const plans: Record<string, { breakfast: string[]; snack: string[]; lunch: string[] }> = {};
  const rows: Array<{ planDate: string; category: (typeof categories)[number]; foodId: string }> = [];
  let previousDayFoods = new Set<string>();

  for (const date of dates) {
    const day = generatedByDate.get(date);
    if (!day) {
      throw new InvalidGeneratedWeekError("Bento didn’t plan every day. Please try again.");
    }

    const currentDayFoods = new Set<string>();
    const plan = { breakfast: [] as string[], snack: [] as string[], lunch: [] as string[] };

    for (const category of categories) {
      for (const token of day[category]) {
        const food = tokenToFood.get(token);
        if (!food || currentDayFoods.has(food.id) || previousDayFoods.has(food.id)) {
          throw new InvalidGeneratedWeekError("Bento’s menu wasn’t varied enough. Please try again.");
        }
        currentDayFoods.add(food.id);
        plan[category].push(food.id);
        rows.push({ planDate: date, category, foodId: food.id });
      }
    }

    plans[date] = plan;
    previousDayFoods = currentDayFoods;
  }

  return { plans, rows };
}

async function enforceGenerationRateLimit() {
  const requestHeaders = await headers();
  const forwardedFor =
    requestHeaders.get("x-vercel-forwarded-for") ??
    requestHeaders.get("x-forwarded-for") ??
    "unknown";
  const address = forwardedFor.split(",")[0]?.trim() || "unknown";
  const fingerprint = createHash("sha256").update(address).digest("hex").slice(0, 24);
  const bucket = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS);
  const id = `${bucket}:${fingerprint}`;

  const [usage] = await getDb()
    .insert(aiGenerationRateLimit)
    .values({ id })
    .onConflictDoUpdate({
      target: aiGenerationRateLimit.id,
      set: {
        requestCount: sql`${aiGenerationRateLimit.requestCount} + 1`,
      },
    })
    .returning({ requestCount: aiGenerationRateLimit.requestCount });

  if (!usage || usage.requestCount > RATE_LIMIT_REQUESTS) {
    throw new Error("You’ve generated several weeks recently. Please try again in about 15 minutes.");
  }
}

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

async function generateWeekMenu(
  input: z.input<typeof GenerateWeekInputSchema>,
) {
  const { dates, overwrite } = GenerateWeekInputSchema.parse(input);
  ensureConsecutiveDates(dates);

  const db = getDb();
  const existing = await db
    .select({ id: mealPlanItem.id })
    .from(mealPlanItem)
    .where(inArray(mealPlanItem.planDate, dates))
    .limit(1);

  if (existing.length > 0 && !overwrite) {
    return { status: "needs-confirmation" as const };
  }

  const foods = await db
    .select({ id: foodItem.id, name: foodItem.name })
    .from(foodItem)
    .orderBy(asc(foodItem.name));

  if (foods.length < 6) {
    throw new Error("Add at least six foods so Bento can make a varied week.");
  }
  if (foods.length > MAX_GENERATION_FOODS) {
    throw new Error(`Bento can generate from up to ${MAX_GENERATION_FOODS} foods at a time.`);
  }

  await enforceGenerationRateLimit();

  const tokenToFood = new Map<string, (typeof foods)[number]>(
    foods.map((food, index) => [`food_${index + 1}`, food] as const),
  );
  const foodTokens = [...tokenToFood.keys()];
  const maxFoodsPerMeal = Math.max(1, Math.min(3, Math.floor(foods.length / 6)));
  const foodList = [...tokenToFood.entries()]
    .map(([token, food]) => `${token}: ${food.name}`)
    .join("\n");

  const openRouter = await getOpenRouterClient();
  let validated: ReturnType<typeof validateGeneratedWeek> | undefined;

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const response = await openRouter.chat.send({
      chatRequest: {
        model: WEEK_GENERATION_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You plan practical children’s breakfasts, snacks, and lunches using only a supplied food library. Meal appropriateness and foods that naturally go together are more important than using every available food. Return only the requested structured data. Do not make medical or nutrition claims.",
          },
          {
            role: "user",
            content: `Create a menu for all seven dates below.

Dates, in order:
${dates.join("\n")}

Available foods (use the token before each name in your response):
${foodList}

Rules:
- Fill breakfast, snack, and lunch for every date.
- Use 1 to ${maxFoodsPerMeal} ${maxFoodsPerMeal === 1 ? "food" : "foods"} per meal. Do not exceed this limit. Snacks should usually be lighter than breakfast or lunch.
- Choose foods appropriate for that meal and that make sense together based only on their names.
- It is okay to leave some available foods unused. Prefer repeating a meal-appropriate food after a one-day gap over placing a food in an awkward meal just for coverage.
- Never use the same food more than once on the same day.
- Never use a food on adjacent days. A food may repeat after at least one full day in between.
- Before planning each day, exclude every food used on the immediately preceding day.
- Favor variety across the whole week, while sensible repeats are welcome.
- Use every supplied date exactly once and only supplied food tokens.`,
          },
        ],
        responseFormat: {
          type: "json_schema",
          jsonSchema: {
            name: "bento_week_menu",
            strict: true,
            schema: generatedWeekJsonSchema(dates, foodTokens, maxFoodsPerMeal),
          },
        },
        provider: {
          requireParameters: true,
          sort: "price",
        },
        temperature: 0.5,
        seed: Math.floor(Math.random() * 2_147_483_647),
        maxTokens: 2_000,
        stream: false,
      },
    });

    if (!("choices" in response)) {
      throw new Error("Bento didn’t receive a complete menu. Please try again.");
    }

    const content = response.choices[0]?.message.content;
    if (typeof content !== "string") {
      throw new Error("Bento didn’t receive a usable menu. Please try again.");
    }

    try {
      validated = validateGeneratedWeek(content, dates, tokenToFood);
      break;
    } catch (error) {
      if (!(error instanceof InvalidGeneratedWeekError) || attempt === MAX_GENERATION_ATTEMPTS - 1) {
        throw error;
      }
      console.warn(`Bento rejected generated menu attempt ${attempt + 1}; retrying.`);
    }
  }

  if (!validated) {
    throw new Error("Bento couldn’t generate a valid menu. Please try again.");
  }

  const { plans, rows } = validated;

  await db.transaction(async (tx) => {
    await tx.delete(mealPlanItem).where(inArray(mealPlanItem.planDate, dates));
    await tx.insert(mealPlanItem).values(rows);
  });

  revalidatePath("/");
  return { status: "generated" as const, plans, model: WEEK_GENERATION_MODEL };
}

export async function generateWeekMenuAction(
  input: z.input<typeof GenerateWeekInputSchema>,
) {
  try {
    return await generateWeekMenu(input);
  } catch (error) {
    const errorSummary = error instanceof Error
      ? `${error.name}: ${error.message}`
      : "Unknown generation error";
    console.error("Bento week generation failed:", errorSummary);
    const message = error instanceof Error && /^(Add |Bento(?: |’s )|You’ve )/.test(error.message)
      ? error.message
      : "Bento couldn’t generate a week right now. Please try again.";
    return { status: "error" as const, message };
  }
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
