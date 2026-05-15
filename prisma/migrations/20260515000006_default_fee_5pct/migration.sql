-- Set all percentage-type categories to 5% platform fee
UPDATE "categories"
SET "feeValue" = 0.05
WHERE "feeType" = 'percentage';
