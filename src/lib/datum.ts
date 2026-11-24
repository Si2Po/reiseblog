import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { de } from 'date-fns/locale';

const d = (s: string) => parseISO(s);

/** „5.–19. Juli 2025“, „28. Juni – 3. Juli 2025“, „30. Dez. 2024 – 4. Jan. 2025“ */
export function zeitraum(start: string, ende: string): string {
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
/** Reisetag 1, 2, … */
export const reiseTag = (start: string, s: string) => differenceInCalendarDays(d(s), d(start)) + 1;

/** „3 h 40 min“ */
export function dauer(min: number): string {
	const h = Math.floor(min / 60),
		m = min % 60;
	return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

export const zahl = (n: number) => n.toLocaleString('de-DE');
