-- Schritt 01: Teilen-Links ohne „Preise“ zeigen auch die Ausgaben (Tanken, Maut, Fähre …) nicht.
-- Einmal im SQL Editor ausführen. Ersetzt nur die Funktion freigabe_lesen, Daten bleiben unverändert.

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
			(case when coalesce((u ->> 'texte')::boolean, false) then inhalt else inhalt - array['text', 'notizen'] end)
			- (case when coalesce((u ->> 'preise')::boolean, false) then '{}'::text[] else array['preis', 'waehrung', 'kosten'] end)
			#- (case when coalesce((u ->> 'preise')::boolean, false) then '{}'::text[] else '{merkmale,stromkosten}'::text[] end)
			#- (case when coalesce((u ->> 'preise')::boolean, false) then '{}'::text[] else '{merkmale,kurtaxe}'::text[] end)
		) from eintraege), '[]'::jsonb),
		'plaetze', coalesce((select jsonb_agg(
			case when coalesce((u ->> 'texte')::boolean, false) then inhalt else inhalt - 'notiz' end) from plaetze), '[]'::jsonb),
		'fotos', coalesce((select jsonb_agg(inhalt) from fotos), '[]'::jsonb)
	) into ergebnis;
	return ergebnis;
end $$;

revoke all on function public.freigabe_lesen(text) from public;
grant execute on function public.freigabe_lesen(text) to anon, authenticated;
