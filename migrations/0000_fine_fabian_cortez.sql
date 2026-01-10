CREATE TABLE "restaurants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"opening_time" time NOT NULL,
	"closing_time" time NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastModified" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" serial PRIMARY KEY NOT NULL,
	"restaurant_id" integer NOT NULL,
	"table_number" integer NOT NULL,
	"capacity" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"lastModified" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;