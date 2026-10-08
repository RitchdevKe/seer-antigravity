import { Pool } from 'pg';
import format from 'pg-format';
import { Router } from 'express';
import zlib from 'zlib';

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

// Fast, gzipped endpoint for full historical universe
router.get('/uploaded-matches', async (req, res) => {
  try {
    const result = await pgPool.query('SELECT data FROM user_uploaded_matches');
    const matches = result.rows.map(r => r.data).filter(Boolean);
    const jsonString = JSON.stringify({ data: matches, count: matches.length, error: null });
    
    zlib.gzip(Buffer.from(jsonString, 'utf-8'), (err, buffer) => {
      if (err) {
        console.error("Gzip compression failed:", err);
        return res.json({ data: matches, count: matches.length, error: null });
      }
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    });
  } catch (err: any) {
    console.error("Error streaming uploaded-matches:", err.message);
    res.status(500).json({ data: null, error: err.message });
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
          if (Array.isArray(val)) {
            val = '{' + val.map(v => '"' + String(v).replace(/"/g, '\\"') + '"').join(',') + '}';
          } else if (typeof val === 'object' && val !== null) {
            val = JSON.stringify(val);
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
        values.push(data[k]);
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

export default router;
