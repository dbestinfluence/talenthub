CREATE TABLE IF NOT EXISTS "mst_dbest" (
    "bst_id" SERIAL NOT NULL,
    "bst_nama" VARCHAR(100),
    "bst_alamat" VARCHAR(100),
    "bst_status" INTEGER DEFAULT 1,
    "creaby" VARCHAR(20),
    "creadate" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "modiby" VARCHAR(20),
    "modidate" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mst_dbest_pkey" PRIMARY KEY ("bst_id")
);
