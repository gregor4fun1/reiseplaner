// Legt den Vorschlag „Skandinavien 2027“ als neue Reise an.
// Aufruf: node scripts/seed-skandinavien.mjs http://localhost:8788
// Koordinaten der Hütten sind Platzhalter für die Region, Fährzeiten sind Richtwerte.
const base = process.argv[2];
if (!base) throw new Error('Adresse fehlt, z. B. http://localhost:8788');
const post = async (path, body) => {
  const r = await fetch(`${base}/api/trips${path}`, { method: 'POST', body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${body.title || path}: ${r.status} ${await r.text()}`);
  return r.json();
};
const trip = await post('', { name: 'Skandinavien 2027' });
const add = it => post(`/${trip.adminKey}/items`, { author: 'Claude', ...it });
const F = 'fahrt', U = 'unterkunft', A = 'aktivitaet';

// ---- Anreise ----
await add({ kind: F, title: 'Abfahrt Wiener Neustadt', date: '2027-07-03', time: '07:00', lat: 47.813, lon: 16.243, place: 'Wiener Neustadt',
  note: 'Rund 520 km bis Dresden über Brünn und Prag, etwa 6 Stunden. Vignette für Tschechien nötig.' });
await add({ kind: U, title: 'Übernachtung Dresden', date: '2027-07-03', time: '15:00', lat: 51.050, lon: 13.737, place: 'Dresden',
  note: 'Zwischenstopp, damit die Fähre am nächsten Tag ohne Stress erreichbar ist. Abends Altstadt.' });
await add({ kind: F, title: 'Nachtfähre Kiel → Göteborg', date: '2027-07-04', time: '18:45', lat: 54.318, lon: 10.140, place: 'Kiel, Schwedenkai',
  url: 'https://www.stenaline.de', note: 'Stena Line, Abfahrt etwa 18:45, Ankunft etwa 09:15. Ab Dresden 560 km: spätestens 09:00 losfahren, Einchecken etwa 2 Stunden vorher. Kabine früh buchen. Zeiten für 2027 prüfen.' });

// ---- Schweden ----
await add({ kind: A, title: 'Ankunft Göteborg, Stadtbummel', date: '2027-07-05', time: '09:15', lat: 57.7089, lon: 11.9746, place: 'Göteborg',
  note: 'Haga-Viertel, Fischhalle Feskekôrka, Zimtschnecke. Am Nachmittag 180 km zur Hütte, vorher Großeinkauf.' });
const dalsland = await add({ kind: U, title: 'Hütte in Dalsland', date: '2027-07-05', end_date: '2027-07-12', time: '16:00', lat: 59.029, lon: 12.226, place: 'Raum Bengtsfors, Dalsland (Platzhalter)',
  note: 'Noch zu buchen: Stuga am See mit Boot und Sauna, Raum Bengtsfors oder Lelång. Zum Angeln braucht man die Fischereikarte (Fiskekort) für den jeweiligen See.' });
const se = it => add({ parent_id: dalsland.id, kind: A, ...it });
await se({ title: 'Aquädukt Håverud und Dalsland-Kanal', date: '2027-07-07', lat: 58.821, lon: 12.411, place: 'Håverud',
  note: 'Schleusen und Aquädukt, Bootsfahrt auf dem Kanal möglich. Halber Tag.' });
await se({ title: 'Bohuslän-Küste: Fjällbacka und Smögen', date: '2027-07-09', lat: 58.599, lon: 11.288, place: 'Fjällbacka',
  note: 'Langer Tagesausflug an die Schärenküste: Kungsklyftan in Fjällbacka, Holzstege und Krabben in Smögen.' });
await se({ title: 'Nationalpark Tresticklan', date: '2027-07-10', lat: 58.985, lon: 11.775, place: 'Tresticklan, bei Ed',
  note: 'Wanderung durch unberührten Wald und über Felsrücken, Rundwege von 8 bis 16 km. Lage des Parkplatzes ungefähr.' });
await se({ title: 'Kanutour auf dem Lelång', note: 'Kanuverleih in Bengtsfors. Idee für einen windstillen Tag.' });
await se({ title: 'Angeltag und Sauna an der Hütte', note: 'Hecht, Barsch und Zander. Fiskekort online kaufen.' });

// ---- Überfahrt nach Norwegen ----
await add({ kind: A, title: 'Stabkirche Heddal', date: '2027-07-12', time: '13:00', lat: 59.579, lon: 9.176, place: 'Heddal, Notodden',
  note: 'Größte Stabkirche Norwegens, guter Stopp auf halbem Weg. Ab der Hütte etwa 290 km.' });
await add({ kind: U, title: 'Übernachtung Rjukan', date: '2027-07-12', time: '17:00', lat: 59.879, lon: 8.594, place: 'Rjukan',
  note: 'Teilt die lange Strecke von Dalsland zum Hardangerfjord (zusammen rund 560 km).' });
await add({ kind: A, title: 'Gaustatoppen (wenn das Wetter passt)', date: '2027-07-13', time: '08:00', lat: 59.846, lon: 8.700, place: 'Stavsro',
  note: 'Aufstieg ab Stavsro etwa 2 bis 3 Stunden, oder mit der Gaustabanen im Berg nach oben. Danach 230 km über das Haukelifjell.' });

// ---- Norwegen ----
const hardanger = await add({ kind: U, title: 'Hütte am Hardangerfjord', date: '2027-07-13', end_date: '2027-07-21', time: '17:00', lat: 60.326, lon: 6.657, place: 'Raum Lofthus, Hardanger (Platzhalter)',
  note: 'Noch zu buchen: Hütte am Fjord mit Boot und Sauna, Raum Lofthus, Kinsarvik oder Ullensvang. Angeln im Fjord (Salzwasser) geht ohne Lizenz.' });
const no = it => add({ parent_id: hardanger.id, kind: A, ...it });
await no({ title: 'Dronningstien (Panoramaweg)', date: '2027-07-14', lat: 60.365, lon: 6.705, place: 'Røte, Kinsarvik',
  note: 'Höhenweg von Kinsarvik nach Lofthus mit Fjordblick, 16 km, 6 bis 8 Stunden. Lage des Einstiegs ungefähr.' });
await no({ title: 'Vøringsfossen und Hardangervidda', date: '2027-07-15', lat: 60.427, lon: 7.252, place: 'Vøringsfossen',
  note: 'Wasserfall mit Stegbrücke, danach Panoramastraße Rv7 über die Hochebene.' });
await no({ title: 'Ruhetag: Angeln und Boot auf dem Fjord', date: '2027-07-16', note: 'Puffer nach den ersten Wanderungen und vor der Trolltunga.' });
await no({ title: 'Trolltunga', date: '2027-07-17', time: '07:00', lat: 60.131, lon: 6.628, place: 'Skjeggedal, Tyssedal',
  url: 'https://trolltunga.com', note: 'Hin und zurück 20 bis 27 km je nach Parkplatz, 8 bis 12 Stunden. Parkplatz vorab buchen. Nur bei gutem Wetter, sonst mit dem Ruhetag tauschen.' });
await no({ title: 'Buerbreen: Wanderung zum Gletscher', date: '2027-07-18', lat: 60.036, lon: 6.497, place: 'Buer, Odda',
  note: 'Leichter als die Trolltunga: etwa 3 Stunden hin und zurück bis zur Gletscherzunge.' });
await no({ title: 'Bergen: Bryggen und Fløyen', date: '2027-07-19', lat: 60.397, lon: 5.324, place: 'Bergen',
  note: 'Stadttag. Je Richtung etwa 2,5 Stunden Fahrt mit Fähre oder Tunnel.' });
await no({ title: 'Husedalen: vier Wasserfälle', date: '2027-07-20', lat: 60.368, lon: 6.740, place: 'Kinsarvik',
  note: 'Wanderung entlang von vier Wasserfällen, 4 bis 6 Stunden. Lage des Einstiegs ungefähr.' });
await no({ title: 'Steinsdalsfossen', lat: 60.371, lon: 6.103, place: 'Norheimsund', note: 'Wasserfall, hinter dem man durchgehen kann. Idee für einen Regentag.' });
await no({ title: 'Flåm und Aussichtspunkt Stegastein', lat: 60.908, lon: 7.212, place: 'Aurland', note: 'Langer Tag (je Richtung 2,5 bis 3 Stunden): Flåmsbana, Landschaftsroute Aurlandsfjellet.' });

// ---- Heimreise ----
await add({ kind: A, title: 'Pause in Geilo', date: '2027-07-21', time: '12:30', lat: 60.534, lon: 8.206, place: 'Geilo',
  note: 'Rückfahrt über die Hardangervidda (Rv7), bis Oslo rund 350 km.' });
await add({ kind: U, title: 'Übernachtung Oslo', date: '2027-07-21', time: '17:00', lat: 59.911, lon: 10.757, place: 'Oslo' });
await add({ kind: A, title: 'Oslo: Oper und Vigelandpark', date: '2027-07-22', time: '09:00', lat: 59.927, lon: 10.700, place: 'Vigelandpark, Oslo',
  note: 'Vormittag in der Stadt, bis 12:30 am Fährterminal sein.' });
await add({ kind: F, title: 'Nachtfähre Oslo → Kiel', date: '2027-07-22', time: '14:00', lat: 59.910, lon: 10.700, place: 'Oslo, Hjortnes',
  url: 'https://www.colorline.de', note: 'Color Line, Abfahrt etwa 14:00, Ankunft in Kiel etwa 10:00. Kabine früh buchen. Zeiten für 2027 prüfen.' });
await add({ kind: F, title: 'Ankunft Kiel, Fahrt nach Dresden', date: '2027-07-23', time: '10:00', lat: 54.316, lon: 10.147, place: 'Kiel, Norwegenkai', note: '560 km, etwa 6 Stunden.' });
await add({ kind: U, title: 'Übernachtung Dresden (Rückweg)', date: '2027-07-23', time: '17:00', lat: 51.050, lon: 13.737, place: 'Dresden' });
await add({ kind: 'sonstiges', title: 'Ankunft Wiener Neustadt', date: '2027-07-24', time: '16:00', lat: 47.813, lon: 16.243, place: 'Wiener Neustadt' });

console.log(`Admin:  ${base}/#${trip.adminKey}\nViewer: ${base}/#${trip.viewKey}`);
