-- Accounts: who owns a design or upload, whether a design is public, and
-- who is behind a presence session. Existing designs stay public (the
-- column default) until scripts/claim-designs.ts gives them an owner.
CREATE TYPE "public"."design_visibility" AS ENUM('private', 'public');--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "design_presence" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "design_presence" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "designs" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "designs" ADD COLUMN "visibility" "design_visibility" DEFAULT 'public' NOT NULL;--> statement-breakpoint
CREATE INDEX "designs_owner_updated_idx" ON "designs" USING btree ("owner_id","updated_at");--> statement-breakpoint
CREATE INDEX "designs_visibility_updated_idx" ON "designs" USING btree ("visibility","updated_at");--> statement-breakpoint
-- Hand-written: neon_auth."user" belongs to Neon Auth, so it isn't in
-- lib/db/schema.ts. A deleted account takes its designs with it; its
-- uploads stay, since other people's designs may show them.
ALTER TABLE "designs" ADD CONSTRAINT "designs_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_presence" ADD CONSTRAINT "design_presence_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;
