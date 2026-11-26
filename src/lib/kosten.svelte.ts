/*
  Kosten einer Reise: Übernachtungen (Preis pro Nacht + Strom/Kurtaxe aus den Merkmalen) und
  die Ausgaben an den Einträgen (Tanken, Maut, Fähre …), getrennt nach Währung.
  Umrechnung in Euro mit aktuellen EZB-Kursen (Frankfurter, ohne Schlüssel), 1× am Tag geholt
  und im Browser gemerkt – also „ungefähr“, nicht zum Kurs des Reisetags.
*/
import { eintraegeVon } from '#lib/auswertung.ts';
import { heute } from '#lib/datum.ts';
import { KOSTEN_ART, type Eintrag, type Kosten, type KostenArt } from '#lib/db/typen.ts';

export const WAEHRUNGEN = ['EUR', 'CHF', 'NOK', 'SEK', 'DKK', 'GBP', 'CZK', 'PLN', 'HUF', 'ISK'];

/** Betrag je Währung, z. B. { EUR: 120, NOK: 850 } */
export type Betraege = Record<string, number>;

export interface Posten {
	art: KostenArt | 'nacht';
	name: string;
	betraege: Betraege;
}

function dazu(b: Betraege, waehrung: string, betrag: number) {
	if (betrag) b[waehrung] = (b[waehrung] ?? 0) + betrag;
}

/** Übernachtungskosten eines Eintrags (alle Nächte) */
export function nachtKosten(e: Eintrag): number {
	if (e.typ !== 'stay') return 0;
	const proNacht = (e.preis ?? 0) + Number(e.merkmale?.stromkosten ?? 0) + Number(e.merkmale?.kurtaxe ?? 0);
	return proNacht * (e.naechte ?? 1);
}

/** Alle Kostenposten einer Reise (nur Arten mit Beträgen), Übernachtungen zuerst */
export function reiseKosten(reise: string): Posten[] {
	const nacht: Betraege = {};
	const arten = new Map<KostenArt, Betraege>();
	for (const e of eintraegeVon(reise)) {
		dazu(nacht, e.waehrung ?? 'EUR', nachtKosten(e));
		for (const k of e.kosten ?? []) {
			if (!arten.has(k.art)) arten.set(k.art, {});
			dazu(arten.get(k.art)!, k.waehrung, k.betrag);
		}
	}
	const liste: Posten[] = [];
	if (Object.keys(nacht).length) liste.push({ art: 'nacht', name: 'Übernachtungen', betraege: nacht });
	for (const art of Object.keys(KOSTEN_ART) as KostenArt[]) {
		const b = arten.get(art);
		if (b && Object.keys(b).length) liste.push({ art, name: KOSTEN_ART[art], betraege: b });
	}
	return liste;
}

/** Kurzer Name einer Ausgabe: bei „Sonstiges“ die eigene Notiz, sonst die Art („Maut“ statt „Maut / Vignette“) */
export const kostenName = (k: Kosten) => (k.art === 'sonstig' && k.notiz?.trim()) || KOSTEN_ART[k.art].split(' /')[0];

export function summe(posten: Posten[]): Betraege {
	const s: Betraege = {};
	for (const p of posten) for (const [w, b] of Object.entries(p.betraege)) dazu(s, w, b);
	return s;
}

// --- Wechselkurse ---

const SPEICHER = 'reiseblog-kurse';
type Kurse = Record<string, number>; // 1 EUR = x Fremdwährung

class Wechselkurse {
	kurse = $state<Kurse | null>(null);
	#laeuft = false;

	constructor() {
		try {
			const s = JSON.parse(localStorage.getItem(SPEICHER) ?? 'null');
			if (s?.kurse) this.kurse = s.kurse;
		} catch {
			/* nichts gemerkt */
		}
	}

	/** Holt die Kurse höchstens einmal am Tag (still – ohne Netz bleibt es bei den gemerkten) */
	async holen() {
		if (this.#laeuft) return;
		try {
			const s = JSON.parse(localStorage.getItem(SPEICHER) ?? 'null');
			if (s?.tag === heute()) return;
		} catch {
			/* neu holen */
		}
		this.#laeuft = true;
		try {
			const r = await fetch('https://api.frankfurter.dev/v1/latest?base=EUR');
			if (!r.ok) return;
			const j = await r.json();
			if (!j?.rates) return;
			this.kurse = { ...j.rates, EUR: 1 };
			localStorage.setItem(SPEICHER, JSON.stringify({ tag: heute(), kurse: this.kurse }));
		} catch {
			/* offline */
		} finally {
			this.#laeuft = false;
		}
	}

	/** Beträge in Euro umgerechnet – null, wenn ein Kurs fehlt */
	inEuro(b: Betraege): number | null {
		let s = 0;
		for (const [w, x] of Object.entries(b)) {
			if (w === 'EUR') s += x;
			else if (this.kurse?.[w]) s += x / this.kurse[w];
			else return null;
		}
		return s;
	}
}

export const wechselkurse = new Wechselkurse();

/** Nur Euro dabei? Dann ist die Summe genau, sonst „ungefähr“. */
export const nurEuro = (b: Betraege) => Object.keys(b).every((w) => w === 'EUR');
