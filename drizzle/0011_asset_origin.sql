CREATE TYPE "public"."asset_origin" AS ENUM('upload', 'template');--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "origin" "asset_origin" DEFAULT 'upload' NOT NULL;