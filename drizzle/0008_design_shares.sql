-- Sharing a design with people by email (see lib/db/schema.ts).
CREATE TABLE "design_shares" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"design_id" uuid NOT NULL,
	"email" text NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid,
	CONSTRAINT "design_shares_design_id_email_pk" PRIMARY KEY("design_id","email"),
	CONSTRAINT "design_shares_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "design_shares" ADD CONSTRAINT "design_shares_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "design_shares_user_idx" ON "design_shares" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "design_shares_email_idx" ON "design_shares" USING btree ("email");--> statement-breakpoint
-- Hand-written, as in 0006: neon_auth."user" belongs to Neon Auth. A deleted
-- account leaves every design shared with it.
ALTER TABLE "design_shares" ADD CONSTRAINT "design_shares_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;
