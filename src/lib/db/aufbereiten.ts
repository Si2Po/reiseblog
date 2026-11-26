/*
  Ältere Datensätze in die aktuelle Form bringen (beim Laden, auch für Daten vom Server).
  Gespeichert wird die neue Form erst, wenn der Datensatz das nächste Mal geändert wird.
*/
import type { Eintrag, Merkmale, Platz, TabellenName } from './typen.ts';
import { merkmal } from '#lib/merkmale.ts';
import { neueId } from './id.ts';

type Alt = Record<string, unknown>;

function platz(p: Platz & Alt): Platz {
	const alt = 'ausstattung' in p || 'url' in p || 'untergrund' in p || !p.merkmale || !p.links;
	if (!alt) return p;
	const merkmale: Merkmale = { ...(p.merkmale ?? {}) };
	let notiz = p.notiz;
	if (Array.isArray(p.ausstattung)) for (const k of p.ausstattung as string[]) merkmale[k] = true;
	if (typeof p.untergrund === 'string' && p.untergrund) {
		const opt = merkmal('untergrund')?.optionen?.find((o) => o.key === (p.untergrund as string).toLowerCase() || o.name.toLowerCase() === (p.untergrund as string).toLowerCase());
		if (opt) merkmale.untergrund = opt.key;
		else notiz = [notiz, `Untergrund: ${p.untergrund}`].filter(Boolean).join('\n');
	}
	const links = [...((p.links as string[]) ?? []), ...(typeof p.url === 'string' && p.url ? [p.url] : [])];
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { ausstattung, untergrund, url, ...rest } = p;
	return { ...rest, merkmale, links, notiz } as Platz;
}

function eintrag(e: Eintrag & Alt): Eintrag {
	// „Event“ gibt es nicht mehr: zählt jetzt als Ausflug
	const event = (e.typ as string) === 'event';
	if (!('privat' in e) && !(e.typ === 'stay' && e.text) && !event) return e;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { privat, ...rest } = e;
	if (event) rest.typ = 'outing';
	if (rest.typ === 'stay' && rest.text) {
		rest.notizen = [...(rest.notizen ?? []), { id: neueId(), zeit: `${rest.datum}T20:00`, text: rest.text }];
		delete rest.text;
	}
	return rest as Eintrag;
}

export function aufbereiten<T>(tabelle: TabellenName, satz: T): T {
	if (tabelle === 'plaetze') return platz(satz as Platz & Alt) as T;
	if (tabelle === 'eintraege') return eintrag(satz as Eintrag & Alt) as T;
	return satz;
}
