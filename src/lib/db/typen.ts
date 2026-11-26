/*
  Datenmodell – bewusst nur wenige Sorten von Objekten:
    Reise · Eintrag (Art: Übernachtung, Fahrt, Ausflug) · Platz · Foto · Ziel
  Ausgaben (`kosten`) und Tageswetter (`wetter`) hängen am Eintrag.
  Zusätzliche, auswertbare Eigenschaften stehen NICHT als eigene Felder im Code, sondern als
  `merkmale` (Schlüssel → Wert). Welche Merkmale es gibt, beschreibt der Katalog in src/lib/merkmale.ts.
  Neues Merkmal = eine Zeile im Katalog, alte Daten bleiben gültig.

  Werte immer auswertbar speichern: Zahlen als Zahlen, Ja/Nein als boolean, Auswahl als fester Schlüssel,
  Länder zusätzlich als ISO-Code (landCode), Freitext nur in Notizen.

  Jede Tabelle hat dieselben Grundfelder (Basis):
  - id: vom Gerät erzeugt (neueId in id.ts), bleibt für immer gleich
  - geaendert: Zeitpunkt der letzten Änderung auf diesem Gerät (ms)
  - geloescht: weiches Löschen (bleibt für Abgleich und Rückgängig erhalten)
*/

export interface Basis {
	id: string;
	geaendert: number;
	geloescht?: boolean;
}

export type LngLat = [number, number];

/** Wert eines Merkmals */
export type Wert = boolean | number | string;
export type Merkmale = Record<string, Wert>;

export interface Ort {
	lat: number;
	lng: number;
	/** Ortsname, z. B. „Geiranger“ */
	name?: string;
	/** Land, z. B. „Norwegen“ */
	land?: string;
	/** Ländercode ISO 3166-1, z. B. „NO“ (für Auswertungen) */
	landCode?: string;
}

/** Notiz mit Zeitpunkt (z. B. „Nacht 2: Nachbarn laut“) */
export interface Notiz {
	id: string;
	/** ISO-Zeitpunkt JJJJ-MM-TTTHH:MM */
	zeit: string;
	text: string;
}

export interface Reise extends Basis {
	titel: string;
	/** ISO-Datum JJJJ-MM-TT */
	start: string;
	/** leer = läuft noch */
	ende?: string;
	/** Index in die Reisefarben */
	farbe: number;
	/** Foto-ID fürs Titelbild */
	titelbild?: string;
	notiz?: string;
}

export type Typ = 'stay' | 'drive' | 'outing';

export interface Eintrag extends Basis {
	reise: string;
	typ: Typ;
	titel: string;
	datum: string;
	/** Uhrzeit HH:MM:SS (nur für die Reihenfolge am Tag, wird nicht angezeigt) */
	zeit?: string;
	ort?: Ort;
	/** Freitext (Ausflug, Fahrt) */
	text?: string;
	/** Notizen mit Zeitpunkt (Übernachtung: pro Nacht) */
	notizen?: Notiz[];
	/** weitere Eigenschaften laut Katalog */
	merkmale?: Merkmale;
	/** Ausgaben (Tanken, Maut, Fähre, Eintritt …) – Übernachtungspreis steht extra in `preis` */
	kosten?: Kosten[];
	/** Wetter der Tage, für die dieser Eintrag den Ort angibt (Datum → Wetter), automatisch nachgetragen */
	wetter?: Record<string, Wetter>;

	// Übernachtung
	platz?: string;
	naechte?: number;
	/** Preis pro Nacht */
	preis?: number;
	waehrung?: string;
	bewertung?: number;

	// Fahrt
	von?: Ort;
	nach?: Ort;
	via?: Ort[];
	route?: LngLat[];
	km?: number;
	minuten?: number;
	/** false = gerade Linie, Straßenroute noch nicht berechnet */
	routeOk?: boolean;
}

export type KostenArt = 'tanken' | 'maut' | 'faehre' | 'eintritt' | 'essen' | 'einkauf' | 'sonstig';

export interface Kosten {
	id: string;
	art: KostenArt;
	betrag: number;
	waehrung: string;
	/** nur bei „Sonstiges“: wofür (z. B. „Waschmaschine“) */
	notiz?: string;
}

/** Tageswetter (Open-Meteo): WMO-Code, Höchst-/Tiefsttemperatur °C, Niederschlag mm */
export interface Wetter {
	c: number;
	max: number;
	min: number;
	regen?: number;
}

export type PlatzArt = 'camping' | 'stellplatz' | 'frei' | 'hof' | 'sonstig';

export interface Platz extends Basis {
	name: string;
	art: PlatzArt;
	ort: Ort;
	/** Ausstattung, Umgebung … laut Katalog */
	merkmale: Merkmale;
	/** Links zum Wiederfinden (Park4Night, Webseite, …) */
	links: string[];
	notiz?: string;
	/** früher „Gern wieder“ – nicht mehr in der Oberfläche, bleibt in alten Daten stehen */
	wiederkommen?: boolean;
}

export interface Foto extends Basis {
	reise?: string;
	eintrag?: string;
	ort?: Ort;
	/** Aufnahmezeitpunkt (ISO), sonst Zeitpunkt des Hinzufügens */
	aufgenommen: string;
	breite: number;
	hoehe: number;
	/** Pfad im Supabase-Speicher, sobald hochgeladen */
	pfad?: string;
	/** kleines Vorschaubild (Data-URL) */
	vorschau: string;
}

/** Merkliste / Planung: Orte, an die man (noch) will – Stellplatz, Stadt, Ausflugsziel … */
export type ZielArt = 'stellplatz' | 'stadt' | 'sehenswert' | 'natur' | 'essen' | 'sonstig';

export interface Ziel extends Basis {
	name: string;
	art: ZielArt;
	ort: Ort;
	notiz?: string;
	links: string[];
	/** für eine bestimmte (geplante) Reise vorgemerkt */
	reise?: string;
	/** erledigt: ID des Eintrags, mit dem man dort war */
	erledigt?: string;
}

export interface Tabellen {
	reisen: Reise;
	eintraege: Eintrag;
	plaetze: Platz;
	fotos: Foto;
	ziele: Ziel;
}
export type TabellenName = keyof Tabellen;

export const TYP_NAME: Record<Typ, string> = {
	stay: 'Übernachtung',
	drive: 'Fahrt',
	outing: 'Ausflug'
};

export const KOSTEN_ART: Record<KostenArt, string> = {
	tanken: 'Tanken',
	maut: 'Maut / Vignette',
	faehre: 'Fähre',
	eintritt: 'Eintritt',
	essen: 'Essen gehen',
	einkauf: 'Einkauf',
	sonstig: 'Sonstiges'
};

export const ZIEL_ART: Record<ZielArt, string> = {
	stellplatz: 'Stellplatz',
	stadt: 'Stadt',
	sehenswert: 'Sehenswürdigkeit',
	natur: 'Natur & Wandern',
	essen: 'Essen & Trinken',
	sonstig: 'Sonstiges'
};

export const PLATZ_ART: Record<PlatzArt, string> = {
	camping: 'Campingplatz',
	stellplatz: 'Stellplatz',
	frei: 'Frei stehen',
	hof: 'Bauernhof / Weingut',
	sonstig: 'Sonstiges'
};
