-- Preserve existing customer records by copying their contact details from the linked user.
ALTER TABLE "Customer"
ADD COLUMN "name" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Customer" AS c
SET "name" = u."name",
    "email" = u."email"
FROM "User" AS u
WHERE c."userId" = u."id";

ALTER TABLE "Customer"
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "email" SET NOT NULL;

DROP INDEX "Customer_userId_organizationId_key";
CREATE UNIQUE INDEX "Customer_organizationId_email_key"
ON "Customer"("organizationId", "email");

ALTER TABLE "Customer" DROP CONSTRAINT "Customer_userId_fkey";
ALTER TABLE "Customer" DROP COLUMN "userId";
