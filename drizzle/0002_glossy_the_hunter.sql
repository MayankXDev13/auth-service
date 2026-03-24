CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "users_login_type_email_idx" ON "users" USING btree ("login_type","email");--> statement-breakpoint
CREATE INDEX "users_active_verified_idx" ON "users" USING btree ("is_active","is_email_verified");