import { pool } from '../db';
const TABLES = [
    `CREATE TABLE IF NOT EXISTS discover_categories (
    id varchar(36) NOT NULL,
    kind enum('audio','video','album') NOT NULL,
    name_en varchar(150) NOT NULL,
    name_ta varchar(150) DEFAULT NULL,
    sort_order int NOT NULL DEFAULT 0,
    created_at datetime DEFAULT current_timestamp(),
    PRIMARY KEY (id),
    KEY idx_dcat_kind (kind)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS discover_audio (
    id varchar(36) NOT NULL,
    category_id varchar(36) DEFAULT NULL,
    title_en varchar(255) NOT NULL,
    title_ta varchar(255) DEFAULT NULL,
    audio_url varchar(500) DEFAULT NULL,
    cover_url varchar(500) DEFAULT NULL,
    item_date date DEFAULT NULL,
    status enum('draft','published') NOT NULL DEFAULT 'draft',
    sort_order int NOT NULL DEFAULT 0,
    created_at datetime DEFAULT current_timestamp(),
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS discover_audio_classes (
    id varchar(36) NOT NULL,
    audio_id varchar(36) NOT NULL,
    title_en varchar(255) NOT NULL,
    title_ta varchar(255) DEFAULT NULL,
    audio_url varchar(500) NOT NULL,
    class_date date DEFAULT NULL,
    sort_order int NOT NULL DEFAULT 0,
    created_at datetime DEFAULT current_timestamp(),
    PRIMARY KEY (id),
    KEY idx_dclass_audio (audio_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS discover_video (
    id varchar(36) NOT NULL,
    category_id varchar(36) DEFAULT NULL,
    title_en varchar(255) NOT NULL,
    title_ta varchar(255) DEFAULT NULL,
    youtube_id varchar(20) DEFAULT NULL,
    youtube_url varchar(300) DEFAULT NULL,
    item_date date DEFAULT NULL,
    status enum('draft','published') NOT NULL DEFAULT 'draft',
    sort_order int NOT NULL DEFAULT 0,
    created_at datetime DEFAULT current_timestamp(),
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS discover_video_classes (
    id varchar(36) NOT NULL,
    video_id varchar(36) NOT NULL,
    title_en varchar(255) NOT NULL,
    title_ta varchar(255) DEFAULT NULL,
    youtube_id varchar(20) NOT NULL,
    youtube_url varchar(300) NOT NULL,
    class_date date DEFAULT NULL,
    sort_order int NOT NULL DEFAULT 0,
    created_at datetime DEFAULT current_timestamp(),
    PRIMARY KEY (id),
    KEY idx_dvclass_video (video_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS discover_albums (
    id varchar(36) NOT NULL,
    category_id varchar(36) DEFAULT NULL,
    title_en varchar(255) NOT NULL,
    title_ta varchar(255) DEFAULT NULL,
    cover_url varchar(500) DEFAULT NULL,
    item_date date DEFAULT NULL,
    status enum('draft','published') NOT NULL DEFAULT 'draft',
    sort_order int NOT NULL DEFAULT 0,
    created_at datetime DEFAULT current_timestamp(),
    PRIMARY KEY (id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS discover_album_photos (
    id varchar(36) NOT NULL,
    album_id varchar(36) NOT NULL,
    image_url varchar(500) NOT NULL,
    sort_order int NOT NULL DEFAULT 0,
    created_at datetime DEFAULT current_timestamp(),
    PRIMARY KEY (id),
    KEY idx_dphoto_album (album_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];
async function addColumn(table, column, definition) {
    const [r] = await pool.query(`SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`, [table, column]);
    if (!r.length)
        await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
async function run() {
    try {
        for (const q of TABLES)
            await pool.query(q);
        await addColumn('discover_audio', 'kind', `enum('single','series') NOT NULL DEFAULT 'single'`);
        await pool.query('ALTER TABLE discover_audio MODIFY audio_url varchar(500) DEFAULT NULL');
        await addColumn('discover_video', 'kind', `enum('single','series') NOT NULL DEFAULT 'single'`);
        await pool.query('ALTER TABLE discover_video MODIFY youtube_id varchar(20) DEFAULT NULL, MODIFY youtube_url varchar(300) DEFAULT NULL');
        // Optimised copies of album photos (image_url stays the original)
        await addColumn('discover_album_photos', 'web_url', 'varchar(500) DEFAULT NULL');
        await addColumn('discover_album_photos', 'thumb_url', 'varchar(500) DEFAULT NULL');
        await addColumn('discover_albums', 'cover_thumb_url', 'varchar(500) DEFAULT NULL');
        console.log('[Discover] Tables are ready.');
        return true;
    }
    catch (e) {
        console.error('[Discover] Could not create the tables:', e?.sqlMessage || e?.message || e);
        return false;
    }
}
// Runs once; if it failed, the next request tries again
let ready = null;
export function ensureDiscoverTables() {
    if (!ready) {
        ready = run().then((ok) => {
            if (!ok)
                ready = null;
            return ok;
        });
    }
    return ready;
}
void ensureDiscoverTables();
