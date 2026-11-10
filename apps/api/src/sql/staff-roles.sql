-- One-time update so the users table can hold the new staff roles and logins without a phone number.
-- The database is shared by dev and live, so this changes both. Safe to run more than once.

-- Role becomes plain text: all existing values (superadmin, admin, devotee ...) are kept as they are.
ALTER TABLE users MODIFY COLUMN role VARCHAR(30) NOT NULL DEFAULT 'devotee';

-- A staff login does not need a phone number. (Skip this line if the column is already NULL-able.)
ALTER TABLE users MODIFY COLUMN phone VARCHAR(30) NULL;