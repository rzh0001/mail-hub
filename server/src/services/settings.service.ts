import { getDatabase } from '../database';
import type { SettingsMap } from '../types';

export function getAllSettings(): SettingsMap {
  const db = getDatabase();
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map: SettingsMap = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export function getSetting(key: string): string | null {
  const db = getDatabase();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function updateSetting(key: string, value: string): void {
  const db = getDatabase();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function updateSettings(settings: SettingsMap): SettingsMap {
  const db = getDatabase();
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      upsert.run(key, value);
    }
  });
  tx();
  return getAllSettings();
}
