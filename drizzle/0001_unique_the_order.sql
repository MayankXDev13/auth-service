ALTER TABLE "refresh_tokens" RENAME COLUMN "updated_at" TO "expires_at";--> statement-breakpoint
ALTER TABLE "refresh_tokens" ALTER COLUMN "revoked" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ALTER COLUMN "token_hash" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "refresh_tokens" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "refresh_tokens" ALTER COLUMN "created_at" SET NOT NULL;