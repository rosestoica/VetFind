-- Migration: Add URL slug column to companies (unique, derived from name)
-- Also enforce unique company names.

-- 1. Add slug column (nullable initially so we can backfill)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- 2. Backfill existing rows: strip diacritics, lowercase, hyphens
--    (handles common Romanian characters; the backend will generate proper slugs going forward)
UPDATE companies
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      TRANSLATE(
        name,
        'ăâîșțĂÂÎȘȚéèêëàáäüöôûùçñÉÈÊËÀÁÄÜÖÔÛÙÇÑ',
        'aaistAAISTeeeeeaaauooouucnEEEEAAAUOOUUCN'
      ),
      '[^a-zA-Z0-9 -]', '', 'g'
    ),
    '\s+', '-', 'g'
  )
)
WHERE slug IS NULL OR slug = '';

-- 3. Set NOT NULL now that rows are populated
ALTER TABLE companies ALTER COLUMN slug SET NOT NULL;

-- 4. Unique index on slug (for fast lookup)
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);

-- 5. Unique constraint on name (company names must be unique)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_name_key'
  ) THEN
    ALTER TABLE companies ADD CONSTRAINT companies_name_key UNIQUE (name);
  END IF;
END $$;
