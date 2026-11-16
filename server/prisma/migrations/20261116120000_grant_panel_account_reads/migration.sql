-- The internal panel's Users page reads accounts through the read-only control_usage role.
-- Column grants keep password hashes, session tokens and saved addresses out of its reach.
-- Only production has that role, so the grant is skipped wherever it does not exist.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'control_usage') THEN
    GRANT SELECT (id, email, name, email_verified, created_at) ON "user" TO control_usage;
    GRANT SELECT (user_id, provider, created_at) ON "user_identity" TO control_usage;
    GRANT SELECT (user_id, created_at) ON "user_session" TO control_usage;
    GRANT SELECT ON "user_event" TO control_usage;
  END IF;
END $$;
