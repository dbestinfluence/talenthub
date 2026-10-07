ALTER TABLE "dtl_project"
ADD COLUMN "drf_sort_order" INTEGER NOT NULL DEFAULT 0;

WITH ordered_details AS (
  SELECT
    "drf_id",
    ROW_NUMBER() OVER (
      PARTITION BY "drf_projectid"
      ORDER BY "drf_id"
    ) AS row_number
  FROM "dtl_project"
)
UPDATE "dtl_project" AS detail
SET "drf_sort_order" = ordered_details.row_number
FROM ordered_details
WHERE detail."drf_id" = ordered_details."drf_id";

ALTER TABLE "trs_project"
ADD COLUMN "prj_po_no" VARCHAR(100);

ALTER TABLE "mst_dbest"
ADD COLUMN "bst_approver_name" VARCHAR(100),
ADD COLUMN "bst_approver_title" VARCHAR(100);
