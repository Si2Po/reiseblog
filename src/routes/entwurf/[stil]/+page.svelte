<!--
  Klickbarer Design-Entwurf. Gleicher Aufbau für alle drei Stilrichtungen,
  Unterschiede über CSS-Variablen und data-stil.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { fade, fly, scale } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Karte from '#lib/map/Karte.svelte';
	import Sheet, { type Hoehe } from '#lib/ui/Sheet.svelte';
	import Sterne from '#lib/ui/Sterne.svelte';
	import { stile, stilVon } from '#lib/entwurf/stile.ts';
	import { fotoUrl } from '#lib/entwurf/fotos.ts';
	import { AUSSTATTUNG } from '#lib/ausstattung.ts';
	import * as D from '#lib/entwurf/daten.ts';
	import { zeitraum, tagLang, jahr, monatJahr, kurz, reiseTag, dauer, zahl } from '#lib/datum.ts';

	import Tent from 'phosphor-svelte/lib/Tent';
	import Van from 'phosphor-svelte/lib/Van';
	import Footprints from 'phosphor-svelte/lib/Footprints';
	import Ticket from 'phosphor-svelte/lib/Ticket';
	import MapTrifold from 'phosphor-svelte/lib/MapTrifold';
	import MapPin from 'phosphor-svelte/lib/MapPin';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import Plus from 'phosphor-svelte/lib/Plus';
	import Images from 'phosphor-svelte/lib/Images';
	import NavigationArrow from 'phosphor-svelte/lib/NavigationArrow';
	import CaretLeft from 'phosphor-svelte/lib/CaretLeft';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import X from 'phosphor-svelte/lib/X';
	import Camera from 'phosphor-svelte/lib/Camera';
	import ArrowsLeftRight from 'phosphor-svelte/lib/ArrowsLeftRight';
	import Heart from 'phosphor-svelte/lib/Heart';
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
	import Crosshair from 'phosphor-svelte/lib/Crosshair';

	const stil = $derived(stilVon(page.params.stil ?? 'atlas'));
	const farbe = (u: string) => stil.reiseFarben[D.urlaube.find((x) => x.id === u)!.farbe];

	// --- Zustand ---
	let hoehe = $state<Hoehe>('halb');
	let sichtbar = $state(0);
	let tab = $state<'reisen' | 'plaetze' | 'suche'>('reisen');
	type Detail = { art: 'urlaub'; id: string } | { art: 'platz'; id: string };
	let verlauf = $state<Detail[]>([]);
	const detail = $derived(verlauf.at(-1) ?? null);
	let fotosAn = $state(false);
	let gross = $state<string | null>(null);
	let neu = $state(false);
	let hinweis = $state<string | null>(null);
	let markiert = $state<string | null>(null);
	let karte: ReturnType<typeof Karte> | undefined = $state();

	// --- Kartendaten ---
	const linien = $derived<GeoJSON.FeatureCollection>({
		type: 'FeatureCollection',
		features: D.eintraege
			.filter((e) => e.route)
			.map((e) => ({ type: 'Feature', properties: { reise: e.urlaub, farbe: farbe(e.urlaub) }, geometry: { type: 'LineString', coordinates: e.route! } }))
	});
	const punkte = $derived<GeoJSON.FeatureCollection>({
		type: 'FeatureCollection',
		features: D.eintraege
			.filter((e) => e.typ !== 'drive')
			.map((e) => ({ type: 'Feature', properties: { id: e.id, reise: e.urlaub, typ: e.typ, farbe: farbe(e.urlaub) }, geometry: { type: 'Point', coordinates: [e.lng, e.lat] } }))
	});
	const kartenFotos = D.fotos.map((f) => ({ id: f.id, lat: f.lat, lng: f.lng, url: fotoUrl(f.id, f.motiv, f.hoch) }));
	const auswahl = $derived(detail?.art === 'urlaub' ? detail.id : null);

	const halb = () => Math.round(window.innerHeight * 0.52);
	function koordinaten(u?: string): [number, number][] {
		return D.eintraege.filter((e) => !u || e.urlaub === u).flatMap((e) => (e.route ? e.route : [[e.lng, e.lat] as [number, number]]));
	}

	// --- Aktionen ---
	function oeffneUrlaub(id: string, eintrag?: string) {
		if (detail?.art !== 'urlaub' || detail.id !== id) verlauf = [...verlauf, { art: 'urlaub', id }];
		if (hoehe === 'klein') hoehe = 'halb';
		markiert = eintrag ?? null;
		karte?.zeigeBereich(koordinaten(id), hoehe === 'voll' ? halb() : halb());
		if (eintrag) setTimeout(() => document.getElementById('e-' + eintrag)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350);
	}
	function oeffnePlatz(id: string) {
		verlauf = [...verlauf, { art: 'platz', id }];
		if (hoehe === 'klein') hoehe = 'halb';
		const p = D.plaetze.find((x) => x.id === id)!;
		karte?.zeigePunkt(p.lng, p.lat, halb(), 12.5);
	}
	function zurueck() {
		verlauf = verlauf.slice(0, -1);
		markiert = null;
		const d = verlauf.at(-1);
		if (d?.art === 'urlaub') karte?.zeigeBereich(koordinaten(d.id), halb());
		else if (!d) karte?.zeigeBereich(koordinaten(), halb());
	}
	function punktGetippt(id: string) {
		const e = D.eintraege.find((x) => x.id === id);
		if (!e) return;
		if (e.typ === 'stay' && detail?.art === 'urlaub' && detail.id === e.urlaub) oeffnePlatz(e.platz!);
		else oeffneUrlaub(e.urlaub, e.id);
	}
	function eintragGetippt(e: D.Eintrag) {
		if (e.typ === 'stay') return oeffnePlatz(e.platz!);
		markiert = e.id;
		if (e.route) karte?.zeigeBereich(e.route, sichtbar);
		else karte?.zeigePunkt(e.lng, e.lat, sichtbar, 13);
	}
	function zeigeHinweis(t: string) {
		hinweis = t;
		setTimeout(() => (hinweis = null), 2200);
	}
	function stilWechseln() {
		const i = stile.findIndex((s) => s.id === stil.id);
		goto('#/entwurf/' + stile[(i + 1) % stile.length].id);
	}

	// --- Reise-Zeitleiste ---
	function tage(u: string) {
		const map = new Map<string, D.Eintrag[]>();
		for (const e of D.eintraegeVon(u)) map.set(e.datum, [...(map.get(e.datum) ?? []), e]);
		return [...map.entries()];
	}
	const SYMBOL = { stay: Tent, drive: Van, outing: Footprints, event: Ticket };
	const TYPNAME = { stay: 'Übernachtung', drive: 'Fahrt', outing: 'Ausflug', event: 'Event' };

	// --- Plätze ---
	let filter = $state<string[]>([]);
	const FILTER = [
		{ key: 'gern', name: 'Gern wieder' },
		{ key: 'strom', name: 'Strom' },
		{ key: 'hunde', name: 'Hunde' },
		{ key: 'gratis', name: 'Gratis' }
	];
	const plaetzeListe = $derived(
		D.plaetze
			.filter((p) =>
				filter.every((f) =>
					f === 'gern' ? p.wiederkommen : f === 'gratis' ? D.besuche(p.id).some((b) => b.preis === 'gratis') : p.ausstattung.includes(f)
				)
			)
			.sort((a, b) => D.platzBewertung(b.id) - D.platzBewertung(a.id))
	);
	const umschalten = (k: string) => (filter = filter.includes(k) ? filter.filter((f) => f !== k) : [...filter, k]);

	// --- Suche ---
	let suche = $state('');
	let suchJahr = $state<string | null>(null);
	const treffer = $derived(
		D.eintraege.filter((e) => {
			if (suchJahr && !e.datum.startsWith(suchJahr)) return false;
			const q = suche.trim().toLowerCase();
			if (!q) return !!suchJahr;
			return [e.titel, e.ort, e.text ?? ''].some((t) => t.toLowerCase().includes(q));
		})
	);

	// --- Großansicht ---
	const grossFoto = $derived(D.fotos.find((f) => f.id === gross));
	function blaettern(r: number) {
		if (!grossFoto) return;
		const liste = D.fotosVon(grossFoto.urlaub);
		const i = liste.findIndex((f) => f.id === gross);
		gross = liste[(i + r + liste.length) % liste.length].id;
	}

	const summe = { naechte: D.urlaube.reduce((s, u) => s + D.naechte(u.id), 0), km: D.urlaube.reduce((s, u) => s + D.km(u.id), 0) };
</script>

<svelte:head>
	<meta name="theme-color" content={stil.vars['--grund']} />
</svelte:head>

<svelte:window
	onkeydown={(e) => {
		if (gross && e.key === 'ArrowRight') blaettern(1);
		if (gross && e.key === 'ArrowLeft') blaettern(-1);
		if (e.key === 'Escape') (gross = null), (neu = false);
	}}
/>

<div class="app" data-stil={stil.id} style={Object.entries(stil.vars).map(([k, v]) => `${k}:${v}`).join(';')}>
	{#key stil.id}
		<Karte
			bind:this={karte}
			farben={stil.karte}
			halo={stil.vars['--flaeche']}
			{linien}
			{punkte}
			fotos={kartenFotos}
			{fotosAn}
			{auswahl}
			onpunkt={punktGetippt}
			onreise={(id) => oeffneUrlaub(id)}
			onfoto={(id) => (gross = id)}
			onbereit={() => karte?.zeigeBereich(koordinaten(), halb())}
		/>
	{/key}

	<div class="schleier"></div>

	<button class="stilchip" onclick={stilWechseln}>
		<b>{stil.buchstabe}</b>
		{stil.name}
		<ArrowsLeftRight size={14} />
	</button>

	<div class="kartenknoepfe" style:opacity={hoehe === 'voll' ? 0 : 1}>
		<button class:an={fotosAn} onclick={() => (fotosAn = !fotosAn)} aria-label="Fotos auf der Karte" aria-pressed={fotosAn}>
			<Images size={22} weight={fotosAn ? 'fill' : 'regular'} />
		</button>
		<button onclick={() => karte?.zeigePunkt(7.2059, 62.1007, sichtbar, 11)} aria-label="Mein Standort">
			<NavigationArrow size={20} />
		</button>
	</div>

	{#if hoehe !== 'voll'}
		<button class="hier" style:bottom="{sichtbar + 14}px" onclick={() => (neu = true)} transition:fade={{ duration: 150 }}>
			<Plus size={20} weight="bold" /> Hier eintragen
		</button>
	{/if}

	<Sheet bind:hoehe bind:sichtbar klein={118}>
		{#snippet kopf()}
			{#if !detail}
				<nav class="reiter" aria-label="Bereiche">
					<button class:aktiv={tab === 'reisen'} onclick={() => (tab = 'reisen')}><MapTrifold size={18} /> Reisen</button>
					<button class:aktiv={tab === 'plaetze'} onclick={() => (tab = 'plaetze')}><Tent size={18} /> Plätze</button>
					<button
						class:aktiv={tab === 'suche'}
						onclick={() => {
							tab = 'suche';
							hoehe = 'voll';
						}}><MagnifyingGlass size={18} /> Suche</button
					>
				</nav>
			{:else}
				<div class="zurueckzeile">
					<button class="zurueck" onclick={zurueck}><CaretLeft size={18} weight="bold" /> Zurück</button>
				</div>
			{/if}
		{/snippet}

		{#if detail?.art === 'urlaub'}
			{@const u = D.urlaube.find((x) => x.id === detail.id)!}
			{@const fs = D.fotosVon(u.id)}
			<article class="seite" style="--rf:{farbe(u.id)}" in:fly={{ x: 30, duration: 260, easing: cubicOut }}>
				<header class="u-kopf">
					<span class="ueber">{monatJahr(u.start)}</span>
					<h2>{u.titel}</h2>
					<p class="zeit">{zeitraum(u.start, u.ende)}</p>
					<div class="kennzahlen">
						<div><b class="zahl">{D.naechte(u.id)}</b><span>Nächte</span></div>
						<div><b class="zahl">{zahl(D.km(u.id))}</b><span>km</span></div>
						<div><b class="zahl">{D.eintraegeVon(u.id).filter((e) => e.typ === 'stay').length}</b><span>Plätze</span></div>
						<div><b class="zahl">{fs.length}</b><span>Fotos</span></div>
					</div>
				</header>
				<div class="streifen">
					{#each fs as f (f.id)}
						<button onclick={() => (gross = f.id)} aria-label="Foto ansehen"><img alt="" src={fotoUrl(f.id, f.motiv, f.hoch)} /></button>
					{/each}
					<button class="mehr" onclick={() => zeigeHinweis('Fotos hinzufügen kommt später')}><Camera size={22} /><span>Fotos</span></button>
				</div>
				<ol class="zeitleiste">
					{#each tage(u.id) as [tag, liste] (tag)}
						<li class="tag">
							<div class="tagkopf"><span class="tagnr">Tag {reiseTag(u.start, tag)}</span><span>{tagLang(tag)}</span></div>
							{#each liste as e (e.id)}
								{@const Sym = SYMBOL[e.typ]}
								<button class="ein typ-{e.typ}" class:markiert={markiert === e.id} id="e-{e.id}" onclick={() => eintragGetippt(e)}>
									<span class="sym"><Sym size={18} weight={e.typ === 'stay' ? 'fill' : 'regular'} /></span>
									<span class="ein-txt">
										<span class="ein-titel">{e.titel}</span>
										<span class="ein-meta">
											{#if e.typ === 'drive'}
												<span class="zahl">{zahl(e.km!)} km · {dauer(e.min!)}</span>
											{:else if e.typ === 'stay'}
												<Sterne wert={e.bewertung!} groesse={12} />
												<span class="zahl">{e.naechte} {e.naechte === 1 ? 'Nacht' : 'Nächte'} · {e.preis}</span>
											{:else}
												<span>{TYPNAME[e.typ]} · {e.ort}</span>
											{/if}
										</span>
										{#if e.text}<span class="ein-text">{e.text}</span>{/if}
									</span>
									{#if e.typ === 'stay'}<CaretRight size={16} class="pfeil" />{/if}
								</button>
							{/each}
						</li>
					{/each}
				</ol>
			</article>
		{:else if detail?.art === 'platz'}
			{@const p = D.plaetze.find((x) => x.id === detail.id)!}
			{@const bs = D.besuche(p.id)}
			<article class="seite platz" in:fly={{ x: 30, duration: 260, easing: cubicOut }}>
				<span class="ueber">{p.art} · {p.ort}, {p.land}</span>
				<h2>{p.name}</h2>
				<div class="bewertung">
					<Sterne wert={D.platzBewertung(p.id)} groesse={20} />
					<span class="zahl">{D.platzBewertung(p.id).toLocaleString('de-DE', { maximumFractionDigits: 1 })}</span>
					{#if p.wiederkommen}<span class="marke"><Heart size={13} weight="fill" /> Gern wieder</span>{/if}
				</div>
				<div class="aktionen">
					<a class="knopf" href="https://maps.apple.com/?daddr={p.lat},{p.lng}" target="_blank" rel="noopener"><NavigationArrow size={18} weight="fill" /> Route</a>
					<button class="knopf zweit" onclick={() => zeigeHinweis('Bearbeiten kommt später')}><PencilSimple size={18} /> Bearbeiten</button>
				</div>
				<h4>Ausstattung</h4>
				<ul class="ausst">
					{#each AUSSTATTUNG as a (a.key)}
						<li class:da={p.ausstattung.includes(a.key)}><a.icon size={20} /> {a.name}</li>
					{/each}
				</ul>
				{#if p.notiz}
					<h4>Notiz</h4>
					<p class="notiz">{p.notiz}</p>
				{/if}
				<h4>{bs.length === 1 ? 'Ein Besuch' : `${bs.length} Besuche`}</h4>
				<ul class="besuche">
					{#each bs as b (b.id)}
						{@const u = D.urlaube.find((x) => x.id === b.urlaub)!}
						<li>
							<button onclick={() => oeffneUrlaub(u.id, b.id)}>
								<span class="punkt" style:background={farbe(u.id)}></span>
								<span class="b-txt"><b>{u.titel} {jahr(u.start)}</b><span class="zahl">{kurz(b.datum)} · {b.naechte} Nächte · {b.preis}</span></span>
								<Sterne wert={b.bewertung!} groesse={12} />
							</button>
						</li>
					{/each}
				</ul>
			</article>
		{:else if tab === 'reisen'}
			<div class="seite" in:fade={{ duration: 150 }}>
				<p class="ueber summe zahl">{D.urlaube.length} Reisen · {summe.naechte} Nächte · {zahl(summe.km)} km</p>
				<div class="reisen">
					{#each D.urlaube as u (u.id)}
						{@const c = D.fotos.find((f) => f.id === u.cover)!}
						<button class="reise" style="--rf:{farbe(u.id)}" onclick={() => oeffneUrlaub(u.id)}>
							<img class="cover" alt="" src={fotoUrl(c.id, c.motiv)} />
							<span class="r-txt">
								<span class="jahr zahl">{jahr(u.start)}</span>
								<span class="r-titel">{u.titel}</span>
								<span class="zeit">{zeitraum(u.start, u.ende)}</span>
								<span class="zahlen zahl"
									><span><b>{D.naechte(u.id)}</b> Nächte</span><span><b>{zahl(D.km(u.id))}</b> km</span><span
										><b>{D.fotosVon(u.id).length}</b> Fotos</span
									></span
								>
							</span>
						</button>
					{/each}
				</div>
				<button class="neue-reise" onclick={() => zeigeHinweis('Neue Reise anlegen kommt später')}><Plus size={18} /> Neue Reise</button>
			</div>
		{:else if tab === 'plaetze'}
			<div class="seite" in:fade={{ duration: 150 }}>
				<div class="chips">
					{#each FILTER as f (f.key)}
						<button class:an={filter.includes(f.key)} onclick={() => umschalten(f.key)}>{f.name}</button>
					{/each}
				</div>
				<ul class="plaetze">
					{#each plaetzeListe as p (p.id)}
						<li>
							<button onclick={() => oeffnePlatz(p.id)}>
								<span class="p-txt">
									<b>{p.name}</b>
									<span>{p.art} · {p.ort}</span>
								</span>
								<span class="p-rechts">
									<Sterne wert={D.platzBewertung(p.id)} groesse={12} />
									<span class="mini-ausst">
										{#each AUSSTATTUNG.filter((a) => p.ausstattung.includes(a.key)).slice(0, 5) as a (a.key)}<a.icon size={13} />{/each}
									</span>
								</span>
							</button>
						</li>
					{:else}
						<li class="leer">Kein Platz passt zu allen Filtern.</li>
					{/each}
				</ul>
			</div>
		{:else}
			<div class="seite" in:fade={{ duration: 150 }}>
				<label class="suchfeld">
					<MagnifyingGlass size={20} />
					<input type="search" placeholder="Ort, Platz oder Notiz" bind:value={suche} enterkeyhint="search" />
				</label>
				<div class="chips">
					{#each ['2025', '2024', '2023'] as j (j)}
						<button class:an={suchJahr === j} onclick={() => (suchJahr = suchJahr === j ? null : j)}>{j}</button>
					{/each}
					<button onclick={() => zeigeHinweis('Zeitraum wählen kommt später')}>Zeitraum <CaretDown size={12} /></button>
				</div>
				{#if suche || suchJahr}
					<ul class="treffer">
						{#each treffer as e (e.id)}
							{@const Sym = SYMBOL[e.typ]}
							{@const u = D.urlaube.find((x) => x.id === e.urlaub)!}
							<li>
								<button onclick={() => oeffneUrlaub(u.id, e.id)}>
									<span class="sym" style:color={farbe(u.id)}><Sym size={18} /></span>
									<span class="b-txt"><b>{e.titel}</b><span>{e.ort} · {kurz(e.datum)} · {u.titel}</span></span>
								</button>
							</li>
						{:else}
							<li class="leer">Nichts gefunden. Versuch es mit einem Ort, zum Beispiel „Fjord“ oder „Crozon“.</li>
						{/each}
					</ul>
				{:else}
					<p class="leer">Suche nach Orten, Plätzen und Notizen – oder tippe ein Jahr an.</p>
				{/if}
			</div>
		{/if}
	</Sheet>

	{#if neu}
		<div class="dimmer" onclick={() => (neu = false)} role="presentation" transition:fade={{ duration: 180 }}></div>
		<div class="neu" role="dialog" aria-label="Hier eintragen" transition:fly={{ y: 300, duration: 320, easing: cubicOut }}>
			<div class="neu-kopf">
				<h3>Hier eintragen</h3>
				<button class="rund" onclick={() => (neu = false)} aria-label="Schließen"><X size={18} /></button>
			</div>
			<div class="standort">
				<span class="ortsym"><Crosshair size={20} /></span>
				<span class="b-txt"><b>Geiranger, Norwegen</b><span class="zahl">62,1007° N · 7,2059° O · auf 8 m genau</span></span>
			</div>
			<button class="reisewahl" onclick={() => zeigeHinweis('Reise wählen kommt später')}>
				<span class="punkt" style:background={stil.reiseFarben[0]}></span> Zur Reise <b>Norwegen</b>
				<CaretDown size={14} />
			</button>
			<div class="wahl">
				<button onclick={() => zeigeHinweis('Formular Übernachtung kommt später')}><Tent size={28} weight="duotone" /> Übernachtung</button>
				<button onclick={() => zeigeHinweis('Formular Ausflug kommt später')}><Footprints size={28} weight="duotone" /> Ausflug</button>
				<button onclick={() => zeigeHinweis('Formular Event kommt später')}><Ticket size={28} weight="duotone" /> Event</button>
			</div>
			<button class="nurfotos" onclick={() => zeigeHinweis('Fotos hinzufügen kommt später')}><Camera size={20} /> Nur Fotos hinzufügen</button>
		</div>
	{/if}

	{#if grossFoto}
		{@const u = D.urlaube.find((x) => x.id === grossFoto.urlaub)!}
		<div class="gross" transition:fade={{ duration: 200 }} role="dialog" aria-label="Foto">
			<button class="rund zu" onclick={() => (gross = null)} aria-label="Schließen"><X size={20} /></button>
			{#key grossFoto.id}
				<img alt="" src={fotoUrl(grossFoto.id, grossFoto.motiv, grossFoto.hoch)} in:scale={{ start: 0.94, duration: 280, easing: cubicOut }} />
			{/key}
			<button class="blatt links" onclick={() => blaettern(-1)} aria-label="Vorheriges Foto"></button>
			<button class="blatt rechts" onclick={() => blaettern(1)} aria-label="Nächstes Foto"></button>
			<div class="unterschrift">
				<b>{u.titel} {jahr(u.start)}</b>
				<span>{tagLang(grossFoto.datum)}</span>
				<button
					onclick={() => {
						gross = null;
						karte?.zeigePunkt(grossFoto!.lng, grossFoto!.lat, sichtbar, 13);
					}}><MapPin size={14} weight="fill" /> Auf der Karte</button
				>
			</div>
		</div>
	{/if}

	{#if hinweis}
		<div class="hinweis" style:bottom="{Math.min(sichtbar, 300) + 70}px" transition:fly={{ y: 16, duration: 200 }}>{hinweis}</div>
	{/if}
</div>

<style>
	.app {
		position: fixed;
		inset: 0;
		overflow: hidden;
		background: var(--grund);
		color: var(--text);
		font-family: var(--schrift-ui);
	}
	.schleier {
		position: absolute;
		inset: 0 0 auto;
		height: calc(env(safe-area-inset-top) + 8px);
		background: var(--grund);
		opacity: 0.85;
		z-index: 5;
		pointer-events: none;
	}

	/* --- schwebende Bedienelemente auf der Karte --- */
	.stilchip {
		position: absolute;
		z-index: 6;
		top: calc(env(safe-area-inset-top) + 12px);
		left: 12px;
		display: flex;
		align-items: center;
		gap: 6px;
		height: 34px;
		padding: 0 12px 0 5px;
		border: 1px solid var(--linie);
		border-radius: 17px;
		background: var(--flaeche);
		font-size: 13px;
		font-weight: 550;
	}
	.stilchip b {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: 12px;
		background: var(--text);
		color: var(--flaeche);
		font-size: 12px;
	}
	.kartenknoepfe {
		position: absolute;
		z-index: 6;
		top: calc(env(safe-area-inset-top) + 12px);
		right: 12px;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		overflow: hidden;
		transition: opacity 0.2s;
	}
	.kartenknoepfe button {
		display: grid;
		place-items: center;
		width: 46px;
		height: 46px;
		border: 0;
		background: none;
		color: var(--text);
	}
	.kartenknoepfe button + button {
		border-top: 1px solid var(--linie);
	}
	.kartenknoepfe button.an {
		color: var(--akzent);
	}
	.hier {
		position: absolute;
		z-index: 19;
		right: 14px;
		display: flex;
		align-items: center;
		gap: 8px;
		height: 50px;
		padding: 0 20px 0 16px;
		border: 0;
		border-radius: 25px;
		background: var(--akzent);
		color: var(--akzent-text);
		font-weight: 620;
		font-size: 16px;
		box-shadow: var(--knopf-schatten);
		transition: bottom 0.42s cubic-bezier(0.22, 1, 0.36, 1);
	}
	.hier:active {
		transform: scale(0.97);
	}

	/* --- Sheet-Kopf --- */
	.reiter {
		display: flex;
		gap: 4px;
		margin: 2px 14px 10px;
		padding: 4px;
		border-radius: calc(var(--radius) + 2px);
		background: var(--flaeche-2);
	}
	.reiter button {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		height: 38px;
		border: 0;
		border-radius: var(--radius);
		background: none;
		color: var(--text-2);
		font-size: 15px;
		font-weight: 550;
	}
	.reiter button.aktiv {
		background: var(--flaeche);
		color: var(--text);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}
	.zurueckzeile {
		padding: 0 8px 4px;
	}
	.zurueck {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 40px;
		padding: 0 10px 0 6px;
		border: 0;
		background: none;
		color: var(--akzent);
		font-weight: 600;
	}

	/* --- Seiten im Sheet --- */
	.seite {
		padding: 4px 18px 0;
	}
	.ueber {
		display: block;
		color: var(--text-2);
		font-size: 13px;
		font-weight: 550;
		letter-spacing: 0.02em;
	}
	.summe {
		margin: 4px 0 10px;
	}
	h4 {
		margin: 26px 0 10px;
		font-size: 13px;
		font-weight: 650;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-2);
	}
	.leer {
		padding: 28px 8px;
		color: var(--text-2);
		text-align: center;
		list-style: none;
	}

	/* Reisen-Liste */
	.reisen {
		display: flex;
		flex-direction: column;
	}
	.reise {
		display: grid;
		grid-template-columns: 84px 1fr;
		gap: 14px;
		align-items: center;
		padding: 12px 0;
		border: 0;
		border-bottom: 1px solid var(--linie);
		background: none;
		text-align: left;
	}
	.cover {
		width: 84px;
		height: 84px;
		object-fit: cover;
		border-radius: var(--radius);
	}
	.r-txt {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.jahr {
		font-size: 13px;
		font-weight: 650;
		color: var(--rf);
	}
	.r-titel {
		font-family: var(--schrift-kopf);
		font-weight: var(--kopf-gewicht);
		font-style: var(--kopf-stil);
		letter-spacing: var(--kopf-sperrung);
		font-size: 24px;
		line-height: 1.1;
	}
	.zeit {
		color: var(--text-2);
		font-size: 14px;
	}
	.zahlen {
		display: flex;
		gap: 12px;
		margin-top: 4px;
		font-size: 13px;
		color: var(--text-2);
	}
	.zahlen b {
		color: var(--text);
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

	/* Urlaub-Detail */
	.u-kopf h2 {
		font-size: 38px;
		margin: 2px 0 4px;
	}
	.kennzahlen {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		margin: 16px 0 4px;
		border-top: 1px solid var(--linie);
		border-bottom: 1px solid var(--linie);
	}
	.kennzahlen div {
		display: flex;
		flex-direction: column;
		padding: 10px 0;
	}
	.kennzahlen div + div {
		padding-left: 12px;
		border-left: 1px solid var(--linie);
	}
	.kennzahlen b {
		font-size: 22px;
		font-weight: 600;
		line-height: 1.1;
	}
	.kennzahlen span {
		font-size: 12px;
		color: var(--text-2);
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
		width: 92px;
		height: 116px;
		padding: 0;
		border: 0;
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--flaeche-2);
	}
	.streifen img {
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
		position: relative;
		padding: 0 0 8px 0;
	}
	.tagkopf {
		display: flex;
		align-items: baseline;
		gap: 10px;
		padding: 16px 0 6px;
		font-size: 14px;
		color: var(--text-2);
	}
	.tagnr {
		font-family: var(--schrift-kopf);
		font-style: var(--kopf-stil);
		font-weight: var(--kopf-gewicht);
		color: var(--rf);
		font-size: 17px;
	}
	.ein {
		position: relative;
		display: grid;
		grid-template-columns: 36px 1fr auto;
		gap: 12px;
		align-items: start;
		width: 100%;
		padding: 8px 6px 10px 0;
		border: 0;
		border-radius: var(--radius);
		background: none;
		text-align: left;
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
		background: color-mix(in srgb, var(--rf) 30%, transparent);
		z-index: 0;
	}
	.sym {
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
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
		font-weight: 600;
		font-size: 16px;
	}
	.typ-drive .ein-titel {
		font-weight: 500;
		color: var(--text-2);
	}
	.ein-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--text-2);
	}
	.ein-text {
		margin-top: 3px;
		font-size: 15px;
		line-height: 1.45;
	}
	.ein :global(.pfeil) {
		margin-top: 10px;
		color: var(--text-2);
	}

	/* Platz-Detail */
	.platz h2 {
		font-size: 32px;
		margin: 4px 0 10px;
	}
	.bewertung {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
	}
	.marke {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-left: auto;
		padding: 4px 10px;
		border-radius: 20px;
		background: color-mix(in srgb, var(--akzent) 14%, transparent);
		color: var(--akzent);
		font-size: 13px;
	}
	.aktionen {
		display: flex;
		gap: 10px;
		margin-top: 18px;
	}
	.knopf {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		height: 48px;
		border: 0;
		border-radius: var(--radius);
		background: var(--akzent);
		color: var(--akzent-text);
		font-weight: 600;
		text-decoration: none;
	}
	.knopf.zweit {
		background: var(--flaeche-2);
		color: var(--text);
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
	.notiz {
		font-size: 16px;
		line-height: 1.5;
	}
	.besuche,
	.plaetze,
	.treffer {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.besuche button,
	.plaetze button,
	.treffer button {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 60px;
		padding: 8px 0;
		border: 0;
		border-bottom: 1px solid var(--linie);
		background: none;
		text-align: left;
	}
	.punkt {
		flex: none;
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}
	.b-txt,
	.p-txt {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.b-txt span,
	.p-txt span {
		font-size: 13px;
		color: var(--text-2);
	}
	.p-rechts {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}
	.mini-ausst {
		display: flex;
		gap: 3px;
		color: var(--text-2);
	}

	/* Chips & Suche */
	.chips {
		display: flex;
		gap: 8px;
		margin: 2px -18px 12px;
		padding: 0 18px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.chips button {
		flex: none;
		display: flex;
		align-items: center;
		gap: 4px;
		height: 36px;
		padding: 0 14px;
		border: 1px solid var(--linie);
		border-radius: 18px;
		background: none;
		font-size: 14px;
		font-weight: 550;
		color: var(--text);
	}
	.chips button.an {
		background: var(--text);
		border-color: var(--text);
		color: var(--flaeche);
	}
	.suchfeld {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 48px;
		margin: 4px 0 12px;
		padding: 0 14px;
		border-radius: var(--radius);
		background: var(--flaeche-2);
		color: var(--text-2);
	}
	.suchfeld input {
		flex: 1;
		min-width: 0;
		border: 0;
		outline: 0;
		background: none;
		color: var(--text);
	}

	/* Hier eintragen */
	.dimmer {
		position: fixed;
		inset: 0;
		z-index: 40;
		background: rgba(10, 10, 10, 0.35);
	}
	.neu {
		position: fixed;
		z-index: 41;
		left: 8px;
		right: 8px;
		bottom: calc(8px + env(safe-area-inset-bottom));
		padding: 16px 16px 14px;
		border-radius: var(--radius-gross);
		background: var(--flaeche);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}
	.neu-kopf {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}
	.neu-kopf h3 {
		font-size: 26px;
	}
	.rund {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border: 0;
		border-radius: 50%;
		background: var(--flaeche-2);
		color: var(--text);
	}
	.standort {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		border-radius: var(--radius);
		background: var(--flaeche-2);
	}
	.ortsym {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--akzent);
		color: var(--akzent-text);
	}
	.reisewahl {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		height: 44px;
		margin: 6px 0 12px;
		padding: 0 4px;
		border: 0;
		background: none;
		color: var(--text-2);
		font-size: 15px;
	}
	.reisewahl b {
		color: var(--text);
	}
	.wahl {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}
	.wahl button {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 18px 4px 14px;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		font-weight: 600;
		font-size: 14px;
		color: var(--text);
	}
	.wahl button :global(svg) {
		color: var(--akzent);
	}
	.wahl button:active {
		background: var(--flaeche-2);
	}
	.nurfotos {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		height: 48px;
		margin-top: 8px;
		border: 0;
		border-radius: var(--radius);
		background: none;
		color: var(--text-2);
		font-weight: 550;
	}

	/* Großansicht */
	.gross {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: grid;
		place-items: center;
		background: #0b0c0d;
	}
	.gross img {
		max-width: 100%;
		max-height: 78vh;
		object-fit: contain;
	}
	.zu {
		position: absolute;
		z-index: 2;
		top: calc(env(safe-area-inset-top) + 12px);
		right: 14px;
		background: rgba(255, 255, 255, 0.14);
		color: #fff;
	}
	.blatt {
		position: absolute;
		top: 15%;
		bottom: 25%;
		width: 35%;
		border: 0;
		background: none;
	}
	.blatt.links {
		left: 0;
	}
	.blatt.rechts {
		right: 0;
	}
	.unterschrift {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 16px 20px calc(20px + env(safe-area-inset-bottom));
		color: #eee;
	}
	.unterschrift b {
		font-family: var(--schrift-kopf);
		font-style: var(--kopf-stil);
		font-weight: var(--kopf-gewicht);
		font-size: 22px;
	}
	.unterschrift span {
		color: #aaa;
		font-size: 14px;
	}
	.unterschrift button {
		align-self: flex-start;
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 10px;
		height: 36px;
		padding: 0 14px;
		border: 0;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.14);
		color: #fff;
		font-size: 14px;
	}

	.hinweis {
		position: fixed;
		z-index: 60;
		left: 50%;
		transform: translateX(-50%);
		padding: 10px 16px;
		border-radius: 22px;
		background: var(--text);
		color: var(--flaeche);
		font-size: 14px;
		font-weight: 550;
		white-space: nowrap;
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
	}

	/* ===================== B: Nachtfahrt – große Bilder ===================== */
	[data-stil='nacht'] .reisen {
		gap: 12px;
	}
	[data-stil='nacht'] .reise {
		position: relative;
		display: block;
		height: 190px;
		padding: 0;
		border: 0;
		border-radius: var(--radius-gross);
		overflow: hidden;
	}
	[data-stil='nacht'] .cover {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		border-radius: 0;
	}
	[data-stil='nacht'] .r-txt {
		position: absolute;
		inset: auto 0 0;
		padding: 40px 18px 14px;
		background: linear-gradient(transparent, rgba(8, 10, 13, 0.86));
		color: #fff;
	}
	[data-stil='nacht'] .r-titel {
		font-size: 30px;
	}
	[data-stil='nacht'] .zeit,
	[data-stil='nacht'] .zahlen {
		color: rgba(255, 255, 255, 0.75);
	}
	[data-stil='nacht'] .zahlen b {
		color: #fff;
	}
	[data-stil='nacht'] .jahr {
		color: var(--rf);
		letter-spacing: 0.06em;
	}
	[data-stil='nacht'] .streifen button {
		width: 120px;
		height: 150px;
	}
	[data-stil='nacht'] .kennzahlen {
		border: 0;
		gap: 8px;
	}
	[data-stil='nacht'] .kennzahlen div {
		padding: 10px 12px;
		border: 0;
		border-radius: var(--radius);
		background: var(--flaeche-2);
	}

	/* ===================== C: Wegweiser – Schilder und Zahlen ===================== */
	[data-stil='wegweiser'] .reise {
		grid-template-columns: 6px 1fr 88px;
		gap: 14px;
		padding: 14px 0;
	}
	[data-stil='wegweiser'] .reise::before {
		content: '';
		grid-column: 1;
		grid-row: 1;
		align-self: stretch;
		border-radius: 3px;
		background: var(--rf);
	}
	[data-stil='wegweiser'] .cover {
		grid-column: 3;
		grid-row: 1;
		width: 88px;
		height: 88px;
	}
	[data-stil='wegweiser'] .r-txt {
		grid-column: 2;
		grid-row: 1;
	}
	[data-stil='wegweiser'] .jahr {
		color: var(--text-2);
		letter-spacing: 0.08em;
	}
	[data-stil='wegweiser'] .r-titel {
		font-size: 22px;
	}
	[data-stil='wegweiser'] .zahlen b {
		font-size: 15px;
	}
	[data-stil='wegweiser'] .u-kopf h2 {
		font-size: 34px;
	}
	[data-stil='wegweiser'] .kennzahlen {
		gap: 6px;
		border: 0;
	}
	[data-stil='wegweiser'] .kennzahlen div {
		padding: 10px;
		border: 0;
		border-radius: var(--radius);
		background: var(--tief);
		color: #fff;
	}
	[data-stil='wegweiser'] .kennzahlen div:first-child {
		background: var(--signal);
		color: #111;
	}
	[data-stil='wegweiser'] .kennzahlen div:first-child span {
		color: #333;
	}
	[data-stil='wegweiser'] .kennzahlen span {
		color: rgba(255, 255, 255, 0.75);
	}
	[data-stil='wegweiser'] .kennzahlen b {
		font-size: 24px;
		font-weight: 700;
	}
	[data-stil='wegweiser'] .ueber,
	[data-stil='wegweiser'] .tagkopf {
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 12px;
	}
	[data-stil='wegweiser'] .tagnr {
		padding: 2px 8px;
		border-radius: 4px;
		background: var(--rf);
		color: #fff;
		font-size: 12px;
		font-weight: 700;
	}
	[data-stil='wegweiser'] .sym {
		border-radius: 8px;
	}
	[data-stil='wegweiser'] .hier {
		border-radius: var(--radius);
	}

	/* ===================== A: Atlas – Papier und Linien ===================== */
	[data-stil='atlas'] .cover {
		border-radius: 3px;
		box-shadow:
			0 0 0 4px #fffdf8,
			0 1px 0 4px var(--linie),
			0 4px 10px 4px rgba(80, 60, 30, 0.08);
		transform: rotate(-1.5deg);
	}
	[data-stil='atlas'] .reise:nth-child(2n) .cover {
		transform: rotate(1.2deg);
	}
	[data-stil='atlas'] .reise {
		padding: 16px 0 16px 4px;
		border-bottom-style: dashed;
	}
	[data-stil='atlas'] .r-titel {
		font-size: 26px;
	}
	[data-stil='atlas'] .jahr {
		font-family: var(--schrift-kopf);
		font-style: italic;
		font-weight: 400;
		font-size: 15px;
	}
	[data-stil='atlas'] .u-kopf h2 {
		font-size: 42px;
		font-variation-settings: 'opsz' 144;
	}
	[data-stil='atlas'] .streifen button {
		border-radius: 3px;
		border: 4px solid #fffdf8;
		box-shadow: 0 1px 0 var(--linie), 0 3px 8px rgba(80, 60, 30, 0.1);
	}
	[data-stil='atlas'] .ein::before {
		width: 0;
		border-left: 2px dotted color-mix(in srgb, var(--rf) 55%, transparent);
		background: none;
	}
</style>
