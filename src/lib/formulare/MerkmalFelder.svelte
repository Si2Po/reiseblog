<!--
  Eingabefelder, die automatisch aus dem Merkmal-Katalog (src/lib/merkmale.ts) entstehen.
  Ja/Nein und Auswahl als Chips, Zahlen als Felder, Sterne als Sterne.
-->
<script lang="ts">
	import SterneWahl from '#lib/ui/SterneWahl.svelte';
	import { GRUPPEN, merkmaleFuer, type Bezug, type Gruppe, type Merkmal } from '#lib/merkmale.ts';
	import type { Merkmale } from '#lib/db/typen.ts';

	let { bezug, werte = $bindable({}), nur }: { bezug: Bezug; werte: Merkmale; nur?: Gruppe[] } = $props();

	const gruppen = $derived(
		(Object.keys(GRUPPEN) as Gruppe[])
			.filter((g) => !nur || nur.includes(g))
			.map((g) => ({ g, liste: merkmaleFuer(bezug, g) }))
			.filter((x) => x.liste.length)
	);

	function setzen(m: Merkmal, w: Merkmale[string] | undefined) {
		const neu = { ...werte };
		if (w === undefined || w === '' || w === false || (typeof w === 'number' && Number.isNaN(w))) delete neu[m.key];
		else neu[m.key] = w;
		werte = neu;
	}
</script>

{#each gruppen as { g, liste } (g)}
	{@const chips = liste.filter((m) => m.art === 'janein')}
	{@const rest = liste.filter((m) => m.art !== 'janein')}
	<div class="feld">
		<span class="name">{GRUPPEN[g]}</span>
		{#if chips.length}
			<div class="chips umbruch">
				{#each chips as m (m.key)}
					<button type="button" class:an={!!werte[m.key]} aria-pressed={!!werte[m.key]} onclick={() => setzen(m, !werte[m.key])}>
						{#if m.icon}<m.icon size={16} />{/if}
						{m.name}
					</button>
				{/each}
			</div>
		{/if}
		{#each rest as m (m.key)}
			<div class="zeile">
				<span class="mname">{m.name}{#if m.hilfe}<small>{m.hilfe}</small>{/if}</span>
				{#if m.art === 'auswahl'}
					<div class="chips umbruch">
						{#each m.optionen ?? [] as o (o.key)}
							<button type="button" class:an={werte[m.key] === o.key} onclick={() => setzen(m, werte[m.key] === o.key ? undefined : o.key)}>{o.name}</button>
						{/each}
					</div>
				{:else if m.art === 'zahl'}
					<label class="zahlfeld">
						<input
							type="number"
							inputmode="decimal"
							min="0"
							step="0.5"
							value={werte[m.key] ?? ''}
							oninput={(e) => setzen(m, e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value))}
						/>
						{#if m.einheit}<span>{m.einheit}</span>{/if}
					</label>
				{:else if m.art === 'sterne'}
					<SterneWahl wert={werte[m.key] as number | undefined} onwahl={(w) => setzen(m, w)} groesse={26} name={m.name} />
				{/if}
			</div>
		{/each}
	</div>
{/each}

<style>
	.chips.umbruch {
		flex-wrap: wrap;
	}
	.zeile {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 8px;
	}
	.mname {
		font-size: 15px;
		font-weight: 560;
	}
	.mname small {
		display: block;
		color: var(--text-2);
		font-size: 13px;
		font-weight: 400;
	}
	.zahlfeld {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.zahlfeld input {
		width: 120px !important;
	}
	.zahlfeld span {
		color: var(--text-2);
		font-size: 14px;
	}
</style>
