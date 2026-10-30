CREATE TABLE "design_presence" (
	"client_id" uuid NOT NULL,
	"color" text NOT NULL,
	"design_id" uuid NOT NULL,
	"drag" jsonb,
	"name" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"selection" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"x" real,
	"y" real,
	CONSTRAINT "design_presence_design_id_client_id_pk" PRIMARY KEY("design_id","client_id")
);
--> statement-breakpoint
ALTER TABLE "design_presence" ADD CONSTRAINT "design_presence_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;