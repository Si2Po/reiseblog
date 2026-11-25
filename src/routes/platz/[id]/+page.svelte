<!-- Ein Stellplatz: Bewertung, Ausstattung, Notiz, alle Besuche. -->
<script lang="ts">
	import { page } from '$app/state';
	import NavigationArrow from 'phosphor-svelte/lib/NavigationArrow';
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
	import Heart from 'phosphor-svelte/lib/Heart';
	import ArrowSquareOut from 'phosphor-svelte/lib/ArrowSquareOut';
	import Kopf from '#lib/ui/Kopf.svelte';
	import Sterne from '#lib/ui/Sterne.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { thema } from '#lib/thema.svelte.ts';
	import { reiseFarbe } from '#lib/farben.ts';
	import { besuche, platzBewertung } from '#lib/auswertung.ts';
	import { kurz, jahr, preisText, notizZeit } from '#lib/datum.ts';
	import { AUSSTATTUNG, merkmaleFuer, wertText } from '#lib/merkmale.ts';
	import { linkInfo } from '#lib/links.ts';
	import { PLATZ_ART } from '#lib/db/typen.ts';
	import { koordText } from '#lib/geo.ts';

	const p = $derived(daten.platz(page.params.id));
	const bs = $derived(p ? besuche(p.id) : []);
	const wert = $derived(p ? platzBewertung(p.id) : 0);
	// Ausstattung: die acht Klassiker immer zeigen (auch durchgestrichen), Extras nur wenn vorhanden
	const ausstattung = $derived(AUSSTATTUNG.filter((a, i) => i < 8 || p?.merkmale[a.key]));
	const weitere = $derived(p ? merkmaleFuer('platz').filter((m) => m.gruppe !== 'ausstattung' && p.merkmale[m.key] !== undefined) : []);
	const alleNotizen = $derived(bs.flatMap((b) => b.notizen ?? []).sort((a, b) => b.zeit.localeCompare(a.zeit)));

	$effect(() => {
		if (!p) return;
		ui.auswahl = bs[0]?.reise ?? null;
		ui.oeffnen();
		ui.zeigeOrt(p.ort, 13);
	});
</script>

{#if p}
	<Kopf>
		{#snippet rechts()}
			<button onclick={() => (ui.dialog = { art: 'platz', id: p.id })}><PencilSimple size={17} /> Bearbeiten</button>
		{/snippet}
	</Kopf>
	<article class="seite">
		<span class="ueber">{PLATZ_ART[p.art]}{#if p.ort.name}{' · '}{p.ort.name}{/if}{#if p.ort.land}, {p.ort.land}{/if}</span>
		<h1>{p.name}</h1>
		<div class="bewertung">
			{#if wert}
				<Sterne wert={wert} groesse={20} />
				<span class="zahl">{wert.toLocaleString('de-DE', { maximumFractionDigits: 1 })}</span>
			{:else}
				<span class="ohne">Noch nicht bewertet</span>
			{/if}
			{#if p.wiederkommen}<span class="marke"><Heart size={13} weight="fill" /> Gern wieder</span>{/if}
		</div>
		<div class="aktionen">
			<a class="knopf" href="https://maps.apple.com/?daddr={p.ort.lat},{p.ort.lng}" target="_blank" rel="noopener"
				><NavigationArrow size={18} weight="fill" /> Route dorthin</a
			>
			{#each p.links as l (l)}
				{@const info = linkInfo(l)}
				<a class="knopf zweit" href={info.url} target="_blank" rel="noopener"><ArrowSquareOut size={18} /> {info.name}</a>
			{/each}
		</div>

		<h4>Ausstattung</h4>
		<ul class="ausst">
			{#each ausstattung as a (a.key)}
				<li class:da={!!p.merkmale[a.key]}>{#if a.icon}<a.icon size={20} />{/if} {a.name}</li>
			{/each}
		</ul>
		{#if weitere.length}
			<dl class="merkmale">
				{#each weitere as m (m.key)}
					<div><dt>{m.name}</dt><dd>{wertText(m, p.merkmale[m.key])}</dd></div>
				{/each}
			</dl>
		{/if}

		{#if p.notiz}
			<h4>Notiz zum Platz</h4>
			<p class="notiz">{p.notiz}</p>
		{/if}

		{#if alleNotizen.length}
			<h4>Notizen von unterwegs</h4>
			<ul class="unterwegs">
				{#each alleNotizen as n (n.id)}
					<li><small>{notizZeit(n.zeit)}</small>{n.text}</li>
				{/each}
			</ul>
		{/if}

		<h4>{bs.length === 1 ? 'Ein Besuch' : `${bs.length} Besuche`}</h4>
		<ul class="besuche">
			{#each bs as b (b.id)}
				{@const r = daten.reise(b.reise)}
				<li>
					<a
						href="#/reise/{b.reise}"
						onclick={() => {
							ui.markiert = b.id;
						}}
					>
						<span class="punkt" style:background={reiseFarbe(r?.farbe ?? 0, thema.dunkel)}></span>
						<span class="b-txt">
							<b>{r?.titel ?? 'Reise'} {r ? jahr(r.start) : ''}</b>
							<span class="zahl"
								>{kurz(b.datum)} · {b.naechte ?? 1} {(b.naechte ?? 1) === 1 ? 'Nacht' : 'Nächte'}{#if b.preis !== undefined}{' · '}{preisText(b.preis, b.waehrung)}{/if}</span
							>
						</span>
						{#if b.bewertung}<Sterne wert={b.bewertung} groesse={12} />{/if}
					</a>
				</li>
			{/each}
		</ul>
		<p class="koord zahl">{koordText(p.ort)}</p>
	</article>
{:else if daten.geladen}
	<Kopf zurueck="#/plaetze" />
	<p class="leer">Diesen Platz gibt es nicht (mehr).</p>
{/if}

<style>
	.seite {
		padding: 0 18px;
	}
	h1 {
		font-size: 30px;
		margin: 4px 0 10px;
	}
	h4 {
		margin: 26px 0 10px;
		font-size: 12px;
		font-weight: 650;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-2);
	}
	.bewertung {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 32px;
		font-weight: 600;
	}
	.ohne {
		color: var(--text-2);
		font-weight: 500;
	}
	.marke {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-left: auto;
		padding: 4px 10px;
		border-radius: 20px;
		background: var(--signal);
		color: var(--signal-text);
		font-size: 13px;
	}
	.aktionen {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 16px;
	}
	.aktionen .knopf {
		flex: 1;
	}
	.ausst {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.ausst li {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 10px 0 8px;
		border-radius: var(--radius);
		font-size: 12px;
		color: var(--text-2);
		opacity: 0.38;
		text-decoration: line-through;
	}
	.ausst li.da {
		opacity: 1;
		text-decoration: none;
		color: var(--text);
		background: var(--flaeche-2);
	}
	.merkmale {
		display: grid;
		gap: 6px;
		margin: 12px 0 0;
	}
	.merkmale div {
		display: flex;
		justify-content: space-between;
		padding: 8px 0;
		border-bottom: 1px solid var(--linie);
	}
	.merkmale dt {
		color: var(--text-2);
	}
	.merkmale dd {
		margin: 0;
		font-weight: 600;
	}
	.unterwegs {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.unterwegs li {
		display: flex;
		flex-direction: column;
		gap: 1px;
		margin-bottom: 6px;
		padding: 8px 12px;
		border-radius: var(--radius);
		background: var(--flaeche-2);
		line-height: 1.4;
		white-space: pre-line;
	}
	.unterwegs small {
		color: var(--text-2);
		font-size: 12px;
		font-weight: 600;
	}
	.notiz {
		line-height: 1.5;
		white-space: pre-line;
	}
	.besuche {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.besuche a {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 60px;
		padding: 8px 0;
		border-bottom: 1px solid var(--linie);
		color: inherit;
		text-decoration: none;
	}
	.punkt {
		flex: none;
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}
	.b-txt {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.b-txt span {
		font-size: 13px;
		color: var(--text-2);
	}
	.koord {
		margin-top: 18px;
		color: var(--text-2);
		font-size: 13px;
	}
</style>
