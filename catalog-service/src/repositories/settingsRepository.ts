import { Pool } from 'pg';
import { getDb } from '../config/db';

export interface PlatformSettingsEntity {
  id?: string;
  _id?: string;
  platform_name: string;
  support_email: string;
  platform_logo: string;
  support_phone: string;
  created_at?: Date;
  updated_at?: Date;
}

const DEFAULT_SETTINGS: PlatformSettingsEntity = {
  platform_name: 'BHARATCLAP',
  support_email: 'support@bharatclap.com',
  platform_logo: '',
  support_phone: '+91 9876543210',
};

export class SettingsRepository {
  private static get pool(): Pool {
    return getDb();
  }

  static async getPlatformSettings(): Promise<PlatformSettingsEntity> {
    const res = await this.pool.query(
      `SELECT id, value, created_at, updated_at FROM catalog.platform_settings WHERE key = 'general' LIMIT 1`
    );

    if (res.rows.length === 0) {
      // Initialize default settings in database
      const insertRes = await this.pool.query(
        `INSERT INTO catalog.platform_settings (key, value)
         VALUES ('general', $1)
         ON CONFLICT (key) DO UPDATE SET updated_at = NOW()
         RETURNING id, value, created_at, updated_at`,
        [JSON.stringify(DEFAULT_SETTINGS)]
      );
      const row = insertRes.rows[0];
      const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      const idStr = String(row.id);
      return {
        id: idStr,
        _id: idStr,
        ...DEFAULT_SETTINGS,
        ...val,
      };
    }

    const row = res.rows[0];
    const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    const idStr = String(row.id);
    return {
      id: idStr,
      _id: idStr,
      ...DEFAULT_SETTINGS,
      ...val,
    };
  }

  static async updatePlatformSettings(updates: Partial<PlatformSettingsEntity>): Promise<PlatformSettingsEntity> {
    const current = await this.getPlatformSettings();
    const merged: PlatformSettingsEntity = {
      ...current,
      ...(updates.platform_name !== undefined && { platform_name: updates.platform_name }),
      ...(updates.support_email !== undefined && { support_email: updates.support_email }),
      ...(updates.platform_logo !== undefined && { platform_logo: updates.platform_logo }),
      ...(updates.support_phone !== undefined && { support_phone: updates.support_phone }),
    };

    const res = await this.pool.query(
      `INSERT INTO catalog.platform_settings (key, value)
       VALUES ('general', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
       RETURNING id, value, created_at, updated_at`,
      [JSON.stringify(merged)]
    );

    const row = res.rows[0];
    const val = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    const idStr = String(row.id);
    return {
      id: idStr,
      _id: idStr,
      ...merged,
      ...val,
    };
  }

  static async getSetting(key: string): Promise<any> {
    const res = await this.pool.query(
      `SELECT value FROM catalog.platform_settings WHERE key = $1 LIMIT 1`,
      [key]
    );
    if (res.rows.length === 0) return null;
    return typeof res.rows[0].value === 'string' ? JSON.parse(res.rows[0].value) : res.rows[0].value;
  }

  static async setSetting(key: string, value: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO catalog.platform_settings (key, value)
       VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, JSON.stringify(value)]
    );
  }

  static async getAllSettings(): Promise<Record<string, any>> {
    const res = await this.pool.query(`SELECT key, value FROM catalog.platform_settings`);
    const settings: Record<string, any> = {};
    for (const row of res.rows) {
      settings[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    }
    return settings;
  }
}
