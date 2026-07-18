ALTER TABLE "meal_plan_item" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
WITH "ranked_items" AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "plan_date", "category"
			ORDER BY "created_at", "id"
		) - 1 AS "position"
	FROM "meal_plan_item"
)
UPDATE "meal_plan_item"
SET "sort_order" = "ranked_items"."position"
FROM "ranked_items"
WHERE "meal_plan_item"."id" = "ranked_items"."id";
