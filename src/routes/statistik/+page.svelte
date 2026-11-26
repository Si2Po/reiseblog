<!-- Statistik über alle Reisen, Weltkarte mit besuchten Ländern. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';
	import X from 'phosphor-svelte/lib/X';
	import { pfeile } from '#lib/ui/pfeile.ts';
	import { wechselkurse } from '#lib/kosten.svelte.ts';
	import Kopf from '#lib/ui/Kopf.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { zahl, wort } from '#lib/datum.ts';
	import { grenzenLaden, berechnen, alleOrte, type Statistik } from '#lib/statistik.ts';

	let grenzen = $state.raw<Awaited<ReturnType<typeof grenzenLaden>> | null>(null);
	let fehler = $state('');
	// rechnet automatisch neu, wenn sich Daten ändern (z. B. nach dem Abgleich)
	/** gewähltes Jahr (Tipp in „Pro Jahr“) – alles andere zeigt dann nur dieses Jahr */
	let jahr = $state<string | undefined>();
	const s = $derived<Statistik | null>(grenzen && daten.geladen ? berechnen(grenzen.laender, jahr) : null);

	onMount(() => {
		ui.auswahl = null;
		wechselkurse.holen();
		let weg = false;
		grenzenLaden()
			.then((g) => {
				if (weg) return;
				grenzen = g;
				const orte = alleOrte().map((o) => [o.lng, o.lat] as [number, number]);
				if (orte.length) ui.karte?.zeigeBereich(orte, ui.rand(), 4);
			})
			.catch(() => (fehler = 'Die Ländergrenzen konnten nicht geladen werden (offline?).'));
		return () => {
			weg = true;
			ui.laender = null;
		};
	});

	// besuchte Länder auf der Karte einfärben
	$effect(() => {
		if (grenzen && s) ui.laender = { grenzen: grenzen.fc, besucht: s.laender.map((l) => l.code) };
	});

	const maxNaechte = $derived(Math.max(1, ...(s?.laender.map((l) => l.naechte) ?? [1])));
	const maxJahr = $derived(Math.max(1, ...(s?.jahre.map((j) => j.naechte) ?? [1])));
</script>

<Kopf />

<div class="seite">
	<h1>Statistik{#if jahr}<button class="nur" onclick={() => (jahr = undefined)} aria-label="Alle Jahre zeigen">{jahr} <X size={14} weight="bold" /></button>{/if}</h1>
	{#if fehler}<p class="leer">{fehler}</p>{/if}
	{#if !s && !fehler}<p class="leer">Wird berechnet …</p>{/if}
	{#if s && !s.reisen}
		<p class="leer">Noch keine Reisen. Sobald du Übernachtungen und Fahrten einträgst, siehst du hier deine Länder, Nächte, Kilometer und Rekorde.</p>
	{:else if s}
		<div class="kacheln zahl">
			<div class="gelb"><b>{s.laender.length}</b><span>{s.laender.length === 1 ? 'Land' : 'Länder'}</span></div>
			<div><b>{s.naechte}</b><span>{wort(s.naechte, 'Nacht', 'Nächte')}</span></div>
			<div><b>{zahl(s.km)}</b><span>km</span></div>
			<div><b>{s.reisen}</b><span>{wort(s.reisen, 'Reise', 'Reisen')}</span></div>
			<div><b>{s.plaetze}</b><span>{wort(s.plaetze, 'Platz', 'Plätze')}</span></div>
			<div><b>{s.fotos}</b><span>{wort(s.fotos, 'Foto', 'Fotos')}</span></div>
		</div>

		{#if s.laender.length}
			<h4>Länder</h4>
			<ul class="balken">
				{#each s.laender as l (l.code)}
					<li>
						<span class="name">{l.name}</span>
						<span class="bahn"><span style:width="{(l.naechte / maxNaechte) * 100}%"></span></span>
						<span class="wert zahl">{l.naechte ? `${l.naechte} N.` : 'besucht'}</span>
					</li>
				{/each}
			</ul>
		{/if}

		{#if s.jahre.length}
			<h4>Pro Jahr <small>– antippen für nur dieses Jahr</small></h4>
			<ul class="balken jahre" {@attach pfeile('button')}>
				{#each s.jahre as j (j.jahr)}
					<li>
						<button class:an={jahr === j.jahr} aria-pressed={jahr === j.jahr} onclick={() => (jahr = jahr === j.jahr ? undefined : j.jahr)}>
							<span class="name zahl">{j.jahr}</span>
							<span class="bahn"><span style:width="{(j.naechte / maxJahr) * 100}%"></span></span>
							<span class="wert zahl">{j.naechte} N.</span>
							<small class="zahl"
								>{j.reisen} {wort(j.reisen, 'Reise', 'Reisen')} · {zahl(j.km)} km{#if j.euro}{' · '}ca. {zahl(Math.round(j.euro))} €{/if}</small
							>
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if s.rekorde.length}
			<h4>Rekorde</h4>
			<ul class="rekorde">
				{#each s.rekorde as r (r.titel)}
					<li>
						<a href={r.link}>
							<span class="r-txt"><span>{r.titel}</span><b>{r.wert}</b></span>
							<CaretRight size={16} />
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>

<style>
	.seite {
		padding: 0 18px;
	}
	h1 {
		font-size: 30px;
		margin: 4px 0 12px;
	}
	h4 {
		margin: 22px 0 8px;
		font-size: 12px;
		font-weight: 650;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-2);
	}
	.kacheln {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}
	.kacheln div {
		display: flex;
		flex-direction: column;
		padding: 10px;
		border-radius: var(--radius);
		background: var(--tief);
		color: var(--tief-text);
	}
	.kacheln .gelb {
		background: var(--signal);
		color: var(--signal-text);
	}
	.kacheln b {
		font-size: 24px;
		font-weight: 700;
		line-height: 1.1;
	}
	.kacheln span {
		font-size: 12px;
		opacity: 0.75;
	}
	.nur {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-left: 12px;
		height: 32px;
		padding: 0 12px;
		border: 0;
		border-radius: 16px;
		background: var(--text);
		color: var(--flaeche);
		font-size: 15px;
		font-weight: 650;
		vertical-align: middle;
	}
	h4 small {
		font-weight: 500;
		letter-spacing: 0;
		text-transform: none;
	}
	.balken.jahre li {
		display: block;
	}
	.jahre button {
		display: grid;
		grid-template-columns: 110px 1fr auto;
		align-items: center;
		gap: 2px 10px;
		width: 100%;
		padding: 6px 8px;
		margin: 0 -8px;
		box-sizing: content-box;
		border: 0;
		border-radius: var(--radius);
		background: none;
		color: var(--text);
		text-align: left;
	}
	.jahre button.an {
		background: var(--flaeche-2);
		box-shadow: inset 0 0 0 1.5px var(--text);
	}
	.jahre small {
		grid-column: 1 / -1;
		color: var(--text-2);
		font-size: 13px;
	}
	.balken {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.balken li {
		display: grid;
		grid-template-columns: 110px 1fr auto;
		align-items: center;
		gap: 10px;
		min-height: 34px;
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 560;
	}
	.bahn {
		height: 10px;
		border-radius: 5px;
		background: var(--flaeche-2);
		overflow: hidden;
	}
	.bahn span {
		display: block;
		height: 100%;
		min-width: 4px;
		border-radius: 5px;
		background: var(--stern);
	}
	.wert {
		color: var(--text-2);
		font-size: 13px;
		text-align: right;
	}
	.rekorde {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rekorde a {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 56px;
		padding: 6px 0;
		border-bottom: 1px solid var(--linie);
		color: inherit;
		text-decoration: none;
	}
	.r-txt {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.r-txt span {
		color: var(--text-2);
		font-size: 13px;
	}
</style>
