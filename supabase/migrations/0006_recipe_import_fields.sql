-- Utvider recipes med felter hentet fra URL-import (schema.org/JSON-LD Recipe).
-- Gjenbruker eksisterende url (kilde) og body (fremgangsmåte) fremfor å lage nye kolonner.
alter table recipes add column if not exists image_url text;
alter table recipes add column if not exists servings int;
alter table recipes add column if not exists total_time_minutes int;
