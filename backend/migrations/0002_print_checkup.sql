-- Printed check-up sheets are audited like exports (design refresh, B5).
ALTER TABLE audit_log DROP CONSTRAINT audit_log_action_check;
ALTER TABLE audit_log ADD CONSTRAINT audit_log_action_check
  CHECK (action IN ('VIEW_PATIENT', 'EXPORT_CSV', 'EXPORT_PDF', 'PRINT_CHECKUP', 'CORRECT_LOG', 'CONSENT_GRANT', 'CONSENT_REVOKE'));
