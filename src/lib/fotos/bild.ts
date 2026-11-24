// Welche Bildquelle ein Foto hat: hochgeladen (Supabase), lokal (IndexedDB) oder nur Vorschau.
import { db } from '#lib/db/db.ts';
import type { Foto } from '#lib/db/typen.ts';

const lokal = new Map<string, string>();

/** Bild in voller (verkleinerter) Größe. Fällt auf die Vorschau zurück. */
export async function vollbild(f: Foto): Promise<string> {
	const hit = lokal.get(f.id);
	if (hit) return hit;
	const datei = await db.dateien.get(f.id);
	if (datei) {
		const url = URL.createObjectURL(new Blob([datei.bild], { type: datei.typ }));
		lokal.set(f.id, url);
		return url;
	}
	// TODO Abgleich: öffentliche Adresse aus Supabase-Speicher, wenn f.pfad gesetzt
	return f.vorschau;
}
