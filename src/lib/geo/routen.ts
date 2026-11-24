// Straßenrouten für Fahrten im Hintergrund berechnen; offline angelegte Fahrten später nachholen.
import { daten } from '#lib/db/daten.svelte.ts';
import { routeBerechnen } from './dienste.ts';

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

/** Alle Fahrten ohne Straßenroute nachrechnen (beim Start und wenn wieder Netz da ist) */
export async function offeneRoutenNachtragen() {
	if (!navigator.onLine) return;
	const offen = daten.eintraege.filter((e) => e.typ === 'drive' && e.von && e.nach && e.routeOk === false);
	for (const e of offen) {
		await routeNachtragen(e.id);
		await new Promise((r) => setTimeout(r, 1200)); // Routendienst schonen
	}
}
