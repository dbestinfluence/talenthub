ALTER TABLE "trs_project"
ADD COLUMN IF NOT EXISTS "prj_dbestid" INTEGER;

UPDATE "trs_project"
SET "prj_dbestid" = (
  SELECT "bst_id"
  FROM "mst_dbest"
  WHERE "bst_status" = 1
  ORDER BY "bst_id" DESC
  LIMIT 1
)
WHERE "prj_dbestid" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_trs_project_dbest'
  ) THEN
    ALTER TABLE "trs_project"
    ADD CONSTRAINT "fk_trs_project_dbest"
    FOREIGN KEY ("prj_dbestid") REFERENCES "mst_dbest"("bst_id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;
