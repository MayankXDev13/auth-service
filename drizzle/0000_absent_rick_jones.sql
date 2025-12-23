CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(256) NOT NULL,
	"username" varchar(256),
	"password" varchar(256),
	"login_type" varchar(50) DEFAULT 'email_password' NOT NULL,
	"provider_id" varchar(256),
	"profile_picture" varchar(512),
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"refresh_token" varchar(512),
	"forgot_password_token" varchar(512),
	"forgot_password_token_expires_at" timestamp,
	"email_verification_token" varchar(512),
	"email_verification_expiry" timestamp,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "provider_unique_idx" ON "users" USING btree ("login_type","provider_id");--> statement-breakpoint
CREATE INDEX "refresh_token_idx" ON "users" USING btree ("refresh_token");--> statement-breakpoint
CREATE INDEX "forgot_password_token_idx" ON "users" USING btree ("forgot_password_token");--> statement-breakpoint
CREATE INDEX "email_verification_token_idx" ON "users" USING btree ("email_verification_token");