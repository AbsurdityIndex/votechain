PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS votechain_poc_state_v2 (
  bundle_id TEXT PRIMARY KEY,
  short_code TEXT NOT NULL,
  nullifier TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('ready', 'consumed', 'invalid')),
  receipt_kind TEXT NOT NULL CHECK (receipt_kind IN ('expected', 'recorded', 'rejected')),
  credential_json TEXT NOT NULL,
  credential_hash TEXT NOT NULL,
  receipt_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  audit_json TEXT NOT NULL,
  consumed_at TEXT,
  invalid_reason TEXT,
  expected_error_code TEXT,
  duplicate_of TEXT REFERENCES votechain_poc_state_v2(bundle_id),
  fraud_flag_code TEXT,
  fraud_flag_notes TEXT,
  last_error_at TEXT,
  last_verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dirty_noted_at TEXT,
  CHECK (
    (status = 'consumed' AND consumed_at IS NOT NULL AND receipt_kind = 'recorded') OR
    (status = 'ready' AND consumed_at IS NULL AND receipt_kind = 'expected') OR
    (status = 'invalid' AND receipt_kind = 'rejected')
  ),
  CHECK (
    (status = 'invalid' AND invalid_reason IS NOT NULL) OR status != 'invalid'
  )
);

CREATE INDEX IF NOT EXISTS idx_votechain_poc_state_v2_status
  ON votechain_poc_state_v2 (status);

CREATE INDEX IF NOT EXISTS idx_votechain_poc_state_v2_consumed_at
  ON votechain_poc_state_v2 (consumed_at);

CREATE INDEX IF NOT EXISTS idx_votechain_poc_state_v2_duplicate_of
  ON votechain_poc_state_v2 (duplicate_of);

CREATE TRIGGER IF NOT EXISTS trg_votechain_poc_state_v2_touch_updated_at
AFTER UPDATE ON votechain_poc_state_v2
FOR EACH ROW
BEGIN
  UPDATE votechain_poc_state_v2
  SET updated_at = CURRENT_TIMESTAMP
  WHERE bundle_id = OLD.bundle_id;
END;
