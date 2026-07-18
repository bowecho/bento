import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const mealCategoryEnum = pgEnum("meal_category", [
  "breakfast",
  "snack",
  "lunch",
]);

export const foodCategoryEnum = pgEnum("food_category", [
  "protein",
  "fruit",
  "vegetable",
  "dairy",
  "grain_starch",
  "pantry_extra",
]);

export const foodRelationshipKindEnum = pgEnum("food_relationship_kind", [
  "pairs_well",
  "avoid",
]);

export const foodItem = pgTable(
  "food_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    category: foodCategoryEnum("category").notNull().default("pantry_extra"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("food_item_name_unique").on(sql`lower(${table.name})`),
  ],
);

export const foodRelationship = pgTable(
  "food_relationship",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceFoodId: uuid("source_food_id")
      .notNull()
      .references(() => foodItem.id, { onDelete: "cascade" }),
    targetFoodId: uuid("target_food_id")
      .notNull()
      .references(() => foodItem.id, { onDelete: "cascade" }),
    kind: foodRelationshipKindEnum("kind").notNull(),
  },
  (table) => [
    uniqueIndex("food_relationship_unique").on(
      table.sourceFoodId,
      table.targetFoodId,
      table.kind,
    ),
    index("food_relationship_source_idx").on(table.sourceFoodId),
    index("food_relationship_target_idx").on(table.targetFoodId),
    check("food_relationship_not_self", sql`${table.sourceFoodId} <> ${table.targetFoodId}`),
  ],
);

export const mealPlanItem = pgTable(
  "meal_plan_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planDate: date("plan_date", { mode: "string" }).notNull(),
    category: mealCategoryEnum("category").notNull(),
    foodId: uuid("food_id")
      .notNull()
      .references(() => foodItem.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("meal_plan_item_unique").on(
      table.planDate,
      table.category,
      table.foodId,
    ),
    index("meal_plan_item_date_idx").on(table.planDate),
    index("meal_plan_item_food_idx").on(table.foodId),
  ],
);

export const aiGenerationRateLimit = pgTable("ai_generation_rate_limit", {
  id: text("id").primaryKey(),
  requestCount: integer("request_count").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
