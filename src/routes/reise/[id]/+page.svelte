<!-- Eine Reise: Kennzahlen, Fotos, Zeitleiste nach Tagen. -->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { slide } from 'svelte/transition';
	import Tent from 'phosphor-svelte/lib/Tent';
	import Van from 'phosphor-svelte/lib/Van';
	import Footprints from 'phosphor-svelte/lib/Footprints';
	import Ticket from 'phosphor-svelte/lib/Ticket';
	import Camera from 'phosphor-svelte/lib/Camera';
	import Plus from 'phosphor-svelte/lib/Plus';
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
	import Trash from 'phosphor-svelte/lib/Trash';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';
	import Lock from 'phosphor-svelte/lib/Lock';
	import Kopf from '#lib/ui/Kopf.svelte';
	import Sterne from '#lib/ui/Sterne.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { thema } from '#lib/thema.svelte.ts';
	import { reiseFarbe } from '#lib/farben.ts';
	import { naechte, km, plaetzeAnzahl, fotosVon, fotosVonEintrag, tage, reiseEnde } from '#lib/auswertung.ts';
	import { zeitraum, tagLang, monatJahr, reiseTag, dauer, zahl, preisText } from '#lib/datum.ts';
	import { fotosWaehlen } from '#lib/fotos/import.ts';
	import type { Eintrag } from '#lib/db/typen.ts';
	import { TYP_NAME } from '#lib/db/typen.ts';

	const id = $derived(page.params.id ?? '');
	const r = $derived(daten.reise(id));
	const fs = $derived(r ? fotosVon(r.id) : []);
	const liste = $derived(r ? tage(r.id) : []);
	let offen = $state<string | null>(null);

	// Karte auf diese Reise einstellen
	$effect(() => {
		if (!r || !daten.geladen) return;
		ui.auswahl = r.id;
		ui.oeffnen();
		if (!ui.markiert) ui.zeigeReise(r.id);
	});
	$effect(() => {
		if (ui.markiert) offen = ui.markiert;
	});

	const SYMBOL = { stay: Tent, drive: Van, outing: Footprints, event: Ticket };

	function getippt(e: Eintrag) {
		offen = offen === e.id ? null : e.id;
		ui.markiert = offen;
		if (offen) {
			if (e.route?.length) ui.zeigeLinie(e.route);
			else if (e.ort) ui.zeigeOrt(e.ort, 13);
		}
	}

	async function loeschen(e: Eintrag) {
		const zurueck = await daten.loeschen('eintraege', e.id);
		ui.zeige(`„${e.titel}“ gelöscht`, zurueck);
	}

	/** Kurze Zeile unter dem Titel, z. B. „265 km · 4 h 22 min“ oder „2 Nächte · 390 NOK“ */
	function metaText(e: Eintrag): string {
		if (e.typ === 'drive') {
			const teile = [e.km ? `${zahl(e.km)} km` : '', e.minuten ? dauer(e.minuten) : ''].filter(Boolean);
			if (!teile.length) return e.routeOk === false ? 'Route wird berechnet …' : 'Fahrt';
			return teile.join(' · ');
		}
		if (e.typ === 'stay') {
			const n = e.naechte ?? 1;
			return [`${n} ${n === 1 ? 'Nacht' : 'Nächte'}`, preisText(e.preis, e.waehrung)].filter(Boolean).join(' · ');
		}
		return [TYP_NAME[e.typ], e.ort?.name].filter(Boolean).join(' · ');
	}

	function grossAb(fotos: { id: string }[], i: number) {
		ui.gross = { ids: fotos.map((f) => f.id), i };
	}

	function neuerEintrag() {
		const letzter = liste.at(-1)?.datum;
		ui.dialog = { art: 'eintrag', vorlage: { reise: id, datum: letzter ?? r?.start } };
	}
</script>

{#if r}
	{@const rf = reiseFarbe(r.farbe, thema.dunkel)}
	<Kopf>
		{#snippet rechts()}
			<button onclick={() => (ui.dialog = { art: 'reise', id: r.id })}><PencilSimple size={17} /> Bearbeiten</button>
		{/snippet}
	</Kopf>

	<article class="seite" style="--rf:{rf}">
		<header>
			<span class="ueber">{monatJahr(r.start)}</span>
			<h1>{r.titel}</h1>
			<p class="zeit">{zeitraum(r.start, r.ende ?? reiseEnde(r))}</p>
			<div class="kennzahlen zahl">
				<div class="gelb"><b>{naechte(r.id)}</b><span>Nächte</span></div>
				<div><b>{zahl(km(r.id))}</b><span>km</span></div>
				<div><b>{plaetzeAnzahl(r.id)}</b><span>Plätze</span></div>
				<div><b>{fs.length}</b><span>Fotos</span></div>
			</div>
			{#if r.notiz}<p class="notiz">{r.notiz}</p>{/if}
		</header>

		<div class="streifen">
			{#each fs as f, i (f.id)}
				<button onclick={() => grossAb(fs, i)} aria-label="Foto ansehen"><img alt="" src={f.vorschau} loading="lazy" /></button>
			{/each}
			<button class="mehr" onclick={() => fotosWaehlen({ reise: r.id })}><Camera size={22} /><span>Fotos</span></button>
		</div>

		{#if !liste.length}
			<p class="leer">Noch keine Einträge. Füg die erste Übernachtung oder Fahrt hinzu.</p>
		{/if}

		<ol class="zeitleiste">
			{#each liste as tag (tag.datum)}
				<li class="tag">
					<div class="tagkopf">
						<span class="tagnr zahl">Tag {reiseTag(r.start, tag.datum)}</span>
						<span>{tagLang(tag.datum)}</span>
					</div>
					{#if tag.fotos.length}
						<div class="tagfotos">
							{#each tag.fotos.slice(0, 5) as f, i (f.id)}
								<button onclick={() => grossAb(tag.fotos, i)} aria-label="Foto ansehen"><img alt="" src={f.vorschau} loading="lazy" /></button>
							{/each}
							{#if tag.fotos.length > 5}
								<button class="mehrfotos" onclick={() => grossAb(tag.fotos, 5)}>+{tag.fotos.length - 5}</button>
							{/if}
						</div>
					{/if}
					{#each tag.eintraege as e (e.id)}
						{@const Sym = SYMBOL[e.typ]}
						{@const ef = fotosVonEintrag(e.id)}
						<div class="ein typ-{e.typ}" class:markiert={offen === e.id} id="e-{e.id}">
							<button class="ein-knopf" onclick={() => getippt(e)} aria-expanded={offen === e.id}>
								<span class="sym"><Sym size={18} weight={e.typ === 'stay' ? 'fill' : 'regular'} /></span>
								<span class="ein-txt">
									<span class="ein-titel">
										{e.titel}
										{#if e.privat}<Lock size={13} class="schloss" />{/if}
									</span>
									<span class="ein-meta zahl">
										{#if e.typ === 'stay' && e.bewertung}<Sterne wert={e.bewertung} groesse={12} />{/if}
										<span>{metaText(e)}</span>
										{#if ef.length}<span class="kamera"><Camera size={13} weight="fill" /> {ef.length}</span>{/if}
									</span>
									{#if e.text}<span class="ein-text">{e.text}</span>{/if}
								</span>
							</button>
							{#if offen === e.id}
								<div class="aktionen" transition:slide={{ duration: 180 }}>
									{#if e.typ === 'stay' && e.platz}
										<button onclick={() => goto(`#/platz/${e.platz}`)}><Tent size={16} /> Platz <CaretRight size={13} /></button>
									{/if}
									{#if ef.length}
										<button onclick={() => grossAb(ef, 0)}><Camera size={16} /> {ef.length} Fotos</button>
									{/if}
									<button onclick={() => fotosWaehlen({ reise: r.id, eintrag: e.id })}><Plus size={16} /> Fotos</button>
									<button onclick={() => (ui.dialog = { art: 'eintrag', id: e.id })}><PencilSimple size={16} /> Bearbeiten</button>
									<button class="weg" onclick={() => loeschen(e)} aria-label="Löschen"><Trash size={16} /></button>
								</div>
							{/if}
						</div>
					{/each}
				</li>
			{/each}
		</ol>

		<button class="knopf neu" onclick={neuerEintrag}><Plus size={18} weight="bold" /> Eintrag hinzufügen</button>
	</article>
{:else if daten.geladen}
	<Kopf />
	<p class="leer">Diese Reise gibt es nicht (mehr).</p>
{/if}

<style>
	.seite {
		padding: 0 18px;
	}
	h1 {
		font-size: 34px;
		margin: 2px 0 4px;
	}
	.zeit {
		color: var(--text-2);
	}
	.notiz {
		margin-top: 12px;
		line-height: 1.5;
	}
	.kennzahlen {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
		margin: 16px 0 4px;
	}
	.kennzahlen div {
		display: flex;
		flex-direction: column;
		padding: 10px;
		border-radius: var(--radius);
		background: var(--tief);
		color: var(--tief-text);
	}
	.kennzahlen .gelb {
		background: var(--signal);
		color: var(--signal-text);
	}
	.kennzahlen b {
		font-size: 22px;
		font-weight: 700;
		line-height: 1.1;
	}
	.kennzahlen span {
		font-size: 12px;
		opacity: 0.75;
	}
	.streifen {
		display: flex;
		gap: 8px;
		margin: 14px -18px 6px;
		padding: 0 18px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.streifen button {
		flex: none;
		width: 120px;
		height: 150px;
		padding: 0;
		border: 0;
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--flaeche-2);
	}
	.streifen img,
	.tagfotos img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.streifen .mehr {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		width: 96px;
		color: var(--text-2);
		font-size: 13px;
		border: 1.5px dashed var(--linie);
		background: none;
	}
	.zeitleiste {
		list-style: none;
		margin: 10px 0 0;
		padding: 0;
	}
	.tag {
		padding-bottom: 8px;
	}
	.tagkopf {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 16px 0 8px;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-2);
	}
	.tagnr {
		padding: 2px 8px;
		border-radius: 4px;
		background: var(--rf);
		color: var(--schild-text);
		font-weight: 700;
	}
	.tagfotos {
		display: flex;
		gap: 4px;
		margin: 0 0 8px 48px;
	}
	.tagfotos button {
		flex: none;
		width: 52px;
		height: 52px;
		padding: 0;
		border: 0;
		border-radius: 4px;
		overflow: hidden;
		background: var(--flaeche-2);
	}
	.mehrfotos {
		display: grid;
		place-items: center;
		color: var(--text-2);
		font-size: 14px;
		font-weight: 650;
	}
	.ein {
		position: relative;
		border-radius: var(--radius);
		transition: background 0.3s;
	}
	.ein.markiert {
		background: color-mix(in srgb, var(--rf) 12%, transparent);
	}
	.ein::before {
		content: '';
		position: absolute;
		left: 17px;
		top: -8px;
		bottom: -10px;
		width: 2px;
		background: color-mix(in srgb, var(--rf) 35%, transparent);
	}
	.ein-knopf {
		position: relative;
		display: grid;
		grid-template-columns: 36px 1fr;
		gap: 12px;
		align-items: start;
		width: 100%;
		padding: 8px 6px 10px 0;
		border: 0;
		background: none;
		text-align: left;
	}
	.sym {
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 8px;
		background: var(--flaeche);
		border: 2px solid var(--rf);
		color: var(--rf);
	}
	.typ-stay .sym {
		background: var(--rf);
		color: var(--flaeche);
	}
	.typ-drive .sym {
		border-style: dashed;
	}
	.ein-txt {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
		padding-top: 2px;
	}
	.ein-titel {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: 620;
		font-size: 16px;
	}
	.ein-titel :global(.schloss) {
		color: var(--text-2);
	}
	.typ-drive .ein-titel {
		font-weight: 500;
		color: var(--text-2);
	}
	.ein-meta {
		display: block;
		font-size: 13px;
		line-height: 20px;
		color: var(--text-2);
	}
	.ein-meta > :global(*) {
		margin-right: 8px;
	}
	.kamera {
		display: inline-flex;
		vertical-align: 1px;
		align-items: center;
		gap: 3px;
		padding: 1px 6px;
		border-radius: 4px;
		background: var(--flaeche-2);
		color: var(--text);
		font-weight: 600;
	}
	.ein-text {
		margin-top: 3px;
		font-size: 15px;
		line-height: 1.45;
		white-space: pre-line;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 0 8px 10px 48px;
	}
	.aktionen button {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 36px;
		padding: 0 12px;
		border: 1px solid var(--linie);
		border-radius: 18px;
		background: var(--flaeche);
		font-size: 14px;
		font-weight: 550;
	}
	.aktionen .weg {
		margin-left: auto;
		color: var(--gefahr);
	}
	.neu {
		width: 100%;
		margin-top: 18px;
	}
</style>
