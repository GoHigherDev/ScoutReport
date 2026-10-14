CREATE TABLE "predict_age_confirmations" (
	"address" text PRIMARY KEY NOT NULL,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "predict_nonces" (
	"nonce" text PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "predict_rate_limits" (
	"address" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "predict_terms_acceptances" (
	"address" text NOT NULL,
	"version" text NOT NULL,
	"country" text,
	"country_check" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "predict_terms_acceptances_address_version_pk" PRIMARY KEY("address","version")
);
--> statement-breakpoint
CREATE TABLE "prediction_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" text NOT NULL,
	"match_id" uuid NOT NULL,
	"outcome" text NOT NULL,
	"signature" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prediction_audit_address" CHECK ("prediction_audit"."address" ~ '^(0x[0-9a-f]{40}|erased:[0-9a-f]{64})$'),
	CONSTRAINT "prediction_audit_erased_signature" CHECK ("prediction_audit"."address" LIKE '0x%' OR "prediction_audit"."signature" IS NULL)
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log" DROP CONSTRAINT "admin_audit_log_actor_lowercase";--> statement-breakpoint
ALTER TABLE "matches" DROP CONSTRAINT "matches_created_by_lowercase";--> statement-breakpoint
ALTER TABLE "picks" ADD COLUMN "signature" text;--> statement-breakpoint
ALTER TABLE "siwe_nonces" ADD COLUMN "address" text;--> statement-breakpoint
CREATE INDEX "prediction_audit_address_index" ON "prediction_audit" USING btree ("address");--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_lowercase" CHECK ("admin_audit_log"."actor_address" ~ '^(0x[0-9a-f]{40}|erased:[0-9a-f]{64})$');--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_created_by_lowercase" CHECK ("matches"."created_by" ~ '^(0x[0-9a-f]{40}|erased:[0-9a-f]{64})$');
--> statement-breakpoint
CREATE FUNCTION protect_prediction_audit() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'prediction_audit is append-only except for erasure';
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.address = current_setting('scoutreport.erasure_wallet', true)
     AND NEW.address = current_setting('scoutreport.erasure_pseudonym', true)
     AND NEW.address ~ '^erased:[0-9a-f]{64}$'
     AND NEW.signature IS NULL
     AND (to_jsonb(NEW) - 'address' - 'signature') =
         (to_jsonb(OLD) - 'address' - 'signature') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'prediction_audit is append-only except for erasure';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER prediction_audit_append_only
BEFORE UPDATE OR DELETE ON prediction_audit
FOR EACH ROW EXECUTE FUNCTION protect_prediction_audit();
--> statement-breakpoint
CREATE TRIGGER prediction_audit_no_truncate
BEFORE TRUNCATE ON prediction_audit
FOR EACH STATEMENT EXECUTE FUNCTION protect_prediction_audit();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION reject_admin_audit_log_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  wallet text := current_setting('scoutreport.erasure_wallet', true);
  pseudonym text := current_setting('scoutreport.erasure_pseudonym', true);
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'admin_audit_log is append-only except for erasure';
  END IF;
  IF TG_OP = 'UPDATE'
     AND wallet ~ '^0x[0-9a-f]{40}$'
     AND pseudonym ~ '^erased:[0-9a-f]{64}$'
     AND (OLD.actor_address = wallet OR strpos(lower(OLD.payload::text), wallet) > 0)
     AND NEW.actor_address = (CASE WHEN OLD.actor_address = wallet THEN pseudonym ELSE OLD.actor_address END)
     AND NEW.payload = '{"erased":true}'::jsonb
     AND (to_jsonb(NEW) - 'actor_address' - 'payload') =
         (to_jsonb(OLD) - 'actor_address' - 'payload') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'admin_audit_log is append-only except for erasure';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER admin_audit_log_no_truncate
BEFORE TRUNCATE ON admin_audit_log
FOR EACH STATEMENT EXECUTE FUNCTION reject_admin_audit_log_mutation();
--> statement-breakpoint
CREATE FUNCTION erase_predict_data(wallet text, pseudonym text) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF wallet IS NULL OR wallet !~ '^0x[0-9a-f]{40}$'
     OR pseudonym IS NULL OR pseudonym !~ '^erased:[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid erasure parameters';
  END IF;
  PERFORM set_config('scoutreport.erasure_wallet', wallet, true);
  PERFORM set_config('scoutreport.erasure_pseudonym', pseudonym, true);
  DELETE FROM picks WHERE address = wallet;
  DELETE FROM prediction_points WHERE address = wallet;
  DELETE FROM predict_terms_acceptances WHERE address = wallet;
  DELETE FROM predict_age_confirmations WHERE address = wallet;
  DELETE FROM predict_nonces WHERE address = wallet;
  DELETE FROM siwe_nonces WHERE address = wallet;
  DELETE FROM predict_rate_limits WHERE address = wallet;
  UPDATE prediction_audit SET address = pseudonym, signature = NULL WHERE address = wallet;
  UPDATE admin_audit_log SET
    actor_address = CASE WHEN actor_address = wallet THEN pseudonym ELSE actor_address END,
    payload = '{"erased":true}'::jsonb
    WHERE actor_address = wallet OR strpos(lower(payload::text), wallet) > 0;
  -- Remove indirect audit links through fixture administration metadata too.
  UPDATE matches SET
    created_by = CASE WHEN created_by = wallet THEN pseudonym ELSE created_by END,
    settled_by = CASE WHEN settled_by = wallet THEN pseudonym ELSE settled_by END,
    voided_by = CASE WHEN voided_by = wallet THEN pseudonym ELSE voided_by END
    WHERE created_by = wallet OR settled_by = wallet OR voided_by = wallet;
  PERFORM set_config('scoutreport.erasure_wallet', '', true);
  PERFORM set_config('scoutreport.erasure_pseudonym', '', true);
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION erase_predict_data(text, text) FROM PUBLIC;