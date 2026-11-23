import { Pool } from 'pg';
import format from 'pg-format';
import { Router } from 'express';
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';

const router = Router();

const rdsConfig = {
  host: 'seer-postgres-db-2.c0jo26icsslj.us-east-1.rds.amazonaws.com',
  port: 5432,
  user: 'postgres',
  password: 'SeerAdmin2026!bp6luu',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
};

const pgPool = new Pool(rdsConfig);
pgPool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

// Ensure league and country columns exist in match tables, plus opw_calibrated_rules table
pgPool.query(`
  ALTER TABLE IF EXISTS live_matches ADD COLUMN IF NOT EXISTS league TEXT, ADD COLUMN IF NOT EXISTS country TEXT;
  ALTER TABLE IF EXISTS nerdy_matches ADD COLUMN IF NOT EXISTS league TEXT, ADD COLUMN IF NOT EXISTS country TEXT;
  ALTER TABLE IF EXISTS nerdy_jackpot_matches ADD COLUMN IF NOT EXISTS league TEXT, ADD COLUMN IF NOT EXISTS country TEXT;
  CREATE TABLE IF NOT EXISTS opw_calibrated_rules (
    day TEXT PRIMARY KEY,
    categories JSONB NOT NULL,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  UPDATE live_matches SET data = data - 'lockedOpwScores' - 'lockedOpwScore' WHERE data ? 'lockedOpwScores' OR data ? 'lockedOpwScore';
  UPDATE live_matches SET data = jsonb_set(data, '{mo}', to_jsonb(REGEXP_REPLACE(data->>'mo', '[^0-9,.]', '', 'g'))) WHERE data ? 'mo' AND data->>'mo' ~ '[^0-9,.]';
  UPDATE nerdy_matches SET mo = REGEXP_REPLACE(mo, '[^0-9,.]', '', 'g'), data = jsonb_set(data, '{mo}', to_jsonb(REGEXP_REPLACE(data->>'mo', '[^0-9,.]', '', 'g'))) WHERE mo ~ '[^0-9,.]' OR (data ? 'mo' AND data->>'mo' ~ '[^0-9,.]');
  UPDATE nerdy_jackpot_matches SET mo = REGEXP_REPLACE(mo, '[^0-9,.]', '', 'g'), data = jsonb_set(data, '{mo}', to_jsonb(REGEXP_REPLACE(data->>'mo', '[^0-9,.]', '', 'g'))) WHERE mo ~ '[^0-9,.]' OR (data ? 'mo' AND data->>'mo' ~ '[^0-9,.]');
  UPDATE live_matches 
  SET league = 'Iraqi stars league', 
      country = 'Iraq',
      data = jsonb_set(jsonb_set(data, '{league}', '"Iraqi stars league"'), '{country}', '"Iraq"')
  WHERE data->>'teams' ILIKE '%kahraba%' 
     OR data->>'teams' ILIKE '%zakho%' 
     OR data->>'teams' ILIKE '%mosul%' 
     OR data->>'teams' ILIKE '%duhok%'
     OR data->>'teams' ILIKE '%mina%'
     OR data->>'teams' ILIKE '%diyala%'
     OR data->>'league' ILIKE '%iraq%';
`).catch(e => console.error('[DB API] Migration column add notice:', e.message));

// Fast, gzipped endpoint for full historical universe with multi-layer disk and stream caching
const diskGzipPath = path.join(process.cwd(), 'data', 'uploaded_matches.json.gz');
const diskMetaPath = path.join(process.cwd(), 'data', 'uploaded_matches.meta.json');
const diskJsonPath = path.join(process.cwd(), 'data', 'prm_uploaded_matches.json');

export const invalidateUploadedMatchesCache = () => {
  try {
    if (fs.existsSync(diskGzipPath)) {
      fs.unlinkSync(diskGzipPath);
    }
    if (fs.existsSync(diskMetaPath)) {
      fs.unlinkSync(diskMetaPath);
    }
  } catch (e) {}
};

const getUploadedMatchesDbMeta = async (): Promise<{ count: number; maxUpdatedAt: string }> => {
  const res = await pgPool.query('SELECT COUNT(*)::int AS cnt, COALESCE(MAX(updated_at)::text, \'\') AS max_upd FROM user_uploaded_matches');
  const row = res.rows[0] || {};
  return { count: Number(row.cnt || 0), maxUpdatedAt: String(row.max_upd || '') };
};

router.post('/uploaded-matches/invalidate', (req, res) => {
  invalidateUploadedMatchesCache();
  res.json({ success: true, message: 'Uploaded matches cache invalidated' });
});

router.get('/uploaded-matches/meta', async (req, res) => {
  try {
    const meta = await getUploadedMatchesDbMeta();
    res.json(meta);
  } catch (err: any) {
    res.status(500).json({ count: 0, maxUpdatedAt: '', error: err.message });
  }
});

router.get('/uploaded-matches', async (req, res) => {
  const forceRefresh = req.query.fresh === '1' || req.query.fresh === 'true';

  // Verify disk gzip cache freshness against RDS row count + max updated_at
  let dbMeta: { count: number; maxUpdatedAt: string } | null = null;
  let diskCacheFresh = false;
  if (!forceRefresh && fs.existsSync(diskGzipPath) && fs.existsSync(diskMetaPath)) {
    try {
      const cachedMeta = JSON.parse(fs.readFileSync(diskMetaPath, 'utf-8'));
      dbMeta = await getUploadedMatchesDbMeta();
      if (
        cachedMeta &&
        cachedMeta.count === dbMeta.count &&
        cachedMeta.maxUpdatedAt === dbMeta.maxUpdatedAt &&
        dbMeta.count > 0
      ) {
        diskCacheFresh = true;
      } else {
        invalidateUploadedMatchesCache();
      }
    } catch (e) {
      invalidateUploadedMatchesCache();
    }
  } else if (!forceRefresh && fs.existsSync(diskGzipPath) && !fs.existsSync(diskMetaPath)) {
    // Legacy unversioned gzip cache without meta sidecar — rebuild once so RDS updates are reflected
    invalidateUploadedMatchesCache();
  }

  // 1. Instant Disk Gzip Streaming (Zero Heap Memory, 5ms Delivery, Verified Fresh)
  if (!forceRefresh && diskCacheFresh && fs.existsSync(diskGzipPath)) {
    try {
      const stat = fs.statSync(diskGzipPath);
      if (stat.size > 1000) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('X-Cache', 'DISK_GZIP_STREAM');
        return fs.createReadStream(diskGzipPath).pipe(res);
      }
    } catch (e) {}
  }

  // 2. Chunked Database Stream (Fetches in 2,500 batches to strictly preserve V8 Heap < 50 MB)
  try {
    if (!dbMeta) {
      try { dbMeta = await getUploadedMatchesDbMeta(); } catch (_) {}
    }
    const dataDir = path.dirname(diskGzipPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('X-Cache', 'DB_CHUNKED_STREAM');
    const gzip = zlib.createGzip({ level: 6 });
    const tmpGzipPath = `${diskGzipPath}.tmp`;
    const cacheOut = fs.createWriteStream(tmpGzipPath);
    gzip.pipe(res);
    gzip.pipe(cacheOut);

    gzip.write('{"data":[');
    let offset = 0;
    const batchSize = 2500;
    let isFirst = true;

    while (true) {
      const result = await pgPool.query('SELECT data FROM user_uploaded_matches ORDER BY id LIMIT $1 OFFSET $2', [batchSize, offset]);
      if (result.rows.length === 0) break;

      for (const row of result.rows) {
        const m = row.data;
        if (!m) continue;
        delete m.lockedOpwScores;
        delete m.lockedOpwScore;
        const chunkStr = (isFirst ? '' : ',') + JSON.stringify(m);
        isFirst = false;
        gzip.write(chunkStr);
      }
      offset += result.rows.length;
      if (result.rows.length < batchSize) break;
    }
    gzip.write(`],"count":${offset},"error":null}`);
    cacheOut.on('finish', () => {
      try {
        fs.renameSync(tmpGzipPath, diskGzipPath);
        if (dbMeta) {
          fs.writeFileSync(diskMetaPath, JSON.stringify({ count: offset, maxUpdatedAt: dbMeta.maxUpdatedAt }), 'utf-8');
        }
      } catch (_) {}
    });
    gzip.end();
  } catch (err: any) {
    console.error("Error streaming uploaded-matches:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ data: null, error: err.message });
    }
  }
});

// Dedicated endpoint to cleanly wipe nerdy tips matches
router.post('/nerdy/delete-all', async (req, res) => {
  const { type = 'daily' } = req.body;
  try {
    const table = type === 'jackpot' ? 'nerdy_jackpot_matches' : 'nerdy_matches';
    await pgPool.query(`DELETE FROM ${format.ident(table)}`);
    console.log(`[DB API] Successfully deleted all records from ${table}`);
    res.json({ success: true, message: `All ${type} matches deleted successfully.` });
  } catch (err: any) {
    console.error(`[DB API] Error deleting ${type} matches:`, err.message);
    res.status(500).json({ error: err.message || 'Failed to delete matches' });
  }
});

// Per-date in-memory gzip cache for fast historical & daily slip loading
interface SlipsDateCacheEntry {
  json: string;
  gzip: Buffer;
  cachedAt: number;
}
const slipsDateCache = new Map<string, SlipsDateCacheEntry>();
const SLIPS_DATE_CACHE_MAX_ENTRIES = 60;
const SLIPS_ACTIVE_CACHE_TTL_MS = 5 * 60 * 1000;
const SLIPS_PAST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const invalidateSlipsDateCache = (date?: string) => {
  if (date) {
    slipsDateCache.delete(date);
  } else {
    slipsDateCache.clear();
  }
};

const sendSlipsPayload = (req: any, res: any, entry: SlipsDateCacheEntry) => {
  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Vary', 'Accept-Encoding');
  if (acceptEncoding.includes('gzip')) {
    res.setHeader('Content-Encoding', 'gzip');
    return res.status(200).send(entry.gzip);
  }
  return res.status(200).send(entry.json);
};

// Dedicated fast batch endpoint to retrieve all slips for a specific date in parallel with gzip & caching
router.get('/slips/date/:date', async (req, res) => {
  const { date } = req.params;
  const forceFresh = req.query.fresh === '1' || req.query.fresh === 'true';
  try {
    if (!forceFresh) {
      const cached = slipsDateCache.get(date);
      if (cached) {
        const todayUtc = new Date().toISOString().slice(0, 10);
        const ttl = date < todayUtc ? SLIPS_PAST_CACHE_TTL_MS : SLIPS_ACTIVE_CACHE_TTL_MS;
        if (Date.now() - cached.cachedAt < ttl) {
          return sendSlipsPayload(req, res, cached);
        }
      }
    }

    const [slipsRes, aiSlipsRes] = await Promise.all([
      pgPool.query('SELECT id, date, category, type, picks, backups, created_at FROM seer_locked_slips WHERE date = $1', [date]),
      pgPool.query('SELECT id, date, category, type, picks, backups, created_at FROM seer_ai_slips WHERE date = $1', [date]),
    ]);

    const json = JSON.stringify({
      slips: slipsRes.rows,
      aiSlips: aiSlipsRes.rows,
    });
    const gzip = zlib.gzipSync(Buffer.from(json, 'utf-8'));
    const entry: SlipsDateCacheEntry = { json, gzip, cachedAt: Date.now() };

    if (slipsRes.rows.length > 0 || aiSlipsRes.rows.length > 0) {
      if (slipsDateCache.size >= SLIPS_DATE_CACHE_MAX_ENTRIES) {
        const oldestKey = slipsDateCache.keys().next().value;
        if (oldestKey) slipsDateCache.delete(oldestKey);
      }
      slipsDateCache.set(date, entry);
    }

    return sendSlipsPayload(req, res, entry);
  } catch (err: any) {
    console.error(`[DB API] Error fetching slips for date ${date}:`, err.message);
    res.status(500).json({ error: err.message, slips: [], aiSlips: [] });
  }
});

// Dedicated fast batch endpoint to save/upsert all slips into PostgreSQL in parallel
router.post('/slips/batch', async (req, res) => {
  const { slips } = req.body;
  if (!Array.isArray(slips) || slips.length === 0) {
    return res.json({ success: true, count: 0 });
  }

  try {
    const tasks = slips.map(async (slip) => {
      if (!slip || !slip.id || !slip.date || !slip.category) return false;

      const isAi = slip.category.startsWith('ai_');
      const table = isAi ? 'seer_ai_slips' : 'seer_locked_slips';

      const picksVal = typeof slip.picks === 'string' ? slip.picks : JSON.stringify(slip.picks || []);
      const backupsVal = typeof slip.backups === 'string' ? slip.backups : JSON.stringify(slip.backups || []);
      const weightsVal = typeof slip.weightsAtTime === 'string'
        ? slip.weightsAtTime
        : JSON.stringify(slip.weightsAtTime || slip.weights_at_time || {});
      const typeVal = slip.type || 'daily';
      const createdAtVal = slip.createdAt || slip.created_at || new Date().toISOString();

      await pgPool.query(
        `INSERT INTO ${table} (id, date, category, type, picks, backups, weights_at_time, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           picks = EXCLUDED.picks,
           backups = EXCLUDED.backups,
           weights_at_time = EXCLUDED.weights_at_time,
           type = EXCLUDED.type,
           created_at = EXCLUDED.created_at`,
        [slip.id, slip.date, slip.category, typeVal, picksVal, backupsVal, weightsVal, createdAtVal]
      );
      return true;
    });

    const results = await Promise.allSettled(tasks);
    const savedCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const affectedDates = new Set<string>(slips.map((s: any) => s?.date).filter(Boolean));
    affectedDates.forEach(d => invalidateSlipsDateCache(d));
    res.json({ success: true, count: savedCount });
  } catch (err: any) {
    console.error('[DB API] Error batch saving slips:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Dedicated endpoints to permanently purge slips from PostgreSQL
router.delete('/slips/id/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pgPool.query('DELETE FROM seer_locked_slips WHERE id = $1', [id]);
    await pgPool.query('DELETE FROM seer_ai_slips WHERE id = $1', [id]);
    invalidateSlipsDateCache();
    res.json({ success: true, deleted: id });
  } catch (err: any) {
    console.error(`[DB API] Error deleting slip id ${id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/slips/date/:date', async (req, res) => {
  const { date } = req.params;
  try {
    const r1 = await pgPool.query('DELETE FROM seer_locked_slips WHERE date = $1', [date]);
    const r2 = await pgPool.query('DELETE FROM seer_ai_slips WHERE date = $1', [date]);
    invalidateSlipsDateCache(date);
    res.json({ success: true, deletedDate: date, count: (r1.rowCount || 0) + (r2.rowCount || 0) });
  } catch (err: any) {
    console.error(`[DB API] Error deleting slips for date ${date}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Dedicated endpoint to remove a deleted match pick across all slips in RDS PostgreSQL
router.post('/slips/delete-pick', async (req, res) => {
  const { date, matchId, teams } = req.body;
  if (!matchId && !teams) {
    return res.status(400).json({ error: 'matchId or teams required' });
  }

  const strId = matchId ? String(matchId) : '';
  const normTeams = (teams || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  try {
    let modifiedCount = 0;
    const modifiedSlips: string[] = [];

    for (const table of ['seer_locked_slips', 'seer_ai_slips']) {
      let queryStr = `SELECT id, date, picks FROM ${table}`;
      const params: any[] = [];
      if (date) {
        queryStr += ' WHERE date = $1';
        params.push(date);
      }
      const result = await pgPool.query(queryStr, params);

      for (const row of result.rows) {
        const rawPicks = typeof row.picks === 'string' ? JSON.parse(row.picks) : row.picks;
        if (!Array.isArray(rawPicks) || rawPicks.length === 0) continue;

        let hasDeletedMatch = false;
        const newPicks = rawPicks.filter(p => {
          const pId = String(p.match_id || '');
          if (strId && (pId === strId || pId.includes(strId) || strId.includes(pId))) {
            hasDeletedMatch = true;
            return false;
          }
          if (normTeams) {
            const pTeamNorm = (p.team || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (pTeamNorm && (pTeamNorm === normTeams || pTeamNorm.includes(normTeams) || normTeams.includes(pTeamNorm))) {
              hasDeletedMatch = true;
              return false;
            }
          }
          return true;
        });

        if (hasDeletedMatch) {
          await pgPool.query(`UPDATE ${table} SET picks = $1 WHERE id = $2`, [JSON.stringify(newPicks), row.id]);
          modifiedCount++;
          modifiedSlips.push(row.id);
        }
      }
    }

    if (modifiedCount > 0) {
      invalidateSlipsDateCache(date || undefined);
    }

    res.json({ success: true, modifiedCount, modifiedSlips });
  } catch (err: any) {
    console.error('[DB API] Error deleting pick from slips:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/query', async (req, res) => {
  const { table, action, select = '*', filters = [], limit, order, range, single, maybeSingle, data, onConflict } = req.body;

  try {
    let sql = '';
    let values: any[] = [];
    let valueCount = 1;

    // WHERE clause builder
    const buildWhere = () => {
      if (filters.length === 0) return '';
      const conditions = filters.map((f: any) => {
        const col = format.ident(f.col);
        const type = f.type;
        if (type === 'eq') {
          values.push(f.val);
          return `${col} = $${valueCount++}`;
        } else if (type === 'neq') {
          values.push(f.val);
          return `${col} != $${valueCount++}`;
        } else if (type === 'in') {
          // in clause
          values.push(f.val);
          return `${col} = ANY($${valueCount++})`;
        } else if (type === 'like') {
          values.push(f.val);
          return `${col} LIKE $${valueCount++}`;
        } else if (type === 'ilike') {
          values.push(f.val);
          return `${col} ILIKE $${valueCount++}`;
        }
        return '';
      }).filter(Boolean);
      return conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    };

    if (action === 'select') {
      const selectCols = select === '*' ? '*' : select.split(',').map((c: string) => format.ident(c.trim())).join(', ');
      sql = `SELECT ${selectCols} FROM ${format.ident(table)}`;
      sql += buildWhere();

      if (order) {
        sql += ` ORDER BY ${format.ident(order.col)} ${order.ascending ? 'ASC' : 'DESC'}`;
      }

      if (limit) {
        sql += ` LIMIT ${parseInt(limit, 10)}`;
      } else if (range) {
        const from = parseInt(range.from, 10);
        const to = parseInt(range.to, 10);
        sql += ` LIMIT ${to - from + 1} OFFSET ${from}`;
      }

    } else if (action === 'delete') {
      sql = `DELETE FROM ${format.ident(table)}`;
      sql += buildWhere();
      
    } else if (action === 'insert' || action === 'upsert') {
      const records = Array.isArray(data) ? data : [data];
      if (records.length === 0) return res.json({ data: [] });

      const keys = Object.keys(records[0]);
      const columns = keys.map(k => format.ident(k)).join(', ');
      
      const insertVals = records.map(record => {
        return `(${keys.map(k => {
          let val = record[k];
          if (k === 'jackpot_ids') {
            if (Array.isArray(val)) {
              // Retain native JS array so node-postgres binds it properly as PostgreSQL array
            } else if (typeof val === 'string' && val.trim().startsWith('[')) {
              try { val = JSON.parse(val); } catch { val = []; }
            } else if (!val) {
              val = [];
            } else {
              val = [String(val)];
            }
          } else if (val === undefined) {
            val = null;
          } else if (typeof val === 'object' && val !== null) {
            if (k === 'data' && !Array.isArray(val)) {
              const cleaned = { ...val };
              delete (cleaned as any).lockedOpwScores;
              delete (cleaned as any).lockedOpwScore;
              val = JSON.stringify(cleaned);
            } else {
              val = JSON.stringify(val);
            }
          }
          values.push(val);
          return `$${valueCount++}`;
        }).join(', ')})`;
      }).join(', ');

      sql = `INSERT INTO ${format.ident(table)} (${columns}) VALUES ${insertVals}`;

      if (action === 'upsert') {
        const conflictKeys = onConflict ? onConflict.split(',').map((k: string) => format.ident(k.trim())).join(', ') : 'id';
        const updateSets = keys.map(k => `${format.ident(k)} = EXCLUDED.${format.ident(k)}`).join(', ');
        sql += ` ON CONFLICT (${conflictKeys}) DO UPDATE SET ${updateSets}`;
      }

    } else if (action === 'update') {
      const keys = Object.keys(data);
      const updateSets = keys.map(k => {
        let val = data[k];
        if (k === 'jackpot_ids') {
          if (Array.isArray(val)) {
            // Retain native JS array so node-postgres binds it properly as PostgreSQL array
          } else if (typeof val === 'string' && val.trim().startsWith('[')) {
            try { val = JSON.parse(val); } catch { val = []; }
          } else if (!val) {
            val = [];
          } else {
            val = [String(val)];
          }
        } else if (val === undefined) {
          val = null;
        } else if (typeof val === 'object' && val !== null) {
          if (k === 'data' && !Array.isArray(val)) {
            const cleaned = { ...val };
            delete (cleaned as any).lockedOpwScores;
            delete (cleaned as any).lockedOpwScore;
            val = JSON.stringify(cleaned);
          } else {
            val = JSON.stringify(val);
          }
        }
        values.push(val);
        return `${format.ident(k)} = $${valueCount++}`;
      }).join(', ');

      sql = `UPDATE ${format.ident(table)} SET ${updateSets}`;
      sql += buildWhere();
    }

    if (action !== 'select') {
       // Return affected rows or something? Supabase usually returns nothing or the inserted rows if .select() is chained.
       // For simplicity, we just execute. If they chained select(), we can add returning *.
       // Actually, many upserts do not return data unless specified.
    }

    // console.log("Executing SQL:", sql);
    const result = await pgPool.query(sql, values);

    if (action !== 'select' && table === 'user_uploaded_matches') {
      invalidateUploadedMatchesCache();
    }
    if (action !== 'select' && (table === 'seer_locked_slips' || table === 'seer_ai_slips')) {
      invalidateSlipsDateCache();
    }

    let responseData = result.rows;
    if (single) {
      if (result.rows.length === 0) throw new Error("JSON object requested, multiple (or no) rows returned");
      responseData = result.rows[0];
    } else if (maybeSingle) {
      responseData = result.rows.length > 0 ? result.rows[0] : null;
    }

    res.json({ data: responseData, error: null });

  } catch (error: any) {
    console.error(`DB API Error (${action} on ${table}):`, error.message);
    res.status(400).json({ data: null, error: { message: error.message, details: error.detail } });
  }
});

export { pgPool };
export default router;
