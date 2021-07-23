CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY NOT NULL,
  username TEXT,
  telegram_id INTEGER NOT NULL UNIQUE,
  date TEXT NOT NULL,
  role INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY NOT NULL,
  file_name TEXT NOT NULL,
  telegram_id INTEGER NOT NULL REFERENCES users(telegram_id),
  date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS result (
  id INTEGER PRIMARY KEY NOT NULL,
  image_id INTEGER NOT NULL REFERENCES images(id),
  file_name TEXT NOT NULL,
  segment_size TEXT NOT NULL,
  date TEXT NOT NULL
);