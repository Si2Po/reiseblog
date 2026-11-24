/*
  Zentraler Datenspeicher der App.
  Alle (nicht gelöschten) Reisen, Einträge, Plätze und Fotos liegen reaktiv im Speicher –
  es sind nur ein paar hundert bis tausend Datensätze, das ist schnell und einfach.
  Jede Änderung geht sofort in IndexedDB und in die Outbox; der Abgleich (abgleich.svelte.ts)
  wird über `beobachter` angestoßen.
  Gast-Modus (geteilter Link): Daten nur im Speicher, nichts wird gespeichert.
*/
import { db } from './db.ts';
import type { Basis, Tabellen, TabellenName } from './typen.ts';

type Liste<T extends TabellenName> = Tabellen[T][];

export interface GastDaten {
	name: string;
	reisen: Tabellen['reisen'][];
	eintraege: Tabellen['eintraege'][];
	plaetze: Tabellen['plaetze'][];
	fotos: Tabellen['fotos'][];
}

class Daten {
	reisen = $state<Liste<'reisen'>>([]);
	eintraege = $state<Liste<'eintraege'>>([]);
	plaetze = $state<Liste<'plaetze'>>([]);
	fotos = $state<Liste<'fotos'>>([]);
	geladen = $state(false);
	/** gesetzt, wenn ein geteilter Link angesehen wird (Name der Freigabe) */
	gast = $state<string | null>(null);
	/** wird nach jeder Änderung aufgerufen (Abgleich anstoßen) */
	beobachter: (() => void) | null = null;

	async laden() {
		const [r, e, p, f] = await Promise.all([db.reisen.toArray(), db.eintraege.toArray(), db.plaetze.toArray(), db.fotos.toArray()]);
		if (this.gast) return; // währenddessen wurde ein geteilter Link geöffnet
		this.reisen = r.filter((x) => !x.geloescht);
		this.eintraege = e.filter((x) => !x.geloescht);
		this.plaetze = p.filter((x) => !x.geloescht);
		this.fotos = f.filter((x) => !x.geloescht);
		this.geladen = true;
	}

	/** Geteilte Daten anzeigen (nur im Speicher) */
	gastLaden(g: GastDaten) {
		this.gast = g.name;
		this.reisen = g.reisen;
		this.eintraege = g.eintraege;
		this.plaetze = g.plaetze;
		this.fotos = g.fotos;
		this.geladen = true;
	}

	/** Anlegen oder ändern. Gibt den gespeicherten Datensatz zurück. */
	async speichern<T extends TabellenName>(tabelle: T, wert: Omit<Tabellen[T], keyof Basis> & Partial<Basis>): Promise<Tabellen[T]> {
		const neu = { ...wert, id: wert.id ?? crypto.randomUUID(), geaendert: Date.now(), geloescht: false } as Tabellen[T];
		const sauber = $state.snapshot(neu) as Tabellen[T];
		if (this.gast) return sauber;
		await db.transaction('rw', db.table(tabelle), db.outbox, async () => {
			await db.table(tabelle).put(sauber);
			await db.outbox.put({ tabelle, id: sauber.id });
		});
		const liste = this[tabelle] as Tabellen[T][];
		const i = liste.findIndex((x) => x.id === sauber.id);
		if (i >= 0) liste[i] = sauber;
		else liste.push(sauber);
		this.beobachter?.();
		return sauber;
	}

	/** Weich löschen. Gibt eine Funktion zum Rückgängigmachen zurück. */
	async loeschen(tabelle: TabellenName, id: string): Promise<() => Promise<void>> {
		const alt = await db.table(tabelle).get(id);
		if (!alt || this.gast) return async () => {};
		await db.transaction('rw', db.table(tabelle), db.outbox, async () => {
			await db.table(tabelle).put({ ...alt, geloescht: true, geaendert: Date.now() });
			await db.outbox.put({ tabelle, id });
		});
		const liste = this[tabelle] as Basis[];
		const i = liste.findIndex((x) => x.id === id);
		if (i >= 0) liste.splice(i, 1);
		this.beobachter?.();
		return async () => {
			await this.speichern(tabelle, { ...alt, geloescht: false });
		};
	}

	/** Mehrere Löschungen auf einmal, mit einem gemeinsamen Rückgängig. */
	async loeschenAlle(teile: [TabellenName, string][]): Promise<() => Promise<void>> {
		const zurueck: (() => Promise<void>)[] = [];
		for (const [t, id] of teile) zurueck.push(await this.loeschen(t, id));
		return async () => {
			for (const z of zurueck) await z();
		};
	}

	reise = (id: string | undefined) => this.reisen.find((x) => x.id === id);
	eintrag = (id: string | undefined) => this.eintraege.find((x) => x.id === id);
	platz = (id: string | undefined) => this.plaetze.find((x) => x.id === id);
	foto = (id: string | undefined) => this.fotos.find((x) => x.id === id);
}

export const daten = new Daten();
