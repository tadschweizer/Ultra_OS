import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

export const athlete = '11111111-1111-4111-8111-111111111111';
export const owner = '22222222-2222-4222-8222-222222222222';
export const coach = '33333333-3333-4333-8333-333333333333';
export const other = '44444444-4444-4444-8444-444444444444';
export const workout = '55555555-5555-4555-8555-555555555555';
export const activity = '66666666-6666-4666-8666-666666666666';

// Actual isolated PostgreSQL, with only a PostgREST-shaped transport adapter.
export function messagingClient(pg) {
  return {
    async rpc(name, args) {
      assert.ok(['messaging_summary','notification_feed','patch_notification_preferences'].includes(name));
      const values = Object.values(args);
      try { return { data: (await pg.query(`select public.${name}(${values.map((_, i) => `$${i+1}`).join(',')}) as value`, values)).rows[0].value }; }
      catch (error) { return { error }; }
    },
    from(table) {
      assert.match(table,/^[a-z_]+$/);
      let columns = '*', payload, patch, single = false, limit;
      const values = [], filters = [], orders = [];
      const condition = (key, operator, value) => { assert.match(key,/^[a-z_]+$/); values.push(value); filters.push(`${key} ${operator} $${values.length}`); };
      const query = {
        select(value='*') { columns=value; return this; },
        eq(k,v) { condition(k,'=',v); return this; },
        match(object) { Object.entries(object).forEach(([k,v]) => condition(k,'=',v)); return this; },
        in(k,v) { condition(k,'= any',v); filters[filters.length-1]=`${k}::text = any($${values.length}::text[])`; return this; },
        is(k,v) { assert.equal(v,null); filters.push(`${k} is null`); return this; },
        or(value) {
          const cursor = /^created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),id\.lt\.([^()]+)\)$/.exec(value);
          assert.ok(cursor); assert.equal(cursor[1],cursor[2]); values.push(cursor[1],cursor[3]);
          filters.push(`(created_at,id)<($${values.length-1}::timestamptz,$${values.length}::uuid)`); return this;
        },
        order(k,{ascending}={}) { orders.push(`${k} ${ascending ? 'asc' : 'desc'}`); return this; },
        limit(n) { limit=n; return this; },
        insert(value) { payload=value; return this; },
        update(value) { patch=value; return this; },
        single() { single=true; return this; }, maybeSingle() { single=true; return this; },
        async then(resolve) {
          try {
            const where = filters.length ? ` where ${filters.join(' and ')}` : '';
            let sql;
            if (payload) {
              const keys=Object.keys(payload); values.push(...Object.values(payload));
              sql=`insert into ${table} (${keys.join(',')}) values (${keys.map((_,i)=>`$${i+1}`).join(',')}) returning ${columns}`;
            } else if (patch) {
              const assignments=Object.entries(patch).map(([k,v]) => { values.push(v); return `${k}=$${values.length}`; });
              sql=`update ${table} set ${assignments.join(',')}${where} returning ${columns}`;
            } else sql=`select ${columns} from ${table}${where}${orders.length ? ` order by ${orders.join(',')}` : ''}${limit ? ` limit ${limit}` : ''}`;
            const rows = JSON.parse(JSON.stringify((await pg.query(sql,values)).rows));
            return resolve({ data: single ? rows[0] || null : rows });
          } catch (error) { return resolve({ error }); }
        },
      };
      return query;
    },
  };
}

export async function messagingFixture() {
  const pg = new PGlite();
  await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table athletes(id uuid primary key,name text,email text,primary_role text,subscription_tier text default 'free',
      is_admin boolean default false,onboarding_complete boolean default true,session_version integer default 1);
    create table coach_profiles(id uuid primary key,athlete_id uuid,display_name text,coach_code text,bio text,specialties text,
      certifications text,avatar_url text,max_athletes integer,subscription_status text,subscription_tier text,created_at timestamptz,updated_at timestamptz);
    create table coach_athlete_relationships(id uuid default gen_random_uuid(),coach_id uuid,athlete_id uuid,status text,group_name text);
    create table planned_workouts(id uuid primary key,athlete_id uuid,coach_id uuid,title text,workout_date date,sport text);
    create table strava_activities(id uuid primary key,athlete_id uuid,name text,local_date date,sport_type text,start_date timestamptz);
    create table workout_comments(id uuid primary key default gen_random_uuid(),planned_workout_id uuid,activity_id uuid,
      athlete_id uuid,coach_id uuid,author_athlete_id uuid,sender_role text,body text,created_at timestamptz default now(),read_at timestamptz);
    create table coach_notifications(id uuid primary key default gen_random_uuid(),coach_id uuid,athlete_id uuid,
      notification_type text,title text,body text,entity_type text,entity_id uuid,read_at timestamptz,created_at timestamptz default now());
    insert into athletes(id,name,primary_role) values('${athlete}','Test Athlete','athlete'),('${owner}','Test Coach','coach'),('${other}','Other','athlete');
    insert into coach_profiles(id,athlete_id,display_name) values('${coach}','${owner}','Test Coach');
    insert into coach_athlete_relationships(coach_id,athlete_id,status) values('${coach}','${athlete}','active');
    insert into planned_workouts values('${workout}','${athlete}','${coach}','Easy run','2026-10-07','run');
    insert into strava_activities values('${activity}','${athlete}','Imported ride',null,'Ride','2026-10-07T12:00:00Z');
    insert into coach_notifications(coach_id,athlete_id,notification_type,title,body,entity_type,entity_id)
      values('${coach}','${athlete}','athlete_message','Historical reply','Private text','coach_message',gen_random_uuid());
    grant select,insert,update,delete on all tables in schema public to service_role;`);
  await pg.exec(readFileSync(new URL('../../supabase/migrations/20261007200545_messaging_delivery.sql',import.meta.url),'utf8'));
  return { pg, admin: messagingClient(pg) };
}
