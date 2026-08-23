ALTER TABLE "trs_project"
ADD COLUMN "prj_sheetid" VARCHAR(150),
ADD COLUMN "prj_sheeturl" TEXT,
ADD COLUMN "prj_sheet_sync" TIMESTAMP(6);

CREATE UNIQUE INDEX "trs_project_prj_sheetid_key" ON "trs_project"("prj_sheetid");
