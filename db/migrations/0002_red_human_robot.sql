CREATE TABLE "ai_generation_rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
