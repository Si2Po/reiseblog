// Welche Bildquelle ein Foto hat: lokal (IndexedDB), vom Server (verschlüsselt, wird beim ersten Ansehen
// geholt, entschlüsselt und auf dem Gerät abgelegt) oder nur die Vorschau.
import { db } from '#lib/db/db.ts';
import { abgleich } from '#lib/db/abgleich.svelte.ts';
import type { Foto } from '#lib/db/typen.ts';

/** schon erzeugte Bild-Adressen; mit der Vorschau gemerkt – ändert die sich (Foto gedreht), gilt das Bild nicht mehr */
const lokal = new Map<string, { vorschau: string; url: string }>();

/** Gemerktes Bild verwerfen (z. B. nach dem Drehen) */
export function vergessen(id: string) {
	const alt = lokal.get(id);
	if (alt) URL.revokeObjectURL(alt.url);
	lokal.delete(id);
}

/** Bild in voller (verkleinerter) Größe. Fällt auf die Vorschau zurück. */
export async function vollbild(f: Foto): Promise<string> {
	const hit = lokal.get(f.id);
	if (hit?.vorschau === f.vorschau) return hit.url;
	if (hit) vergessen(f.id);
	const datei = await db.dateien.get(f.id).catch(() => undefined);
	const bild = datei?.bild ?? (await abgleich.fotoLaden(f).catch(() => null));
	if (!bild) return f.vorschau;
	const url = URL.createObjectURL(new Blob([bild], { type: 'image/jpeg' }));
	lokal.set(f.id, { vorschau: f.vorschau, url });
	return url;
}
