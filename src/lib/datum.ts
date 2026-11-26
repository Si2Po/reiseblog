import { format, parseISO, differenceInCalendarDays, addDays } from 'date-fns';
import { de } from 'date-fns/locale';

const d = (s: string) => parseISO(s);

/** Heutiges Datum als JJJJ-MM-TT (lokale Zeit) */
export const heute = () => format(new Date(), 'yyyy-MM-dd');

/** „5.–19. Juli 2025“, „28. Juni – 3. Juli 2025“, „30. Dez. 2024 – 4. Jan. 2025“, „seit 3. Mai 2026“ */
export function zeitraum(start: string, ende: string | undefined): string {
	if (!ende || ende === start) return ende ? format(d(start), 'd. MMMM yyyy', { locale: de }) : `seit ${format(d(start), 'd. MMMM yyyy', { locale: de })}`;
	const a = d(start),
		b = d(ende);
	if (a.getFullYear() !== b.getFullYear()) return `${format(a, 'd. MMM yyyy', { locale: de })} – ${format(b, 'd. MMM yyyy', { locale: de })}`;
	if (a.getMonth() !== b.getMonth()) return `${format(a, 'd. MMMM', { locale: de })} – ${format(b, 'd. MMMM yyyy', { locale: de })}`;
	return `${format(a, 'd.')}–${format(b, 'd. MMMM yyyy', { locale: de })}`;
}

/** „Mo, 7. Juli“ */
export const tagLang = (s: string) => format(d(s), 'EEEEEE, d. MMMM', { locale: de });
/** „Juli 2025“ */
export const monatJahr = (s: string) => format(d(s), 'MMMM yyyy', { locale: de });
export const jahr = (s: string) => format(d(s), 'yyyy');
export const kurz = (s: string) => format(d(s), 'd. MMM yyyy', { locale: de });
/** „Do, 26. Nov. 2026“ */
export const tagMitJahr = (s: string) => format(d(s), 'EEEEEE, d. MMM yyyy', { locale: de });
/** Reisetag 1, 2, … */
export const reiseTag = (start: string, s: string) => differenceInCalendarDays(d(s), d(start)) + 1;

/** „3 h 40 min“ */
export function dauer(min: number): string {
	const h = Math.floor(min / 60),
		m = min % 60;
	return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

export const zahl = (n: number) => n.toLocaleString('de-DE');

/** „38 €“, „420 NOK“, „gratis“ */
export function preisText(preis: number | undefined, waehrung = 'EUR'): string {
	if (preis === undefined || preis === null) return '';
	if (preis === 0) return 'gratis';
	const symbol: Record<string, string> = { EUR: '€', CHF: 'CHF', NOK: 'NOK', SEK: 'SEK', DKK: 'DKK', GBP: '£', HRK: 'kn', CZK: 'Kč', PLN: 'zł' };
	return `${preis.toLocaleString('de-DE', { maximumFractionDigits: 2 })} ${symbol[waehrung] ?? waehrung}`;
}

/** Notiz-Zeitpunkt „Sa, 12. Juli · 20:30“ */
export const notizZeit = (z: string) => format(parseISO(z), "EEEEEE, d. MMMM · HH:mm", { locale: de });

/** Datum + n Tage (JJJJ-MM-TT) */
export const plusTage = (s: string, n: number) => format(addDays(d(s), n), 'yyyy-MM-dd');
