-- =====================================================================
-- Reiseblog – komplette Datenbank (nur für ein NEUES, leeres Supabase-Projekt)
-- Im Supabase-Dashboard: SQL Editor → New query → alles einfügen → Run.
-- Spätere Änderungen kommen als kleine Dateien in supabase/schritte/.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Dokumente: Reisen, Einträge, Plätze, Fotos (Inhalt als JSON)
--    Jede Person sieht und ändert nur ihre eigenen Dokumente.
-- ---------------------------------------------------------------------
create table if not exists public.dokumente (
	id uuid primary key,
	owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
	art text not null check (art in ('reise', 'eintrag', 'platz', 'foto')),
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

drop policy if exists "eigene lesen" on public.dokumente;
create policy "eigene lesen" on public.dokumente for select to authenticated using (owner = auth.uid());
drop policy if exists "eigene anlegen" on public.dokumente;
create policy "eigene anlegen" on public.dokumente for insert to authenticated with check (owner = auth.uid());
drop policy if exists "eigene ändern" on public.dokumente;
create policy "eigene ändern" on public.dokumente for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
-- Kein Löschen: gelöscht wird „weich“ (geloescht = true), siehe aufraeumen()

-- ---------------------------------------------------------------------
-- 2. Freigaben (Teilen-Links) mit Umfang
--    umfang = { reisen: 'alle' | [ids], plaetze, unterwegs, texte, preise, fotos }
-- ---------------------------------------------------------------------
create table if not exists public.freigaben (
	token text primary key default replace(gen_random_uuid()::text, '-', ''),
	owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
	name text not null,
	umfang jsonb not null,
	widerrufen boolean not null default false,
	erstellt_am timestamptz not null default now()
);

alter table public.freigaben enable row level security;

drop policy if exists "eigene freigaben" on public.freigaben;
create policy "eigene freigaben" on public.freigaben for all to authenticated
	using (owner = auth.uid()) with check (owner = auth.uid());

-- Gast-Ansicht: liefert nur das Freigegebene. Nicht Freigegebenes wird schon HIER entfernt,
-- es kommt also nie beim Gast an. Private Einträge werden nie geteilt.
create or replace function public.freigabe_lesen(p_token text) returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
	f public.freigaben;
	u jsonb;
	alle_reisen boolean;
	ergebnis jsonb;
begin
	select * into f from public.freigaben where token = p_token and not widerrufen;
	if not found then
		return null;
	end if;
	u := f.umfang;
	alle_reisen := coalesce(u ->> 'reisen', '') = 'alle';

	with reisen as (
		select d.id, d.inhalt from public.dokumente d
		where d.owner = f.owner and d.art = 'reise' and not d.geloescht
			and (alle_reisen or d.id::text in (select jsonb_array_elements_text(u -> 'reisen')))
	),
	eintraege as (
		select d.id, d.inhalt from public.dokumente d
		where d.owner = f.owner and d.art = 'eintrag' and not d.geloescht
			and (d.inhalt ->> 'reise') in (select id::text from reisen)
			and coalesce((d.inhalt ->> 'privat')::boolean, false) = false
			and (
				((d.inhalt ->> 'typ') = 'stay' and coalesce((u ->> 'plaetze')::boolean, false))
				or ((d.inhalt ->> 'typ') <> 'stay' and coalesce((u ->> 'unterwegs')::boolean, false))
			)
	),
	plaetze as (
		select d.id, d.inhalt from public.dokumente d
		where d.owner = f.owner and d.art = 'platz' and not d.geloescht
			and d.id::text in (select inhalt ->> 'platz' from eintraege where inhalt ? 'platz')
	),
	fotos as (
		select d.id, d.inhalt from public.dokumente d
		where coalesce((u ->> 'fotos')::boolean, false)
			and d.owner = f.owner and d.art = 'foto' and not d.geloescht
			and (d.inhalt ->> 'reise') in (select id::text from reisen)
			and (not (d.inhalt ? 'eintrag') or (d.inhalt ->> 'eintrag') in (select id::text from eintraege))
	)
	select jsonb_build_object(
		'name', f.name,
		'umfang', u,
		'reisen', coalesce((select jsonb_agg(
			case when coalesce((u ->> 'texte')::boolean, false) then inhalt else inhalt - 'notiz' end) from reisen), '[]'::jsonb),
		'eintraege', coalesce((select jsonb_agg(
			(case when coalesce((u ->> 'texte')::boolean, false) then inhalt else inhalt - 'text' end)
			- (case when coalesce((u ->> 'preise')::boolean, false) then '{}'::text[] else array['preis', 'waehrung'] end)
		) from eintraege), '[]'::jsonb),
		'plaetze', coalesce((select jsonb_agg(
			case when coalesce((u ->> 'texte')::boolean, false) then inhalt else inhalt - 'notiz' end) from plaetze), '[]'::jsonb),
		'fotos', coalesce((select jsonb_agg(inhalt) from fotos), '[]'::jsonb)
	) into ergebnis;
	return ergebnis;
end $$;

revoke all on function public.freigabe_lesen(text) from public;
grant execute on function public.freigabe_lesen(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Fotospeicher: Eimer „fotos“, öffentlich lesbar über zufällige Dateinamen,
--    hochladen/ändern nur in den eigenen Ordner (<user-id>/…)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

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
