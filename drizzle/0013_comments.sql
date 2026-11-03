-- Comments (see lib/db/schema.ts): threads pinned to a design and their
-- replies in design_comments, and who each one mentions in comment_mentions.
CREATE TABLE "comment_mentions" (
	"comment_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"design_id" uuid NOT NULL,
	"emailed_at" timestamp with time zone,
	"user_id" uuid NOT NULL,
	CONSTRAINT "comment_mentions_comment_id_user_id_pk" PRIMARY KEY("comment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "design_comments" (
	"anchor_height" real,
	"anchor_width" real,
	"anchor_x" real,
	"anchor_y" real,
	"author_id" uuid,
	"author_image" text,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"design_id" uuid NOT NULL,
	"edited_at" timestamp with time zone,
	"element_id" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mentions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"page_id" text,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"thread_id" uuid,
	"x" real,
	"y" real,
	CONSTRAINT "design_comments_root_pin" CHECK (("design_comments"."thread_id" IS NULL) = ("design_comments"."x" IS NOT NULL AND "design_comments"."y" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_comment_id_design_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."design_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_comments" ADD CONSTRAINT "design_comments_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_comments" ADD CONSTRAINT "design_comments_thread_id_design_comments_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."design_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_mentions_user_emailed_idx" ON "comment_mentions" USING btree ("user_id","emailed_at");--> statement-breakpoint
CREATE INDEX "design_comments_design_idx" ON "design_comments" USING btree ("design_id","created_at");--> statement-breakpoint
CREATE INDEX "design_comments_thread_idx" ON "design_comments" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "design_comments_author_created_idx" ON "design_comments" USING btree ("author_id","created_at");--> statement-breakpoint
-- Hand-written, as in 0006: neon_auth."user" belongs to Neon Auth. A deleted
-- account's comments stay, under the name they had; its mentions go.
ALTER TABLE "design_comments" ADD CONSTRAINT "design_comments_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_comments" ADD CONSTRAINT "design_comments_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_mentions" ADD CONSTRAINT "comment_mentions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;
