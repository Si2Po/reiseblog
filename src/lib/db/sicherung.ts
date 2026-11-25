// Sicherung als Datei (ohne Fotodateien – die kommen mit dem Abgleich in die Cloud).
// Ab Version 2 immer mit einem Passwort verschlüsselt (AES-GCM, Schlüssel per PBKDF2 aus dem Passwort).
// Ältere, unverschlüsselte Sicherungen (Version 1) lassen sich weiter einlesen.
import { db } from './db.ts';
import { daten } from './daten.svelte.ts';
import { mitPasswort, mitPasswortLesen, type Paket } from './tresor.svelte.ts';
import { format } from 'date-fns';

const TABELLEN = ['reisen', 'eintraege', 'plaetze', 'fotos', 'ziele'] as const;

type Inhalt = Partial<Record<(typeof TABELLEN)[number], { id: string; geaendert: number }[]>>;
interface Datei {
	app: 'reiseblog';
	version: number;
	erstellt: string;
	/** ab Version 2: verschlüsselter Inhalt */
	tresor?: Paket & { salz: string };
}

/** Erstellt die verschlüsselte Sicherungsdatei */
export async function sicherungErstellen(passwort: string): Promise<File> {
	const inhalt: Inhalt = {};
	for (const t of TABELLEN) inhalt[t] = await db.table(t).toArray();
	const datei: Datei = { app: 'reiseblog', version: 2, erstellt: new Date().toISOString(), tresor: await mitPasswort(passwort, inhalt) };
	return new File([JSON.stringify(datei)], `reiseblog-sicherung-${format(new Date(), 'yyyy-MM-dd')}.json`, { type: 'application/json' });
}

/** Datei teilen (iPhone: „In Dateien sichern“ usw.), sonst herunterladen */
export async function dateiWeitergeben(datei: File) {
	if (navigator.canShare?.({ files: [datei] })) {
		try {
			await navigator.share({ files: [datei] });
			return;
		} catch (e) {
			if ((e as Error).name === 'AbortError') return;
		}
	}
	const a = document.createElement('a');
	a.href = URL.createObjectURL(datei);
	a.download = datei.name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Liest den Kopf einer Sicherung: braucht sie ein Passwort? */
export async function sicherungPruefen(datei: File): Promise<{ verschluesselt: boolean }> {
	let kopf: Datei;
	try {
		kopf = JSON.parse(await datei.text());
	} catch {
		throw new Error('Das ist keine Reiseblog-Sicherung.');
	}
	if (kopf?.app !== 'reiseblog') throw new Error('Das ist keine Reiseblog-Sicherung.');
	return { verschluesselt: !!kopf.tresor };
}

/** Liest eine Sicherung ein. Gleiche IDs werden überschrieben, wenn die Sicherung neuer ist. */
export async function sicherungEinlesen(datei: File, passwort?: string): Promise<number> {
	const kopf = JSON.parse(await datei.text()) as Datei & Inhalt;
	if (kopf?.app !== 'reiseblog') throw new Error('Das ist keine Reiseblog-Sicherung.');
	const inhalt: Inhalt = kopf.tresor ? await mitPasswortLesen<Inhalt>(passwort ?? '', kopf.tresor) : kopf;
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
