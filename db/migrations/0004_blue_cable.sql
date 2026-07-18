CREATE TYPE "public"."food_category" AS ENUM('protein', 'fruit', 'vegetable', 'dairy', 'grain_starch', 'pantry_extra');--> statement-breakpoint
CREATE TYPE "public"."food_relationship_kind" AS ENUM('pairs_well', 'avoid');--> statement-breakpoint
CREATE TABLE "food_relationship" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_food_id" uuid NOT NULL,
	"target_food_id" uuid NOT NULL,
	"kind" "food_relationship_kind" NOT NULL,
	CONSTRAINT "food_relationship_not_self" CHECK ("food_relationship"."source_food_id" <> "food_relationship"."target_food_id")
);
--> statement-breakpoint
ALTER TABLE "food_item" ADD COLUMN "category" "food_category" DEFAULT 'pantry_extra' NOT NULL;--> statement-breakpoint
ALTER TABLE "food_relationship" ADD CONSTRAINT "food_relationship_source_food_id_food_item_id_fk" FOREIGN KEY ("source_food_id") REFERENCES "public"."food_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_relationship" ADD CONSTRAINT "food_relationship_target_food_id_food_item_id_fk" FOREIGN KEY ("target_food_id") REFERENCES "public"."food_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "food_relationship_unique" ON "food_relationship" USING btree ("source_food_id","target_food_id","kind");--> statement-breakpoint
CREATE INDEX "food_relationship_source_idx" ON "food_relationship" USING btree ("source_food_id");--> statement-breakpoint
CREATE INDEX "food_relationship_target_idx" ON "food_relationship" USING btree ("target_food_id");--> statement-breakpoint
UPDATE "food_item" SET "category" = 'protein' WHERE lower("name") IN (
	'eggs', 'hard-boiled eggs', 'scrambled eggs', 'turkey sandwich meat', 'turkey pepperoni',
	'turkey sausage', 'ground turkey', 'chicken', 'steak', 'refried beans', 'beans', 'peanut butter'
);--> statement-breakpoint
UPDATE "food_item" SET "category" = 'fruit' WHERE lower("name") IN (
	'apples', 'bananas', 'grapes', 'berries', 'strawberries', 'oranges'
);--> statement-breakpoint
UPDATE "food_item" SET "category" = 'vegetable' WHERE lower("name") IN ('carrots', 'corn');--> statement-breakpoint
UPDATE "food_item" SET "category" = 'dairy' WHERE lower("name") IN (
	'greek yogurt', 'yogurt', 'milk', 'cheese', 'cheese sticks', 'cheese slices', 'cheese cubes'
);--> statement-breakpoint
UPDATE "food_item" SET "category" = 'grain_starch' WHERE lower("name") IN (
	'whole-grain bread', 'whole-grain toast', 'english muffins', 'tortillas', 'white rice', 'brown rice',
	'whole-grain crackers', 'pretzels', 'popcorn', 'oats', 'overnight oats', 'original cheerios',
	'multigrain cheerios', 'wheat chex', 'shredded wheat', 'kix', 'raisin bran', 'lower-sugar granola'
);--> statement-breakpoint
INSERT INTO "food_relationship" ("source_food_id", "target_food_id", "kind")
SELECT source_food."id", target_food."id", 'pairs_well'
FROM "food_item" source_food
CROSS JOIN LATERAL regexp_split_to_table(source_food."pairs_well_with", E'[,;\\n]+') AS names(referenced_name)
JOIN "food_item" target_food ON lower(trim(referenced_name)) = lower(target_food."name")
WHERE source_food."id" <> target_food."id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "food_relationship" ("source_food_id", "target_food_id", "kind")
SELECT source_food."id", target_food."id", 'avoid'
FROM "food_item" source_food
CROSS JOIN LATERAL regexp_split_to_table(source_food."avoid_pairing_with", E'[,;\\n]+') AS names(referenced_name)
JOIN "food_item" target_food ON lower(trim(referenced_name)) = lower(target_food."name")
WHERE source_food."id" <> target_food."id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "food_relationship" ("source_food_id", "target_food_id", "kind")
SELECT "target_food_id", "source_food_id", "kind" FROM "food_relationship"
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "food_item" DROP COLUMN "pairs_well_with";--> statement-breakpoint
ALTER TABLE "food_item" DROP COLUMN "avoid_pairing_with";
