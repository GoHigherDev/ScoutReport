CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sport" text NOT NULL,
	"home_label" text NOT NULL,
	"away_label" text NOT NULL,
	"home_token_key" text,
	"away_token_key" text,
	"external_ref" text,
	"kickoff_utc" timestamp with time zone NOT NULL,
	"lock_at_utc" timestamp with time zone NOT NULL,
	"outcomes" jsonb NOT NULL,
	"points_for_correct" integer NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"result" text,
	"void_reason" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	"settled_by" text,
	"voided_at" timestamp with time zone,
	"voided_by" text,
	CONSTRAINT "matches_sport" CHECK ("matches"."sport" IN ('football', 'cs2')),
	CONSTRAINT "matches_lock_at" CHECK ("matches"."lock_at_utc" <= "matches"."kickoff_utc"),
	CONSTRAINT "matches_points" CHECK ("matches"."points_for_correct" BETWEEN 1 AND 100),
	CONSTRAINT "matches_outcomes" CHECK (CASE WHEN jsonb_typeof("matches"."outcomes") = 'array' THEN (jsonb_array_length("matches"."outcomes") BETWEEN 2 AND 3 AND jsonb_typeof("matches"."outcomes"->0) = 'string' AND jsonb_typeof("matches"."outcomes"->1) = 'string' AND length(trim("matches"."outcomes"->>0)) > 0 AND length(trim("matches"."outcomes"->>1)) > 0 AND "matches"."outcomes"->>0 <> "matches"."outcomes"->>1 AND (jsonb_array_length("matches"."outcomes") = 2 OR (jsonb_typeof("matches"."outcomes"->2) = 'string' AND length(trim("matches"."outcomes"->>2)) > 0 AND "matches"."outcomes"->>2 <> "matches"."outcomes"->>0 AND "matches"."outcomes"->>2 <> "matches"."outcomes"->>1))) ELSE false END),
	CONSTRAINT "matches_status" CHECK ("matches"."status" IN ('open', 'settled', 'voided')),
	CONSTRAINT "matches_status_result" CHECK (("matches"."status" = 'settled' AND "matches"."result" IS NOT NULL AND "matches"."outcomes" ? "matches"."result" OR "matches"."status" <> 'settled' AND "matches"."result" IS NULL)),
	CONSTRAINT "matches_void_reason" CHECK (("matches"."status" = 'voided' AND "matches"."void_reason" IS NOT NULL AND length(trim("matches"."void_reason")) > 0 OR "matches"."status" <> 'voided' AND "matches"."void_reason" IS NULL)),
	CONSTRAINT "matches_created_by_lowercase" CHECK ("matches"."created_by" ~ '^0x[0-9a-f]{40}$')
);
--> statement-breakpoint
CREATE TABLE "picks" (
	"match_id" uuid NOT NULL,
	"address" text NOT NULL,
	"outcome" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "picks_match_id_address_pk" PRIMARY KEY("match_id","address"),
	CONSTRAINT "picks_address_lowercase" CHECK ("picks"."address" ~ '^0x[0-9a-f]{40}$')
);
--> statement-breakpoint
CREATE TABLE "prediction_points" (
	"match_id" uuid NOT NULL,
	"address" text NOT NULL,
	"points" integer NOT NULL,
	"week_start_utc" timestamp with time zone NOT NULL,
	"season_id" text NOT NULL,
	"credited_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prediction_points_match_id_address_pk" PRIMARY KEY("match_id","address"),
	CONSTRAINT "prediction_points_address_lowercase" CHECK ("prediction_points"."address" ~ '^0x[0-9a-f]{40}$'),
	CONSTRAINT "prediction_points_positive" CHECK ("prediction_points"."points" > 0)
);
--> statement-breakpoint
ALTER TABLE "picks" ADD CONSTRAINT "picks_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_points" ADD CONSTRAINT "prediction_points_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "matches_id_created" ON "matches" USING btree ("created_at","id");
--> statement-breakpoint
CREATE FUNCTION reject_admin_audit_log_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'admin_audit_log is append-only';
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER admin_audit_log_append_only
BEFORE UPDATE OR DELETE ON admin_audit_log
FOR EACH ROW EXECUTE FUNCTION reject_admin_audit_log_mutation();
--> statement-breakpoint
CREATE FUNCTION validate_pick_write() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  match_row matches%ROWTYPE;
  write_time timestamptz := clock_timestamp();
BEGIN
  SELECT * INTO match_row FROM matches WHERE id = NEW.match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'match is not open for picks';
  END IF;
  IF match_row.status <> 'open' THEN
    RAISE EXCEPTION 'match is not open for picks';
  END IF;
  IF write_time >= match_row.lock_at_utc THEN
    RAISE EXCEPTION 'match is locked for picks';
  END IF;
  IF NOT (match_row.outcomes ? NEW.outcome) THEN
    RAISE EXCEPTION 'pick outcome is not available for match';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := write_time;
  ELSE
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := write_time;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER picks_validate_before_write
BEFORE INSERT OR UPDATE ON picks
FOR EACH ROW EXECUTE FUNCTION validate_pick_write();