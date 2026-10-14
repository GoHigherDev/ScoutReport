CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"sport" text NOT NULL,
	"sides" jsonb NOT NULL,
	"kickoff" timestamp with time zone NOT NULL,
	"lock_time" timestamp with time zone NOT NULL,
	"outcomes" jsonb NOT NULL,
	"points_for_correct" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_match_id_unique" UNIQUE("match_id"),
	CONSTRAINT "matches_match_id" CHECK ("matches"."match_id" ~ '^0x[0-9a-f]{64}$'),
	CONSTRAINT "matches_sport" CHECK ("matches"."sport" IN ('football', 'cs2')),
	CONSTRAINT "matches_lock_time" CHECK ("matches"."lock_time" <= "matches"."kickoff"),
	CONSTRAINT "matches_points" CHECK ("matches"."points_for_correct" BETWEEN 1 AND 100),
	CONSTRAINT "matches_sides" CHECK ((jsonb_typeof("matches"."sides") = 'array' AND jsonb_array_length("matches"."sides") = 2 AND jsonb_typeof("matches"."sides"->0->'name') = 'string' AND length(trim("matches"."sides"->0->>'name')) > 0 AND jsonb_typeof("matches"."sides"->1->'name') = 'string' AND length(trim("matches"."sides"->1->>'name')) > 0 AND jsonb_typeof("matches"."sides"->0->'tokenKey') IN ('string', 'null') AND jsonb_typeof("matches"."sides"->1->'tokenKey') IN ('string', 'null')) IS TRUE),
	CONSTRAINT "matches_outcomes" CHECK ((jsonb_typeof("matches"."outcomes") = 'array' AND jsonb_array_length("matches"."outcomes") BETWEEN 2 AND 3 AND jsonb_typeof("matches"."outcomes"->0) = 'string' AND jsonb_typeof("matches"."outcomes"->1) = 'string' AND length(trim("matches"."outcomes"->>0)) > 0 AND length(trim("matches"."outcomes"->>1)) > 0 AND "matches"."outcomes"->>0 <> "matches"."outcomes"->>1 AND (jsonb_array_length("matches"."outcomes") = 2 OR (jsonb_typeof("matches"."outcomes"->2) = 'string' AND length(trim("matches"."outcomes"->>2)) > 0 AND "matches"."outcomes"->>2 <> "matches"."outcomes"->>0 AND "matches"."outcomes"->>2 <> "matches"."outcomes"->>1))) IS TRUE)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "admin_audit_log_match_transaction" ON "admin_audit_log" USING btree (("payload"->>'chainId'),"action",lower("payload"->>'txHash')) WHERE "admin_audit_log"."action" IN ('matches.createMatch', 'matches.settle', 'matches.voidMatch', 'matches.creditPoints') AND "admin_audit_log"."payload"->>'txHash' IS NOT NULL;