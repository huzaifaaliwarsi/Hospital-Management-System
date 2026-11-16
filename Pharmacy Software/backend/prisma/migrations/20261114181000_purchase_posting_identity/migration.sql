ALTER TABLE "purchases" ADD COLUMN IF NOT EXISTS "request_key" TEXT, ADD COLUMN IF NOT EXISTS "request_hash" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "purchases_request_key_key" ON "purchases"("request_key");
