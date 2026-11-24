/*
  Datenmodell. Jede Tabelle hat dieselben Grundfelder (Basis):
  - id: vom Gerät erzeugt (crypto.randomUUID), bleibt für immer gleich
  - geaendert: Zeitpunkt der letzten Änderung auf diesem Gerät (ms)
  - geloescht: weiches Löschen (bleibt für Abgleich und Rückgängig erhalten)
  Der Abgleich mit Supabase kommt später; geänderte Datensätze stehen bis dahin in der Outbox.
*/

export interface Basis {
	id: string;
	geaendert: number;
	geloescht?: boolean;
}

export type LngLat = [number, number];

export interface Ort {
	lat: number;
	lng: number;
	/** Ortsname, z. B. „Geiranger“ */
	name?: string;
	/** Land, z. B. „Norwegen“ */
	land?: string;
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

export type Typ = 'stay' | 'drive' | 'outing' | 'event';

export interface Eintrag extends Basis {
	reise: string;
	typ: Typ;
	titel: string;
	datum: string;
	/** Uhrzeit HH:MM:SS (nur für die Reihenfolge am Tag, wird nicht angezeigt) */
	zeit?: string;
	ort?: Ort;
	text?: string;
	/** wird nie geteilt */
	privat?: boolean;

	// Übernachtung
	platz?: string;
	naechte?: number;
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

export type PlatzArt = 'camping' | 'stellplatz' | 'frei' | 'hof' | 'sonstig';

export interface Platz extends Basis {
	name: string;
	art: PlatzArt;
	ort: Ort;
	ausstattung: string[];
	untergrund?: string;
	url?: string;
	notiz?: string;
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

export interface Tabellen {
	reisen: Reise;
	eintraege: Eintrag;
	plaetze: Platz;
	fotos: Foto;
}
export type TabellenName = keyof Tabellen;

export const TYP_NAME: Record<Typ, string> = {
	stay: 'Übernachtung',
	drive: 'Fahrt',
	outing: 'Ausflug',
	event: 'Event'
};

export const PLATZ_ART: Record<PlatzArt, string> = {
	camping: 'Campingplatz',
	stellplatz: 'Stellplatz',
	frei: 'Frei stehen',
	hof: 'Bauernhof / Weingut',
	sonstig: 'Sonstiges'
};
