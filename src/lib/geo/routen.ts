// Straßenrouten für Fahrten im Hintergrund berechnen; offline angelegte Fahrten später nachholen.
import { daten } from '#lib/db/daten.svelte.ts';
import { routeBerechnen } from './dienste.ts';
import { abstand } from '#lib/geo.ts';
import type { Ort } from '#lib/db/typen.ts';

const laeuft = new Set<string>();

export async function routeNachtragen(id: string): Promise<boolean> {
	const e = daten.eintrag(id);
	if (!e || e.typ !== 'drive' || !e.von || !e.nach || laeuft.has(id)) return false;
	laeuft.add(id);
	try {
		const r = await routeBerechnen([e.von, ...(e.via ?? []), e.nach]);
		const aktuell = daten.eintrag(id);
		if (aktuell) await daten.speichern('eintraege', { ...aktuell, ...r, routeOk: true });
		return true;
	} catch {
		const aktuell = daten.eintrag(id);
		if (aktuell && aktuell.routeOk !== false) await daten.speichern('eintraege', { ...aktuell, routeOk: false });
		return false;
	} finally {
		laeuft.delete(id);
	}
}

/**
 * Zwischenziel an der Stelle einfügen, an der es den kleinsten Umweg macht
 * (z. B. Sipplingen → Erding, neuer Punkt Ravensburg → landet zwischen beiden).
 */
export function viaEinfuegen<T extends { lat: number; lng: number }>(von: T, via: T[], nach: T, neu: T): T[] {
	const punkte = [von, ...via, nach];
	let beste = 0,
		umweg = Infinity;
	for (let i = 0; i < punkte.length - 1; i++) {
		const u = abstand(punkte[i], neu) + abstand(neu, punkte[i + 1]) - abstand(punkte[i], punkte[i + 1]);
		if (u < umweg) (umweg = u), (beste = i);
	}
	const liste = [...via];
	liste.splice(beste, 0, neu);
	return liste;
}

/** Fahrt über einen weiteren Punkt führen und die Route neu berechnen */
export async function fahrtUeber(id: string, ort: Ort) {
	const e = daten.eintrag(id);
	if (!e || e.typ !== 'drive' || !e.von || !e.nach) return;
	const via = viaEinfuegen(e.von, e.via ?? [], e.nach, ort);
	await daten.speichern('eintraege', { ...e, via, routeOk: false });
	return routeNachtragen(id);
}

/** Alle Fahrten ohne Straßenroute nachrechnen (beim Start und wenn wieder Netz da ist) */
export async function offeneRoutenNachtragen() {
	if (!navigator.onLine) return;
	const offen = daten.eintraege.filter((e) => e.typ === 'drive' && e.von && e.nach && e.routeOk === false);
	for (const e of offen) {
		await routeNachtragen(e.id);
		await new Promise((r) => setTimeout(r, 1200)); // Routendienst schonen
	}
}
