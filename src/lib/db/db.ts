// Lokale Datenbank im Browser (IndexedDB über Dexie). Alles funktioniert offline.
import { Dexie, type EntityTable } from 'dexie';
import type { Reise, Eintrag, Platz, Foto, TabellenName } from './typen.ts';

export interface Datei {
	/** gleiche ID wie das Foto */
	id: string;
	/** verkleinertes Bild (JPEG) */
	bild: Blob;
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
