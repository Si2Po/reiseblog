// Lokale Datenbank im Browser (IndexedDB über Dexie). Alles funktioniert offline.
import { Dexie, type EntityTable } from 'dexie';
import type { Reise, Eintrag, Platz, Foto, Ziel, TabellenName } from './typen.ts';

export interface Datei {
	/** gleiche ID wie das Foto */
	id: string;
	/** verkleinertes Bild (JPEG) als Bytes – kein Blob, den kann Safari im privaten Modus nicht speichern */
	bild: ArrayBuffer;
	typ: string;
}

export interface OutboxEintrag {
	nr?: number;
	tabelle: TabellenName;
	id: string;
}

export interface Meta {
	schluessel: string;
	wert: unknown;
}

export const db = new Dexie('reiseblog') as Dexie & {
	reisen: EntityTable<Reise, 'id'>;
	eintraege: EntityTable<Eintrag, 'id'>;
	plaetze: EntityTable<Platz, 'id'>;
	fotos: EntityTable<Foto, 'id'>;
	ziele: EntityTable<Ziel, 'id'>;
	dateien: EntityTable<Datei, 'id'>;
	outbox: EntityTable<OutboxEintrag, 'nr'>;
	meta: EntityTable<Meta, 'schluessel'>;
};

db.version(1).stores({
	reisen: 'id, start',
	eintraege: 'id, reise, datum, platz',
	plaetze: 'id',
	fotos: 'id, reise, eintrag, aufgenommen',
	dateien: 'id',
	outbox: '++nr, [tabelle+id]',
	meta: 'schluessel'
});

// Version 2: Merkliste/Planung („Ziele“)
db.version(2).stores({
	ziele: 'id, reise'
});
