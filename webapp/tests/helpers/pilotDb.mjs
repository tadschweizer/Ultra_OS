// In-memory database adapter for handler regression tests. It is not staging evidence.
export const athleteId = '11111111-1111-4111-8111-111111111111';
export const coachOwnerId = '22222222-2222-4222-8222-222222222222';
export const coachId = '33333333-3333-4333-8333-333333333333';
export const adminId = '44444444-4444-4444-8444-444444444444';
export const fixedNow = new Date('2026-09-07T12:00:00Z');
export function pilotDb({ tier = 'free', coachTier = 'free', pilot = true, relationship = 'active' } = {}) {
  const tables = {
    athletes: [
      { id: athleteId, primary_role: 'athlete', subscription_tier: tier, session_version: 1, is_admin: false },
      { id: coachOwnerId, primary_role: 'coach', subscription_tier: coachTier, session_version: 1, is_admin: false },
      { id: adminId, primary_role: 'athlete', subscription_tier: 'free', session_version: 1, is_admin: true },
    ],
    coach_profiles: [{ id: coachId, athlete_id: coachOwnerId, display_name: 'Pilot Coach' }],
    coach_pilot_entitlements: pilot ? [{ coach_id: coachId, starts_at: '2026-09-01T00:00:00Z', expires_at: '2026-10-01T00:00:00Z', revoked_at: null, reason: 'Pilot' }] : [],
    coach_athlete_relationships: relationship ? [{ coach_id: coachId, athlete_id: athleteId, status: relationship, removed_at: null, expires_at: null }] : [],
    interventions: [],
    research_library_entries: [],
  };
  const calls = [];
  const db = { tables, calls, failures: new Set(), rateAllowed: true, now: fixedNow,
    async rpc(name, args) { calls.push({ table: name, operation: 'rpc', args });
      if (name !== 'consume_checkin_rate_limit') throw new Error(`Unexpected RPC ${name}`);
      return { data: this.rateAllowed, error: this.failures.has(name) ? new Error('database failure') : null };
    },
    from(table) {
      if (!(table in tables)) throw new Error(`Unexpected table ${table}`);
      let operation = 'select', payload, options, count = false;
      const filters = [];
      const query = {
        select(_fields, opts) { count = Boolean(opts?.count); return this; },
        eq(key, value) { filters.push(row => row[key] === value); return this; },
        gte(key, value) { filters.push(row => row[key] >= value); return this; },
        order() { return this; },
        insert(value) { operation = 'insert'; payload = value; return this; },
        upsert(value, opts) { operation = 'upsert'; payload = value; options = opts; return this; },
        update(value) { operation = 'update'; payload = value; return this; },
        delete() { operation = 'delete'; return this; },
        async execute(single = false) {
          calls.push({ table, operation, payload: structuredClone(payload) });
          if (db.failures.has(table)) return { data: null, error: new Error('database failure') };
          let rows = tables[table].filter(row => filters.every(filter => filter(row)));
          if (operation === 'insert') {
            rows = [{ id: `row-${tables[table].length}`, inserted_at: db.now.toISOString(), ...structuredClone(payload) }];
            tables[table].push(...rows);
          } else if (operation === 'upsert') {
            const key = options.onConflict;
            const found = tables[table].find(row => row[key] === payload[key]);
            if (found) { Object.assign(found, structuredClone(payload)); rows = [found]; }
            else { rows = [structuredClone(payload)]; tables[table].push(...rows); }
          } else if (operation === 'update') rows.forEach(row => Object.assign(row, structuredClone(payload)));
          else if (operation === 'delete') tables[table] = tables[table].filter(row => !rows.includes(row));
          return { data: structuredClone(single ? rows[0] || null : rows), count: count ? rows.length : null, error: null };
        },
        single() { return this.execute(true); }, maybeSingle() { return this.execute(true); },
        then(resolve, reject) { return this.execute().then(resolve, reject); },
      };
      return query;
    },
  };
  return db;
}
