<!--
  Eine Reise: Kennzahlen, Fotos, Zeitleiste nach Tagen.
  Mehrtägige Übernachtungen erscheinen an jedem Tag (Folgenacht), Notizen bei ihrer Nacht.
  Fotos eines Eintrags stehen direkt beim Eintrag; Fotos außerhalb des Zeitraums unter „Weitere Fotos“.
  Wetter steht im Tageskopf (wird beim Öffnen still nachgetragen), Kosten am Ende.
-->
<script lang="ts">
	import { pfeile } from '#lib/ui/pfeile.ts';
	import { kontext } from '#lib/ui/kontext.ts';
	import { fotoAktionen } from '#lib/fotos/aktionen.ts';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import { slide } from 'svelte/transition';
	import Tent from 'phosphor-svelte/lib/Tent';
	import Van from 'phosphor-svelte/lib/Van';
	import Footprints from 'phosphor-svelte/lib/Footprints';
	import Moon from 'phosphor-svelte/lib/Moon';
	import X from 'phosphor-svelte/lib/X';
	import Camera from 'phosphor-svelte/lib/Camera';
	import Plus from 'phosphor-svelte/lib/Plus';
	import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
	import FilePdf from 'phosphor-svelte/lib/FilePdf';
	import NotePencil from 'phosphor-svelte/lib/NotePencil';
	import Trash from 'phosphor-svelte/lib/Trash';
	import CaretRight from 'phosphor-svelte/lib/CaretRight';
	import Kopf from '#lib/ui/Kopf.svelte';
	import Wischzeile from '#lib/ui/Wischzeile.svelte';
	import DotsThree from 'phosphor-svelte/lib/DotsThree';
	import Coins from 'phosphor-svelte/lib/Coins';
	import Sterne from '#lib/ui/Sterne.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui, type Aktion } from '#lib/ui.svelte.ts';
	import { thema } from '#lib/thema.svelte.ts';
	import { reiseFarbe } from '#lib/farben.ts';
	import { naechte, km, plaetzeAnzahl, fotosVon, fotosVonEintrag, tage, reiseEnde, weitereFotos, nachtNotizen } from '#lib/auswertung.ts';
	import { zeitraum, tagLang, monatJahr, reiseTag, dauer, zahl, preisText, notizZeit, heute, wort } from '#lib/datum.ts';
	import { fotosWaehlen } from '#lib/fotos/import.ts';
	import { aktuelleUebernachtung, weiterfahren, zieleInDerNaehe, entfernungText } from '#lib/unterwegs.ts';
	import { laufendeReise } from '#lib/auswertung.ts';
	import { wetterNachtragen, tagesWetter, wetterArt } from '#lib/wetter.ts';
	import { reiseKosten, summe, wechselkurse, nurEuro, kostenName, type Betraege } from '#lib/kosten.svelte.ts';
	import { zielFarbe } from '#lib/map/zusatz.ts';
	import Flag from 'phosphor-svelte/lib/Flag';
	import type { Eintrag, Foto } from '#lib/db/typen.ts';
	import { TYP_NAME, ZIEL_ART } from '#lib/db/typen.ts';

	async function losfahren(e: Eintrag) {
		await weiterfahren(e);
		ui.zeige('Gute Fahrt! Am Ziel einfach „Hier eintragen“ → Übernachtung.');
	}

	const id = $derived(page.params.id ?? '');
	const r = $derived(daten.reise(id));
	const fs = $derived(r ? fotosVon(r.id) : []);
	// Filter über die Kennzahlen: Tipp auf „km“ zeigt nur Fahrten usw.
	type Filter = 'naechte' | 'km' | 'plaetze' | 'fotos';
	const FILTER_NAME: Record<Filter, string> = { naechte: 'alle Nächte', km: 'Fahrten', plaetze: 'Plätze', fotos: 'Fotos' };
	let filter = $state<Filter | null>(null);
	const alleTage = $derived(r ? tage(r.id) : []);
	const liste = $derived.by(() => {
		if (!filter) return alleTage;
		return alleTage
			.map((t) => {
				if (filter === 'naechte') return { ...t, eintraege: t.eintraege.filter((e) => e.typ === 'stay'), fotos: [] };
				if (filter === 'plaetze') return { ...t, eintraege: t.eintraege.filter((e) => e.typ === 'stay'), naechte: [], fotos: [] };
				if (filter === 'km') return { ...t, eintraege: t.eintraege.filter((e) => e.typ === 'drive'), naechte: [], fotos: [] };
				return { ...t, eintraege: t.eintraege.filter((e) => fotosVonEintrag(e.id).length), naechte: [] };
			})
			.filter((t) => t.eintraege.length || t.naechte.length || t.fotos.length);
	});
	const weitere = $derived(r ? weitereFotos(r.id) : []);
	// Während der Reise: gemerkte Ziele in der Nähe (GPS oder aktuelle Übernachtung)
	const nahe = $derived(r && laufendeReise()?.id === r.id ? zieleInDerNaehe().slice(0, 5) : []);
	const geplant = $derived(daten.ziele.filter((z) => z.reise === id && !z.erledigt && !nahe.some((n) => n.ziel.id === z.id)));
	const posten = $derived(r ? reiseKosten(r.id) : []);
	const gesamt = $derived(summe(posten));
	// Reise in der Zukunft ohne Einträge: Planung statt leerer Kennzahlen zeigen
	const inPlanung = $derived(!!r && r.start > heute() && !alleTage.length && !fs.length);
	let offen = $state<string | null>(null);

	// Karte auf diese Reise einstellen
	$effect(() => {
		if (!r || !daten.geladen) return;
		ui.auswahl = r.id;
		ui.oeffnen();
		if (!ui.markiert) ui.zeigeReise(r.id);
	});
	// Von außen markiert (Suche, Fotoalbum, Karte, neuer Eintrag): aufklappen, hinscrollen, auf der Karte zeigen.
	// Beim eigenen Tippen nicht scrollen.
	let selbstGetippt = false;
	$effect(() => {
		const m = ui.markiert;
		if (!m) return;
		offen = m;
		if (selbstGetippt) {
			selbstGetippt = false;
			return;
		}
		untrack(() => {
			const e = daten.eintrag(m);
			if (e?.route?.length) ui.zeigeLinie(e.route);
			else if (e?.ort) ui.zeigeOrt(e.ort, 13);
			setTimeout(() => document.getElementById('e-' + m)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 350);
		});
	});
	// Wetter vergangener Tage nachtragen, Wechselkurse für die Kosten holen
	$effect(() => {
		if (!r || !daten.geladen) return;
		const reise = r.id;
		const fremd = posten.some((p) => !nurEuro(p.betraege));
		untrack(() => {
			wetterNachtragen(reise);
			if (fremd) wechselkurse.holen();
		});
	});

	/** „120 € + 850 NOK“ */
	const betragText = (b: Betraege) =>
		Object.entries(b)
			.map(([w, x]) => preisText(Math.round(x * 100) / 100, w))
			.join(' + ');
	const ausgabenText = (e: Eintrag) => (e.kosten ?? []).map((k) => `${kostenName(k)} ${preisText(k.betrag, k.waehrung)}`).join(' · ');

	const SYMBOL = { stay: Tent, drive: Van, outing: Footprints };

	function getippt(e: Eintrag, schluessel = e.id) {
		offen = offen === schluessel ? null : schluessel;
		// Folgenächte nicht als Markierung setzen – sonst springt die Auswahl auf die erste Nacht
		const neu = offen && schluessel === e.id ? e.id : null;
		if (neu && neu !== ui.markiert) selbstGetippt = true;
		ui.markiert = neu;
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
		if (e.typ === 'drive' && e.von && !e.nach) return 'unterwegs …';
		if (e.typ === 'drive') {
			const teile = [e.km ? `${zahl(e.km)} km` : '', e.minuten ? dauer(e.minuten) : ''].filter(Boolean);
			if (e.via?.length) teile.push('über ' + e.via.map((o) => o.name ?? 'Zwischenziel').join(', '));
			if (!teile.length && !e.kosten?.length) return e.routeOk === false ? 'Route wird berechnet …' : 'Fahrt';
			return [...teile, ausgabenText(e)].filter(Boolean).join(' · ');
		}
		if (e.typ === 'stay') {
			const n = e.naechte ?? 1;
			return [`${n} ${n === 1 ? 'Nacht' : 'Nächte'}`, preisText(e.preis, e.waehrung), ausgabenText(e)].filter(Boolean).join(' · ');
		}
		return [TYP_NAME[e.typ], e.ort?.name, ausgabenText(e)].filter(Boolean).join(' · ');
	}

	function grossAb(fotos: Foto[], i: number) {
		ui.gross = { ids: fotos.map((f) => f.id), i };
	}

	// „+“ oben in der Kopfzeile, sobald der Knopf „Eintrag hinzufügen“ unten nicht mehr zu sehen ist
	let untenKnopf: HTMLElement | undefined = $state();
	let untenSichtbar = $state(true);
	$effect(() => {
		if (!untenKnopf) return;
		const b = new IntersectionObserver(([e]) => (untenSichtbar = e.isIntersecting));
		b.observe(untenKnopf);
		return () => b.disconnect();
	});

	function neuerEintrag() {
		const letzter = liste.at(-1)?.datum;
		ui.dialog = { art: 'eintrag', vorlage: { reise: id, datum: letzter ?? r?.start } };
	}
	const notiz = (e: Eintrag, datum: string) => (ui.dialog = { art: 'notiz', eintrag: e.id, datum });
	const bearbeiten = (e: Eintrag) => (ui.dialog = { art: 'eintrag', id: e.id });

	/** Was sich zu einem Eintrag hinzufügen lässt (Wischen nach rechts, „…“) */
	function hinzuPunkte(e: Eintrag, datum: string): Aktion[] {
		const punkte: Aktion[] = [{ text: 'Fotos hinzufügen', icon: Camera, los: () => fotosWaehlen({ reise: e.reise, eintrag: e.id }) }];
		if (e.typ === 'stay') punkte.push({ text: 'Notiz zu dieser Nacht', icon: NotePencil, los: () => notiz(e, datum) });
		punkte.push({ text: 'Ausgabe hinzufügen', icon: Coins, los: () => (ui.dialog = { art: 'eintrag', id: e.id, kostenNeu: true }) });
		return punkte;
	}
	function hinzufuegen(e: Eintrag, datum: string) {
		ui.aktionen = { titel: `Zu „${e.titel}“ hinzufügen`, punkte: hinzuPunkte(e, datum) };
	}
	/** Alle Aktionen eines Eintrags („…“ bzw. Rechtsklick am PC an der Mausposition) */
	function menue(e: Eintrag, datum: string, x?: number, y?: number) {
		const punkte: Aktion[] = [];
		if (e.typ === 'stay' && aktuelleUebernachtung()?.id === e.id) punkte.push({ text: 'Weiterfahren', icon: Van, los: () => losfahren(e) });
		punkte.push(...hinzuPunkte(e, datum));
		if (e.platz) punkte.push({ text: 'Platz ansehen', icon: Tent, los: () => goto(`#/platz/${e.platz}`) });
		punkte.push({ text: e.typ === 'stay' && datum !== e.datum ? 'Details zur Übernachtung' : 'Details', icon: PencilSimple, los: () => bearbeiten(e) });
		if (datum === e.datum) punkte.push({ text: 'Löschen', icon: Trash, gefahr: true, los: () => loeschen(e) });
		ui.aktionen = { titel: e.titel, punkte, x, y };
	}
</script>

{#snippet fotoreihe(fotos: Foto[])}
	{#if fotos.length}
		<div class="fotoreihe">
			{#each fotos.slice(0, 5) as f, i (f.id)}
				<button onclick={() => grossAb(fotos, i)} aria-label="Foto ansehen" {@attach kontext(() => fotoAktionen(f, () => grossAb(fotos, i)))}>
					<img alt="" src={f.vorschau} />
				</button>
			{/each}
			{#if fotos.length > 5}
				<button class="mehrfotos" onclick={() => grossAb(fotos, 5)}>+{fotos.length - 5}</button>
			{/if}
		</div>
	{/if}
{/snippet}

<!-- Aufgeklappter Eintrag: nur das Wichtigste sichtbar, alles andere hinter „…“, Wischen bzw. Rechtsklick -->
{#snippet leiste(e: Eintrag, datum: string)}
	<div class="aktionen" transition:slide={{ duration: 180 }}>
		{#if e.typ === 'stay' && aktuelleUebernachtung()?.id === e.id}
			<button class="los" onclick={() => losfahren(e)}><Van size={16} /> Weiterfahren</button>
		{/if}
		<button class="rund-klein" onclick={() => fotosWaehlen({ reise: e.reise, eintrag: e.id })} aria-label="Fotos hinzufügen"><Camera size={18} /></button>
		<button class="rund-klein" onclick={(ev) => menue(e, datum, ev.clientX, ev.clientY)} aria-label="Mehr"><DotsThree size={20} weight="bold" /></button>
	</div>
{/snippet}

{#snippet notizen(e: Eintrag, datum: string)}
	{@const ns = nachtNotizen(e, datum)}
	{#if ns.length}
		<ul class="notizen">
			{#each ns as n (n.id)}
				<li><small>{notizZeit(n.zeit)}</small>{n.text}</li>
			{/each}
		</ul>
	{/if}
{/snippet}

{#if r}
	{@const rf = reiseFarbe(r.farbe, thema.dunkel)}
	<Kopf>
		{#snippet rechts()}
			{#if !untenSichtbar}<button onclick={neuerEintrag} aria-label="Eintrag hinzufügen"><Plus size={18} weight="bold" /></button>{/if}
			{#if alleTage.some((t) => t.eintraege.length)}<button onclick={() => (ui.dialog = { art: 'pdf', reise: r.id })} aria-label="Als PDF"><FilePdf size={18} /></button>{/if}
			<button onclick={() => (ui.dialog = { art: 'reise', id: r.id })}><PencilSimple size={17} /> Details</button>
		{/snippet}
	</Kopf>

	<article class="seite" style="--rf:{rf}">
		<header>
			<span class="ueber">{monatJahr(r.start)}</span>
			<h1>{r.titel}</h1>
			<p class="zeit">{zeitraum(r.start, r.ende ?? reiseEnde(r))}</p>
			{#if !inPlanung}
				{@const n = naechte(r.id)}
				{@const pl = plaetzeAnzahl(r.id)}
			<div class="kennzahlen zahl" role="group" aria-label="Zeitleiste filtern" {@attach pfeile('button', 'zeile')}>
				{#each [['naechte', n, wort(n, 'Nacht', 'Nächte')], ['km', zahl(km(r.id)), 'km'], ['plaetze', pl, wort(pl, 'Platz', 'Plätze')], ['fotos', fs.length, wort(fs.length, 'Foto', 'Fotos')]] as [k, wert, name], i (k)}
					<button class:gelb={i === 0} class:an={filter === k} aria-pressed={filter === k} onclick={() => (filter = filter === k ? null : (k as Filter))}>
						<b>{wert}</b><span>{name}</span>
					</button>
				{/each}
			</div>
			{/if}
			{#if filter}
				<button class="filterzeile" onclick={() => (filter = null)}>Gefiltert: {FILTER_NAME[filter]} <X size={14} /></button>
			{/if}
			{#if r.notiz}<p class="reisenotiz">{r.notiz}</p>{/if}
		</header>

		{#if fs.length}
			<div class="streifen" {@attach pfeile('button', 'zeile')}>
				{#each fs as f, i (f.id)}
					<button onclick={() => grossAb(fs, i)} aria-label="Foto ansehen"><img alt="" src={f.vorschau} /></button>
				{/each}
				<button class="mehr" onclick={() => fotosWaehlen({ reise: r.id })}><Camera size={22} /><span>Fotos</span></button>
			</div>
		{:else if !inPlanung}
			<button class="fotos-leer" onclick={() => fotosWaehlen({ reise: r.id })}>
				<Camera size={20} /> Fotos hinzufügen
				<span>Ort und Tag kommen aus dem Foto</span>
			</button>
		{/if}

		{#if nahe.length}
			<section class="geplant nahe">
				<h4>Gemerkt, in der Nähe</h4>
				{#each nahe as { ziel: z, m } (z.id)}
					<button class="ziel" onclick={() => ((ui.dialog = { art: 'ziel', id: z.id }), ui.zeigeOrt(z.ort, 12))}>
						<span class="punkt" style:background={zielFarbe(z.art, thema.dunkel)}></span>
						<span class="z-txt"><b>{z.name}</b><span>{ZIEL_ART[z.art]}{z.ort.name && z.ort.name !== z.name ? ` · ${z.ort.name}` : ''}</span></span>
						<span class="weit zahl">{entfernungText(m)}</span>
					</button>
				{/each}
			</section>
		{/if}

		{#if geplant.length || r.start > heute()}
			<section class="geplant">
				<h4>Geplant</h4>
				{#each geplant as z (z.id)}
					<button class="ziel" onclick={() => ((ui.dialog = { art: 'ziel', id: z.id }), ui.zeigeOrt(z.ort, 12))}>
						<span class="punkt" style:background={zielFarbe(z.art, thema.dunkel)}></span>
						<span class="z-txt"><b>{z.name}</b><span>{ZIEL_ART[z.art]}{z.ort.name && z.ort.name !== z.name ? ` · ${z.ort.name}` : ''}</span></span>
					</button>
				{/each}
				<button class="ziel-neu" onclick={() => (ui.dialog = { art: 'ziel', vorlage: { reise: r.id } })}><Flag size={16} /> Ziel für diese Reise merken</button>
			</section>
		{/if}

		{#if !liste.length && !inPlanung}
			<p class="leer">Noch keine Einträge. Füg die erste Übernachtung oder Fahrt hinzu.</p>
		{/if}

		<ol class="zeitleiste" {@attach pfeile('.ein-knopf, .fotoreihe button, .aktionen button')}>
			{#each liste as tag (tag.datum)}
				{@const ersteNacht = tag.eintraege.findIndex((e) => e.typ === 'stay')}
				<li class="tag">
					<div class="tagkopf">
						<span class="tagnr zahl">Tag {reiseTag(r.start, tag.datum)}</span>
						<span>{tagLang(tag.datum)}</span>
						{#if tagesWetter(tag)}
							{@const w = tagesWetter(tag)!}
							{@const art = wetterArt(w.c)}
							<span class="wetter zahl" title="{art.name}{w.regen ? `, ${w.regen.toLocaleString('de-DE')} mm Regen` : ''}">
								<art.icon size={16} weight="duotone" /><span>{w.max}°<small> / {w.min}°</small></span>
							</span>
						{/if}
					</div>
					{#if tag.fotos.length}<div class="lose">{@render fotoreihe(tag.fotos)}</div>{/if}

					<!-- Folgenächte mehrtägiger Übernachtungen: nach Fahrten und Ausflügen des Tages, vor einer neuen Übernachtung -->
					{#snippet folgeNaechte()}
						{#each tag.naechte as nacht (nacht.eintrag.id + nacht.nr)}
							{@const e = nacht.eintrag}
							{@const schluessel = e.id + ':' + nacht.nr}
							<div class="ein folge" class:markiert={offen === schluessel}>
								<Wischzeile
									links={[{ text: 'Details', icon: PencilSimple, los: () => bearbeiten(e) }]}
									rechts={{ text: 'Hinzufügen', icon: Plus, los: () => hinzufuegen(e, tag.datum) }}
									onmenue={(x, y) => menue(e, tag.datum, x, y)}
								>
									<button class="ein-knopf" onclick={() => getippt(e, schluessel)} aria-expanded={offen === schluessel}>
										<span class="sym klein"><Moon size={15} weight="fill" /></span>
										<span class="ein-txt">
											<span class="ein-titel">{e.titel}</span>
											<span class="ein-meta">Nacht {nacht.nr} von {nacht.von}</span>
										</span>
									</button>
									{@render notizen(e, tag.datum)}
									{#if offen === schluessel}{@render leiste(e, tag.datum)}{/if}
								</Wischzeile>
							</div>
						{/each}
					{/snippet}

					{#each tag.eintraege as e, i (e.id)}
						{#if i === ersteNacht}{@render folgeNaechte()}{/if}
						{@const Sym = SYMBOL[e.typ]}
						{@const ef = fotosVonEintrag(e.id)}
						<div class="ein typ-{e.typ}" class:markiert={offen === e.id} id="e-{e.id}">
							<Wischzeile
								links={[
									{ text: 'Löschen', icon: Trash, gefahr: true, los: () => loeschen(e) },
									{ text: 'Details', icon: PencilSimple, los: () => bearbeiten(e) }
								]}
								rechts={{ text: 'Hinzufügen', icon: Plus, los: () => hinzufuegen(e, e.datum) }}
								onmenue={(x, y) => menue(e, e.datum, x, y)}
							>
								<button class="ein-knopf" onclick={() => getippt(e)} aria-expanded={offen === e.id}>
									<span class="sym"><Sym size={18} weight={e.typ === 'stay' ? 'fill' : 'regular'} /></span>
									<span class="ein-txt">
										<span class="ein-titel">{e.titel}</span>
										<span class="ein-meta zahl">
											{#if e.typ === 'stay' && e.bewertung}<Sterne wert={e.bewertung} groesse={12} />{/if}
											<span>{metaText(e)}</span>
										</span>
										{#if e.text}<span class="ein-text">{e.text}</span>{/if}
									</span>
								</button>
								{#if e.typ === 'stay'}{@render notizen(e, e.datum)}{/if}
								{#if ef.length}<div class="beim-eintrag">{@render fotoreihe(ef)}</div>{/if}
								{#if offen === e.id}{@render leiste(e, e.datum)}{/if}
							</Wischzeile>
						</div>
					{/each}
					{#if ersteNacht < 0}{@render folgeNaechte()}{/if}
				</li>
			{/each}
		</ol>

		{#if posten.length && !filter}
			{@const euro = wechselkurse.inEuro(gesamt)}
			{@const n = naechte(r.id)}
			<section class="kosten">
				<h4>Kosten</h4>
				<dl class="zahl">
					{#each posten as p (p.art)}
						<div><dt>{p.name}</dt><dd>{betragText(p.betraege)}</dd></div>
					{/each}
					<div class="summe">
						<dt>Zusammen</dt>
						<dd>{nurEuro(gesamt) ? betragText(gesamt) : euro !== null ? `≈ ${preisText(Math.round(euro), 'EUR')}` : betragText(gesamt)}</dd>
					</div>
				</dl>
				{#if n && euro !== null}
					<p>{nurEuro(gesamt) ? '' : '≈ '}{preisText(Math.round(euro / n), 'EUR')} pro Nacht{nurEuro(gesamt) ? '' : ' · umgerechnet mit aktuellen Kursen'}</p>
				{/if}
			</section>
		{/if}

		{#if weitere.length}
			<section class="weitere">
				<h4>Weitere Fotos</h4>
				<p>Aufgenommen außerhalb des Reisezeitraums</p>
				{@render fotoreihe(weitere)}
			</section>
		{/if}

		<button class="knopf neu" bind:this={untenKnopf} onclick={neuerEintrag}><Plus size={18} weight="bold" /> Eintrag hinzufügen</button>
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
	.reisenotiz {
		margin-top: 12px;
		line-height: 1.5;
	}
	.kennzahlen {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
		margin: 16px 0 4px;
	}
	.kennzahlen button {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 10px;
		border: 0;
		border-radius: var(--radius);
		background: var(--tief);
		color: var(--tief-text);
		text-align: left;
		transition:
			transform 0.15s,
			box-shadow 0.15s;
	}
	.kennzahlen .gelb {
		background: var(--signal);
		color: var(--signal-text);
	}
	.kennzahlen button.an {
		box-shadow:
			0 0 0 2px var(--flaeche),
			0 0 0 4px var(--text);
	}
	.kennzahlen button:active {
		transform: scale(0.96);
	}
	.filterzeile {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-top: 8px;
		height: 32px;
		padding: 0 12px;
		border: 0;
		border-radius: 16px;
		background: var(--text);
		color: var(--flaeche);
		font-size: 13px;
		font-weight: 600;
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
	.fotoreihe img {
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
	.fotos-leer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
		width: 100%;
		margin: 14px 0 6px;
		padding: 12px 14px;
		border: 1.5px dashed var(--linie);
		border-radius: var(--radius);
		background: none;
		color: var(--text);
		font-weight: 600;
		text-align: left;
	}
	.fotos-leer span {
		flex-basis: 100%;
		padding-left: 30px;
		color: var(--text-2);
		font-size: 13px;
		font-weight: 400;
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
	.fotoreihe {
		display: flex;
		gap: 4px;
	}
	.fotoreihe button {
		flex: none;
		width: 52px;
		height: 52px;
		padding: 0;
		border: 0;
		border-radius: 4px;
		overflow: hidden;
		background: var(--flaeche-2);
	}
	.lose,
	.beim-eintrag {
		position: relative;
		margin: 0 0 8px 48px;
	}
	/* lose Fotos des Tages: Zeitleisten-Strich läuft daneben weiter (wie bei .ein::before) */
	.lose::before {
		content: '';
		position: absolute;
		left: -31px;
		top: -8px;
		bottom: -8px;
		width: 2px;
		background: color-mix(in srgb, var(--rf) 35%, transparent);
	}
	.beim-eintrag {
		margin-top: -4px;
		padding-bottom: 6px;
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
		/* beim Hinspringen nicht unter der festen Kopfzeile landen */
		scroll-margin-top: 64px;
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
	.sym.klein {
		width: 26px;
		height: 26px;
		margin: 5px 0 0 5px;
		border-radius: 6px;
		border-width: 1.5px;
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
		font-weight: 620;
		font-size: 16px;
	}
	.folge .ein-titel {
		font-weight: 520;
		font-size: 15px;
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
	.ein-text {
		margin-top: 3px;
		font-size: 15px;
		line-height: 1.45;
		white-space: pre-line;
	}
	.notizen {
		position: relative;
		margin: -4px 0 8px 48px;
		padding: 0;
		list-style: none;
	}
	.notizen li {
		display: flex;
		flex-direction: column;
		gap: 1px;
		margin-bottom: 6px;
		padding: 6px 10px;
		border-left: 3px solid color-mix(in srgb, var(--rf) 60%, transparent);
		border-radius: 0 var(--radius) var(--radius) 0;
		background: var(--flaeche-2);
		font-size: 15px;
		line-height: 1.4;
		white-space: pre-line;
	}
	.notizen small {
		color: var(--text-2);
		font-size: 12px;
		font-weight: 600;
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
	.aktionen .los {
		border-color: var(--signal);
		background: var(--signal);
		color: var(--signal-text);
	}
	/* kleine runde Symbol-Knöpfe rechts (Foto, „…“) */
	.aktionen .rund-klein {
		justify-content: center;
		width: 36px;
		padding: 0;
		color: var(--text-2);
	}
	.aktionen .rund-klein:first-of-type,
	.aktionen .los + .rund-klein {
		margin-left: auto;
	}
	.geplant {
		margin-top: 14px;
		padding: 12px 0 4px;
		border-top: 1px solid var(--linie);
	}
	.geplant h4,
	.weitere h4 {
		margin: 0 0 6px;
		font-size: 12px;
		font-weight: 650;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-2);
	}
	.ziel {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 52px;
		padding: 6px 0;
		border: 0;
		border-bottom: 1px solid var(--linie);
		background: none;
		text-align: left;
	}
	.ziel .punkt {
		flex: none;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 2px solid var(--signal);
	}
	.z-txt {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.z-txt span {
		font-size: 13px;
		color: var(--text-2);
	}
	.ziel-neu {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 10px 0;
		border: 0;
		background: none;
		color: var(--text);
		font-weight: 600;
	}
	.wetter {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		margin-left: auto;
		letter-spacing: 0;
		color: var(--text);
		font-size: 13px;
	}
	.wetter small {
		color: var(--text-2);
		font-size: 12px;
	}
	.nahe .weit {
		margin-left: auto;
		color: var(--text-2);
		font-size: 13px;
	}
	.kosten {
		margin-top: 18px;
		padding-top: 14px;
		border-top: 1px solid var(--linie);
	}
	.kosten h4 {
		margin: 0 0 6px;
		font-size: 12px;
		font-weight: 650;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-2);
	}
	.kosten dl {
		margin: 0;
	}
	.kosten dl div {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 7px 0;
		border-bottom: 1px solid var(--linie);
	}
	.kosten dd {
		margin: 0;
		text-align: right;
	}
	.kosten .summe {
		border-bottom: 0;
		font-weight: 700;
	}
	.kosten p {
		margin: 0;
		color: var(--text-2);
		font-size: 13px;
	}
	.weitere {
		margin-top: 18px;
		padding-top: 14px;
		border-top: 1px solid var(--linie);
	}
	.weitere h4 {
		margin: 0;
		font-size: 12px;
		font-weight: 650;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-2);
	}
	.weitere p {
		margin: 2px 0 10px;
		color: var(--text-2);
		font-size: 13px;
	}
	.neu {
		width: 100%;
		margin-top: 18px;
	}
</style>
