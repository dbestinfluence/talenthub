-- CreateTable
CREATE TABLE "Daily_Planning" (
    "plan_id" TEXT NOT NULL,
    "tanggal" DATE NOT NULL,
    "shift" TEXT NOT NULL,
    "day_night" TEXT,
    "stock_awal_cb_1tr" INTEGER NOT NULL DEFAULT 0,
    "stock_awal_cb_2tr" INTEGER NOT NULL DEFAULT 0,
    "stock_awal_cr_1tr" INTEGER NOT NULL DEFAULT 0,
    "stock_awal_cam_01" INTEGER NOT NULL DEFAULT 0,
    "stock_awal_cam_02" INTEGER NOT NULL DEFAULT 0,
    "plan_prod_cb_1tr" INTEGER NOT NULL DEFAULT 0,
    "plan_prod_cb_2tr" INTEGER NOT NULL DEFAULT 0,
    "plan_prod_cr_1tr" INTEGER NOT NULL DEFAULT 0,
    "plan_prod_cam_01" INTEGER NOT NULL DEFAULT 0,
    "plan_prod_cam_02" INTEGER NOT NULL DEFAULT 0,
    "input_by" TEXT,
    "input_at" TIMESTAMP(3),
    "remarks" TEXT,

    CONSTRAINT "Daily_Planning_pkey" PRIMARY KEY ("plan_id")
);

-- CreateTable
CREATE TABLE "Order_Header" (
    "order_id" TEXT NOT NULL,
    "kode_order" TEXT NOT NULL,
    "tanggal_order" DATE NOT NULL,
    "waktu_order" TIMESTAMP(3) NOT NULL,
    "shift" TEXT NOT NULL,
    "day_night" TEXT,
    "truck_type" TEXT,
    "ritase_request" INTEGER DEFAULT 0,
    "status_order" TEXT,
    "remarks_ordering" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3),
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "Order_Header_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "Order_Detail" (
    "detail_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "item_code" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "qty_order" INTEGER NOT NULL DEFAULT 0,
    "qty_confirm" INTEGER DEFAULT 0,
    "qty_received" INTEGER DEFAULT 0,
    "remarks_ordering" TEXT,
    "remarks_delivery" TEXT,
    "line_no" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "Order_Detail_pkey" PRIMARY KEY ("detail_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Daily_Planning_tanggal_shift_day_night_key" ON "Daily_Planning"("tanggal", "shift", "day_night");

-- CreateIndex
CREATE INDEX "Order_Header_tanggal_order_shift_day_night_idx" ON "Order_Header"("tanggal_order", "shift", "day_night");

-- CreateIndex
CREATE INDEX "Order_Header_kode_order_idx" ON "Order_Header"("kode_order");

-- CreateIndex
CREATE INDEX "Order_Detail_order_id_idx" ON "Order_Detail"("order_id");

-- CreateIndex
CREATE INDEX "Order_Detail_item_code_idx" ON "Order_Detail"("item_code");

-- AddForeignKey
ALTER TABLE "Order_Detail" ADD CONSTRAINT "Order_Detail_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order_Header"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop legacy table
DROP TABLE IF EXISTS "order_record";
DROP TABLE IF EXISTS "Order_Record";
