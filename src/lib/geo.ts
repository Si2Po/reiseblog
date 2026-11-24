import type { LngLat, Ort } from '#lib/db/typen.ts';

/** Entfernung zweier Punkte in Metern (Haversine) */
export function abstand(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
	const R = 6371000;
	const rad = Math.PI / 180;
	const dLat = (b.lat - a.lat) * rad;
	const dLng = (b.lng - a.lng) * rad;
	const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

export const lngLat = (o: Ort): LngLat => [o.lng, o.lat];

/** „62,1007° N · 7,2059° O“ */
export function koordText(o: { lat: number; lng: number }): string {
	const f = (n: number) => Math.abs(n).toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
	return `${f(o.lat)}° ${o.lat >= 0 ? 'N' : 'S'} · ${f(o.lng)}° ${o.lng >= 0 ? 'O' : 'W'}`;
}

/** Aktueller Standort (iPhone fragt beim ersten Mal nach Erlaubnis) */
export function standort(): Promise<GeolocationPosition> {
	return new Promise((ok, fehler) => {
		if (!('geolocation' in navigator)) return fehler(new Error('Dieses Gerät kann keinen Standort liefern.'));
		navigator.geolocation.getCurrentPosition(ok, (e) => {
			const texte: Record<number, string> = {
				1: 'Standort ist nicht erlaubt. In den iPhone-Einstellungen unter Datenschutz → Ortungsdienste für Safari erlauben.',
				2: 'Standort gerade nicht verfügbar.',
				3: 'Standort hat zu lange gedauert.'
			};
			fehler(new Error(texte[e.code] ?? e.message));
		}, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
	});
}
