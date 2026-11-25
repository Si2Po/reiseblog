<!-- Links eines Platzes bearbeiten: Liste + Feld zum Einfügen (z. B. aus Park4Night „Teilen → Link kopieren“). -->
<script lang="ts">
	import X from 'phosphor-svelte/lib/X';
	import Plus from 'phosphor-svelte/lib/Plus';
	import LinkSimple from 'phosphor-svelte/lib/LinkSimple';
	import { linkInfo, linkSaeubern } from '#lib/links.ts';

	let { links = $bindable([]) }: { links: string[] } = $props();
	let eingabe = $state('');
	let fehler = $state(false);

	function hinzu() {
		const url = linkSaeubern(eingabe);
		fehler = !url && !!eingabe.trim();
		if (!url) return;
		if (!links.includes(url)) links = [...links, url];
		eingabe = '';
	}
</script>

<div class="feld">
	<span class="name">Links zum Wiederfinden</span>
	{#each links as l (l)}
		{@const info = linkInfo(l)}
		<div class="link">
			<LinkSimple size={18} />
			<span class="txt"><b>{info.name}</b><span>{l}</span></span>
			<button type="button" class="rund" onclick={() => (links = links.filter((x) => x !== l))} aria-label="Link entfernen"><X size={16} /></button>
		</div>
	{/each}
	<div class="neu">
		<input
			type="url"
			inputmode="url"
			placeholder="z. B. Park4Night-Link einfügen"
			bind:value={eingabe}
			onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), hinzu())}
			onblur={hinzu}
		/>
		<button type="button" class="knopf zweit" onclick={hinzu} aria-label="Link hinzufügen"><Plus size={18} /></button>
	</div>
	{#if fehler}<p class="fehler">Das sieht nicht wie ein Link aus.</p>{/if}
</div>

<style>
	.link {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 8px 8px 12px;
		border-radius: var(--radius);
		background: var(--flaeche-2);
	}
	.txt {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.txt span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--text-2);
		font-size: 13px;
	}
	.neu {
		display: flex;
		gap: 8px;
	}
	.neu .knopf {
		flex: none;
		width: 48px;
		padding: 0;
	}
	.fehler {
		color: var(--gefahr);
		font-size: 14px;
	}
</style>
