ALTER TABLE "dtl_project"
ADD COLUMN "drf_rate_card" DECIMAL(12,2),
ADD COLUMN "drf_markup_price" DECIMAL(12,2);

UPDATE "dtl_project"
SET
  "drf_rate_card" = "drf_rate",
  "drf_markup_price" = "drf_rate"
WHERE "drf_rate" IS NOT NULL AND "drf_rate" > 0;
