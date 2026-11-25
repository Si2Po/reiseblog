-- =====================================================================
-- Reiseblog – komplette Datenbank (nur für ein NEUES, leeres Supabase-Projekt)
-- Im Supabase-Dashboard: SQL Editor → New query → alles einfügen → Run.
-- Spätere Änderungen kommen als kleine Dateien in supabase/schritte/.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Dokumente: Reisen, Einträge, Plätze, Fotos, Ziele
--    inhalt = verschlüsselt ({v, iv, d}), der Server kann ihn nicht lesen.
--    Jede Person sieht und ändert nur ihre eigenen Dokumente.
-- ---------------------------------------------------------------------
create table if not exists public.dokumente (
	id uuid primary key,
	owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
	art text not null check (art in ('reise', 'eintrag', 'platz', 'foto', 'ziel')),
	inhalt jsonb not null,
	geloescht boolean not null default false,
	geaendert_am timestamptz not null default now()
);

create index if not exists dokumente_owner_zeit on public.dokumente (owner, geaendert_am);

-- Server-Zeitstempel bei jeder Änderung (darauf baut das Abholen von Änderungen auf)
create or replace function public.dokumente_zeit() returns trigger
language plpgsql as $$
begin
	new.geaendert_am := clock_timestamp();
	new.owner := coalesce(old.owner, new.owner);
	return new;
end $$;

drop trigger if exists dokumente_zeit on public.dokumente;
create trigger dokumente_zeit before insert or update on public.dokumente
	for each row execute function public.dokumente_zeit();

alter table public.dokumente enable row level security;
-- Zugriff über die App (Data API) ausdrücklich erlauben – welche Zeilen, regeln die Policies
grant select, insert, update on public.dokumente to authenticated;

drop policy if exists "eigene lesen" on public.dokumente;
create policy "eigene lesen" on public.dokumente for select to authenticated using (owner = auth.uid());
drop policy if exists "eigene anlegen" on public.dokumente;
create policy "eigene anlegen" on public.dokumente for insert to authenticated with check (owner = auth.uid());
drop policy if exists "eigene ändern" on public.dokumente;
create policy "eigene ändern" on public.dokumente for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
-- Kein Löschen: gelöscht wird „weich“ (geloescht = true), siehe aufraeumen()

-- ---------------------------------------------------------------------
-- 2. Tresor: der Tagebuch-Schlüssel, eingepackt mit dem Tagebuch-Passwort
--    und mit dem Notfall-Code (beides nur auf dem Gerät bekannt). Eine Zeile pro Konto.
-- ---------------------------------------------------------------------
create table if not exists public.tresor (
	owner uuid primary key default auth.uid() references auth.users (id) on delete cascade,
	salz text not null,
	pw jsonb not null,
	code_salz text not null,
	code jsonb not null,
	geaendert_am timestamptz not null default now()
);
alter table public.tresor enable row level security;
grant select, insert, update on public.tresor to authenticated;
drop policy if exists "eigener tresor" on public.tresor;
create policy "eigener tresor" on public.tresor for all to authenticated
	using (owner = auth.uid()) with check (owner = auth.uid());

-- ---------------------------------------------------------------------
-- 3. Fotospeicher: privater Eimer „fotos“, Dateien verschlüsselt (<user-id>/<foto-id>.bin).
--    Lesen, hochladen, ändern, löschen nur im eigenen Ordner.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['application/octet-stream'])
on conflict (id) do update set public = false, allowed_mime_types = array['application/octet-stream'];

drop policy if exists "fotos lesen" on storage.objects;
create policy "fotos lesen" on storage.objects for select to authenticated
	using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "fotos hochladen" on storage.objects;
create policy "fotos hochladen" on storage.objects for insert to authenticated
	with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "fotos ändern" on storage.objects;
create policy "fotos ändern" on storage.objects for update to authenticated
	using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "fotos löschen" on storage.objects;
create policy "fotos löschen" on storage.objects for delete to authenticated
	using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- 4. Wecker (verhindert das Pausieren des kostenlosen Projekts) und Aufräumen
-- ---------------------------------------------------------------------
create or replace function public.ping() returns text
language sql security definer set search_path = public as $$
	select 'wach ' || now()::text;
$$;
grant execute on function public.ping() to anon, authenticated;

-- Löschmarkierungen nach 90 Tagen endgültig entfernen (die App ruft das gelegentlich auf)
create or replace function public.aufraeumen() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
	delete from public.dokumente
	where owner = auth.uid() and geloescht and geaendert_am < now() - interval '90 days';
	get diagnostics n = row_count;
	return n;
end $$;
grant execute on function public.aufraeumen() to authenticated;
