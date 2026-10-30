CREATE TABLE "design_elements" (
	"data" jsonb NOT NULL,
	"design_id" uuid NOT NULL,
	"id" text NOT NULL,
	"position" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "design_elements_design_id_id_pk" PRIMARY KEY("design_id","id")
);
--> statement-breakpoint
ALTER TABLE "designs" ALTER COLUMN "document" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "designs" ADD COLUMN "background" jsonb;--> statement-breakpoint
ALTER TABLE "designs" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "design_elements" ADD CONSTRAINT "design_elements_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;