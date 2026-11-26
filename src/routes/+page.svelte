<!-- Startseite: alle Reisen als große Bildkarten. -->
<script lang="ts">
	import { pfeile } from '#lib/ui/pfeile.ts';
	import { kontext } from '#lib/ui/kontext.ts';
	import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
	import FilePdf from 'phosphor-svelte/lib/FilePdf';
	import type { Aktion } from '#lib/ui.svelte.ts';
	import type { Reise } from '#lib/db/typen.ts';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { differenceInCalendarDays, parseISO } from 'date-fns';
	import Plus from 'phosphor-svelte/lib/Plus';
	import Van from 'phosphor-svelte/lib/Van';
	import ChartBar from 'phosphor-svelte/lib/ChartBar';
	import Reiter from '#lib/ui/Reiter.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { thema } from '#lib/thema.svelte.ts';
	import { reiseFarbe } from '#lib/farben.ts';
	import { reisenSortiert, naechte, km, fotosVon, reiseEnde, summe, erinnerungen } from '#lib/auswertung.ts';
	import ClockCounterClockwise from 'phosphor-svelte/lib/ClockCounterClockwise';
	import { zeitraum, jahr, zahl, heute, wort, tagMitJahr } from '#lib/datum.ts';
	import { beispielLaden } from '#lib/beispiel/daten.ts';

	const reisen = $derived(reisenSortiert());
	const s = $derived(summe());
	const erinnert = $derived(daten.geladen ? erinnerungen() : []);

	onMount(() => {
		ui.auswahl = null;
		ui.markiert = null;
		if (daten.geladen) ui.zeigeAlles();
	});

	/** Rechtsklick (PC) auf eine Reise */
	function reiseMenue(r: Reise) {
		const punkte: Aktion[] = [
			{ text: 'Öffnen', icon: ArrowRight, los: () => goto(`#/reise/${r.id}`) },
			{ text: 'Details', icon: PencilSimple, los: () => (ui.dialog = { art: 'reise', id: r.id }) }
		];
		if (naechte(r.id) || km(r.id)) punkte.push({ text: 'Als PDF', icon: FilePdf, los: () => (ui.dialog = { art: 'pdf', reise: r.id }) });
		return { titel: r.titel, punkte };
	}

	function titelbild(id: string) {
		const r = daten.reise(id);
		return daten.foto(r?.titelbild)?.vorschau ?? fotosVon(id)[0]?.vorschau;
	}
</script>

<Reiter />

<div class="seite">
	{#if !daten.geladen}
		<p class="leer">Lädt …</p>
	{:else if !reisen.length}
		<div class="willkommen">
			<span class="symbol"><Van size={40} weight="duotone" /></span>
			<h2>Deine erste Reise</h2>
			<p>
				Leg eine Reise an und trag unterwegs Übernachtungen, Fahrten, Ausflüge und Fotos ein. Mit „Hier eintragen“ geht
				das direkt mit deinem Standort.
			</p>
			<button class="knopf" onclick={() => (ui.dialog = { art: 'reise' })}><Plus size={18} weight="bold" /> Neue Reise</button>
			<button class="knopf still" onclick={beispielLaden}>Zum Ausprobieren: Beispielreisen laden</button>
		</div>
	{:else}
		<a class="summe" href="#/statistik">
			<span class="ueber zahl">{s.reisen} {s.reisen === 1 ? 'Reise' : 'Reisen'} · {s.naechte} {wort(s.naechte, 'Nacht', 'Nächte')} · {zahl(s.km)} km</span>
			<span class="statistik"><ChartBar size={15} weight="bold" /> Statistik</span>
		</a>
		<!-- „Heute vor einem Jahr“: ein Reisetag aus früheren Jahren -->
		{#each erinnert as m (m.reise.id)}
			<a
				class="erinnerung"
				href="#/reise/{m.reise.id}"
				style="--rf:{reiseFarbe(m.reise.farbe, thema.dunkel)}"
				onclick={() => {
					ui.markiert = m.eintrag?.id ?? null;
				}}
			>
				{#if m.fotos[0]}<img alt="" src={m.fotos[0].vorschau} />{:else}<span class="bild"><ClockCounterClockwise size={24} /></span>{/if}
				<span class="e-txt">
					<span class="ueber">{m.genau ? 'Heute' : 'Diese Woche'} vor {m.jahre} {m.jahre === 1 ? 'Jahr' : 'Jahren'}</span>
					<b>{m.eintrag?.titel ?? m.reise.titel}</b>
					<small>{m.reise.titel} · {tagMitJahr(m.datum)}{m.fotos.length ? ` · ${m.fotos.length} ${wort(m.fotos.length, 'Foto', 'Fotos')}` : ''}</small>
				</span>
			</a>
		{/each}
		<div class="reisen" {@attach pfeile('a.reise')}>
			{#each reisen as r (r.id)}
				{@const bild = titelbild(r.id)}
				<a class="reise" class:ohne-bild={!bild} href="#/reise/{r.id}" {@attach kontext(() => reiseMenue(r))} style="--rf:{reiseFarbe(r.farbe, thema.dunkel)}">
					{#if bild}<img class="cover" alt="" src={bild} />{/if}
					<span class="r-txt">
						<span class="jahr zahl">{r.start > heute() ? `Geplant · ${jahr(r.start)}` : jahr(r.start)}</span>
						<span class="r-titel" class:lang={r.titel.length > 26}>{r.titel}</span>
						<span class="zeit">{zeitraum(r.start, r.ende ?? reiseEnde(r))}</span>
						<span class="zahlen zahl">
							{#if r.start > heute() && !naechte(r.id)}
								<!-- geplante Reise: Vorfreude statt Nullen -->
								{@const z = daten.ziele.filter((x) => x.reise === r.id && !x.erledigt).length}
								{@const bis = differenceInCalendarDays(parseISO(r.start), parseISO(heute()))}
								<span>noch <b>{zahl(bis)}</b> {bis === 1 ? 'Tag' : 'Tage'}</span>
								{#if z}<span><b>{z}</b> {z === 1 ? 'Ziel' : 'Ziele'} geplant</span>{/if}
							{:else}
								<span><b>{naechte(r.id)}</b> {wort(naechte(r.id), 'Nacht', 'Nächte')}</span>
								<span><b>{zahl(km(r.id))}</b> km</span>
								<span><b>{fotosVon(r.id).length}</b> {wort(fotosVon(r.id).length, 'Foto', 'Fotos')}</span>
							{/if}
						</span>
					</span>
				</a>
			{/each}
		</div>
		<button class="neue-reise" onclick={() => (ui.dialog = { art: 'reise' })}><Plus size={18} /> Neue Reise</button>
	{/if}
</div>

<style>
	.seite {
		padding: 4px 18px 0;
	}
	.summe {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin: 2px 0 10px;
		min-height: 36px;
		text-decoration: none;
	}
	.statistik {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 32px;
		padding: 0 12px;
		border-radius: 16px;
		background: var(--flaeche-2);
		color: var(--text);
		font-size: 13px;
		font-weight: 600;
	}
	.erinnerung {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 12px;
		padding: 8px;
		border-radius: var(--radius-gross);
		background: color-mix(in srgb, var(--rf) 14%, var(--flaeche));
		color: var(--text);
		text-decoration: none;
	}
	.erinnerung img,
	.erinnerung .bild {
		flex: none;
		width: 64px;
		height: 64px;
		border-radius: var(--radius);
		object-fit: cover;
	}
	.erinnerung .bild {
		display: grid;
		place-items: center;
		background: var(--rf);
		color: var(--flaeche);
	}
	.e-txt {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.e-txt b {
		font-size: 17px;
		font-weight: 650;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.e-txt small {
		color: var(--text-2);
		font-size: 13px;
	}
	.reisen {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.reise {
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		min-height: 200px;
		border-radius: var(--radius-gross);
		overflow: hidden;
		color: #fff;
		text-decoration: none;
		background: var(--flaeche-2);
		transition: transform 0.2s var(--sanft);
	}
	.reise:active {
		transform: scale(0.985);
	}
	.cover {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.r-txt {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
		padding: 56px 16px 14px;
		background: linear-gradient(transparent, rgba(6, 10, 8, 0.84));
	}
	/* Ohne Foto: Fläche in Reisefarbe statt Bild */
	.ohne-bild {
		min-height: 150px;
		background: linear-gradient(135deg, color-mix(in srgb, var(--rf) 85%, #000), color-mix(in srgb, var(--rf) 55%, #000));
	}
	.ohne-bild .r-txt {
		background: none;
		padding-top: 16px;
	}
	.jahr {
		align-self: flex-start;
		margin-bottom: 6px;
		padding: 2px 8px;
		border-radius: 4px;
		background: var(--rf);
		color: var(--schild-text);
		font-size: 12px;
		font-weight: 650;
		letter-spacing: 0.08em;
	}
	.ohne-bild .jahr {
		background: rgba(255, 255, 255, 0.2);
		color: #fff;
	}
	/* lange Namen: höchstens zwei Zeilen, damit Jahr und Zahlen sichtbar bleiben */
	/* über die Höhe statt -webkit-line-clamp und break-word statt „anywhere“: beides bringt die Texterkennung der Tests in WebKit durcheinander */
	.r-titel {
		max-height: 2.2em;
		overflow: hidden;
		overflow-wrap: break-word;
		font-size: 28px;
		font-weight: var(--kopf-gewicht);
		letter-spacing: var(--kopf-sperrung);
		line-height: 1.1;
	}
	.r-titel.lang {
		font-size: 23px;
	}
	.zeit {
		color: rgba(255, 255, 255, 0.78);
		font-size: 14px;
	}
	.zahlen {
		display: flex;
		gap: 12px;
		margin-top: 4px;
		font-size: 13px;
		color: rgba(255, 255, 255, 0.78);
	}
	.zahlen b {
		color: #fff;
		font-size: 15px;
		font-weight: 650;
	}
	.neue-reise {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		height: 50px;
		margin-top: 14px;
		border: 1.5px dashed var(--linie);
		border-radius: var(--radius);
		background: none;
		color: var(--text-2);
		font-weight: 550;
	}
	.willkommen {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		padding: 18px 4px 10px;
	}
	.willkommen .symbol {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		border-radius: var(--radius-gross);
		background: var(--signal);
		color: var(--signal-text);
	}
	.willkommen h2 {
		font-size: 28px;
	}
	.willkommen p {
		color: var(--text-2);
		line-height: 1.5;
	}
	.willkommen .knopf {
		width: 100%;
	}
</style>
