DROP INDEX "users_phone_global_unique";--> statement-breakpoint
DROP INDEX "users_email_global_unique";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_phone_unique" UNIQUE("phone");