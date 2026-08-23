UPDATE "dtl_project"
SET
  "drf_rate" = COALESCE("drf_rate", "drf_rate_card"),
  "drf_markup_price" = COALESCE("drf_markup_price", "drf_rate_card");

ALTER TABLE "dtl_project" DROP COLUMN "drf_rate_card";
