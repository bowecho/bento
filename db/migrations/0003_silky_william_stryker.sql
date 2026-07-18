ALTER TABLE "food_item" ADD COLUMN "pairs_well_with" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "food_item" ADD COLUMN "avoid_pairing_with" text DEFAULT '' NOT NULL;