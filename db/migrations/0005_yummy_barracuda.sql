CREATE TABLE "food_category_record" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "food_category_record" ("name", "sort_order") VALUES
	('Protein', 1),
	('Fruit', 2),
	('Vegetable', 3),
	('Dairy', 4),
	('Grain & Starch', 5),
	('Pantry & Extras', 6);--> statement-breakpoint
ALTER TABLE "ai_generation_rate_limit" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "food_relationship" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "ai_generation_rate_limit" CASCADE;--> statement-breakpoint
DROP TABLE "food_relationship" CASCADE;--> statement-breakpoint
DELETE FROM "meal_plan_item";--> statement-breakpoint
DELETE FROM "food_item";--> statement-breakpoint
ALTER TABLE "food_item" ADD COLUMN "category_id" uuid NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "food_category_record_name_unique" ON "food_category_record" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "food_item" ADD CONSTRAINT "food_item_category_id_food_category_record_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."food_category_record"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_item" DROP COLUMN "category";--> statement-breakpoint
DROP TYPE "public"."food_category";--> statement-breakpoint
DROP TYPE "public"."food_relationship_kind";
