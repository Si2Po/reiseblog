// Welche Bildquelle ein Foto hat: lokal (IndexedDB), vom Server (verschlüsselt, wird beim ersten Ansehen
// geholt, entschlüsselt und auf dem Gerät abgelegt) oder nur die Vorschau.
import { db } from '#lib/db/db.ts';
import { abgleich } from '#lib/db/abgleich.svelte.ts';
import type { Foto } from '#lib/db/typen.ts';

const lokal = new Map<string, string>();

/** Bild in voller (verkleinerter) Größe. Fällt auf die Vorschau zurück. */
export async function vollbild(f: Foto): Promise<string> {
	const hit = lokal.get(f.id);
	if (hit) return hit;
	const datei = await db.dateien.get(f.id).catch(() => undefined);
	const bild = datei?.bild ?? (await abgleich.fotoLaden(f).catch(() => null));
	if (!bild) return f.vorschau;
	const url = URL.createObjectURL(new Blob([bild], { type: 'image/jpeg' }));
	lokal.set(f.id, url);
	return url;
}
