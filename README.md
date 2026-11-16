# Reiseplaner

Gemeinsam Reisen planen: Karte, Tagesplan, Ideen. Zwei Links pro Reise (Admin und Viewer), Zugriff für Claude per MCP unter `/mcp`. Entwurf: `docs/superpowers/specs/2026-11-16-reiseplaner-design.md`.

## Lokal

```bash
npm install
npm run db:local
npm run dev        # http://localhost:8788
npm test
```

## Veröffentlichen (Cloudflare)

```bash
npx wrangler login
npx wrangler d1 create reiseplaner     # ausgegebene database_id in wrangler.toml eintragen
npm run db:remote
npm run deploy                         # legt beim ersten Mal das Pages-Projekt an
npx wrangler pages secret put ORS_KEY  # optional: Schlüssel von openrouteservice.org für Straßenrouten
```

## OpenRouteService-Schlüssel

1. Auf https://openrouteservice.org ein kostenloses Konto anlegen und die E-Mail bestätigen.
2. Im Dashboard einen API-Schlüssel (Token) im kostenlosen Tarif erzeugen und kopieren.
3. Lokal: Datei `.dev.vars` im Projektordner anlegen mit der Zeile `ORS_KEY=dein-schlüssel`, dann `npm run dev` neu starten. Die Datei ist von Git ausgenommen.
4. Veröffentlicht: `npx wrangler pages secret put ORS_KEY` ausführen, den Schlüssel einfügen, danach `npm run deploy`.

Ohne `ORS_KEY` zeichnet die Karte gerade Linien zwischen den Stationen.
