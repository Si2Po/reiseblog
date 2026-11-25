/*
  Merkmal-Katalog: beschreibt alle zusätzlichen, auswertbaren Eigenschaften.
  Formulare, Anzeige, Filter und spätere Auswertungen werden aus dieser Liste erzeugt.

  NEUES MERKMAL = eine Zeile hier. Den Schlüssel (key) danach nie mehr ändern –
  er steht so in den gespeicherten Daten. Name und Gruppe dürfen sich ändern.

  Arten:
    janein  → boolean            (z. B. Strom vorhanden)
    zahl    → number + Einheit   (z. B. Stromkosten in €)
    auswahl → fester Schlüssel   (z. B. Untergrund = „schotter“)
    sterne  → number 1–5         (z. B. Ruhe)
*/
import type { Component } from 'svelte';
import Lightning from 'phosphor-svelte/lib/Lightning';
import Drop from 'phosphor-svelte/lib/Drop';
import Shower from 'phosphor-svelte/lib/Shower';
import Toilet from 'phosphor-svelte/lib/Toilet';
import WifiHigh from 'phosphor-svelte/lib/WifiHigh';
import Dog from 'phosphor-svelte/lib/Dog';
import Recycle from 'phosphor-svelte/lib/Recycle';
import Storefront from 'phosphor-svelte/lib/Storefront';
import Bread from 'phosphor-svelte/lib/Bread';
import ForkKnife from 'phosphor-svelte/lib/ForkKnife';
import SwimmingPool from 'phosphor-svelte/lib/SwimmingPool';
import Sun from 'phosphor-svelte/lib/Sun';
import type { Merkmale, Wert } from '#lib/db/typen.ts';

export type Bezug = 'platz' | 'stay' | 'drive' | 'outing' | 'event';
export type Gruppe = 'ausstattung' | 'umgebung' | 'kosten' | 'eindruck';

export interface Merkmal {
	key: string;
	name: string;
	art: 'janein' | 'zahl' | 'auswahl' | 'sterne';
	gilt: Bezug[];
	gruppe: Gruppe;
	icon?: Component;
	einheit?: string;
	optionen?: { key: string; name: string }[];
	/** kurze Erklärung im Formular */
	hilfe?: string;
}

export const GRUPPEN: Record<Gruppe, string> = {
	ausstattung: 'Ausstattung',
	umgebung: 'Lage und Umgebung',
	kosten: 'Kosten',
	eindruck: 'Eindruck'
};

export const MERKMALE: Merkmal[] = [
	// --- Ausstattung des Platzes ---
	{ key: 'strom', name: 'Strom', art: 'janein', gilt: ['platz'], gruppe: 'ausstattung', icon: Lightning },
	{ key: 'wasser', name: 'Wasser', art: 'janein', gilt: ['platz'], gruppe: 'ausstattung', icon: Drop },
	{ key: 'entsorgung', name: 'Entsorgung', art: 'janein', gilt: ['platz'], gruppe: 'ausstattung', icon: Recycle },
	{ key: 'wc', name: 'WC', art: 'janein', gilt: ['platz'], gruppe: 'ausstattung', icon: Toilet },
	{ key: 'dusche', name: 'Dusche', art: 'janein', gilt: ['platz'], gruppe: 'ausstattung', icon: Shower },
	{ key: 'wlan', name: 'WLAN', art: 'janein', gilt: ['platz'], gruppe: 'ausstattung', icon: WifiHigh },
	{ key: 'hunde', name: 'Hunde', art: 'janein', gilt: ['platz'], gruppe: 'ausstattung', icon: Dog },
	{ key: 'laden', name: 'Laden', art: 'janein', gilt: ['platz'], gruppe: 'ausstattung', icon: Storefront },
	{ key: 'broetchen', name: 'Brötchen', art: 'janein', gilt: ['platz'], gruppe: 'ausstattung', icon: Bread },
	{ key: 'restaurant', name: 'Restaurant', art: 'janein', gilt: ['platz'], gruppe: 'ausstattung', icon: ForkKnife },
	{ key: 'pool', name: 'Pool', art: 'janein', gilt: ['platz'], gruppe: 'ausstattung', icon: SwimmingPool },

	// --- Lage und Umgebung ---
	{
		key: 'lage',
		name: 'Lage',
		art: 'auswahl',
		gilt: ['platz'],
		gruppe: 'umgebung',
		optionen: [
			{ key: 'wasser', name: 'Am Wasser' },
			{ key: 'berge', name: 'Berge' },
			{ key: 'wald', name: 'Wald' },
			{ key: 'land', name: 'Ländlich' },
			{ key: 'stadt', name: 'Stadt' }
		]
	},
	{
		key: 'untergrund',
		name: 'Untergrund',
		art: 'auswahl',
		gilt: ['platz'],
		gruppe: 'umgebung',
		optionen: [
			{ key: 'wiese', name: 'Wiese' },
			{ key: 'schotter', name: 'Schotter' },
			{ key: 'asphalt', name: 'Asphalt' },
			{ key: 'sand', name: 'Sand' },
			{ key: 'gemischt', name: 'Gemischt' }
		]
	},
	{ key: 'schatten', name: 'Schatten', art: 'janein', gilt: ['platz'], gruppe: 'umgebung', icon: Sun },
	{ key: 'eben', name: 'Ebene Stellfläche', art: 'janein', gilt: ['platz'], gruppe: 'umgebung' },

	// --- Kosten der Übernachtung (zusätzlich zum Preis pro Nacht) ---
	{ key: 'stromkosten', name: 'Strom extra', art: 'zahl', einheit: 'pro Nacht', gilt: ['stay'], gruppe: 'kosten' },
	{ key: 'kurtaxe', name: 'Kurtaxe', art: 'zahl', einheit: 'pro Nacht', gilt: ['stay'], gruppe: 'kosten' },

	// --- Eindruck der Übernachtung ---
	{ key: 'ruhe', name: 'Ruhe', art: 'sterne', gilt: ['stay'], gruppe: 'eindruck', hilfe: 'Wie ruhig war die Nacht?' },
	{ key: 'sauberkeit', name: 'Sauberkeit', art: 'sterne', gilt: ['stay'], gruppe: 'eindruck' }
];

export const merkmal = (key: string) => MERKMALE.find((m) => m.key === key);
export const merkmaleFuer = (bezug: Bezug, gruppe?: Gruppe) => MERKMALE.filter((m) => m.gilt.includes(bezug) && (!gruppe || m.gruppe === gruppe));

/** Ausstattung (Ja/Nein mit Symbol) – für die Kachel-Ansicht */
export const AUSSTATTUNG = MERKMALE.filter((m) => m.gruppe === 'ausstattung' && m.art === 'janein');

/** Lesbarer Text eines Werts, z. B. „Schotter“, „3 €“, „★★★★“ */
export function wertText(m: Merkmal, w: Wert | undefined): string {
	if (w === undefined || w === '' || w === null) return '';
	if (m.art === 'janein') return w ? 'ja' : 'nein';
	if (m.art === 'auswahl') return m.optionen?.find((o) => o.key === w)?.name ?? String(w);
	if (m.art === 'sterne') return '★'.repeat(Number(w));
	return `${Number(w).toLocaleString('de-DE')}${m.einheit ? ' ' + m.einheit : ''}`;
}

/** Leere Werte entfernen, damit nur Gesetztes gespeichert wird */
export function aufraeumen(m: Merkmale | undefined): Merkmale | undefined {
	if (!m) return undefined;
	const sauber = Object.fromEntries(Object.entries(m).filter(([, w]) => w !== undefined && w !== null && w !== '' && w !== false));
	return Object.keys(sauber).length ? sauber : undefined;
}
