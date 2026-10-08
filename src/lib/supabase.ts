/**
 * This is a customized Supabase JS client shim.
 * It intercepts all `supabase.from()` requests and routes them to our 
 * local Express backend (`/api/db`) which connects to Amazon RDS natively.
 * This saves us from rewriting hundreds of database calls across the frontend.
 */

class SupabaseQueryBuilder {
  private tableName: string;
  private _action: string = 'select';
  private _select: string = '*';
  private _filters: any[] = [];
  private _limit: number | null = null;
  private _order: any = null;
  private _range: any = null;
  private _single: boolean = false;
  private _maybeSingle: boolean = false;
  private _upsertData: any = null;
  private _onConflict: string | null = null;
  private _insertData: any = null;

  constructor(table: string) {
    this.tableName = table;
  }

  select(columns: string = '*') {
    this._action = 'select';
    this._select = columns;
    return this;
  }

  insert(data: any) {
    this._action = 'insert';
    this._insertData = data;
    return this;
  }

  upsert(data: any, options?: { onConflict?: string }) {
    this._action = 'upsert';
    this._upsertData = data;
    this._onConflict = options?.onConflict || null;
    return this;
  }

  update(data: any) {
    this._action = 'update';
    this._upsertData = data;
    return this;
  }

  delete() {
    this._action = 'delete';
    return this;
  }

  // Filters
  eq(col: string, val: any) { this._filters.push({ type: 'eq', col, val }); return this; }
  neq(col: string, val: any) { this._filters.push({ type: 'neq', col, val }); return this; }
  in(col: string, val: any) { this._filters.push({ type: 'in', col, val }); return this; }
  like(col: string, val: any) { this._filters.push({ type: 'like', col, val }); return this; }
  ilike(col: string, val: any) { this._filters.push({ type: 'ilike', col, val }); return this; }
  lt(col: string, val: any) { this._filters.push({ type: 'lt', col, val }); return this; }
  lte(col: string, val: any) { this._filters.push({ type: 'lte', col, val }); return this; }
  gt(col: string, val: any) { this._filters.push({ type: 'gt', col, val }); return this; }
  gte(col: string, val: any) { this._filters.push({ type: 'gte', col, val }); return this; }
  is(col: string, val: any) { this._filters.push({ type: 'is', col, val }); return this; }
  contains(col: string, val: any) { this._filters.push({ type: 'contains', col, val }); return this; }

  // Modifiers
  order(col: string, options?: { ascending?: boolean }) {
    this._order = { col, ascending: options?.ascending !== false };
    return this;
  }

  limit(n: number) {
    this._limit = n;
    return this;
  }

  range(from: number, to: number) {
    this._range = { from, to };
    return this;
  }

  single() {
    this._single = true;
    return this;
  }

  maybeSingle() {
    this._maybeSingle = true;
    return this;
  }

  // Await support
  async then(resolve?: (val: any) => void, reject?: (reason: any) => void) {
    try {
      const payload = {
        table: this.tableName,
        action: this._action,
        select: this._select,
        filters: this._filters,
        limit: this._limit,
        order: this._order,
        range: this._range,
        single: this._single,
        maybeSingle: this._maybeSingle,
        data: this._insertData || this._upsertData,
        onConflict: this._onConflict
      };

      // In browser, this resolves to the Express server
      // In SSR/tests, this needs a full URL, but Vite proxies /api anyway
      const baseUrl = typeof window === 'undefined' ? 'http://localhost:3000' : '';
      const res = await fetch(`${baseUrl}/api/db/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error?.message || resData.error || 'Database Error');
      }
      
      const result = { data: resData.data, error: null };
      if (resolve) resolve(result);
      return result;
    } catch (err: any) {
      const errorResult = { data: null, error: err };
      if (resolve) resolve(errorResult);
      return errorResult;
    }
  }
}

// Minimal mocked Auth module to prevent breakage
const authMock = {
  getUser: async () => ({ data: { user: { id: 'aws-admin' } }, error: null }),
  getSession: async () => ({ data: { session: null }, error: null }),
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  signOut: async () => ({ error: null }),
  signInWithOAuth: async () => ({ error: null }),
  signInWithPassword: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
};

// Mock channel for realtime
const channelMock = (name: string) => {
  const channelObj = {
    on: () => channelObj,
    subscribe: () => channelObj,
    unsubscribe: () => channelObj,
  };
  return channelObj;
};

export const supabase = {
  from: (table: string) => new SupabaseQueryBuilder(table),
  auth: authMock,
  channel: channelMock
};
