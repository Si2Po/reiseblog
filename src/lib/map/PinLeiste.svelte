<!--
  Leiste unter der Stecknadel nach langem Drücken auf die Karte:
  Ortsname + „Übernachtung · Ausflug · Fahrt hierher“ → passendes Formular, schon ausgefüllt.
-->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import Tent from 'phosphor-svelte/lib/Tent';
	import Footprints from 'phosphor-svelte/lib/Footprints';
	import Van from 'phosphor-svelte/lib/Van';
	import X from 'phosphor-svelte/lib/X';
	import Path from 'phosphor-svelte/lib/Path';
	import Flag from 'phosphor-svelte/lib/Flag';
	import { fahrtUeber } from '#lib/geo/routen.ts';
	import { ui } from '#lib/ui.svelte.ts';
	import { daten } from '#lib/db/daten.svelte.ts';
	import { koordText } from '#lib/geo.ts';
	import { ortsname } from '#lib/geo/dienste.ts';
	import { vorschlagReise, reiseBis, letzteUebernachtung, plaetzeInDerNaehe } from '#lib/auswertung.ts';
	import { heute } from '#lib/datum.ts';
	import type { Typ } from '#lib/db/typen.ts';

	// Ortsname nachladen, sobald eine neue Nadel steht
	$effect(() => {
		const p = ui.pin;
		if (!p || p.name) return;
		ortsname(p.lat, p.lng).then((n) => {
			if (ui.pin && ui.pin.lat === p.lat && ui.pin.lng === p.lng) ui.pin = { ...ui.pin, ...n };
		});
	});

	const bekannt = $derived(ui.pin ? plaetzeInDerNaehe(ui.pin.lat, ui.pin.lng)[0] : undefined);
	// Ist gerade eine Fahrt angetippt? Dann kann der Punkt als Zwischenziel dienen.
	const fahrt = $derived.by(() => {
		const e = daten.eintrag(ui.markiert ?? undefined);
		return e?.typ === 'drive' && e.von && e.nach ? e : undefined;
	});

	async function ueberHier() {
		const p = ui.pin;
		if (!p || !fahrt) return;
		const name = p.name ?? 'diesen Punkt';
		ui.pin = null;
		ui.zeige(`Route wird über ${name} neu berechnet …`);
		const ok = await fahrtUeber(fahrt.id, { lat: p.lat, lng: p.lng, name: p.name, land: p.land, landCode: p.landCode });
		ui.zeige(ok ? `Route führt jetzt über ${name}` : 'Route wird berechnet, sobald wieder Netz da ist');
	}

	function merken() {
		const p = ui.pin;
		if (!p) return;
		ui.pin = null;
		// auf der Seite einer (geplanten) Reise gleich dieser zuordnen
		ui.dialog = { art: 'ziel', vorlage: { ort: { lat: p.lat, lng: p.lng, name: p.name, land: p.land, landCode: p.landCode }, reise: ui.auswahl ?? undefined } };
	}

	function weiter(typ: Typ) {
		const p = ui.pin;
		if (!p) return;
		// Reise: die gerade angezeigte, sonst die laufende, sonst die neueste
		const r = daten.reise(ui.auswahl ?? undefined) ?? vorschlagReise();
		if (!r) {
			ui.pin = null;
			ui.dialog = { art: 'reise' };
			ui.zeige('Leg zuerst eine Reise an');
			return;
		}
		// Datum: heute, wenn die Reise läuft – sonst der letzte Tag dieser Reise
		const bis = reiseBis(r);
		const datum = heute() >= r.start && heute() <= bis ? heute() : (r.ende ?? bis);
		const ort = { lat: p.lat, lng: p.lng, name: p.name, land: p.land, landCode: p.landCode };
		ui.pin = null;
		if (typ === 'drive') {
			const von = letzteUebernachtung(r.id, datum)?.ort;
			ui.dialog = { art: 'eintrag', vorlage: { reise: r.id, typ, datum, von, nach: ort } };
		} else ui.dialog = { art: 'eintrag', vorlage: { reise: r.id, typ, datum, ort, platz: typ === 'stay' ? bekannt?.id : undefined } };
	}
</script>

{#if ui.pin && !ui.dialog && !ui.ortWahl}
	<div class="leiste" class:breit={ui.breit} role="dialog" aria-label="Ort auf der Karte" transition:fly={{ y: 40, duration: 220, easing: cubicOut }}>
		<div class="kopf">
			<span class="txt">
				<b>{ui.pin.name ?? 'Gewählter Ort'}{ui.pin.land ? `, ${ui.pin.land}` : ''}</b>
				<span class="zahl">{bekannt ? `Bekannt: ${bekannt.name}` : koordText(ui.pin)}</span>
			</span>
			<button class="rund" onclick={() => (ui.pin = null)} aria-label="Schließen"><X size={16} /></button>
		</div>
		{#if fahrt}
			<button class="ueber-hier" onclick={ueberHier}><Path size={20} weight="bold" /> Fahrt „{fahrt.titel}“ über hier führen</button>
		{/if}
		<div class="wahl">
			<button onclick={() => weiter('stay')}><Tent size={22} weight="duotone" /> Übernachtung</button>
			<button onclick={() => weiter('outing')}><Footprints size={22} weight="duotone" /> Ausflug</button>
			<button onclick={() => weiter('drive')}><Van size={22} weight="duotone" /> Fahrt hierher</button>
		</div>
		<button class="merken" onclick={merken}><Flag size={18} weight="duotone" /> Als Ziel merken</button>
	</div>
{/if}

<style>
	.leiste {
		position: fixed;
		z-index: 35;
		left: 8px;
		right: 8px;
		bottom: calc(8px + env(safe-area-inset-bottom));
		padding: 12px;
		border-radius: var(--radius-gross);
		background: var(--flaeche);
		box-shadow: var(--schatten-dialog);
	}
	.leiste.breit {
		left: calc(var(--leiste-breite) + 24px);
		right: auto;
		width: 460px;
		bottom: 24px;
	}
	.kopf {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 10px;
	}
	.txt {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.txt b {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.txt span {
		color: var(--text-2);
		font-size: 13px;
	}
	.ueber-hier {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 46px;
		margin-bottom: 8px;
		padding: 8px 12px;
		border: 0;
		border-radius: var(--radius);
		background: var(--signal);
		color: var(--signal-text);
		font-weight: 650;
		text-align: left;
	}
	.wahl {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 6px;
	}
	.wahl button {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 10px 2px 8px;
		border: 1px solid var(--linie);
		border-radius: var(--radius);
		background: var(--flaeche);
		font-size: 12px;
		font-weight: 600;
		line-height: 1.2;
	}
	.wahl button :global(svg) {
		color: var(--stern);
	}
	.wahl button:active {
		background: var(--flaeche-2);
	}
	.merken {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		height: 42px;
		margin-top: 6px;
		border: 0;
		background: none;
		color: var(--text);
		font-weight: 600;
	}
</style>
