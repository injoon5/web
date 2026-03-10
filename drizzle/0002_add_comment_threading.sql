ALTER TABLE "comments" ADD COLUMN "parent_id" uuid REFERENCES "comments"("id") ON DELETE SET NULL;
ALTER TABLE "comments" ADD COLUMN "depth" integer NOT NULL DEFAULT 0;
CREATE INDEX "idx_comments_parent_id" ON "comments" ("parent_id");
