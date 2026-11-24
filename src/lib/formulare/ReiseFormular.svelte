<!-- Reise anlegen oder bearbeiten. -->
<script lang="ts">
	import { goto } from '$app/navigation';
	import Check from 'phosphor-svelte/lib/Check';
	import Trash from 'phosphor-svelte/lib/Trash';
	import Dialog from '#lib/ui/Dialog.svelte';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { thema } from '#lib/thema.svelte.ts';
	import { reiseFarben } from '#lib/farben.ts';
	import { heute } from '#lib/datum.ts';
	import { fotosVon } from '#lib/auswertung.ts';
	import type { TabellenName } from '#lib/db/typen.ts';

	let { id }: { id?: string } = $props();

	// svelte-ignore state_referenced_locally
	const alt = daten.reise(id);
	// Neue Reise: nächste noch wenig benutzte Farbe
	const naechsteFarbe = () => {
		const zaehler = reiseFarben(false).map((_, i) => daten.reisen.filter((r) => r.farbe === i).length);
		return zaehler.indexOf(Math.min(...zaehler));
	};

	let titel = $state(alt?.titel ?? '');
	let start = $state(alt?.start ?? heute());
	let ende = $state(alt?.ende ?? '');
	let farbe = $state(alt?.farbe ?? naechsteFarbe());
	let notiz = $state(alt?.notiz ?? '');
	let titelbild = $state(alt?.titelbild);
	const fotos = $derived(alt ? fotosVon(alt.id) : []);

	const ok = $derived(titel.trim().length > 0 && !!start && (!ende || ende >= start));
	const zu = () => (ui.dialog = null);

	async function speichern() {
		if (!ok) return;
		const r = await daten.speichern('reisen', {
			...(alt ?? {}),
			titel: titel.trim(),
			start,
			ende: ende || undefined,
			farbe,
			notiz: notiz.trim() || undefined,
			titelbild
		});
		zu();
		if (!alt) goto(`#/reise/${r.id}`);
	}

	async function loeschen() {
		if (!alt) return;
		const teile: [TabellenName, string][] = [['reisen', alt.id]];
		for (const e of daten.eintraege) if (e.reise === alt.id) teile.push(['eintraege', e.id]);
		for (const f of daten.fotos) if (f.reise === alt.id) teile.push(['fotos', f.id]);
		const zurueck = await daten.loeschenAlle(teile);
		zu();
		goto('#/');
		ui.zeige(`Reise „${alt.titel}“ gelöscht`, zurueck);
	}
</script>

<Dialog titel={alt ? 'Reise bearbeiten' : 'Neue Reise'} onschliessen={zu} versteckt={!!ui.ortWahl}>
	<form
		id="reiseform"
		onsubmit={(e) => {
			e.preventDefault();
			speichern();
		}}
	>
		<label class="feld">
			<span class="name">Name der Reise</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input bind:value={titel} placeholder="z. B. Norwegen, Sommer am Gardasee" autofocus={!alt && ui.breit} maxlength="80" />
		</label>
		<div class="feldreihe">
			<label class="feld"><span class="name">Von</span><input type="date" bind:value={start} required /></label>
			<label class="feld"><span class="name">Bis</span><input type="date" bind:value={ende} min={start} /></label>
		</div>
		{#if !ende}<p class="hilfe">Ohne Enddatum gilt die Reise als „läuft noch“ – „Hier eintragen“ landet dann automatisch hier.</p>{/if}

		<div class="feld">
			<span class="name">Farbe auf der Karte</span>
			<div class="farben" role="radiogroup" aria-label="Farbe">
				{#each reiseFarben(thema.dunkel) as f, i (i)}
					<button type="button" role="radio" aria-checked={farbe === i} aria-label="Farbe {i + 1}" style:background={f} class:an={farbe === i} onclick={() => (farbe = i)}>
						{#if farbe === i}<Check size={18} weight="bold" />{/if}
					</button>
				{/each}
			</div>
		</div>

		{#if fotos.length}
			<div class="feld">
				<span class="name">Titelbild</span>
				<div class="titelbilder">
					{#each fotos as f (f.id)}
						<button type="button" class:an={titelbild === f.id} onclick={() => (titelbild = titelbild === f.id ? undefined : f.id)} aria-label="Als Titelbild">
							<img alt="" src={f.vorschau} loading="lazy" />
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<label class="feld">
			<span class="name">Notiz</span>
			<textarea bind:value={notiz} placeholder="Mit wem, warum, was war besonders?"></textarea>
		</label>
	</form>

	{#snippet fuss()}
		{#if alt}
			<button class="knopf gefahr fuss-links" onclick={loeschen}><Trash size={18} /> Löschen</button>
		{/if}
		<button class="knopf zweit" onclick={zu}>Abbrechen</button>
		<button class="knopf" type="submit" form="reiseform" disabled={!ok}>{alt ? 'Speichern' : 'Anlegen'}</button>
	{/snippet}
</Dialog>

<style>
	.hilfe {
		margin: -6px 0 16px;
		color: var(--text-2);
		font-size: 14px;
		line-height: 1.4;
	}
	.farben {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.farben button {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 0;
		border-radius: var(--radius);
		color: #fff;
	}
	:global([data-thema='dunkel']) .farben button {
		color: #111;
	}
	.farben button.an {
		box-shadow:
			0 0 0 2px var(--flaeche),
			0 0 0 4px var(--text);
	}
	.titelbilder {
		display: flex;
		gap: 6px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.titelbilder button {
		flex: none;
		width: 64px;
		height: 64px;
		padding: 0;
		border: 0;
		border-radius: var(--radius);
		overflow: hidden;
		opacity: 0.6;
	}
	.titelbilder button.an {
		opacity: 1;
		box-shadow:
			0 0 0 2px var(--flaeche),
			0 0 0 4px var(--text);
	}
	.titelbilder img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>
