<!-- Teilen-Links: Liste, neu anlegen, bearbeiten. -->
<script lang="ts">
	import Plus from 'phosphor-svelte/lib/Plus';
	import LinkSimple from 'phosphor-svelte/lib/LinkSimple';
	import ShareNetwork from 'phosphor-svelte/lib/ShareNetwork';
	import { abgleich, teilenLink, type Freigabe } from '#lib/db/abgleich.svelte.ts';
	import { ui } from '#lib/ui.svelte.ts';

	let liste = $state<Freigabe[]>([]);
	let fehler = $state('');

	$effect(() => {
		void ui.freigabenStand;
		if (!abgleich.email) return;
		abgleich
			.freigaben()
			.then((l) => ((liste = l), (fehler = '')))
			.catch((e) => (fehler = (e as Error).message));
	});

	function beschreibung(f: Freigabe): string {
		const u = f.umfang;
		const teile = [u.plaetze && 'Plätze', u.unterwegs && 'Route', u.fotos && 'Fotos', u.texte && 'Texte', u.preise && 'Preise'].filter(Boolean);
		const reisen = u.reisen === 'alle' ? 'alle Reisen' : u.reisen.length === 1 ? '1 Reise' : `${u.reisen.length} Reisen`;
		return `${reisen} · ${teile.join(', ')}`;
	}

	async function senden(f: Freigabe) {
		const url = teilenLink(f.token);
		if (navigator.share) {
			try {
				return await navigator.share({ title: 'Unsere Reisen', url });
			} catch {
				/* abgebrochen */
			}
		}
		await navigator.clipboard?.writeText(url);
		ui.zeige('Link kopiert');
	}
</script>

<section>
	<h4>Teilen</h4>
	{#if !abgleich.email}
		<p class="hilfe">Zum Teilen bitte oben anmelden. Dann kannst du Links erstellen und für jeden festlegen, was zu sehen ist – z. B. für Freunde alles mit Fotos, für Kollegen nur die Stellplätze.</p>
	{:else}
		{#if fehler}<p class="hilfe">{fehler}</p>{/if}
		<ul class="liste">
			{#each liste as f (f.token)}
				<li class:aus={f.widerrufen}>
					<button class="haupt" onclick={() => (ui.dialog = { art: 'freigabe', token: f.token })}>
						<LinkSimple size={20} />
						<span class="txt">
							<b>{f.name}</b>
							<span>{f.widerrufen ? 'abgeschaltet' : beschreibung(f)}</span>
						</span>
					</button>
					{#if !f.widerrufen}
						<button class="rund" onclick={() => senden(f)} aria-label="Link senden"><ShareNetwork size={18} /></button>
					{/if}
				</li>
			{/each}
		</ul>
		<button class="knopf zweit breit" onclick={() => (ui.dialog = { art: 'freigabe' })}><Plus size={18} /> Neuer Teilen-Link</button>
	{/if}
</section>

<style>
	.liste {
		margin: 0 0 10px;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		align-items: center;
		gap: 8px;
		border-bottom: 1px solid var(--linie);
	}
	li.aus {
		opacity: 0.55;
	}
	.haupt {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 58px;
		padding: 6px 0;
		border: 0;
		background: none;
		text-align: left;
	}
	.txt {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.txt span {
		color: var(--text-2);
		font-size: 13px;
	}
	.breit {
		width: 100%;
	}
</style>
