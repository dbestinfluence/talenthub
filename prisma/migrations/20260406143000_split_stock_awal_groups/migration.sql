ALTER TABLE "Daily_Planning"
ADD COLUMN "stock_awal_junbiki_cb_1tr" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "stock_awal_junbiki_cb_2tr" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "stock_awal_emergency_cb_1tr" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "stock_awal_emergency_cb_2tr" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "stock_awal_emergency_cr_1tr" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "stock_awal_emergency_cam_01" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "stock_awal_emergency_cam_02" INTEGER NOT NULL DEFAULT 0;

UPDATE "Daily_Planning"
SET
  "stock_awal_junbiki_cb_1tr" = "stock_awal_cb_1tr",
  "stock_awal_junbiki_cb_2tr" = "stock_awal_cb_2tr",
  "stock_awal_emergency_cr_1tr" = "stock_awal_cr_1tr",
  "stock_awal_emergency_cam_01" = "stock_awal_cam_01",
  "stock_awal_emergency_cam_02" = "stock_awal_cam_02";

ALTER TABLE "Daily_Planning"
DROP COLUMN "stock_awal_cb_1tr",
DROP COLUMN "stock_awal_cb_2tr",
DROP COLUMN "stock_awal_cr_1tr",
DROP COLUMN "stock_awal_cam_01",
DROP COLUMN "stock_awal_cam_02";
