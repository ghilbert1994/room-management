-- 007_drop_legacy_purpose.sql
-- Removes the pre-normalization free-text column.
--
-- Run this only AFTER the backend that reads reservation_purposes is deployed
-- (the commit that introduces /api/reservation/purposes). Until then the old
-- backend still writes reservations.purpose, which is why 006 kept the column.
--
--   node migrations/run.js 007_drop_legacy_purpose.sql

alter table reservations drop column if exists purpose;

-- New rows are always created with a purpose, so the reference can now be
-- enforced at the database level.
alter table reservations alter column purpose_id set not null;
