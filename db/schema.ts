import { sql } from "drizzle-orm";
import {
  date,
  index,
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

export const foodItem = pgTable(
  "food_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
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
