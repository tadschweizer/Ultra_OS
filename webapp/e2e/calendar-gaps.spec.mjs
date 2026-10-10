import { test,expect } from '@playwright/test';
import { calendarFixture,athlete,owner,plan } from '../tests/helpers/calendar-gap-fixture.mjs';

// Browser API interception dispatches affected calls to actual signed handlers
// and local PostgreSQL; every other API gets empty synthetic data. No provider.
async function setup(page,{coach=false,recoveryOnly=false}={}){
  const f=await calendarFixture();const monday=new Date();monday.setUTCHours(0,0,0,0);monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));
  const start=monday.toISOString().slice(0,10);await f.pg.query('update planned_workouts set workout_date=$1',[start]);
  if(!coach)await f.pg.query('update planned_workouts set visibility=$1,status=$2,completed_duration_min=$3',[recoveryOnly?'coach_private':'athlete_visible',recoveryOnly?'planned':'completed',recoveryOnly?null:60]);
  if(recoveryOnly)await f.pg.query('insert into interventions(athlete_id,date,intervention_type,dose_duration,subjective_feel) values($1,current_date,$2,$3,$4)',[athlete,'Foam Rolling','30 min',6]);
  const state={requests:[],lost:false,failRefresh:false,external:[],errors:[]};
  page.on('pageerror',e=>state.errors.push(e.message));
  await page.context().route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(!['127.0.0.1','localhost'].includes(url.hostname)){state.external.push(req.url());return route.abort();}
    if(!url.pathname.startsWith('/api/'))return route.continue();
    const method=req.method(),body=req.postData()?req.postDataJSON():{},query=Object.fromEntries(url.searchParams);
    if(url.pathname==='/api/me'){
      const r=await f.invoke('me',{actor:coach?owner:athlete});return route.fulfill({status:r.code,json:r.body});
    }
    if(url.pathname==='/api/planned-workouts'){
      if(method==='GET'&&state.failRefresh){state.failRefresh=false;return route.fulfill({status:503,json:{error:'Fixture refresh unavailable'}});}
      const r=await f.invoke('calendar',{actor:coach?owner:athlete,method,body,query});
      if(method==='POST'&&body.action==='copy_week'){
        state.requests.push(body);
        if(state.lost){state.lost=false;return route.abort('failed');}
      }
      return route.fulfill({status:r.code,json:r.body});
    }
    let data={settings:{},notes:[],events:[],comments:[],workouts:[],messages:[],conversations:[],documents:[],relationships:[],protocols:[],items:[],activities:[]};
    if(url.pathname==='/api/coach/athlete-detail')data={athlete:{id:athlete,name:'Synthetic runner'},workouts:[],activities:[],protocols:[],signals:[],compliance:{}};
    if(url.pathname==='/api/message-center')data={has_messaging:false,unread_total:0,workout_threads:[],conversations:[]};
    if(url.pathname==='/api/coach/relationships')data={relationships:[{athlete_id:athlete,status:'active',athlete:{name:'Synthetic runner'}}]};
    await route.fulfill({status:200,json:data});
  });
  return {f,state,start};
}

test('lost copy response, reload retry, private marker and deliberate second copy use production contracts',async({page},info)=>{
  const {f,state,start}=await setup(page,{coach:true});try{
    await page.goto(`/coach/training-calendar?athlete=${athlete}`);
    const buttons=page.getByRole('button',{name:'Copy week to next week'});
    await expect(buttons.first()).toBeVisible({timeout:30000});
    state.lost=true;await buttons.first().click();
    await expect(page.getByText(/Connection lost/)).toBeVisible();
    const id=state.requests[0].client_request_id;
    await page.reload();await expect(buttons.first()).toBeVisible();
    state.failRefresh=true;await buttons.first().click();
    await expect.poll(()=>state.requests.length).toBe(2);
    expect(state.requests[1].client_request_id).toBe(id);
    expect((await f.pg.query('select count(*)::int n from workout_week_copies')).rows[0].n).toBe(1);
    await page.reload();await expect(buttons.first()).toBeVisible();await buttons.first().click();
    await expect.poll(()=>state.requests.length).toBe(3);
    expect(state.requests[2].client_request_id).not.toBe(id);
    expect((await f.pg.query('select count(*)::int n from workout_week_copies')).rows[0].n).toBe(2);
    const copies=(await f.pg.query('select visibility,coach_instructions from planned_workouts where id<>$1',[plan])).rows;
    expect(copies.every(w=>w.visibility==='coach_private'&&w.coach_instructions.includes('poles'))).toBe(true);
    expect(state.external).toEqual([]);expect(state.errors).toEqual([]);
    await page.screenshot({path:`../output/playwright/calendar-gaps/copy-${info.project.name}.png`});
  }finally{await f.close();}
});

test('athlete calendar hides private drafts; recovery-only load remains unknown with source text',async({page},info)=>{
  const {f,state}=await setup(page,{recoveryOnly:true});try{
    await page.goto('/calendar');
    await expect(page.getByText('No recorded training duration available.')).toBeVisible();
    await expect(page.getByText('No training load data')).toBeVisible();
    await expect(page.getByRole('button',{name:/Trail climbs/})).toHaveCount(0);
    await page.screenshot({path:`../output/playwright/calendar-gaps/no-data-${info.project.name}.png`});
    expect(state.external).toEqual([]);expect(state.errors).toEqual([]);
  }finally{await f.close();}
});

test('accepted manual actuals appear in calendar load header with explicit estimated provenance',async({page},info)=>{
  const {f,state}=await setup(page);try{
    await page.goto('/calendar');
    await expect(page.getByText(/Manual workout completions\. Estimated training load/)).toBeVisible();
    await expect(page.getByRole('button',{name:/Trail climbs/}).first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    expect(state.external).toEqual([]);expect(state.errors).toEqual([]);
    await page.screenshot({path:`../output/playwright/calendar-gaps/manual-${info.project.name}.png`});
  }finally{await f.close();}
});
