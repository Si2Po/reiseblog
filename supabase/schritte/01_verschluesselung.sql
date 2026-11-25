-- Schritt 01: Ende-zu-Ende-Verschlüsselung, Teilen-Links entfernt.
-- Einmal im SQL Editor ausführen (für Projekte, die komplett.sql VOR diesem Schritt bekommen haben).
-- Daten gehen keine verloren: es lagen zu dem Zeitpunkt noch keine Reisen auf dem Server.

-- Teilen entfällt
drop function if exists public.freigabe_lesen(text);
drop table if exists public.freigaben;

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

