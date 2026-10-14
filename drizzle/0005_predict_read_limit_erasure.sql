CREATE OR REPLACE FUNCTION erase_predict_data(wallet text, pseudonym text) RETURNS void
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF wallet IS NULL OR wallet !~ '^0x[0-9a-f]{40}$'
     OR pseudonym IS NULL OR pseudonym !~ '^erased:[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid erasure parameters';
  END IF;
  -- Keep the wallet-before-match lock order used by pick writers.
  PERFORM pg_advisory_xact_lock(hashtextextended(wallet, 45));
  PERFORM id FROM matches
    WHERE created_by = wallet OR settled_by = wallet OR voided_by = wallet
      OR id IN (
        SELECT match_id FROM picks WHERE address = wallet
        UNION SELECT match_id FROM prediction_points WHERE address = wallet
        UNION SELECT match_id FROM prediction_audit WHERE address = wallet
      )
    ORDER BY id FOR UPDATE;
  PERFORM set_config('scoutreport.erasure_wallet', wallet, true);
  PERFORM set_config('scoutreport.erasure_pseudonym', pseudonym, true);
  DELETE FROM picks WHERE address = wallet;
  DELETE FROM prediction_points WHERE address = wallet;
  DELETE FROM predict_terms_acceptances WHERE address = wallet;
  DELETE FROM predict_age_confirmations WHERE address = wallet;
  DELETE FROM predict_nonces WHERE address = wallet;
  DELETE FROM siwe_nonces WHERE address = wallet;
  DELETE FROM predict_rate_limits WHERE address IN (wallet, 'read:' || wallet);
  UPDATE prediction_audit SET address = pseudonym, signature = NULL WHERE address = wallet;
  UPDATE admin_audit_log SET
    actor_address = CASE WHEN actor_address = wallet THEN pseudonym ELSE actor_address END,
    payload = '{"erased":true}'::jsonb
    WHERE actor_address = wallet OR strpos(lower(payload::text), wallet) > 0;
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