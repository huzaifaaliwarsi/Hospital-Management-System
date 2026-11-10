-- Keep existing department links and records; permit stream-only services.
ALTER TABLE "service_rates" ALTER COLUMN "department_id" DROP NOT NULL;
