CREATE TYPE "public"."status" AS ENUM('active', 'inactive', 'deleted', 'banned');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firstName" text NOT NULL,
	"lastName" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"phone" text,
	"status" "status" DEFAULT 'active' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastModified" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_global_unique" ON "users" USING btree ("phone") WHERE "phone"
                    IS NOT NULL AND "phone" != '';--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_global_unique" ON "users" USING btree ("email") WHERE "email"
                    IS NOT NULL AND "email" != '';