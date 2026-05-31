CREATE TABLE "media" (
  "id" text PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "url" text NOT NULL,
  "mimeType" text NOT NULL DEFAULT '',
  "width" integer NOT NULL DEFAULT 0,
  "height" integer NOT NULL DEFAULT 0,
  "createdAt" integer NOT NULL DEFAULT (unixepoch())
);
