/*
  Zustand der Oberfläche, den mehrere Seiten teilen:
  Sheet-Höhe, Kartensteuerung, offene Dialoge, Hinweise, Foto-Großansicht, Ort-Wahl.
*/
import type { Component } from 'svelte';
import type { Hoehe } from '#lib/ui/Sheet.svelte';
import type { Rand } from '#lib/map/Karte.svelte';
import type { Eintrag, LngLat, Ziel } from '#lib/db/typen.ts';
import { koordinaten } from '#lib/auswertung.ts';

export interface KartenApi {
	zeigeBereich(coords: LngLat[], rand: Rand, maxZoom?: number): void;
	zeigePunkt(lng: number, lat: number, rand: Rand, zoom?: number): void;
	mitte(): { lat: number; lng: number } | null;
	ortBei(x: number, y: number): { lat: number; lng: number } | null;
}

export type Dialog =
	| { art: 'reise'; id?: string }
	| { art: 'eintrag'; id?: string; vorlage?: Partial<Eintrag>; kostenNeu?: boolean }
	| { art: 'hier' }
	| { art: 'platz'; id: string }
	| { art: 'notiz'; eintrag: string; datum: string }
	| { art: 'ziel'; id?: string; vorlage?: Partial<Ziel> }
	| { art: 'pdf'; reise: string };

/** Eintrag im Aktionen-Menü (`…`, Rechtsklick, Wischen) */
export interface Aktion {
	text: string;
	icon?: Component;
	gefahr?: boolean;
	los: () => unknown;
}

interface Hinweis {
	nr: number;
	text: string;
	rueckgaengig?: () => unknown;
}

class Ui {
	/** breiter Bildschirm (PC/Tablet quer): Seitenleiste statt Sheet */
	breit = $state(false);
	hoehe = $state<Hoehe>('halb');
	/** sichtbare Sheet-Höhe in px (nur schmal) */
	sichtbar = $state(0);

	fotosAn = $state(false);
	/** hervorgehobene Reise auf der Karte */
	auswahl = $state<string | null>(null);
	/** hervorgehobener Eintrag in der Zeitleiste */
	markiert = $state<string | null>(null);
	/** eigener Standort, sobald einmal abgefragt */
	ich = $state<{ lat: number; lng: number; genau: number } | null>(null);

	dialog = $state<Dialog | null>(null);
	/** Aktionen-Menü: am iPhone von unten, am PC an der Mausposition (x/y) */
	aktionen = $state<{ titel?: string; punkte: Aktion[]; x?: number; y?: number } | null>(null);
	hinweis = $state<Hinweis | null>(null);
	/** Foto-Großansicht: Liste von Foto-IDs und Position */
	gross = $state<{ ids: string[]; i: number } | null>(null);
	/** „Ort auf der Karte wählen“ läuft */
	ortWahl = $state<{ fertig: (o: { lat: number; lng: number } | null) => void } | null>(null);


	/** Plätze-Seite mit Filter: nur diese Plätze auf der Karte zeigen (null = alle) */
	sichtbarePlaetze = $state<string[] | null>(null);
	/** Statistik: besuchte Länder einfärben */
	laender = $state<{ grenzen: GeoJSON.FeatureCollection; besucht: string[] } | null>(null);

	/** Stecknadel nach langem Drücken auf die Karte */
	pin = $state<{ lat: number; lng: number; name?: string; land?: string; landCode?: string } | null>(null);

	karte: KartenApi | null = null;

	// --- Karte ---
	/** Ränder im Wahl-Modus: oben Suchfeld, unten Leiste mit „Ort übernehmen“ */
	static WAHL = { oben: 86, unten: 150 };

	/** Punkt auf dem Bildschirm, an dem im Wahl-Modus das Fadenkreuz sitzt (= Kartenmitte) */
	kreuz(): { x: number; y: number } {
		const { oben, unten } = Ui.WAHL;
		return { x: innerWidth / 2, y: oben + (innerHeight - oben - unten) / 2 };
	}

	rand(): Rand {
		if (this.ortWahl) return { top: Ui.WAHL.oben, bottom: Ui.WAHL.unten, left: 0, right: 0 };
		if (this.breit) return { top: 70, bottom: 70, left: 400 + 50, right: 70 };
		const unten = this.hoehe === 'klein' ? 150 : Math.round(innerHeight * 0.52);
		return { top: 90, bottom: unten + 30, left: 40, right: 40 };
	}
	zeigeAlles() {
		const k = koordinaten();
		if (k.length) this.karte?.zeigeBereich(k, this.rand(), 10);
	}
	zeigeReise(id: string) {
		const k = koordinaten(id);
		if (k.length) this.karte?.zeigeBereich(k, this.rand(), 11);
	}
	zeigeOrt(o: { lat: number; lng: number }, zoom = 12) {
		this.karte?.zeigePunkt(o.lng, o.lat, this.rand(), zoom);
	}
	zeigeLinie(route: LngLat[]) {
		this.karte?.zeigeBereich(route, this.rand(), 13);
	}

	/** Sheet mindestens halb öffnen (z. B. beim Wechsel auf eine Detailseite) */
	oeffnen() {
		if (!this.breit && this.hoehe === 'klein') this.hoehe = 'halb';
	}

	// --- Hinweise ---
	#nr = 0;
	#zeit: ReturnType<typeof setTimeout> | undefined;
	zeige(text: string, rueckgaengig?: () => unknown, dauer?: number) {
		clearTimeout(this.#zeit);
		const nr = ++this.#nr;
		this.hinweis = { nr, text, rueckgaengig };
		this.#zeit = setTimeout(() => {
			if (this.hinweis?.nr === nr) this.hinweis = null;
		}, dauer ?? (rueckgaengig ? 6000 : 2600));
	}

	// --- Ort auf der Karte wählen ---
	/**
	 * Blendet offene Dialoge aus (sie bleiben erhalten, samt Eingaben), zeigt ein Fadenkreuz.
	 * Ergebnis = Kartenmitte oder null (abgebrochen).
	 */
	ortWaehlen(start?: { lat: number; lng: number }): Promise<{ lat: number; lng: number } | null> {
		const vorherHoehe = this.hoehe;
		if (!this.breit) this.hoehe = 'klein';
		if (start) setTimeout(() => this.zeigeOrt(start, 14), 50);
		return new Promise((ok) => {
			this.ortWahl = {
				fertig: (o) => {
					this.ortWahl = null;
					this.hoehe = vorherHoehe;
					ok(o);
				}
			};
		});
	}
}

export const ui = new Ui();
