// Welche Bildquelle ein Foto hat: lokal (IndexedDB), hochgeladen (Supabase) oder nur die Vorschau.
import { db } from '#lib/db/db.ts';
import { abgleich } from '#lib/db/abgleich.svelte.ts';
import type { Foto } from '#lib/db/typen.ts';

const lokal = new Map<string, string>();

/** Bild in voller (verkleinerter) Größe. Fällt auf die Vorschau zurück. */
export async function vollbild(f: Foto): Promise<string> {
	const hit = lokal.get(f.id);
	if (hit) return hit;
	const datei = await db.dateien.get(f.id).catch(() => undefined);
	if (datei) {
		const url = URL.createObjectURL(new Blob([datei.bild], { type: datei.typ }));
		lokal.set(f.id, url);
		return url;
	}
	if (f.pfad && abgleich.moeglich) return abgleich.fotoUrl(f.pfad);
	return f.vorschau;
}
