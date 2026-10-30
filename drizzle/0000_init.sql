CREATE TYPE "public"."asset_status" AS ENUM('pending', 'ready');--> statement-breakpoint
CREATE TABLE "assets" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"height" integer NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"mime_type" text NOT NULL,
	"original_name" text NOT NULL,
	"sha256" text,
	"size_bytes" integer NOT NULL,
	"status" "asset_status" DEFAULT 'pending' NOT NULL,
	"width" integer NOT NULL,
	CONSTRAINT "assets_key_unique" UNIQUE("key"),
	CONSTRAINT "assets_sha256_unique" UNIQUE("sha256")
);
--> statement-breakpoint
CREATE TABLE "designs" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"document" jsonb NOT NULL,
	"height" integer NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"thumbnail_key" text,
	"width" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX "assets_created_at_idx" ON "assets" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "designs_updated_at_idx" ON "designs" USING btree ("updated_at");