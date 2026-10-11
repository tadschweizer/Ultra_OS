import { test, expect } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { coachReportFixture } from '../tests/helpers/coach-report-fixture.mjs';
import { signAthleteSession } from '../lib/auth/sessionCookies.js';

test('signed coach report shows bounded provenance and unknown scores, and recovers from real SQL failures', async ({ page }, info) => {
  test.setTimeout(90000);
  const f = await coachReportFixture();
  const responses = [], external = [], errors = [], servedAssets = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.context().route('**/*', async route => {
    const url = new URL(route.request().url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) { external.push(url.href); return route.abort(); }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname === '/api/coach/athlete-detail') {
      const result = await f.report(); responses.push({ status:result.code, body:result.body });
      return route.fulfill({ status: result.code, json: result.body });
    }
    if (url.pathname === '/api/me') {
      const result = await f.invoke('me', { actor:f.owner });
      return route.fulfill({ status:result.code, json:result.body });
    }
    return route.fulfill({ status:501, json:{error:'Ancillary route outside isolated report fixture'} });
  });
  const output = new URL('../../output/coach-report/', import.meta.url);
  await mkdir(output, { recursive:true });
  try {
    await f.seedProtocols();
    await f.pg.query(`insert into daily_checkins(athlete_id,created_at,readiness_score) values
      ($1,now(),null),($1,now()-interval '1 day',null),($1,now()-interval '2 days',null);
      `, [f.athlete]);
    await f.pg.query("insert into interventions(athlete_id,intervention_type,date) values($1,'Sleep','2020-01-01'),($1,'Sleep',current_date)", [f.athlete]);
    for (const width of info.project.name === 'mobile-chromium' ? [320,390] : [1440]) {
      await page.setViewportSize({width,height:844});
      await page.goto(`/coach/athletes/${f.athlete}`);
      await expect(page.getByRole('heading', {name:'Race readiness report',exact:true})).toBeVisible();
      await expect(page.getByText('Recorded check-in band: unknown')).toBeVisible();
      await expect(page.getByText(/Readiness confidence not assessed/)).toBeVisible();
      await expect(page.getByText(/Heat:.*2 planned sessions.*2 matching logs/)).toBeVisible();
      await expect(page.getByText(/Nutrition:.*4 planned sessions.*0 matching logs/)).toBeVisible();
      await expect(page.getByText(/Sleep: Logs recorded.*1 log in the latest 8-log sample/)).toBeVisible();
      await expect(page.getByText(/Report window:.*UTC, 28 calendar days/)).toBeVisible();
      if (!servedAssets.length) {
        const buildId = await page.locator('#__NEXT_DATA__').evaluate(node=>JSON.parse(node.textContent).buildId);
        const buildDirectory = buildId === 'development' ? '.next/dev' : '.next';
        const scripts = await page.locator('script[src]').evaluateAll(nodes => nodes.map(n=>n.src));
        for (const src of scripts.filter(src=>new URL(src).pathname.startsWith('/_next/static/'))) {
          const pathname = new URL(src).pathname;
          const response = await page.request.get(src);
          const served = await response.body();
          const sha = bytes=>createHash('sha256').update(bytes).digest('hex');
          expect(response.status()).toBe(200);
          // Next serves this development endpoint as generated matcher JSON,
          // unlike the on-disk JavaScript manifest. Production assets and all
          // static development chunks still require exact byte equality.
          const generatedDevManifest = buildId === 'development' && pathname === '/_next/static/development/_clientMiddlewareManifest.js';
          if (generatedDevManifest) {
            expect(Array.isArray(JSON.parse(served.toString()))).toBe(true);
          } else {
            const source = await readFile(new URL(`../${buildDirectory}${decodeURIComponent(pathname.replace('/_next',''))}`,import.meta.url));
            expect(sha(served), pathname).toBe(sha(source));
          }
          servedAssets.push({ pathname, sha256:sha(served), bytes:served.length, comparison:generatedDevManifest?'generated-development-manifest':'build-file' });
        }
        expect(servedAssets.some(asset=>asset.pathname.includes('/coach/athletes/') || asset.pathname.includes('pages_coach_athletes_'))).toBe(true);
      }
      expect(await page.locator('main').innerText()).not.toMatch(/29%|43%|100%|On track|Confidence: high|average: 0/);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path:fileURLToPath(new URL(`${width}-provenance.png`,output)), fullPage:true });
    }
    await f.pg.exec('reset role; alter table coach_protocol_assignments rename to unavailable_protocols; set role service_role');
    await page.reload();
    await expect(page.locator('main [role="alert"]')).toHaveText('Athlete report unavailable. Please try again.');
    expect(responses.at(-1).status).toBe(503);
    await expect(page.getByRole('heading',{name:'Race readiness report',exact:true})).toHaveCount(0);
    await page.screenshot({path:fileURLToPath(new URL(`${info.project.name}-unavailable.png`,output))});
    await f.pg.exec('reset role; alter table unavailable_protocols rename to coach_protocol_assignments; set role service_role');
    await page.getByRole('button',{name:'Retry report'}).click();
    await expect(page.getByRole('heading',{name:'Race readiness report',exact:true})).toBeVisible();
    expect(responses.at(-1).status).toBe(200);
    expect(f.queryErrors.some(e=>e.code==='42P01')).toBe(true);
    expect(external).toEqual([]); expect(errors).toEqual([]);
  } finally {
    await writeFile(new URL(`${info.project.name}-responses.json`,output), JSON.stringify({ responses, queryErrors:f.queryErrors, external, errors, servedAssets },null,2));
    await f.close();
  }
});

async function connectSignedReport(page, f, events) {
  await page.context().route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(!['127.0.0.1','localhost'].includes(url.hostname)){events.external.push(url.href);return route.abort();}
    if(!url.pathname.startsWith('/api/'))return route.continue();
    const handler=url.pathname==='/api/me'?'me':url.pathname==='/api/coach/athlete-detail'?'detail':null;
    if(!handler)return route.fulfill({status:501,json:{error:'Ancillary route outside isolated report fixture'}});
    const headers=await route.request().allHeaders();
    const result=await f.invokeWithCookie(handler,headers.cookie||'',Object.fromEntries(url.searchParams));
    events.responses.push({path:url.pathname,status:result.code,body:result.body});
    return route.fulfill({status:result.code,json:result.body});
  });
  page.on('pageerror',error=>events.errors.push(error.message));
}
async function setSession(context,token) {
  await context.addCookies([{name:'athlete_id',value:token,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'}]);
}

test('G1: shared SQL500 preserves the signed session behind a safe guard and Try again recovers without login',async({page,context},info)=>{
  test.setTimeout(120000);
  const f=await coachReportFixture(),events={responses:[],external:[],errors:[],observations:[]};
  const output=new URL('../../output/coach-report/',import.meta.url);await mkdir(output,{recursive:true});
  await connectSignedReport(page,f,events);
  try {
    await f.seedProtocols();const token=signAthleteSession(f.owner,1);
    await setSession(context,token);
    const faults=[
      ['interventions','alter table interventions rename to unavailable_interventions','alter table unavailable_interventions rename to interventions','42P01'],
      ['athlete-column','alter table athletes rename column primary_sports to unavailable_primary_sports','alter table athletes rename column unavailable_primary_sports to primary_sports','42703'],
    ];
    for(const width of info.project.name==='mobile-chromium'?[320,390]:[1440])for(const [name,breakSql,restoreSql,sqlCode]of faults)for(const cached of [false,true]) {
      await page.setViewportSize({width,height:844});
      await page.goto(`/coach/athletes/${f.athlete}`);
      await expect(page.getByRole('heading',{name:'Race readiness report',exact:true})).toBeVisible();
      if(!cached)await page.evaluate(()=>sessionStorage.clear());
      await f.pg.exec(`reset role; ${breakSql}; set role service_role`);
      await page.reload();
      await expect(page.locator('main [role="alert"]')).toHaveText('Access could not be verified. Refresh to try again.');
      expect(page.url()).toContain(`/coach/athletes/${f.athlete}`);
      expect(events.responses.filter(r=>r.path==='/api/me').at(-1).status).toBe(500);
      await expect(page.getByRole('heading',{name:'Race readiness report',exact:true})).toHaveCount(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      expect(await page.locator('main').innerText()).not.toMatch(/relation|primary_sports|42P01|42703/);
      await page.screenshot({path:fileURLToPath(new URL(`${width}-g1-${name}-${cached?'cached':'cold'}.png`,output))});
      await f.pg.exec(`reset role; ${restoreSql}; set role service_role`);
      await page.getByRole('link',{name:'Try again',exact:true}).click();
      await expect(page.getByRole('heading',{name:'Race readiness report',exact:true})).toBeVisible();
      expect(events.responses.filter(r=>r.path==='/api/me').at(-1).status).toBe(200);
      expect(events.responses.filter(r=>r.path==='/api/coach/athlete-detail').at(-1).status).toBe(200);
      expect((await context.cookies()).find(cookie=>cookie.name==='athlete_id')?.value).toBe(token);
      expect(f.queryErrors.some(error=>error.code===sqlCode)).toBe(true);
      events.observations.push({width,fault:name,cached,recoveredWithoutNewSession:true});
    }
    expect(events.external).toEqual([]);expect(events.errors).toEqual([]);
  }finally{await writeFile(new URL(`${info.project.name}-g1-responses.json`,output),JSON.stringify({...events,queryErrors:f.queryErrors},null,2));await f.close();}
});

test('expired, invalid and revoked signed sessions redirect to login; athlete role cannot open the coach report',async({page,context},info)=>{
  test.setTimeout(90000);
  const f=await coachReportFixture(),events={responses:[],external:[],errors:[]};
  const output=new URL('../../output/coach-report/',import.meta.url);await mkdir(output,{recursive:true});
  await connectSignedReport(page,f,events);
  try {
    for(const name of ['expired','invalid','revoked']) {
      await f.pg.query('update athletes set session_version=1 where id=$1',[f.owner]);
      await setSession(context,signAthleteSession(f.owner,1));
      await page.goto(`/coach/athletes/${f.athlete}`);
      await expect(page.getByRole('heading',{name:'Race readiness report',exact:true})).toBeVisible();
      if(name==='expired')await setSession(context,signAthleteSession(f.owner,1,Date.now()-1000));
      if(name==='invalid')await setSession(context,'invalid-signed-session');
      if(name==='revoked')await f.pg.query('update athletes set session_version=2 where id=$1',[f.owner]);
      await page.reload();await expect(page).toHaveURL(/\/login\?next=/);
      expect(events.responses.filter(r=>r.path==='/api/me').at(-1).status).toBe(401);
      expect(await page.evaluate(()=>sessionStorage.getItem('threshold.me.v1'))).toBeNull();
      await expect(page.getByRole('heading',{name:'Race readiness report',exact:true})).toHaveCount(0);
    }
    await f.pg.query('update athletes set session_version=1 where id=$1',[f.owner]);
    await setSession(context,signAthleteSession(f.owner,1));await page.goto(`/coach/athletes/${f.athlete}`);
    await expect(page.getByRole('heading',{name:'Race readiness report',exact:true})).toBeVisible();
    await setSession(context,signAthleteSession(f.athlete,1));await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading',{name:'Race readiness report',exact:true})).toHaveCount(0);
    expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('threshold.me.v1')).account.capabilities.coach)).toBe(false);
    expect(events.external).toEqual([]);expect(events.errors).toEqual([]);
  }finally{await writeFile(new URL(`${info.project.name}-session-denials.json`,output),JSON.stringify(events,null,2));await f.close();}
});
