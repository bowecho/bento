CREATE TYPE "public"."meal_category" AS ENUM('breakfast', 'snack', 'lunch');--> statement-breakpoint
CREATE TABLE "food_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"categories" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plan_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_date" date NOT NULL,
	"category" "meal_category" NOT NULL,
	"food_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meal_plan_item" ADD CONSTRAINT "meal_plan_item_food_id_food_item_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."food_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "food_item_name_unique" ON "food_item" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "meal_plan_item_unique" ON "meal_plan_item" USING btree ("plan_date","category","food_id");--> statement-breakpoint
CREATE INDEX "meal_plan_item_date_idx" ON "meal_plan_item" USING btree ("plan_date");--> statement-breakpoint
CREATE INDEX "meal_plan_item_food_idx" ON "meal_plan_item" USING btree ("food_id");