/*
  Abgleich mit Supabase (nur wenn in config.ts eingerichtet und angemeldet).

  Hochladen: alles aus der Outbox als Dokument (art + inhalt als JSON) per upsert;
             Fotos vorher als Datei in den Speicher-Eimer „fotos“ (<user-id>/<foto-id>.jpg).
  Abholen:   alle Dokumente mit geaendert_am > letzter Stand. Bei gleichzeitiger Änderung
             gewinnt der neuere Zeitstempel (Feld `geaendert` im Inhalt).
  Gelöscht wird nur weich (geloescht = true), damit andere Geräte es mitbekommen.
  Beispieldaten (IDs „bsp-…“) werden nie hochgeladen.
*/
import type { SupabaseClient } from '@supabase/supabase-js';
import { DB_KEY, DB_URL, abgleichMoeglich } from '#lib/config.ts';
import { db } from './db.ts';
import { daten } from './daten.svelte.ts';
import type { Basis, TabellenName } from './typen.ts';

const ART: Record<TabellenName, string> = { reisen: 'reise', eintraege: 'eintrag', plaetze: 'platz', fotos: 'foto' };
const TABELLE: Record<string, TabellenName> = { reise: 'reisen', eintrag: 'eintraege', platz: 'plaetze', foto: 'fotos' };
const TABELLEN = Object.keys(ART) as TabellenName[];

export interface Umfang {
	reisen: 'alle' | string[];
	plaetze: boolean;
	unterwegs: boolean;
	texte: boolean;
	preise: boolean;
	fotos: boolean;
}
export interface Freigabe {
	token: string;
	name: string;
	umfang: Umfang;
	widerrufen: boolean;
	erstellt_am: string;
}

function fehlerText(e: unknown): string {
	const m = (e as { message?: string })?.message ?? String(e);
	if (/Invalid login credentials/i.test(m)) return 'E-Mail oder Passwort stimmt nicht.';
	if (/already registered|already exists/i.test(m)) return 'Für diese E-Mail gibt es schon ein Konto – bitte anmelden.';
	if (/Password should be/i.test(m)) return 'Das Passwort ist zu kurz (mindestens 6 Zeichen).';
	if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Keine Verbindung – es wird später automatisch nachgeholt.';
	if (/JWT|token/i.test(m)) return 'Anmeldung abgelaufen – bitte neu anmelden.';
	return m;
}

class Abgleich {
	moeglich = abgleichMoeglich();
	email = $state<string | null>(null);
	laeuft = $state(false);
	zuletzt = $state<number | null>(null);
	fehler = $state('');
	#client: SupabaseClient | null = null;
	#uid: string | null = null;
	#nochmal = false;
	#zeit: ReturnType<typeof setTimeout> | undefined;

	async client(): Promise<SupabaseClient | null> {
		if (!this.moeglich) return null;
		if (!this.#client) {
			const { createClient } = await import('@supabase/supabase-js');
			this.#client = createClient(DB_URL, DB_KEY, {
				auth: { persistSession: true, autoRefreshToken: true, storageKey: 'reiseblog-anmeldung' }
			});
		}
		return this.#client;
	}

	/** Beim App-Start: Anmeldung wiederherstellen, regelmäßig abgleichen */
	async starten() {
		const c = await this.client();
		if (!c || daten.gast) return;
		const { data } = await c.auth.getSession();
		this.#setzen(data.session?.user ?? null);
		c.auth.onAuthStateChange((_e, s) => this.#setzen(s?.user ?? null));
		this.zuletzt = ((await db.meta.get('zuletzt'))?.wert as number) ?? null;
		daten.beobachter = () => this.bald();
		addEventListener('online', () => this.jetzt());
		document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && this.jetzt());
		setInterval(() => document.visibilityState === 'visible' && this.jetzt(), 60_000);
		if (this.email) this.jetzt();
	}

	#setzen(user: { id: string; email?: string } | null) {
		this.#uid = user?.id ?? null;
		this.email = user?.email ?? null;
	}

	async anmelden(email: string, passwort: string, neu = false) {
		const c = await this.client();
		if (!c) throw new Error('Abgleich ist nicht eingerichtet.');
		const { data, error } = neu
			? await c.auth.signUp({ email, password: passwort })
			: await c.auth.signInWithPassword({ email, password: passwort });
		if (error) throw new Error(fehlerText(error));
		if (!data.session) throw new Error('Bitte in Supabase „Confirm email“ ausschalten (siehe Anleitung).');
		this.#setzen(data.session.user);
		await this.#allesVormerken(data.session.user.id);
		await this.jetzt();
	}

	async abmelden() {
		const c = await this.client();
		await c?.auth.signOut();
		this.#setzen(null);
	}

	/** Beim ersten Anmelden eines Kontos auf diesem Gerät: alle eigenen Daten zum Hochladen vormerken */
	async #allesVormerken(uid: string) {
		const schon = (await db.meta.get('hochgeladen-fuer'))?.wert;
		if (schon === uid) return;
		await db.transaction('rw', [...TABELLEN.map((t) => db.table(t)), db.outbox, db.meta], async () => {
			for (const t of TABELLEN) {
				const ids = (await db.table(t).toCollection().primaryKeys()) as string[];
				await db.outbox.bulkPut(ids.filter((id) => !id.startsWith('bsp-')).map((id) => ({ tabelle: t, id })));
			}
			await db.meta.put({ schluessel: 'hochgeladen-fuer', wert: uid });
			await db.meta.delete('stand'); // alles vom Server einmal holen
		});
	}

	/** kurz nach einer Änderung abgleichen (mehrere Änderungen werden gebündelt) */
	bald() {
		clearTimeout(this.#zeit);
		this.#zeit = setTimeout(() => this.jetzt(), 2500);
	}

	async jetzt() {
		if (!this.email || daten.gast || !navigator.onLine) return;
		if (this.laeuft) {
			this.#nochmal = true;
			return;
		}
		this.laeuft = true;
		try {
			const c = (await this.client())!;
			await this.#hochladen(c);
			await this.#holen(c);
			this.zuletzt = Date.now();
			await db.meta.put({ schluessel: 'zuletzt', wert: this.zuletzt });
			this.fehler = '';
		} catch (e) {
			this.fehler = fehlerText(e);
			console.warn('Abgleich:', e);
		} finally {
			this.laeuft = false;
			if (this.#nochmal) {
				this.#nochmal = false;
				this.bald();
			}
		}
	}

	async #hochladen(c: SupabaseClient) {
		const liste = await db.outbox.toArray();
		if (!liste.length) return;
		const zeilen = new Map<string, { id: string; art: string; inhalt: unknown; geloescht: boolean }>();
		for (const o of liste) {
			if (o.id.startsWith('bsp-')) continue;
			const satz = (await db.table(o.tabelle).get(o.id)) as (Basis & { pfad?: string }) | undefined;
			if (!satz) continue;
			if (o.tabelle === 'fotos' && !satz.pfad && !satz.geloescht) await this.#fotoHochladen(c, satz);
			zeilen.set(satz.id, { id: satz.id, art: ART[o.tabelle], inhalt: satz, geloescht: !!satz.geloescht });
		}
		const alle = [...zeilen.values()];
		for (let i = 0; i < alle.length; i += 100) {
			const { error } = await c.from('dokumente').upsert(alle.slice(i, i + 100), { onConflict: 'id' });
			if (error) throw error;
		}
		await db.outbox.bulkDelete(liste.map((o) => o.nr!));
	}

	async #fotoHochladen(c: SupabaseClient, foto: Basis & { pfad?: string }) {
		const datei = await db.dateien.get(foto.id);
		if (!datei || !this.#uid) return;
		const pfad = `${this.#uid}/${foto.id}.jpg`;
		const { error } = await c.storage.from('fotos').upload(pfad, new Blob([datei.bild], { type: datei.typ }), { upsert: true, contentType: datei.typ });
		if (error) throw error;
		foto.pfad = pfad;
		await db.fotos.update(foto.id, { pfad });
		const imSpeicher = daten.foto(foto.id);
		if (imSpeicher) imSpeicher.pfad = pfad;
	}

	async #holen(c: SupabaseClient) {
		let stand = ((await db.meta.get('stand'))?.wert as string) ?? '1970-01-01T00:00:00Z';
		let geaendert = false;
		for (;;) {
			const { data, error } = await c
				.from('dokumente')
				.select('id, art, inhalt, geloescht, geaendert_am')
				.gt('geaendert_am', stand)
				.order('geaendert_am')
				.limit(500);
			if (error) throw error;
			for (const z of data ?? []) {
				const tabelle = TABELLE[z.art];
				if (!tabelle) continue;
				const fern = { ...(z.inhalt as Basis), geloescht: z.geloescht };
				const lokal = (await db.table(tabelle).get(z.id)) as Basis | undefined;
				if (lokal && lokal.geaendert > fern.geaendert) continue; // hier neuer → wird hochgeladen
				if (lokal && lokal.geaendert === fern.geaendert && !!lokal.geloescht === fern.geloescht) continue; // eigene Änderung
				await db.table(tabelle).put(fern);
				geaendert = true;
			}
			if (data?.length) {
				stand = data[data.length - 1].geaendert_am;
				await db.meta.put({ schluessel: 'stand', wert: stand });
			}
			if (!data || data.length < 500) break;
		}
		if (geaendert) await daten.laden();
		// gelegentlich alte Löschmarkierungen auf dem Server aufräumen
		if (Math.random() < 0.05) await c.rpc('aufraeumen');
	}

	/** Öffentliche Adresse eines hochgeladenen Fotos */
	fotoUrl(pfad: string) {
		return `${DB_URL}/storage/v1/object/public/fotos/${pfad}`;
	}

	// --- Teilen ---
	async freigaben(): Promise<Freigabe[]> {
		const c = await this.client();
		if (!c || !this.email) return [];
		const { data, error } = await c.from('freigaben').select('*').order('erstellt_am', { ascending: false });
		if (error) throw new Error(fehlerText(error));
		return data as Freigabe[];
	}
	async freigabeSpeichern(f: { token?: string; name: string; umfang: Umfang; widerrufen?: boolean }): Promise<Freigabe> {
		const c = (await this.client())!;
		const q = f.token
			? c.from('freigaben').update({ name: f.name, umfang: f.umfang, widerrufen: !!f.widerrufen }).eq('token', f.token)
			: c.from('freigaben').insert({ name: f.name, umfang: f.umfang });
		const { data, error } = await q.select().single();
		if (error) throw new Error(fehlerText(error));
		return data as Freigabe;
	}
	async freigabeLoeschen(token: string) {
		const c = (await this.client())!;
		const { error } = await c.from('freigaben').delete().eq('token', token);
		if (error) throw new Error(fehlerText(error));
	}
	/** Gast: freigegebene Daten holen (ohne Anmeldung) */
	async freigabeLesen(token: string) {
		const c = await this.client();
		if (!c) throw new Error('Diese Kopie der App ist nicht mit der Datenbank verbunden.');
		const { data, error } = await c.rpc('freigabe_lesen', { p_token: token });
		if (error) throw new Error(fehlerText(error));
		return data as { name: string; umfang: Umfang; reisen: never[]; eintraege: never[]; plaetze: never[]; fotos: never[] } | null;
	}
}

export const abgleich = new Abgleich();

/** Adresse eines Teilen-Links */
export const teilenLink = (token: string) => `${location.origin}${location.pathname}#/teilen/${token}`;
