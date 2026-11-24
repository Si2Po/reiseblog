import type { Component } from 'svelte';
import Lightning from 'phosphor-svelte/lib/Lightning';
import Drop from 'phosphor-svelte/lib/Drop';
import Shower from 'phosphor-svelte/lib/Shower';
import Toilet from 'phosphor-svelte/lib/Toilet';
import WifiHigh from 'phosphor-svelte/lib/WifiHigh';
import Dog from 'phosphor-svelte/lib/Dog';
import Recycle from 'phosphor-svelte/lib/Recycle';
import Storefront from 'phosphor-svelte/lib/Storefront';

export const AUSSTATTUNG: { key: string; name: string; icon: Component }[] = [
	{ key: 'strom', name: 'Strom', icon: Lightning },
	{ key: 'wasser', name: 'Wasser', icon: Drop },
	{ key: 'entsorgung', name: 'Entsorgung', icon: Recycle },
	{ key: 'wc', name: 'WC', icon: Toilet },
	{ key: 'dusche', name: 'Dusche', icon: Shower },
	{ key: 'wlan', name: 'WLAN', icon: WifiHigh },
	{ key: 'hunde', name: 'Hunde', icon: Dog },
	{ key: 'laden', name: 'Laden', icon: Storefront }
];
