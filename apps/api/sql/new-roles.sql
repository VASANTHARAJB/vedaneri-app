-- Only needed if creating a GM or Developer login says "The users table does not accept this role yet".
-- The API normally does this change by itself the first time a GM or Developer login is saved.
ALTER TABLE users MODIFY role VARCHAR(30) NOT NULL;