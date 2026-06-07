CREATE TABLE "blog" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "slug" text,
  "status" text DEFAULT 'draft',
  "data" text NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX "blog_slug_idx" ON "blog" ("slug");
CREATE INDEX "blog_status_idx" ON "blog" ("status");
