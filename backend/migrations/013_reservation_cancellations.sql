-- 013_reservation_cancellations.sql
-- Keep cancelled reservations instead of deleting them, so they stay visible
-- in My Reservations and Reservation History with an audit trail.

alter table reservations add column if not exists cancelled_at timestamptz;
alter table reservations add column if not exists cancelled_by bigint references users(id) on delete set null;
alter table reservations add column if not exists cancellation_reason text;

create index if not exists reservations_cancelled_idx
    on reservations (cancelled_at desc);
