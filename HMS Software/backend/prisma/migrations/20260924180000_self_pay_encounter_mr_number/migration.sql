-- Give self-pay encounters a real, permanent MR number (panel.md §4.4),
-- drawn from the SAME sequence as panel_patients so numbers never collide
-- and never shift on re-fetch (previously computed client-side, on the fly,
-- from row position — this reassigned a different visitor's MR number
-- every time a new panel patient or self-pay visitor was registered).

ALTER TABLE "self_pay_encounters" ADD COLUMN "mr_number" TEXT;

-- Backfill existing rows: continue the sequence after the highest
-- panel_patients MR number, in registration order, so earliest-registered
-- visitors keep the lowest numbers (matches the old client-side ordering
-- visitors were already seeing, minimizing surprise).
WITH max_panel AS (
  SELECT COALESCE(MAX(CAST(substring("mr_number" FROM 'MR-(\d+)$') AS INTEGER)), 0) AS max_num
  FROM "panel_patients"
  WHERE "mr_number" ~ '^MR-\d+$'
),
numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "created_at" ASC) AS rn
  FROM "self_pay_encounters"
)
UPDATE "self_pay_encounters" sp
SET "mr_number" = 'MR-' || LPAD((max_panel.max_num + numbered.rn)::text, 6, '0')
FROM numbered, max_panel
WHERE sp."id" = numbered."id";

ALTER TABLE "self_pay_encounters" ALTER COLUMN "mr_number" SET NOT NULL;

CREATE UNIQUE INDEX "self_pay_encounters_mr_number_key" ON "self_pay_encounters"("mr_number");
