ALTER TABLE "mst_brand"
  ADD COLUMN "brd_pic1_phone" VARCHAR(30),
  ADD COLUMN "brd_pic2_phone" VARCHAR(30),
  ADD COLUMN "brd_pic3_phone" VARCHAR(30);

ALTER TABLE "trs_project"
  ADD COLUMN "prj_project_pic" VARCHAR(100),
  ADD COLUMN "prj_quotation_pic" VARCHAR(100),
  ADD COLUMN "prj_quotation_phone" VARCHAR(30);
