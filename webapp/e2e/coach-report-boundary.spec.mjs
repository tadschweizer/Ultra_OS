import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { coachReportFixture } from '../tests/helpers/coach-report-fixture.mjs';
import { signAthleteSession } from '../lib/auth/sessionCookies.js';

const cases = [
  { zone:'America/Denver', instant:'2026-10-11T01:00:00Z', start:'2026-09-13', end:'2026-10-10', activity:'2026-09-14T01:00:00Z' },
  { zone:'America/Denver', instant:'2026-10-11T01:00:00Z', start:'2026-09-13', end:'2026-10-10', activity:'2026-09-12T10:30:00Z' }, // athlete in UTC+14
  { zone:'America/Los_Angeles', instant:'2026-10-11T01:00:00Z', start:'2026-09-13', end:'2026-10-10', activity:'2026-09-14T02:00:00Z' },
  { zone:'UTC', instant:'2026-10-11T01:00:00Z', start:'2026-09-14', end:'2026-10-11', activity:'2026-09-14T12:00:00Z' },
  { zone:'Pacific/Kiritimati', instant:'2026-10-11T01:00:00Z', start:'2026-09-14', end:'2026-10-11', activity:'2026-09-13T10:30:00Z' },
  { zone:'Pacific/Kiritimati', instant:'2026-10-11T23:00:00Z', start:'2026-09-15', end:'2026-10-12', activity:'2026-09-14T10:30:00Z' },
];

test('local reconciliation retains oldest calendar day across UTC midnight and extreme timezones', async ({ browser }, info) => {
  test.setTimeout(150000);
  const f = await coachReportFixture();
  const output = new URL('../../output/playwright/coach-report-boundary/', import.meta.url);
  await mkdir(output,{recursive:true});
  const observations=[];
  try {
    for (const c of cases) {
      const context=await browser.newContext({timezoneId:c.zone,viewport:{width:info.project.name==='mobile-chromium'?320:1440,height:844}});
      const page=await context.newPage();
      const responses=[], external=[], errors=[];
      try {
        await f.pg.exec('delete from planned_workouts; delete from strava_activities;');
        await f.pg.query(`insert into planned_workouts(id,athlete_id,coach_id,title,sport,workout_date,planned_duration_min,status,visibility)
          values('dddddddd-dddd-4ddd-8ddd-dddddddddddd',$1,$2,'Oldest local trail run','run',$3,60,'planned','athlete_visible')`,[f.athlete,f.coach,c.start]);
        await f.pg.query(`insert into strava_activities(athlete_id,strava_activity_id,start_date,local_date,sport_type,moving_time,name)
          values($1,'boundary-run',$2,$3,'Run',3600,'Oldest local completed run')`,[f.athlete,c.activity,c.start]);
        await page.clock.setFixedTime(new Date(c.instant));
        const token=signAthleteSession(f.owner,1);
        await context.addCookies([{name:'athlete_id',value:token,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'}]);
        await context.route('**/*',async route=>{
          const url=new URL(route.request().url());
          if(!['127.0.0.1','localhost'].includes(url.hostname)){external.push(url.href);return route.abort();}
          if(!url.pathname.startsWith('/api/'))return route.continue();
          const name=url.pathname==='/api/me'?'me':url.pathname==='/api/coach/athlete-detail'?'detail':null;
          if(!name)return route.fulfill({status:501,json:{error:'Ancillary route outside isolated report fixture'}});
          const headers=await route.request().allHeaders();
          const call=()=>f.invokeWithCookie(name,headers.cookie||'',Object.fromEntries(url.searchParams));
          const r=name==='detail'?await f.atReportTime(c.instant,call):await call();
          responses.push({path:url.pathname,status:r.code,body:r.body});
          return route.fulfill({status:r.code,json:r.body});
        });
        page.on('pageerror',e=>errors.push(e.message));
        await page.goto(`/coach/athletes/${f.athlete}`);
        await expect(page.getByRole('heading',{name:'Race readiness report',exact:true})).toBeVisible();
        const report=responses.find(r=>r.path==='/api/coach/athlete-detail');
        const text=await page.locator('main').innerText();
        observations.push({...c,status:report?.status,planned:report?.body.plannedWorkouts,activities:report?.body.reconciliationActivities,text,external,errors});
        expect(report.status).toBe(200);
        await expect(page.getByText(/1 of 1 planned session completed/)).toBeVisible();
        await expect(page.getByText('Oldest local trail run',{exact:false})).toBeVisible();
        await expect(page.getByText(`Plan window: ${c.start} to ${c.end} (${c.zone}, 28 local calendar days). Activities retain their recorded local dates.`)).toBeVisible();
        expect(text).toContain('100% avg compliance');
        expect(report.body.raceReadiness.window.timeZone).toBe('UTC');
        expect(external).toEqual([]);expect(errors).toEqual([]);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(info.project.name==='mobile-chromium'?320:1440);
      } finally { await context.close(); }
    }
  } finally {
    await writeFile(new URL(`${info.project.name}-observations.json`,output),JSON.stringify(observations,null,2));
    await f.close();
  }
});
