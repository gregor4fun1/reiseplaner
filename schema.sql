CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  admin_key TEXT NOT NULL UNIQUE,
  view_key TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  trip_id INTEGER NOT NULL REFERENCES trips(id),
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  place TEXT,
  lat REAL,
  lon REAL,
  date TEXT,
  end_date TEXT,
  time TEXT,
  note TEXT,
  url TEXT,
  author TEXT,
  images TEXT,        -- Bild-Links, einer pro Zeile
  parent_id INTEGER,  -- Aufenthalt, zu dem ein Tagesausflug gehört
  leg TEXT            -- Weiterfahrt zur nächsten Station: faehre, flug, zug; leer = Auto
);
CREATE INDEX IF NOT EXISTS items_trip ON items(trip_id);

-- Zwischenspeicher für berechnete Routen, Schlüssel "lat,lon;lat,lon"
CREATE TABLE IF NOT EXISTS routes (
  k TEXT PRIMARY KEY,
  json TEXT NOT NULL
);
