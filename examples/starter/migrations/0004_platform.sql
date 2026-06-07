CREATE TABLE IF NOT EXISTS "content_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "collection" text NOT NULL,
  "record_id" text NOT NULL,
  "version" integer NOT NULL,
  "data" text NOT NULL,
  "changed_by" text,
  "changed_at" integer NOT NULL
);
CREATE INDEX IF NOT EXISTS "content_versions_record_idx" ON "content_versions" ("collection", "record_id");
CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" text PRIMARY KEY NOT NULL,
  "action" text NOT NULL,
  "collection" text NOT NULL,
  "record_id" text,
  "user" text,
  "policy" text,
  "timestamp" integer NOT NULL,
  "meta" text
);
CREATE INDEX IF NOT EXISTS "audit_log_collection_idx" ON "audit_log" ("collection", "record_id");
