CREATE TABLE "blog" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "slug" text,
  "author" text,
  "publishedAt" integer,
  "status" text DEFAULT 'draft',
  "site" text,
  "data" text NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX "blog_slug_idx" ON "blog" ("slug");
CREATE INDEX "blog_status_idx" ON "blog" ("status");
CREATE INDEX "blog_site_idx" ON "blog" ("site");

CREATE TABLE "pages" (
  "id" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "slug" text,
  "status" text DEFAULT 'draft',
  "site" text,
  "data" text NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" ("slug");
CREATE INDEX "pages_status_idx" ON "pages" ("status");
CREATE INDEX "pages_site_idx" ON "pages" ("site");
