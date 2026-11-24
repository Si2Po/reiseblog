// Erzeugt die PNG-Icons aus static/icons/icon.svg (einmalig bzw. nach Änderung am Icon).
import { webkit } from 'playwright';
import { readFileSync } from 'node:fs';

const svg = readFileSync('static/icons/icon.svg', 'utf8');
const b = await webkit.launch();
const p = await b.newPage();
async function png(datei, groesse, rand = 0) {
	await p.setViewportSize({ width: groesse, height: groesse });
	// rand: Sicherheitszone für „maskable“ (Android schneidet rund/oval zu)
	await p.setContent(`<body style="margin:0;background:#1d5c3a"><div style="width:${groesse}px;height:${groesse}px;display:grid;place-items:center">
		<div style="width:${groesse * (1 - rand)}px;height:${groesse * (1 - rand)}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div></body>`);
	await p.screenshot({ path: `static/icons/${datei}`, omitBackground: false });
}
await png('apple-touch-icon.png', 180);
await png('icon-192.png', 192);
await png('icon-512.png', 512);
await png('maskable-512.png', 512, 0.2);
await b.close();
console.log('Icons erzeugt');
