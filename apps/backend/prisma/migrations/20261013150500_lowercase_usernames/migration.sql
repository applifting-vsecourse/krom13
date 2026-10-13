-- BetterAuth's username plugin stores and looks up usernames lowercase.
-- Older seeded rows kept their original casing, so "taken" checks missed them.
UPDATE "user" SET "username" = lower("username") WHERE "username" <> lower("username");
