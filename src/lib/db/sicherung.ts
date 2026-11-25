// Sicherung als JSON-Datei (ohne Fotodateien – die kommen mit dem Abgleich in die Cloud).
import { db } from './db.ts';
import { daten } from './daten.svelte.ts';
import { format } from 'date-fns';

const TABELLEN = ['reisen', 'eintraege', 'plaetze', 'fotos', 'ziele'] as const;

export async function sicherungHerunterladen() {
	const inhalt: Record<string, unknown> = { app: 'reiseblog', version: 1, erstellt: new Date().toISOString() };
	for (const t of TABELLEN) inhalt[t] = await db.table(t).toArray();
	const blob = new Blob([JSON.stringify(inhalt)], { type: 'application/json' });
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = `reiseblog-sicherung-${format(new Date(), 'yyyy-MM-dd')}.json`;
	a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Liest eine Sicherung ein. Gleiche IDs werden überschrieben, wenn die Sicherung neuer ist. */
export async function sicherungEinlesen(datei: File): Promise<number> {
	const inhalt = JSON.parse(await datei.text());
	if (inhalt?.app !== 'reiseblog') throw new Error('Das ist keine Reiseblog-Sicherung.');
	let n = 0;
	await db.transaction('rw', [...TABELLEN.map((t) => db.table(t)), db.outbox], async () => {
		for (const t of TABELLEN) {
			for (const neu of inhalt[t] ?? []) {
				const alt = await db.table(t).get(neu.id);
				if (alt && alt.geaendert >= neu.geaendert) continue;
				await db.table(t).put(neu);
				await db.outbox.put({ tabelle: t, id: neu.id });
				n++;
			}
		}
	});
	await daten.laden();
	return n;
}
