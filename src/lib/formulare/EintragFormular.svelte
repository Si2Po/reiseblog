<!--
  Eintrag anlegen/bearbeiten. Je nach Art andere Felder:
  - Übernachtung: Ort, Platz (bekannte Plätze in der Nähe werden vorgeschlagen), Nächte, Preis, Bewertung
  - Fahrt: von → nach, Straßenroute wird im Hintergrund berechnet
  - Ausflug / Event: Ort und Text
  Selten Gebrauchtes (Ausstattung, privat) ist eingeklappt.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { slide } from 'svelte/transition';
	import Tent from 'phosphor-svelte/lib/Tent';
	import Van from 'phosphor-svelte/lib/Van';
	import Footprints from 'phosphor-svelte/lib/Footprints';
	import Ticket from 'phosphor-svelte/lib/Ticket';
	import Trash from 'phosphor-svelte/lib/Trash';
	import CaretDown from 'phosphor-svelte/lib/CaretDown';
	import Minus from 'phosphor-svelte/lib/Minus';
	import Plus from 'phosphor-svelte/lib/Plus';
	import ArrowsDownUp from 'phosphor-svelte/lib/ArrowsDownUp';
	import Dialog from '#lib/ui/Dialog.svelte';
	import SterneWahl from '#lib/ui/SterneWahl.svelte';
	import OrtFeld from './OrtFeld.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { heute, zahl, dauer } from '#lib/datum.ts';
	import { laufendeReise, reisenSortiert, plaetzeInDerNaehe, letzteUebernachtung, platzBewertung } from '#lib/auswertung.ts';
	import { routeNachtragen } from '#lib/geo/routen.ts';
	import { AUSSTATTUNG } from '#lib/ausstattung.ts';
	import { TYP_NAME, PLATZ_ART, type Eintrag, type Ort, type PlatzArt, type Typ } from '#lib/db/typen.ts';

	let { id, vorlage }: { id?: string; vorlage?: Partial<Eintrag> } = $props();

	// svelte-ignore state_referenced_locally
	const alt = daten.eintrag(id);
	// svelte-ignore state_referenced_locally
	const v: Partial<Eintrag> = { ...(vorlage ?? {}), ...(alt ?? {}) };
	const altPlatz = daten.platz(v.platz);
	const letzteWaehrung = [...daten.eintraege].reverse().find((e) => e.waehrung)?.waehrung;

	let reise = $state(v.reise ?? laufendeReise()?.id ?? reisenSortiert()[0]?.id ?? '');
	let typ = $state<Typ>(v.typ ?? 'stay');
	let titel = $state(v.titel ?? '');
	let datum = $state(v.datum ?? heute());
	let ort = $state<Ort | undefined>(v.ort);
	let text = $state(v.text ?? '');
	let privat = $state(v.privat ?? false);

	// Übernachtung
	let platzId = $state<string | undefined>(v.platz);
	let platzName = $state(altPlatz?.name ?? '');
	let platzArt = $state<PlatzArt>(altPlatz?.art ?? 'camping');
	let ausstattung = $state<string[]>(altPlatz?.ausstattung ? [...altPlatz.ausstattung] : []);
	let wiederkommen = $state(altPlatz?.wiederkommen ?? false);
	let naechte = $state(v.naechte ?? 1);
	let preis = $state<number | null>(v.preis ?? null);
	let waehrung = $state(v.waehrung ?? letzteWaehrung ?? 'EUR');
	let bewertung = $state(v.bewertung);
	let mehr = $state(false);

	// Fahrt
	const vorige = $derived(letzteUebernachtung(reise, datum));
	let von = $state<Ort | undefined>(v.von ?? (v.typ === 'drive' ? letzteUebernachtung(v.reise ?? '', v.datum ?? heute())?.ort : undefined));
	let nach = $state<Ort | undefined>(v.nach);
	let fahrtMit = $state(!alt);

	const reisen = reisenSortiert();
	const nahe = $derived(typ === 'stay' && ort ? plaetzeInDerNaehe(ort.lat, ort.lng) : []);
	// Ist die vorige Übernachtung derselbe Platz? Dann keine Fahrt anbieten.
	const fahrtSinnvoll = $derived(
		!alt && typ === 'stay' && !!vorige?.ort && !!ort && vorige.platz !== platzId && Math.abs(vorige.ort.lat - ort.lat) + Math.abs(vorige.ort.lng - ort.lng) > 0.005
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
			ausstattung = [...p.ausstattung];
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

	const umschalten = (k: string) => (ausstattung = ausstattung.includes(k) ? ausstattung.filter((x) => x !== k) : [...ausstattung, k]);

	async function speichern() {
		if (!ok) return;
		let platz: string | undefined;
		if (typ === 'stay') {
			const p = daten.platz(platzId);
			const name = platzName.trim() || ort?.name || 'Platz';
			if (p) {
				const geaendert = p.name !== name || p.art !== platzArt || p.wiederkommen !== wiederkommen || p.ausstattung.join() !== ausstattung.join();
				if (geaendert) await daten.speichern('plaetze', { ...p, name, art: platzArt, ausstattung, wiederkommen });
				platz = p.id;
			} else if (ort) {
				platz = (await daten.speichern('plaetze', { name, art: platzArt, ort, ausstattung, wiederkommen })).id;
			}
		}

		const gemeinsam = {
			reise,
			typ,
			titel: titel.trim() || autoTitel || TYP_NAME[typ],
			datum,
			zeit: alt?.zeit,
			text: text.trim() || undefined,
			privat: privat || undefined
		};
		let neu: Omit<Eintrag, 'id' | 'geaendert'> & { id?: string };
		if (typ === 'stay') neu = { ...gemeinsam, ort, platz, naechte, preis: preis ?? undefined, waehrung, bewertung };
		else if (typ === 'drive') {
			const gleich = alt?.von && alt?.nach && von && nach && alt.von.lat === von.lat && alt.von.lng === von.lng && alt.nach.lat === nach.lat && alt.nach.lng === nach.lng;
			neu = gleich
				? { ...gemeinsam, von, nach, via: alt!.via, route: alt!.route, km: alt!.km, minuten: alt!.minuten, routeOk: alt!.routeOk }
				: { ...gemeinsam, von, nach, routeOk: von && nach ? false : undefined };
		} else neu = { ...gemeinsam, ort };
		if (alt) neu.id = alt.id;

		const e = await daten.speichern('eintraege', neu);
		if (e.typ === 'drive' && e.routeOk === false) routeNachtragen(e.id);

		// Fahrt vom letzten Platz gleich mit anlegen
		if (typ === 'stay' && fahrtSinnvoll && fahrtMit && vorige?.ort && ort) {
			const f = await daten.speichern('eintraege', {
				reise,
				typ: 'drive',
				titel: `${vorige.ort.name ?? daten.platz(vorige.platz)?.name ?? 'Start'} → ${ort.name ?? platzName ?? 'Ziel'}`,
				datum,
				von: vorige.ort,
				nach: ort,
				routeOk: false
			});
			routeNachtragen(f.id);
		}

		zu();
		ui.markiert = e.id;
		if (!(page.route.id === '/reise/[id]' && page.params.id === reise)) goto(`#/reise/${reise}`);
		ui.zeige(alt ? 'Gespeichert' : `${TYP_NAME[typ]} eingetragen`);
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
				onclick={() => ([von, nach] = [nach, von])}
				aria-label="Start und Ziel tauschen"
				disabled={!von && !nach}><ArrowsDownUp size={18} /></button
			>
			<OrtFeld bind:ort={nach} name="Nach" />
			{#if alt?.km && alt.von === von && alt.nach === nach}
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
			<label class="feld"><span class="name">Datum</span><input type="date" bind:value={datum} required /></label>
			{#if typ === 'stay'}
				<div class="feld">
					<span class="name">Nächte</span>
					<div class="zaehler">
						<button type="button" onclick={() => (naechte = Math.max(1, naechte - 1))} aria-label="Weniger"><Minus size={16} /></button>
						<span class="zahl">{naechte}</span>
						<button type="button" onclick={() => naechte++} aria-label="Mehr"><Plus size={16} /></button>
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
		{/if}

		<label class="feld">
			<span class="name">{typ === 'stay' ? 'Wie war’s?' : 'Notiz'}</span>
			<textarea bind:value={text} placeholder={typ === 'stay' ? 'Lage, Nachbarn, Tipps …' : 'Was habt ihr erlebt?'}></textarea>
		</label>

		<button type="button" class="aufklapp" onclick={() => (mehr = !mehr)} aria-expanded={mehr}>
			<CaretDown size={16} style="transform: rotate({mehr ? 180 : 0}deg); transition: transform .2s" /> Mehr
		</button>
		{#if mehr}
			<div transition:slide={{ duration: 180 }}>
				{#if typ === 'stay'}
					<div class="feld">
						<span class="name">Art des Platzes</span>
						<div class="chips umbruch">
							{#each Object.entries(PLATZ_ART) as [k, name] (k)}
								<button type="button" class:an={platzArt === k} onclick={() => (platzArt = k as PlatzArt)}>{name}</button>
							{/each}
						</div>
					</div>
					<div class="feld">
						<span class="name">Ausstattung</span>
						<div class="chips umbruch">
							{#each AUSSTATTUNG as a (a.key)}
								<button type="button" class:an={ausstattung.includes(a.key)} onclick={() => umschalten(a.key)}><a.icon size={16} /> {a.name}</button>
							{/each}
						</div>
					</div>
				{/if}
				<label class="schalter">
					<span>Privat<small>Wird nie geteilt, auch nicht mit Freunden</small></span>
					<input type="checkbox" bind:checked={privat} />
				</label>
				{#if typ === 'stay'}
					<label class="feld">
						<span class="name">Eigener Titel</span>
						<input bind:value={titel} placeholder={autoTitel || 'sonst der Name des Platzes'} maxlength="100" />
					</label>
				{/if}
			</div>
		{/if}
	</form>

	{#snippet fuss()}
		{#if alt}
			<button class="knopf gefahr fuss-links" onclick={loeschen} aria-label="Löschen"><Trash size={18} /></button>
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
	.route {
		margin: -6px 0 16px;
		color: var(--text-2);
		font-size: 14px;
	}
	.chips.umbruch {
		flex-wrap: wrap;
	}
</style>
