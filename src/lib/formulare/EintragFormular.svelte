<!--
  Eintrag anlegen/bearbeiten. Je nach Art andere Felder:
  - Übernachtung: Ort, Platz (bekannte Plätze in der Nähe werden vorgeschlagen), Nächte, Preis, Bewertung,
    Notizen mit Zeitpunkt (eine pro Erlebnis/Nacht)
  - Fahrt: von → nach, Straßenroute wird im Hintergrund berechnet
  - Ausflug / Event: Ort und Text
  Selten Gebrauchtes (Merkmale aus dem Katalog, Links, eigener Titel) ist unter „Mehr“.
  Liegt das Datum außerhalb der Reise, wird der Reisezeitraum automatisch erweitert.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { format, addDays, parseISO } from 'date-fns';
	import { page } from '$app/state';
	import { slide } from 'svelte/transition';
	import Tent from 'phosphor-svelte/lib/Tent';
	import Van from 'phosphor-svelte/lib/Van';
	import Footprints from 'phosphor-svelte/lib/Footprints';
	import Ticket from 'phosphor-svelte/lib/Ticket';
	import Trash from 'phosphor-svelte/lib/Trash';
	import X from 'phosphor-svelte/lib/X';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import Minus from 'phosphor-svelte/lib/Minus';
	import Plus from 'phosphor-svelte/lib/Plus';
	import ArrowsDownUp from 'phosphor-svelte/lib/ArrowsDownUp';
	import Dialog from '#lib/ui/Dialog.svelte';
	import SterneWahl from '#lib/ui/SterneWahl.svelte';
	import OrtFeld from './OrtFeld.svelte';
	import MerkmalFelder from './MerkmalFelder.svelte';
	import LinkFeld from './LinkFeld.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { heute, zahl, dauer, notizZeit } from '#lib/datum.ts';
	import { laufendeReise, reisenSortiert, plaetzeInDerNaehe, letzteUebernachtung, platzBewertung, eintraegeVon } from '#lib/auswertung.ts';
	import { routeNachtragen, viaEinfuegen } from '#lib/geo/routen.ts';
	import { offeneFahrt, naechteBis } from '#lib/unterwegs.ts';
	import { koordText } from '#lib/geo.ts';
	import { aufraeumen } from '#lib/merkmale.ts';
	import { TYP_NAME, PLATZ_ART, type Eintrag, type Merkmale, type Notiz, type Ort, type PlatzArt, type Typ } from '#lib/db/typen.ts';

	let { id, vorlage }: { id?: string; vorlage?: Partial<Eintrag> } = $props();

	// svelte-ignore state_referenced_locally
	const alt = daten.eintrag(id);
	// svelte-ignore state_referenced_locally
	const v: Partial<Eintrag> = { ...(vorlage ?? {}), ...(alt ?? {}) };
	const altPlatz = daten.platz(v.platz);

	let reise = $state(v.reise ?? laufendeReise()?.id ?? reisenSortiert()[0]?.id ?? '');
	let typ = $state<Typ>(v.typ ?? 'stay');
	let titel = $state(v.titel ?? '');
	let datum = $state(v.datum ?? heute());
	let ort = $state<Ort | undefined>(v.ort);
	let text = $state(v.text ?? '');
	let merkmale = $state<Merkmale>({ ...(v.merkmale ?? {}) });

	// Übernachtung
	let platzId = $state<string | undefined>(v.platz);
	let platzName = $state(altPlatz?.name ?? '');
	let platzArt = $state<PlatzArt>(altPlatz?.art ?? 'camping');
	let platzMerkmale = $state<Merkmale>({ ...(altPlatz?.merkmale ?? {}) });
	let platzLinks = $state<string[]>([...(altPlatz?.links ?? [])]);
	let wiederkommen = $state(altPlatz?.wiederkommen ?? false);
	let naechte = $state(v.naechte ?? 1);
	let preis = $state<number | null>(v.preis ?? null);
	// Währung: zuletzt benutzte in DIESER Reise, sonst Euro (Beispieldaten zählen nicht)
	const waehrungDerReise = (r: string) =>
		[...eintraegeVon(r)].reverse().find((e) => e.waehrung && !e.id.startsWith('bsp-'))?.waehrung;
	let waehrung = $state(v.waehrung ?? waehrungDerReise(v.reise ?? '') ?? 'EUR');
	let bewertung = $state(v.bewertung);
	let notizen = $state<Notiz[]>([...(v.notizen ?? [])]);
	let neueNotiz = $state('');
	let mehr = $state(false);

	// Fahrt
	const vorige = $derived(letzteUebernachtung(reise, datum));
	let von = $state<Ort | undefined>(v.von ?? (v.typ === 'drive' ? letzteUebernachtung(v.reise ?? '', v.datum ?? heute())?.ort : undefined));
	let nach = $state<Ort | undefined>(v.nach);
	// Zwischenziele („über Ravensburg“) – werden an der Stelle mit dem kleinsten Umweg eingefügt
	let via = $state<Ort[]>([...(v.via ?? [])]);
	let neuVia = $state<Ort | undefined>();
	let viaOffen = $state(false);
	function viaHinzu(o: Ort) {
		const i = via.findIndex((x) => x.lat === o.lat && x.lng === o.lng);
		if (i >= 0) via[i] = o; // Ortsname kam nach
		else via = von && nach ? viaEinfuegen(von, via, nach, o) : [...via, o];
		neuVia = undefined;
		viaOffen = false;
	}
	let fahrtMit = $state(!alt);

	const reisen = reisenSortiert();
	const nahe = $derived(typ === 'stay' && ort ? plaetzeInDerNaehe(ort.lat, ort.lng) : []);
	// Läuft gerade eine Fahrt („Weiterfahren“)? Dann endet sie hier – keine zweite Fahrt anlegen.
	const offen = $derived(!alt && typ === 'stay' ? offeneFahrt(reise) : undefined);
	// Ist die vorige Übernachtung derselbe Platz? Dann keine Fahrt anbieten.
	const fahrtSinnvoll = $derived(
		!alt && !offen && typ === 'stay' && !!vorige?.ort && !!ort && vorige.platz !== platzId && Math.abs(vorige.ort.lat - ort.lat) + Math.abs(vorige.ort.lng - ort.lng) > 0.005
	);

	const autoTitel = $derived(
		typ === 'stay'
			? platzName || ort?.name || ''
			: typ === 'drive'
				? von || nach
					? `${von?.name ?? 'Start'} → ${nach?.name ?? 'Ziel'}`
					: ''
				: ort?.name ?? ''
	);

	const ok = $derived(!!reise && !!datum && (typ !== 'drive' || (!!von && !!nach) || !!titel.trim()));
	const zu = () => (ui.dialog = null);

	function platzWaehlen(pid: string | undefined) {
		platzId = pid;
		const p = daten.platz(pid);
		if (p) {
			platzName = p.name;
			platzArt = p.art;
			platzMerkmale = { ...p.merkmale };
			platzLinks = [...p.links];
			wiederkommen = !!p.wiederkommen;
		}
	}

	function ortGewaehlt(o: Ort) {
		if (typ === 'stay' && !platzId) {
			const kandidat = plaetzeInDerNaehe(o.lat, o.lng)[0];
			if (kandidat) platzWaehlen(kandidat.id);
			else if (!platzName && o.name) platzName = o.name;
		}
	}

	/** Zeitpunkt für eine neue Notiz: jetzt, wenn heute zur Übernachtung gehört, sonst Abend des ersten Tages */
	function notizZeitpunkt(): string {
		const jetzt = new Date();
		const tag = format(jetzt, 'yyyy-MM-dd');
		const bis = format(addDays(parseISO(datum), naechte), 'yyyy-MM-dd');
		return tag >= datum && tag <= bis ? format(jetzt, "yyyy-MM-dd'T'HH:mm") : `${datum}T20:00`;
	}

	async function speichern() {
		if (!ok) return;
		// vor dem Speichern merken – danach ist die neue Übernachtung selbst „die letzte“
		const start = typ === 'stay' && fahrtSinnvoll && fahrtMit ? vorige : undefined;
		const voriger = !alt && typ === 'stay' && vorige && vorige.datum < datum ? vorige : undefined;
		const laufend = offen;
		// heutige Einträge bekommen die Uhrzeit, damit die Reihenfolge am Tag stimmt
		// (bei geändertem Datum gilt die alte Uhrzeit nicht mehr)
		const zeit = alt && alt.datum === datum ? alt.zeit : datum === heute() ? format(new Date(), 'HH:mm:ss') : undefined;
		let platz: string | undefined;
		if (typ === 'stay') {
			const p = daten.platz(platzId);
			const name = platzName.trim() || ort?.name || 'Platz';
			const pm = aufraeumen(platzMerkmale) ?? {};
			if (p) {
				const neu = { ...p, name, art: platzArt, wiederkommen, merkmale: pm, links: platzLinks };
				if (JSON.stringify([p.name, p.art, !!p.wiederkommen, p.merkmale, p.links]) !== JSON.stringify([name, platzArt, wiederkommen, pm, platzLinks]))
					await daten.speichern('plaetze', neu);
				platz = p.id;
			} else if (ort) {
				platz = (await daten.speichern('plaetze', { name, art: platzArt, ort, merkmale: pm, links: platzLinks, wiederkommen })).id;
			}
		}

		const gemeinsam = { reise, typ, titel: titel.trim() || autoTitel || TYP_NAME[typ], datum, zeit, merkmale: aufraeumen(merkmale) };
		let neu: Omit<Eintrag, 'id' | 'geaendert'> & { id?: string };
		if (typ === 'stay') {
			const alle = neueNotiz.trim() ? [...notizen, { id: crypto.randomUUID(), zeit: notizZeitpunkt(), text: neueNotiz.trim() }] : notizen;
			neu = { ...gemeinsam, ort, platz, naechte, preis: preis ?? undefined, waehrung, bewertung, notizen: alle.length ? alle : undefined };
		} else if (typ === 'drive') {
			// Strecke unverändert (gleiche Punkte)? Dann die berechnete Route behalten.
			const punkte = (liste: (Ort | undefined)[]) => JSON.stringify(liste.map((o) => (o ? [o.lat, o.lng] : null)));
			const gleich = !!alt?.von && !!alt?.nach && punkte([alt.von, ...(alt.via ?? []), alt.nach]) === punkte([von, ...via, nach]);
			const zw = via.length ? via : undefined;
			neu = gleich
				? { ...gemeinsam, text: text.trim() || undefined, von, nach, via: zw, route: alt!.route, km: alt!.km, minuten: alt!.minuten, routeOk: alt!.routeOk }
				: { ...gemeinsam, text: text.trim() || undefined, von, nach, via: zw, routeOk: von && nach ? false : undefined };
		} else neu = { ...gemeinsam, text: text.trim() || undefined, ort };
		if (alt) neu.id = alt.id;

		const e = await daten.speichern('eintraege', neu);
		if (e.typ === 'drive' && e.routeOk === false) routeNachtragen(e.id);

		// Fahrt vom letzten Platz gleich mit anlegen
		if (start?.ort && ort) {
			const f = await daten.speichern('eintraege', {
				reise,
				typ: 'drive',
				titel: `${start.ort.name ?? daten.platz(start.platz)?.name ?? 'Start'} → ${ort.name ?? (platzName || 'Ziel')}`,
				datum,
				zeit,
				von: start.ort,
				nach: ort,
				routeOk: false
			});
			routeNachtragen(f.id);
		}

		// Offene Fahrt („Weiterfahren“) endet hier
		if (laufend && ort) {
			const ziel = ort.name ?? (platzName || 'Ziel');
			const f = await daten.speichern('eintraege', { ...laufend, nach: ort, titel: laufend.titel.replace(/→ …$/, `→ ${ziel}`), routeOk: false });
			routeNachtragen(f.id);
		}

		// Nächte der vorigen Übernachtung automatisch passend setzen (man weiß vorher oft nicht, wie lange man bleibt)
		const naechteAngepasst = voriger ? await naechteBis(voriger, datum) : false;

		const angepasst = await reisezeitraumAnpassen();
		zu();
		ui.markiert = e.id;
		if (!(page.route.id === '/reise/[id]' && page.params.id === reise)) goto(`#/reise/${reise}`);
		const zusatz = [
			angepasst ? 'Reisezeitraum angepasst' : '',
			naechteAngepasst ? `${voriger!.titel}: jetzt ${daten.eintrag(voriger!.id)?.naechte} Nächte` : ''
		].filter(Boolean);
		ui.zeige([alt ? 'Gespeichert' : `${TYP_NAME[typ]} eingetragen`, ...zusatz].join(' · '));
	}

	/** Eintrag vor dem Start oder nach dem Ende? Dann die Reise entsprechend verlängern. */
	async function reisezeitraumAnpassen(): Promise<boolean> {
		const r = daten.reise(reise);
		if (!r) return false;
		const letzter = typ === 'stay' ? format(addDays(parseISO(datum), naechte), 'yyyy-MM-dd') : datum;
		const start = datum < r.start ? datum : r.start;
		const ende = r.ende && letzter > r.ende ? letzter : r.ende;
		if (start === r.start && ende === r.ende) return false;
		await daten.speichern('reisen', { ...r, start, ende });
		return true;
	}

	async function loeschen() {
		if (!alt) return;
		const zurueck = await daten.loeschen('eintraege', alt.id);
		zu();
		ui.zeige(`„${alt.titel}“ gelöscht`, zurueck);
	}

	const TYPEN: { t: Typ; icon: typeof Tent }[] = [
		{ t: 'stay', icon: Tent },
		{ t: 'drive', icon: Van },
		{ t: 'outing', icon: Footprints },
		{ t: 'event', icon: Ticket }
	];
	const WAEHRUNGEN = ['EUR', 'CHF', 'NOK', 'SEK', 'DKK', 'GBP', 'CZK', 'PLN', 'HUF'];
</script>

<Dialog titel={alt ? `${TYP_NAME[typ]} bearbeiten` : 'Neuer Eintrag'} onschliessen={zu} versteckt={!!ui.ortWahl}>
	<form
		id="eintragform"
		onsubmit={(e) => {
			e.preventDefault();
			speichern();
		}}
	>
		<div class="wahl-typ" role="radiogroup" aria-label="Art">
			{#each TYPEN as x (x.t)}
				<button type="button" role="radio" aria-checked={typ === x.t} class:an={typ === x.t} onclick={() => (typ = x.t)}>
					<x.icon size={22} weight={typ === x.t ? 'fill' : 'regular'} />
					{TYP_NAME[x.t]}
				</button>
			{/each}
		</div>

		{#if reisen.length > 1}
			<label class="feld">
				<span class="name">Reise</span>
				<select bind:value={reise}>
					{#each reisen as r (r.id)}<option value={r.id}>{r.titel} ({r.start.slice(0, 4)})</option>{/each}
				</select>
			</label>
		{/if}

		{#if typ === 'drive'}
			<OrtFeld bind:ort={von} name="Von" />
			<button
				type="button"
				class="tauschen"
				onclick={() => {
					[von, nach] = [nach, von];
					via = [...via].reverse();
				}}
				aria-label="Start und Ziel tauschen"
				disabled={!von && !nach}><ArrowsDownUp size={18} /></button
			>
			{#if via.length}
				<div class="feld">
					<span class="name">Über</span>
					{#each via as o, i (o.lat + ',' + o.lng)}
						<div class="via">
							<span class="via-nr zahl">{i + 1}</span>
							<span class="via-txt"><b>{o.name ?? 'Punkt auf der Karte'}</b><span class="zahl">{koordText(o)}</span></span>
							<button type="button" class="rund" onclick={() => (via = via.filter((_, j) => j !== i))} aria-label="Zwischenziel entfernen"><X size={14} /></button>
						</div>
					{/each}
				</div>
			{/if}
			{#if viaOffen}
				<OrtFeld bind:ort={neuVia} name="Über … (Zwischenziel)" onwahl={viaHinzu} />
			{:else}
				<button type="button" class="via-neu" onclick={() => (viaOffen = true)}><Plus size={16} /> Über … (Zwischenziel)</button>
			{/if}
			<OrtFeld bind:ort={nach} name="Nach" />
			{#if alt?.km && alt.von === von && alt.nach === nach && JSON.stringify(alt.via ?? []) === JSON.stringify(via)}
				<p class="route zahl">Straßenroute: {zahl(alt.km)} km · {dauer(alt.minuten ?? 0)}</p>
			{:else if von && nach}
				<p class="route">Die Straßenroute wird nach dem Speichern berechnet.</p>
			{/if}
		{:else}
			<OrtFeld bind:ort name={typ === 'stay' ? 'Wo übernachtet ihr?' : 'Wo?'} onwahl={ortGewaehlt} />
		{/if}

		{#if typ === 'stay' && nahe.length}
			<div class="feld" transition:slide={{ duration: 160 }}>
				<span class="name">Warst du hier schon?</span>
				<div class="chips">
					{#each nahe as p (p.id)}
						<button type="button" class:an={platzId === p.id} onclick={() => platzWaehlen(p.id)}>{p.name}{platzBewertung(p.id) ? ` · ${platzBewertung(p.id).toLocaleString('de-DE', { maximumFractionDigits: 1 })}★` : ''}</button>
					{/each}
					<button type="button" class:an={!platzId} onclick={() => platzWaehlen(undefined)}>Neuer Platz</button>
				</div>
			</div>
		{/if}

		{#if typ === 'stay'}
			<label class="feld">
				<span class="name">Name des Platzes</span>
				<input bind:value={platzName} placeholder={ort?.name ?? 'z. B. Camping am See'} maxlength="80" />
			</label>
		{:else}
			<label class="feld">
				<span class="name">Titel</span>
				<input bind:value={titel} placeholder={autoTitel || (typ === 'outing' ? 'z. B. Wanderung zum Gipfel' : typ === 'event' ? 'z. B. Weinfest' : 'z. B. Über den Pass')} maxlength="100" />
			</label>
		{/if}

		<div class="feldreihe">
			<label class="feld"><span class="name">{typ === 'stay' ? 'Erste Nacht' : 'Datum'}</span><input type="date" bind:value={datum} required /></label>
			{#if typ === 'stay'}
				<div class="feld">
					<span class="name">Nächte</span>
					<div class="zaehler">
						<button type="button" onclick={() => (naechte = Math.max(1, naechte - 1))} aria-label="Eine Nacht weniger"><Minus size={16} /></button>
						<span class="zahl">{naechte}</span>
						<button type="button" onclick={() => naechte++} aria-label="Eine Nacht mehr"><Plus size={16} /></button>
					</div>
				</div>
			{/if}
		</div>

		{#if typ === 'stay'}
			<div class="feldreihe">
				<label class="feld">
					<span class="name">Preis pro Nacht</span>
					<input type="number" inputmode="decimal" min="0" step="0.5" bind:value={preis} placeholder="0 = gratis" />
				</label>
				<label class="feld klein">
					<span class="name">Währung</span>
					<select bind:value={waehrung}>
						{#each WAEHRUNGEN as w (w)}<option value={w}>{w}</option>{/each}
					</select>
				</label>
			</div>
			<div class="feld">
				<span class="name">Bewertung</span>
				<SterneWahl bind:wert={bewertung} />
			</div>
			<label class="schalter">
				<span>Gern wieder<small>Platz für später merken</small></span>
				<input type="checkbox" bind:checked={wiederkommen} />
			</label>
			{#if fahrtSinnvoll}
				<label class="schalter">
					<span>Fahrt vom letzten Platz eintragen<small>{vorige?.titel} → hier, mit Straßenroute</small></span>
					<input type="checkbox" bind:checked={fahrtMit} />
				</label>
			{/if}
			{#if offen}
				<p class="info">Die Fahrt „{offen.titel}“ endet hier – die Straßenroute wird berechnet.</p>
			{/if}

			<div class="feld">
				<span class="name">Notizen</span>
				{#each notizen as n (n.id)}
					<div class="notiz">
						<span class="ntxt"><small>{notizZeit(n.zeit)}</small>{n.text}</span>
						<button type="button" class="rund" onclick={() => (notizen = notizen.filter((x) => x.id !== n.id))} aria-label="Notiz löschen"><X size={14} /></button>
					</div>
				{/each}
				<textarea bind:value={neueNotiz} placeholder={notizen.length ? 'Neue Notiz, z. B. zur zweiten Nacht …' : 'Wie war’s? Lage, Nachbarn, Tipps …'}></textarea>
			</div>
		{:else}
			<label class="feld">
				<span class="name">Notiz</span>
				<textarea bind:value={text} placeholder="Was habt ihr erlebt?"></textarea>
			</label>
		{/if}

		<button type="button" class="aufklapp" onclick={() => (mehr = !mehr)} aria-expanded={mehr}>
			<CaretDown size={16} style="transform: rotate({mehr ? 180 : 0}deg); transition: transform .2s" /> Mehr
		</button>
		{#if mehr}
			<div transition:slide={{ duration: 180 }}>
				{#if typ === 'stay'}
					<MerkmalFelder bezug="stay" bind:werte={merkmale} />
					<div class="feld">
						<span class="name">Art des Platzes</span>
						<div class="chips umbruch">
							{#each Object.entries(PLATZ_ART) as [k, name] (k)}
								<button type="button" class:an={platzArt === k} onclick={() => (platzArt = k as PlatzArt)}>{name}</button>
							{/each}
						</div>
					</div>
					<MerkmalFelder bezug="platz" bind:werte={platzMerkmale} />
					<LinkFeld bind:links={platzLinks} />
					<label class="feld">
						<span class="name">Eigener Titel</span>
						<input bind:value={titel} placeholder={autoTitel || 'sonst der Name des Platzes'} maxlength="100" />
					</label>
				{:else}
					<MerkmalFelder bezug={typ} bind:werte={merkmale} />
					<p class="leer klein">Hier gibt es noch keine weiteren Merkmale.</p>
				{/if}
			</div>
		{/if}
	</form>

	{#snippet fuss()}
		{#if alt}
			<button class="knopf gefahr fuss-links" onclick={loeschen} aria-label="Löschen"><Trash size={20} /></button>
		{/if}
		<button class="knopf zweit" onclick={zu}>Abbrechen</button>
		<button class="knopf" type="submit" form="eintragform" disabled={!ok}>{alt ? 'Speichern' : 'Eintragen'}</button>
	{/snippet}
</Dialog>

<style>
	.feld.klein {
		flex: 0 0 110px;
	}
	.zaehler {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 46px;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
	}
	.zaehler button {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: 0;
		background: none;
	}
	.zaehler span {
		font-size: 18px;
		font-weight: 650;
	}
	.tauschen {
		display: grid;
		place-items: center;
		width: 40px;
		height: 32px;
		margin: -10px 0 4px auto;
		border: 1px solid var(--linie);
		border-radius: 16px;
		background: var(--flaeche);
	}
	.via {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 8px 8px 10px;
		border-radius: var(--radius);
		background: var(--flaeche-2);
	}
	.via-nr {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--signal);
		color: var(--signal-text);
		font-size: 13px;
		font-weight: 700;
	}
	.via-txt {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.via-txt span {
		color: var(--text-2);
		font-size: 12px;
	}
	.via .rund {
		width: 30px;
		height: 30px;
	}
	.via-neu {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: -6px 0 14px;
		padding: 6px 0;
		border: 0;
		background: none;
		color: var(--text);
		font-weight: 600;
	}
	.route {
		margin: -6px 0 16px;
		color: var(--text-2);
		font-size: 14px;
	}
	.info {
		margin: 0 0 14px;
		padding: 10px 12px;
		border-radius: var(--radius);
		background: var(--flaeche-2);
		font-size: 14px;
		line-height: 1.4;
	}
	.chips.umbruch {
		flex-wrap: wrap;
	}
	.notiz {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		padding: 10px 8px 10px 12px;
		border-radius: var(--radius);
		background: var(--flaeche-2);
	}
	.ntxt {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		white-space: pre-line;
		line-height: 1.4;
	}
	.ntxt small {
		color: var(--text-2);
		font-size: 12px;
		font-weight: 600;
	}
	.notiz .rund {
		flex: none;
		width: 30px;
		height: 30px;
	}
	.leer.klein {
		padding: 4px 0 12px;
		text-align: left;
		font-size: 14px;
	}
</style>
