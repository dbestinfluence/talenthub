ALTER TABLE "dtl_project"
  ADD COLUMN "drf_pricing_type" VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "drf_bundle_id" VARCHAR(64),
  ADD COLUMN "drf_bundle_price" DECIMAL(12, 2);

CREATE INDEX "idx_dtl_project_bundle_id" ON "dtl_project"("drf_bundle_id");
