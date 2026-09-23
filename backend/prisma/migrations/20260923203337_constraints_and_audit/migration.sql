-- Database-level rules that Prisma's schema language cannot express.
-- These hold even if a bug or a manual SQL session bypasses the application.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Value constraints
-- ---------------------------------------------------------------------------

ALTER TABLE users
  ADD CONSTRAINT users_email_lowercase CHECK (email = lower(email)),
  ADD CONSTRAINT users_failed_login_count_nonneg CHECK (failed_login_count >= 0);

ALTER TABLE patients
  ADD CONSTRAINT patients_version_positive CHECK (version >= 1),
  ADD CONSTRAINT patients_dob_not_future CHECK (date_of_birth <= CURRENT_DATE);

ALTER TABLE clinical_records
  ADD CONSTRAINT clinical_psa_nonneg CHECK (psa_ng_ml IS NULL OR psa_ng_ml >= 0),
  ADD CONSTRAINT clinical_free_psa_nonneg CHECK (free_psa_ng_ml IS NULL OR free_psa_ng_ml >= 0),
  ADD CONSTRAINT clinical_free_psa_le_total CHECK (
    free_psa_ng_ml IS NULL OR psa_ng_ml IS NULL OR free_psa_ng_ml <= psa_ng_ml),
  ADD CONSTRAINT clinical_pirads_range CHECK (pirads_score IS NULL OR pirads_score BETWEEN 1 AND 5),
  ADD CONSTRAINT clinical_prostate_volume_positive CHECK (
    prostate_volume_ml IS NULL OR prostate_volume_ml > 0),
  ADD CONSTRAINT clinical_version_positive CHECK (version >= 1);

ALTER TABLE consents
  ADD CONSTRAINT consents_withdrawal_consistent CHECK (
    (status = 'WITHDRAWN' AND withdrawn_at IS NOT NULL)
    OR (status = 'GRANTED' AND withdrawn_at IS NULL)),
  ADD CONSTRAINT consents_version_positive CHECK (version >= 1);

ALTER TABLE imaging_studies
  ADD CONSTRAINT imaging_size_positive CHECK (size_bytes > 0),
  ADD CONSTRAINT imaging_sha256_format CHECK (sha256 ~ '^[0-9a-f]{64}$');

ALTER TABLE histopathology_specimens
  ADD CONSTRAINT histo_size_positive CHECK (size_bytes > 0),
  ADD CONSTRAINT histo_sha256_format CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT histo_gleason_primary_range CHECK (gleason_primary IS NULL OR gleason_primary BETWEEN 1 AND 5),
  ADD CONSTRAINT histo_gleason_secondary_range CHECK (gleason_secondary IS NULL OR gleason_secondary BETWEEN 1 AND 5),
  ADD CONSTRAINT histo_isup_range CHECK (isup_grade_group IS NULL OR isup_grade_group BETWEEN 1 AND 5);

-- NFR-09: every explanation is either a stored artifact or an explicit "unavailable" reason.
ALTER TABLE explainability_artifacts
  ADD CONSTRAINT explain_artifact_or_reason CHECK (
    storage_key IS NOT NULL OR unavailable_reason IS NOT NULL);

-- ---------------------------------------------------------------------------
-- Append-only, hash-chained audit log (FR-10)
-- ---------------------------------------------------------------------------

-- Deterministic hash of a row, chained to the previous row's hash.
CREATE OR REPLACE FUNCTION audit_logs_row_hash(p_prev text, r audit_logs)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT encode(digest(concat_ws('|',
    p_prev,
    r.seq::text,
    to_char(r.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    coalesce(r.actor_user_id::text, ''),
    coalesce(r.actor_role, ''),
    r.action,
    r.entity_type,
    coalesce(r.entity_id, ''),
    r.outcome::text,
    coalesce(r.request_id, ''),
    coalesce(r.ip, ''),
    coalesce(r.details::text, '')
  ), 'sha256'), 'hex');
$$;

-- Serialises inserts with a transaction-scoped advisory lock so that seq order
-- equals chain order, then links the new row to the latest one.
CREATE OR REPLACE FUNCTION audit_logs_before_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_prev text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('audit_logs_chain'));
  NEW.seq := nextval(pg_get_serial_sequence('audit_logs', 'seq'));
  NEW.occurred_at := date_trunc('milliseconds', coalesce(NEW.occurred_at, now()));
  SELECT row_hash INTO v_prev FROM audit_logs ORDER BY seq DESC LIMIT 1;
  NEW.prev_hash := coalesce(v_prev, repeat('0', 64));
  NEW.row_hash := audit_logs_row_hash(NEW.prev_hash, NEW);
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_logs_chain
  BEFORE INSERT ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_before_insert();

CREATE OR REPLACE FUNCTION audit_logs_block_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();

CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_block_mutation();

-- Walks the chain; returns the first broken row, or no rows when intact.
CREATE OR REPLACE FUNCTION audit_logs_verify_chain()
RETURNS TABLE (broken_seq bigint, reason text) LANGUAGE plpgsql STABLE AS $$
DECLARE
  r audit_logs;
  v_prev text := repeat('0', 64);
BEGIN
  FOR r IN SELECT * FROM audit_logs ORDER BY seq LOOP
    IF r.prev_hash <> v_prev THEN
      broken_seq := r.seq; reason := 'prev_hash does not match previous row'; RETURN NEXT; RETURN;
    END IF;
    IF r.row_hash <> audit_logs_row_hash(r.prev_hash, r) THEN
      broken_seq := r.seq; reason := 'row content does not match row_hash'; RETURN NEXT; RETURN;
    END IF;
    v_prev := r.row_hash;
  END LOOP;
END;
$$;
