CREATE TYPE "public"."vote_type" AS ENUM('up', 'down');--> statement-breakpoint
CREATE TABLE "banned_ips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_hash" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "banned_ips_ip_hash_unique" UNIQUE("ip_hash")
);
--> statement-breakpoint
CREATE TABLE "comment_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"ip_hash" text NOT NULL,
	"vote_type" "vote_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"username" text DEFAULT 'Anonymous' NOT NULL,
	"password_hash" text NOT NULL,
	"text" text NOT NULL,
	"ip_hash" text NOT NULL,
	"reply" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"ip_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comment_votes" ADD CONSTRAINT "comment_votes_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "comment_votes_unique" ON "comment_votes" USING btree ("comment_id","ip_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "likes_unique" ON "likes" USING btree ("url","ip_hash");