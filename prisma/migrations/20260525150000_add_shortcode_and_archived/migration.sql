-- AlterTable: add shortCode + archived
ALTER TABLE "Product" ADD COLUMN "shortCode" INTEGER;
ALTER TABLE "Product" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Product_shortCode_idx" ON "Product"("shortCode");
CREATE INDEX "Product_archived_idx" ON "Product"("archived");

-- Backfill existing products with sequential short codes ordered by createdAt.
-- Uses a CTE + row_number() so we get 1, 2, 3, ... assigned deterministically.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt") AS rn
  FROM "Product"
  WHERE "shortCode" IS NULL
)
UPDATE "Product" p
SET "shortCode" = n.rn
FROM numbered n
WHERE p.id = n.id;

-- Mark fully-sold-out existing products as archived so they don't crowd the
-- sell page. (Doesn't affect anything else — just hides them.)
UPDATE "Product"
SET "archived" = true
WHERE "stockXS" = 0 AND "stockS" = 0 AND "stockM" = 0 AND "stockL" = 0;
