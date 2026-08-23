CREATE TABLE "detail_report" (
    "id" SERIAL NOT NULL,
    "dtl_project_id" INTEGER NOT NULL,
    "content_url" TEXT NOT NULL,
    "platform" VARCHAR(20) NOT NULL,
    "caption" TEXT,
    "thumbnail_url" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "reposts" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "duration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "performance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "scraped_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "detail_report_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "detail_report_dtl_project_id_key" ON "detail_report"("dtl_project_id");
CREATE INDEX "idx_detail_report_project_detail" ON "detail_report"("dtl_project_id");

ALTER TABLE "detail_report" ADD CONSTRAINT "fk_detail_report_project_detail"
FOREIGN KEY ("dtl_project_id") REFERENCES "dtl_project"("drf_id") ON DELETE CASCADE ON UPDATE CASCADE;
