-- AlterTable
ALTER TABLE "User" ADD COLUMN "name" TEXT;

-- Backfill (FR-03, AC-04, NFR-01): parte local del email para filas existentes.
UPDATE "User" SET "name" = split_part(email, '@', 1) WHERE "name" IS NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;
