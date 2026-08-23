CREATE TABLE IF NOT EXISTS "mst_apify_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "label" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "quota_exceeded_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mst_apify_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mst_apify_tokens_token_key"
ON "mst_apify_tokens"("token");

CREATE INDEX IF NOT EXISTS "mst_apify_tokens_is_active_quota_exceeded_at_idx"
ON "mst_apify_tokens"("is_active", "quota_exceeded_at");
