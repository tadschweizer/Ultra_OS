import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createSiteReviewHandler } from '../pages/api/site-review.js';
import { signAthleteSession } from '../lib/auth/sessionCookies.js';
process.env.SESSION_COOKIE_SECRET = 'review-tests-only-secret-with-at-least-32-characters';
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const id = '33333333-3333-4333-8333-333333333333';
function fixture({ actor = owner, version = 1, failed = false, member = true } = {}) {
  const rows = []; const calls = [];
  const client = { from(table) {
    calls.push(table); let payload, op, filters = [];
    const q = { select() { return this; }, eq(k,v) { filters.push(r => r[k] === v); return this; }, order() { return this; }, limit() { return this; },
      upsert(v) { payload=v;op='insert';return this; }, update(v) { payload=v;op='update';return this; },
      async execute(single) {
        if (failed) return { error: new Error('offline') };
        if (table === 'athletes') return { data: { session_version: version } };
        if (table === 'site_reviewers') return { data: member && actor === owner ? { athlete_id: owner } : null };
        if (op === 'insert' && !rows.find(r => r.id === payload.id)) rows.push({ status:'open', ...payload });
        const data=rows.filter(r=>filters.every(f=>f(r)));
        if(op==='update') data.forEach(r=>Object.assign(r,payload));
        return { data: single ? data[0] || null : data };
      }, maybeSingle() { return this.execute(true); }, then(resolve,reject) { return this.execute(false).then(resolve,reject); }
    }; return q;
  }};
  const handler=createSiteReviewHandler({getClient:()=>client});
  return { rows,calls,async invoke(method='GET',body={},headers={}) {
    const res={ code:0, body:null, setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;} };
    await handler({method,query:{},body,headers:{cookie:actor?`athlete_id=${signAthleteSession(actor)}`:'',host:'localhost','content-type':'application/json',...headers}},res);
    return res;
  }};
}
for(const method of ['GET','POST','PATCH']) {
  test(`${method} denies anonymous, other accounts and revoked sessions before note access`, async()=>{
    for(const [options,code] of [[{actor:null},401],[{actor:other},403],[{version:2},401],[{member:false},403],[{failed:true},401]]) {
      const f=fixture(options);assert.equal((await f.invoke(method,{id})).code,code);assert.ok(!f.calls.includes('site_review_notes'));
    }
  });
}
test('owner creates, retries without duplicates, lists, resolves and reopens; client cannot spoof owner',async()=>{
  const f=fixture();const body={id,pathname:'/calendar',element:'Save button',note:'Save failed',athlete_id:other};
  assert.equal((await f.invoke('POST',body)).code,200);assert.equal((await f.invoke('POST',body)).code,200);
  assert.equal(f.rows.length,1);assert.equal(f.rows[0].athlete_id,owner);
  assert.equal((await f.invoke()).body.notes.length,1);
  assert.equal((await f.invoke('PATCH',{id,status:'resolved'})).body.note.status,'resolved');
  assert.equal((await f.invoke('PATCH',{id,status:'open'})).body.note.status,'open');
  assert.equal((await f.invoke('PATCH',{id:other,status:'open'})).code,404);
});
test('rejects malformed notes, unsafe URLs, invalid status and cross-site writes',async()=>{
  const f=fixture();const valid={id,pathname:'/calendar',note:'Fix this'};
  for(const body of [{...valid,note:''},{...valid,note:'x'.repeat(5001)},{...valid,pathname:'//evil.test'},{...valid,pathname:'/auth?token=secret'},{...valid,pathname:'https://evil.test'},{...valid,id:'bad'}]) assert.equal((await f.invoke('POST',body)).code,400);
  for(const headers of [{'content-type':'text/plain'},{origin:'https://evil.test'},{'sec-fetch-site':'cross-site'}]) assert.equal((await f.invoke('POST',valid,headers)).code,403);
  assert.equal((await f.invoke('PATCH',{id,status:'deleted'})).code,400);
  assert.equal((await f.invoke('DELETE')).code,405);
  assert.equal(f.rows.length,0);
});
test('real PostgreSQL migration denies public roles and enforces ownership/constraints',async()=>{
  const pg=new PGlite();try {
    await pg.exec('create role anon; create role authenticated; create role service_role bypassrls; create table athletes(id uuid primary key);');
    await pg.exec(readFileSync(new URL('../supabase/migrations/20261016195233_private_site_review.sql',import.meta.url),'utf8'));
    await pg.exec(`insert into athletes values('${owner}'); insert into site_reviewers values('${owner}');`);
    for(const role of ['anon','authenticated']) {
      await pg.exec(`set role ${role}`);
      await assert.rejects(pg.query('select * from site_review_notes'),/permission denied/);
      await assert.rejects(pg.query('select * from site_reviewers'),/permission denied/);
      await pg.exec('reset role');
    }
    await pg.exec('set role service_role');
    await pg.query('insert into site_review_notes(id,athlete_id,pathname,note) values($1,$2,$3,$4)',[id,owner,'/calendar','Review test']);
    assert.equal((await pg.query('select * from site_review_notes')).rows.length,1);
    await assert.rejects(pg.query("update site_review_notes set status='bad'"),/check constraint/);
    await pg.exec('reset role');
    assert.equal((await pg.query("select count(*)::int as n from pg_class where relname in ('site_review_notes','site_reviewers') and relrowsecurity")).rows[0].n,2);
  } finally { await pg.close(); }
});
