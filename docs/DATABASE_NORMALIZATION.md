# Database Normalization (1NF → 3NF)

This document is the defense-ready explanation of how the LabEase schema is
normalized, what changed in `006_reservation_purposes.sql`, and what is still
outstanding.

> **On the "ISO standard" claim:** no ISO standard requires database
> normalization. ISO/IEC 25010 is a *software quality model* (functional
> suitability, performance, security, maintainability) and ISO/IEC 27001 is an
> *information-security management* standard. What a panel usually wants is the
> textbook relational design check (1NF, 2NF, 3NF) **plus** the supporting
> artifacts: an ERD and a data dictionary. This document is that check.

## 1. Relations and keys

| Relation | Primary key | Foreign keys |
|---|---|---|
| `users` | `id` | `invite_code_id → invite_codes(id)` |
| `rooms` | `id` | `coordinator_id → users(id)` |
| `computers` | `id` | `room_id → rooms(id)` |
| `reservations` | `id` | `room_id → rooms(id)`, `reserved_by → users(id)`, `purpose_id → reservation_purposes(id)` |
| `reservation_purposes` | `id` | — |
| `notifications` | `id` | `user_id → users(id)` |
| `semesters` | `id` | `created_by → users(id)` |
| `semester_schedules` | `id` | `semester_id → semesters(id)`, `room_id → rooms(id)`, `instructor_id → users(id)`, `created_by → users(id)` |
| `master_schedule_events` | `id` | `created_by → users(id)` |
| `invite_codes` | `id` | `created_by → users(id)` |
| `class_cancellations` | `id` | `schedule_id → semester_schedules(id)`, `cancelled_by → users(id)` |
| `session` | `sid` | — (session store) |

Every relation has a declared primary key, so there are no duplicate rows and
every attribute is functionally dependent on a key.

## 2. First Normal Form (1NF)

**Rule:** every column holds one atomic value, there are no repeating groups or
arrays, and each row is uniquely identifiable.

Evidence:

- No column stores a list, set, or comma-separated values. The previous
  multi-purpose candidate — a free-text `purpose` string that held whatever the
  user typed — has been replaced by `purpose_id`, a single atomic reference.
- Optional detail lives in its own column (`purpose_notes`) instead of being
  concatenated into the category.
- Every table has a single-column primary key (see table above).

**Before this change** `reservations.purpose` was unconstrained text. Production
data contained `"Ya"`, `"Ya 3"`, `"hahahahaha"`, `"yeah"`, which cannot be
grouped, filtered, or reported on. That is a 1NF/domain-integrity failure even
though each value was technically atomic: a column whose domain is "any string"
has no domain at all.

**After this change** purposes are rows in `reservation_purposes` and
`reservations.purpose_id` references them. The value set is closed, so reports
such as "reservations per purpose" are now meaningful.

## 3. Second Normal Form (2NF)

**Rule:** 1NF, and every non-key attribute depends on the *whole* primary key —
relevant only when a relation has a composite key.

All LabEase relations use single-column surrogate keys (`id`), so partial
dependencies (a non-key attribute depending on part of a composite key) cannot
exist. 2NF is satisfied by construction.

## 4. Third Normal Form (3NF)

**Rule:** 2NF, and no non-key attribute depends on another non-key attribute
(no transitive dependencies, no derived data stored alongside its source).

Functional dependencies for reservations:

```
id            → room_id, reserved_by, purpose_id, purpose_notes,
                time_start, time_end, status, participants, created_at
room_id       → rooms.name, rooms.location, rooms.capacity, ...
reserved_by   → users.name, users.email, users.role
purpose_id    → reservation_purposes.label, reservation_purposes.description
```

Room, user, and purpose facts live only in their own relations, so changing a
room name cannot leave reservations pointing at a stale copy. That is why the
reservation list joins `rooms`, `users`, and `reservation_purposes` instead of
denormalizing names into the row.

### Known deviations still open

These are documented rather than hidden, which is what an examiner expects:

| Relation | Attribute | Dependency | Plan |
|---|---|---|---|
| `rooms` | `computer_count` | derived from `count(computers)` | compute in query; keep only if used as a cached counter with a trigger |
| `semester_schedules` | `room` (text) | duplicates `room_id` | backfill `room_id`, then drop the text column |
| `semester_schedules` | `instructor` (text) | duplicates `instructor_id` | same |
| `users` | `name` (full name) | composite of first/middle/last | split when student records are imported |
| `notifications` | `message` | embeds room/user names for display | store `entity_type` + `entity_id`, render text in the UI |

None of these break 1NF; they are 3NF hygiene items that can be resolved in a
later cleanup without changing the application behavior.

## 5. Migration history

| File | Effect |
|---|---|
| `006_reservation_purposes.sql` | creates `reservation_purposes`, seeds 10 controlled purposes, adds `purpose_id` + `purpose_notes`, backfills existing text (exact match → keyword match → *Others* with the original text preserved as a note) |
| `007_drop_legacy_purpose.sql` | drops the pre-normalization free-text `purpose` column and makes `purpose_id` `not null`; run **after** the new backend is deployed |

`006` is additive and backward compatible: the previous backend keeps working
while the new one is deployed. `007` is the two-phase cut-over that removes the
duplicate attribute for good.

## 6. How this is demonstrated

1. `\d reservations` shows `purpose_id` with a foreign-key constraint and no
   free-text purpose column (after `007`).
2. `select * from reservation_purposes;` shows the closed value set.
3. The reservation form only offers those values, and the API rejects anything
   else with `Choose a valid reservation purpose`.
4. `select p.label, count(*) from reservations r join reservation_purposes p on
   p.id = r.purpose_id group by 1;` produces a usable report — impossible with
   the old free text.
