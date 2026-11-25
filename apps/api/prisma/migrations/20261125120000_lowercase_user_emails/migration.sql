-- Emails are now compared in lowercase everywhere, so existing accounts must be stored in lowercase too.
-- If two accounts differ only by letter case, the UNIQUE constraint makes this fail loudly (merge them by hand first).
UPDATE "User" SET "email" = LOWER("email") WHERE "email" <> LOWER("email");
