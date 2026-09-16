ALTER TABLE "dtl_project"
ADD COLUMN "drf_platform" VARCHAR(20);

UPDATE "dtl_project" AS detail
SET "drf_platform" = creator."social_media"
FROM "mst_creators" AS creator
WHERE creator."id" = detail."drf_creatorid"
  AND detail."drf_platform" IS NULL;
