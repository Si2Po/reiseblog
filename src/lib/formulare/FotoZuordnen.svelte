<!--
  Fotos zuordnen: Reise wählen (oder „Keine Reise“), dann einen Eintrag (Übernachtung, Fahrt,
  Ausflug – auch eine Folgenacht, die zählt zur Übernachtung) oder „Nur zur Reise“ (Tag nach Datum).
  Einträge am Aufnahmetag der Fotos sind markiert. Fotos ohne Ort bekommen den Ort des Eintrags.
  Aufruf: ui.dialog = { art: 'zuordnen', fotos: [ids] } – aus Großansicht, Rechtsklick, nach dem
  Hinzufügen (Hinweis „Zuordnen“) und für mehrere ausgewählte Fotos im Album.
-->
<script lang="ts">
	import Tent from 'phosphor-svelte/lib/Tent';
	import Van from 'phosphor-svelte/lib/Van';
	import Footprints from 'phosphor-svelte/lib/Footprints';
	import Moon from 'phosphor-svelte/lib/Moon';
	import CalendarBlank from 'phosphor-svelte/lib/CalendarBlank';
	import Check from 'phosphor-svelte/lib/Check';
	import Dialog from '#lib/ui/Dialog.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { reisenSortiert, tage } from '#lib/auswertung.ts';
	import { tagLang, jahr, wort, reiseTag } from '#lib/datum.ts';
	import { reiseAm, ortOhneGps } from '#lib/fotos/import.ts';
	import type { Eintrag, Foto } from '#lib/db/typen.ts';

	let { fotos: ids }: { fotos: string[] } = $props();
	// svelte-ignore state_referenced_locally
	const fotos = ids.map((id) => daten.foto(id)).filter((f): f is Foto => !!f);
	const tageDerFotos = new Set(fotos.map((f) => f.aufgenommen.slice(0, 10)));
	const erstes = fotos[0];

	let reise = $state(erstes?.reise ?? reiseAm(erstes?.aufgenommen.slice(0, 10) ?? '') ?? '');
	/** gewählter Eintrag; '' = nur zur Reise */
	let ziel = $state(fotos.every((f) => f.eintrag && f.eintrag === erstes?.eintrag) ? erstes!.eintrag! : '');

	const SYMBOL = { stay: Tent, drive: Van, outing: Footprints };
	interface Zeile {
		key: string;
		eintrag: Eintrag;
		titel: string;
		unter: string;
		nacht?: boolean;
	}
	interface TagGruppe {
		datum: string;
		kopf: string;
		passt: boolean;
		zeilen: Zeile[];
	}
	const gruppen = $derived.by((): TagGruppe[] => {
		const r = daten.reise(reise);
		if (!r) return [];
		return tage(r.id)
			.map((t) => ({
				datum: t.datum,
				kopf: `Tag ${reiseTag(r.start, t.datum)} · ${tagLang(t.datum)}`,
				passt: tageDerFotos.has(t.datum),
				zeilen: [
					...t.eintraege.map((e) => ({ key: e.id, eintrag: e, titel: e.titel, unter: { stay: 'Übernachtung', drive: 'Fahrt', outing: 'Ausflug' }[e.typ] })),
					...t.naechte.map((n) => ({ key: n.eintrag.id + ':' + n.nr, eintrag: n.eintrag, titel: n.eintrag.titel, unter: `Nacht ${n.nr} von ${n.von}`, nacht: true }))
				]
			}))
			.filter((g) => g.zeilen.length);
	});

	const zu = () => (ui.dialog = null);

	async function speichern() {
		const e = daten.eintrag(ziel || undefined);
		const r = reise || undefined;
		for (const f of fotos) {
			const ort = f.ort ?? ortOhneGps(e, r, f.aufgenommen.slice(0, 10));
			await daten.speichern('fotos', { ...f, reise: r, eintrag: e?.id, ort });
		}
		zu();
		const wohin = e ? `„${e.titel}“` : r ? `„${daten.reise(r)?.titel}“` : 'keiner Reise';
		ui.zeige(`${fotos.length} ${wort(fotos.length, 'Foto', 'Fotos')} zugeordnet: ${wohin}`);
	}

	// Beim Öffnen zum passenden Tag scrollen
	function hinscrollen(el: HTMLElement) {
		setTimeout(() => el.querySelector('.passt')?.scrollIntoView({ block: 'center' }), 250);
	}
</script>

<Dialog titel={fotos.length === 1 ? 'Foto zuordnen' : `${fotos.length} Fotos zuordnen`} onschliessen={zu}>
	<div class="vorschau">
		{#each fotos.slice(0, 6) as f (f.id)}<img alt="" src={f.vorschau} />{/each}
		{#if fotos.length > 6}<span>+{fotos.length - 6}</span>{/if}
	</div>

	<label class="feld">
		<span class="name">Reise</span>
		<select
			bind:value={reise}
			onchange={() => {
				ziel = '';
			}}
		>
			<option value="">Keine Reise</option>
			{#each reisenSortiert() as r (r.id)}<option value={r.id}>{r.titel} ({jahr(r.start)})</option>{/each}
		</select>
	</label>

	{#if reise}
		<div class="liste" role="radiogroup" aria-label="Eintrag" {@attach hinscrollen}>
			<button type="button" role="radio" aria-checked={ziel === ''} class="zeile nur" class:an={ziel === ''} onclick={() => (ziel = '')}>
				<span class="sym"><CalendarBlank size={18} /></span>
				<span class="txt"><b>Nur zur Reise</b><small>erscheint am Tag der Aufnahme</small></span>
				{#if ziel === ''}<Check size={18} weight="bold" />{/if}
			</button>
			{#each gruppen as g (g.datum)}
				<p class="tag" class:passt={g.passt}>{g.kopf}{#if g.passt}<span class="marke">Aufnahmetag</span>{/if}</p>
				{#each g.zeilen as z (z.key)}
					{@const Sym = z.nacht ? Moon : SYMBOL[z.eintrag.typ]}
					<button type="button" role="radio" aria-checked={ziel === z.eintrag.id} class="zeile" class:an={ziel === z.eintrag.id} onclick={() => (ziel = z.eintrag.id)}>
						<span class="sym"><Sym size={18} /></span>
						<span class="txt"><b>{z.titel}</b><small>{z.unter}</small></span>
						{#if ziel === z.eintrag.id}<Check size={18} weight="bold" />{/if}
					</button>
				{/each}
			{/each}
			{#if !gruppen.length}<p class="hilfe">Diese Reise hat noch keine Einträge.</p>{/if}
		</div>
	{:else}
		<p class="hilfe">Die Fotos stehen dann für sich: auf der Karte (wenn sie einen Ort haben) und im Fotoalbum.</p>
	{/if}

	{#snippet fuss()}
		<button class="knopf zweit" onclick={zu}>Abbrechen</button>
		<button class="knopf" onclick={speichern}>Zuordnen</button>
	{/snippet}
</Dialog>

<style>
	.vorschau {
		display: flex;
		gap: 4px;
		margin-bottom: 14px;
	}
	.vorschau img,
	.vorschau span {
		width: 48px;
		height: 48px;
		border-radius: 8px;
		object-fit: cover;
	}
	.vorschau span {
		display: grid;
		place-items: center;
		background: var(--flaeche-2);
		color: var(--text-2);
		font-size: 14px;
		font-weight: 650;
	}
	.liste {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.tag {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 12px 0 2px;
		color: var(--text-2);
		font-size: 12px;
		font-weight: 650;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.marke {
		padding: 2px 8px;
		border-radius: 10px;
		background: var(--signal);
		color: var(--signal-text);
		font-size: 11px;
		letter-spacing: 0;
		text-transform: none;
	}
	.zeile {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 52px;
		padding: 6px 12px;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		color: var(--text);
		text-align: left;
	}
	.zeile.an {
		border-color: var(--text);
		box-shadow: inset 0 0 0 1px var(--text);
	}
	.zeile.nur {
		margin-bottom: 4px;
	}
	.sym {
		display: grid;
		place-items: center;
		flex: none;
		width: 32px;
		height: 32px;
		border-radius: 8px;
		background: var(--flaeche-2);
		color: var(--text-2);
	}
	.txt {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.txt b {
		font-size: 15px;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.txt small {
		color: var(--text-2);
		font-size: 13px;
	}
	.hilfe {
		color: var(--text-2);
		font-size: 14px;
		line-height: 1.45;
	}
</style>
