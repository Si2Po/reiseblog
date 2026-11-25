<!--
  Ziel auf der Merkliste anlegen/bearbeiten: Stellplatz, Stadt, Sehenswürdigkeit, Natur, Essen …
  Optional für eine bestimmte Reise vorgemerkt. „Hier gewesen“ macht daraus einen Eintrag.
-->
<script lang="ts">
	import Trash from 'phosphor-svelte/lib/Trash';
	import NavigationArrow from 'phosphor-svelte/lib/NavigationArrow';
	import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
	import Dialog from '#lib/ui/Dialog.svelte';
	import OrtFeld from './OrtFeld.svelte';
	import LinkFeld from './LinkFeld.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { reisenSortiert, laufendeReise } from '#lib/auswertung.ts';
	import { heute } from '#lib/datum.ts';
	import { ZIEL_ART, type Ort, type Ziel, type ZielArt } from '#lib/db/typen.ts';

	let { id, vorlage }: { id?: string; vorlage?: Partial<Ziel> } = $props();
	// svelte-ignore state_referenced_locally
	const alt = daten.ziel(id);
	// svelte-ignore state_referenced_locally
	const v: Partial<Ziel> = { ...(vorlage ?? {}), ...(alt ?? {}) };

	let name = $state(v.name ?? v.ort?.name ?? '');
	let art = $state<ZielArt>(v.art ?? 'sehenswert');
	let ort = $state<Ort | undefined>(v.ort);
	let reise = $state(v.reise ?? '');
	let notiz = $state(v.notiz ?? '');
	let links = $state<string[]>([...(v.links ?? [])]);

	// Geplante Reisen zuerst (Start heute oder später), dann die übrigen
	const h = heute();
	const reisen = reisenSortiert().filter((r) => !r.id.startsWith('bsp-') || r.id === reise);
	const geplant = reisen.filter((r) => r.start >= h || r.id === laufendeReise()?.id);
	const fruehere = reisen.filter((r) => !geplant.includes(r));

	const ok = $derived(name.trim().length > 0 && !!ort);
	const zu = () => (ui.dialog = null);

	function ortGewaehlt(o: Ort) {
		if (!name.trim() && o.name) name = o.name;
	}

	async function speichern() {
		if (!ok) return;
		await daten.speichern('ziele', {
			...(alt ?? {}),
			name: name.trim(),
			art,
			ort: ort!,
			reise: reise || undefined,
			notiz: notiz.trim() || undefined,
			links
		});
		zu();
		ui.zeige(alt ? 'Gespeichert' : `„${name.trim()}“ gemerkt`);
	}

	async function loeschen() {
		if (!alt) return;
		const zurueck = await daten.loeschen('ziele', alt.id);
		zu();
		ui.zeige(`„${alt.name}“ von der Merkliste entfernt`, zurueck);
	}

	/** Dort gewesen: als erledigt markieren und gleich einen Eintrag anlegen */
	async function hierGewesen() {
		if (!alt || !ort) return;
		await daten.speichern('ziele', { ...alt, erledigt: h });
		const r = daten.reise(reise) ?? laufendeReise() ?? reisenSortiert()[0];
		ui.dialog = {
			art: 'eintrag',
			vorlage: { reise: r?.id, typ: art === 'stellplatz' ? 'stay' : 'outing', titel: art === 'stellplatz' ? undefined : name.trim(), ort, datum: h }
		};
	}
</script>

<Dialog titel={alt ? 'Ziel' : 'Ziel merken'} onschliessen={zu} versteckt={!!ui.ortWahl}>
	<form
		id="zielform"
		onsubmit={(e) => {
			e.preventDefault();
			speichern();
		}}
	>
		<OrtFeld bind:ort name="Wo?" onwahl={ortGewaehlt} />
		<label class="feld"><span class="name">Name</span><input bind:value={name} placeholder="z. B. Deutsches Museum" maxlength="80" /></label>
		<div class="feld">
			<span class="name">Was ist es?</span>
			<div class="chips umbruch">
				{#each Object.entries(ZIEL_ART) as [k, n] (k)}
					<button type="button" class:an={art === k} onclick={() => (art = k as ZielArt)}>{n}</button>
				{/each}
			</div>
		</div>
		<label class="feld">
			<span class="name">Für welche Reise?</span>
			<select bind:value={reise}>
				<option value="">Irgendwann</option>
				{#if geplant.length}
					<optgroup label="Geplant / läuft">
						{#each geplant as r (r.id)}<option value={r.id}>{r.titel} ({r.start.slice(0, 4)})</option>{/each}
					</optgroup>
				{/if}
				{#if fruehere.length}
					<optgroup label="Frühere Reisen">
						{#each fruehere as r (r.id)}<option value={r.id}>{r.titel} ({r.start.slice(0, 4)})</option>{/each}
					</optgroup>
				{/if}
			</select>
		</label>
		<LinkFeld bind:links />
		<label class="feld"><span class="name">Notiz</span><textarea bind:value={notiz} placeholder="Öffnungszeiten, Tipp von Freunden, Parken …"></textarea></label>

		{#if alt}
			<div class="aktionen">
				<a class="knopf zweit" href="https://maps.apple.com/?daddr={alt.ort.lat},{alt.ort.lng}" target="_blank" rel="noopener"
					><NavigationArrow size={18} weight="fill" /> Route</a
				>
				{#if !alt.erledigt}
					<button type="button" class="knopf zweit" onclick={hierGewesen}><CheckCircle size={18} weight="fill" /> Hier gewesen</button>
				{:else}
					<span class="erledigt"><CheckCircle size={16} weight="fill" /> Erledigt</span>
				{/if}
			</div>
		{/if}
	</form>

	{#snippet fuss()}
		{#if alt}<button class="knopf gefahr fuss-links" onclick={loeschen} aria-label="Ziel löschen"><Trash size={20} /></button>{/if}
		<button class="knopf zweit" onclick={zu}>Abbrechen</button>
		<button class="knopf" type="submit" form="zielform" disabled={!ok}>{alt ? 'Speichern' : 'Merken'}</button>
	{/snippet}
</Dialog>

<style>
	.chips.umbruch {
		flex-wrap: wrap;
	}
	.aktionen {
		display: flex;
		gap: 8px;
		margin-top: 4px;
	}
	.aktionen .knopf {
		flex: 1;
	}
	.erledigt {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		color: var(--stern);
		font-weight: 600;
	}
</style>
