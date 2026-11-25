/*
  Abläufe für unterwegs:
  - „Weiterfahren“: aktuelle Übernachtung mit heute abschließen (Nächte stimmen) und eine offene Fahrt beginnen.
  - Am Ziel schließt die nächste Übernachtung die offene Fahrt ab (siehe EintragFormular).
  - Nächte automatisch: Kommt eine neue Übernachtung dazu, wird die vorige auf die richtige Nächtezahl gesetzt.
*/
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { daten } from '#lib/db/daten.svelte.ts';
import { eintraegeVon, laufendeReise } from '#lib/auswertung.ts';
import { heute } from '#lib/datum.ts';
import type { Eintrag } from '#lib/db/typen.ts';

/** Übernachtung, an der man gerade steht (letzte Übernachtung der laufenden Reise, schon begonnen) */
export function aktuelleUebernachtung(): Eintrag | undefined {
	const r = laufendeReise();
	if (!r) return undefined;
	const liste = eintraegeVon(r.id).filter((e) => e.datum <= heute());
	const i = liste.findLastIndex((e) => e.typ === 'stay');
	if (i < 0) return undefined;
	// steht danach schon eine Fahrt, ist man nicht mehr dort
	return liste.slice(i + 1).some((e) => e.typ === 'drive') ? undefined : liste[i];
}

/** Begonnene Fahrt ohne Ziel (nach „Weiterfahren“) */
export function offeneFahrt(reise: string): Eintrag | undefined {
	return eintraegeVon(reise)
		.filter((e) => e.typ === 'drive' && e.von && !e.nach)
		.at(-1);
}

/** Nächtezahl einer Übernachtung so setzen, dass sie bis zum Tag `bis` reicht. Gibt true zurück, wenn geändert. */
export async function naechteBis(s: Eintrag, bis: string): Promise<boolean> {
	const n = differenceInCalendarDays(parseISO(bis), parseISO(s.datum));
	if (n < 1 || n === (s.naechte ?? 1)) return false;
	await daten.speichern('eintraege', { ...s, naechte: n });
	return true;
}

/** „Weiterfahren“: Übernachtung mit heute abschließen und eine offene Fahrt beginnen */
export async function weiterfahren(s: Eintrag): Promise<Eintrag> {
	const h = heute();
	await naechteBis(s, h);
	const start = s.ort ?? daten.platz(s.platz)?.ort;
	return daten.speichern('eintraege', {
		reise: s.reise,
		typ: 'drive',
		titel: `${start?.name ?? s.titel} → …`,
		datum: h,
		zeit: format(new Date(), 'HH:mm:ss'),
		von: start
	});
}
