-- Flexible Ward/Room/Bed hierarchy: support Ward -> Bed, Ward -> Room -> Bed,
-- and Room -> Bed (standalone room, no ward). No existing data is dropped or
-- modified beyond widening nullability and backfilling the new column.

-- AlterTable: Room can now exist without a parent Ward
ALTER TABLE "rooms" ALTER COLUMN "ward_id" DROP NOT NULL;

-- AlterTable: Bed can now exist without a parent Room (direct Ward -> Bed)
ALTER TABLE "beds" ALTER COLUMN "room_id" DROP NOT NULL;
ALTER TABLE "beds" ADD COLUMN "ward_id" TEXT;

-- Backfill: existing Ward -> Room -> Bed beds get their ward denormalized
-- directly onto the bed row, so ward lookups never require joining Room.
UPDATE "beds" b
SET "ward_id" = r."ward_id"
FROM "rooms" r
WHERE b."room_id" = r."id" AND r."ward_id" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
