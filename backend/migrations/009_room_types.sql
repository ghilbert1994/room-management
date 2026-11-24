-- 009_room_types.sql
-- Distinguish classrooms from laboratories.
--
-- Class schedules can now target either kind of room, and the reservation
-- page only offers laboratories. Existing rooms stay laboratories.

alter table rooms
    add column if not exists room_type text not null default 'laboratory';

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'rooms_room_type_check'
    ) then
        alter table rooms
            add constraint rooms_room_type_check
            check (room_type in ('laboratory', 'classroom'));
    end if;
end $$;

create index if not exists rooms_room_type_idx on rooms (room_type);
