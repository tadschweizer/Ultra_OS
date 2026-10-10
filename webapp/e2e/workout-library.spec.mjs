import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { libraryFixture } from '../tests/helpers/library-fixture.mjs';
import { owner, coach, athlete } from '../tests/helpers/message-lifecycle-fixture.mjs';

async function signedLibraryRoutes(page,f,intercept=()=>null) {
  await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url());
    let result={code:200,body:{settings:{distance_unit:'mi'},workouts:[],events:[],notes:[],comments:[],notifications:[],unreadCount:0}};
    if(url.pathname==='/api/me')result.body={athlete:{id:owner,name:'Isolated coach',onboarding_complete:true,primary_role:'coach',subscription_tier:'coach_pro'},account:{primary_role:'coach',capabilities:{athlete:true,coach:true},coach_profile:{id:coach},coach_access:{eligible:true}}};
    if(url.pathname==='/api/coach/relationships')result.body={relationships:[{athlete_id:athlete,status:'active',athlete:{name:'Isolated runner'}}]};
    if(url.pathname==='/api/workout-library') {
      const body=req.postData()?req.postDataJSON():{};
      result=await intercept(req,body) || await f.invokeLibrary({method:req.method(),body,query:Object.fromEntries(url.searchParams)});
    }
    await route.fulfill({status:result.code,contentType:'application/json',body:JSON.stringify(result.body)});
  });
}

test('F6 library outages never assert empty data; retry recovers and refresh preserves known templates',async({page},info)=>{
  test.setTimeout(60000);const f=await libraryFixture();
  try {
    if(info.project.name==='mobile-chromium')await page.setViewportSize({width:320,height:844});
    for(let i=0;i<4;i++)expect((await f.invokeLibrary({method:'POST',body:{name:`Stored trail template ${i}`,client_request_id:randomUUID()}})).code).toBe(200);
    await f.pg.exec('reset role; alter table workout_library rename column objective to unavailable_objective; set role service_role;');
    await signedLibraryRoutes(page,f);
    await page.goto('/coach/training-calendar');
    await page.getByRole('button',{name:'Library (unavailable)',exact:true}).click();
    await expect(page.getByText('No saved workouts yet.',{exact:false})).not.toBeVisible();
    await expect(page.getByRole('alert').filter({hasText:'Workout library could not be loaded'})).toBeVisible();
    await page.screenshot({path:`../output/library-f6-unavailable-${info.project.name}.png`,fullPage:true});
    await f.pg.exec('reset role; alter table workout_library rename column unavailable_objective to objective; set role service_role;');
    await page.getByRole('button',{name:'Retry library load',exact:true}).click();
    await expect(page.getByRole('button',{name:'Library (5)',exact:true})).toBeVisible();
    await expect(page.getByText('Stored trail template 0',{exact:true})).toBeVisible();
    await f.pg.exec('reset role; alter table workout_library rename column objective to unavailable_objective; set role service_role;');
    await page.getByRole('button',{name:'Refresh library',exact:true}).click();
    await expect(page.getByText('Showing the last loaded templates.',{exact:false})).toBeVisible();
    await expect(page.getByText('Stored trail template 0',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Library (5)',exact:true})).toBeVisible();
    await expect(page.getByText('No saved workouts yet.',{exact:false})).not.toBeVisible();
    await page.screenshot({path:`../output/library-f6-retained-${info.project.name}.png`,fullPage:true});
    await f.pg.exec('reset role; alter table workout_library rename column unavailable_objective to objective; set role service_role;');
    await page.getByRole('button',{name:'Retry library load',exact:true}).click();
    await expect(page.getByText('Showing the last loaded templates.',{exact:false})).not.toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{await f.close();}
});

for(const refresh of [false,true])test(`F7 committed response loss retries once ${refresh?'after refresh':'in editor'}; deliberate next save gets a fresh operation`,async({page},info)=>{
  test.setTimeout(60000);const f=await libraryFixture();const writes=[];let loseResponse=true;
  try {
    if(info.project.name==='mobile-chromium')await page.setViewportSize({width:320,height:844});
    await signedLibraryRoutes(page,f,async(req,body)=>{
      if(req.method()!=='POST')return null;
      writes.push(body);const result=await f.invokeLibrary({method:'POST',body});
      if(loseResponse&&result.code===200){loseResponse=false;return {code:503,body:{error:'Injected response lost after commit.'}};}
      return result;
    });
    await page.goto('/coach/training-calendar');
    await page.getByRole('button',{name:'+ Plan workout',exact:true}).click();
    let editor=page.getByRole('dialog',{name:'Workout editor'});
    await editor.getByLabel('Workout title',{exact:true}).fill('Uncertain trail save');
    await editor.getByPlaceholder('Planned IF',{exact:true}).fill('0');
    await editor.getByLabel('Workout visibility').selectOption('coach_private');
    await editor.getByRole('button',{name:'Save to library',exact:true}).click();
    await expect(editor.getByText('Could not save to library.',{exact:true})).toBeVisible();
    if(refresh){
      await page.reload();
      await page.getByRole('button',{name:'Retry unconfirmed library save',exact:true}).click();
      await expect(page.getByRole('button',{name:'Retry unconfirmed library save',exact:true})).not.toBeVisible();
    }else{
      await editor.getByRole('button',{name:'Save to library',exact:true}).click();
      await expect(editor.getByText('Saved to library.',{exact:true})).toBeVisible();
    }
    let rows=(await f.invokeLibrary()).body.workouts.filter(w=>w.name==='Uncertain trail save');
    expect(rows).toHaveLength(1);expect(Number(rows[0].planned_if)).toBe(0);expect(rows[0].visibility).toBe('coach_private');
    expect(writes[0].client_request_id).toMatch(/^[0-9a-f-]{36}$/);expect(writes[1].client_request_id).toBe(writes[0].client_request_id);
    await page.screenshot({path:`../output/library-f7-${refresh?'refresh':'editor'}-${info.project.name}.png`,fullPage:true});
    if(refresh){
      await page.getByRole('button',{name:'+ Plan workout',exact:true}).click();editor=page.getByRole('dialog',{name:'Workout editor'});
      await editor.getByLabel('Workout title',{exact:true}).fill('Uncertain trail save');
    }
    await editor.getByRole('button',{name:'Save to library',exact:true}).click();
    await expect(editor.getByText('Saved to library.',{exact:true})).toBeVisible();
    await expect.poll(()=>writes.length).toBe(3);
    rows=(await f.invokeLibrary()).body.workouts.filter(w=>w.name==='Uncertain trail save');
    expect(rows).toHaveLength(2);expect(writes[2].client_request_id).not.toBe(writes[0].client_request_id);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{await f.close();}
});

test('library validation can be corrected; uncertain save keeps original intent through edits, close and retry',async({page})=>{
  test.setTimeout(60000);const f=await libraryFixture();const writes=[];let unavailable=false;
  try {
    await signedLibraryRoutes(page,f,async(req,body)=>{
      if(req.method()!=='POST')return null;writes.push(body);
      if(unavailable)return {code:503,body:{error:'Injected failure before transaction.'}};
      return f.invokeLibrary({method:'POST',body});
    });
    await page.goto('/coach/training-calendar');await page.getByRole('button',{name:'+ Plan workout',exact:true}).click();
    const editor=page.getByRole('dialog',{name:'Workout editor'}),save=editor.getByRole('button',{name:'Save to library',exact:true});
    await save.click();await expect(editor.getByText('Could not save to library.',{exact:true})).toBeVisible();
    expect((await f.invokeLibrary()).body.workouts).toHaveLength(1);
    await editor.getByLabel('Workout title',{exact:true}).fill('Original uncertain intent');unavailable=true;
    await save.click();await expect(editor.getByText('Could not save to library.',{exact:true})).toBeVisible();
    expect(writes).toHaveLength(2);expect(writes[1].client_request_id).not.toBe(writes[0].client_request_id);
    await editor.getByLabel('Workout title',{exact:true}).fill('Edited intentional template');
    await save.click();await expect(editor.getByText('Could not save to library.',{exact:true})).toBeVisible();expect(writes).toHaveLength(2);
    await editor.getByRole('button',{name:'Close',exact:true}).click();unavailable=false;
    await page.getByRole('button',{name:'Retry unconfirmed library save',exact:true}).click();
    await expect(page.getByRole('button',{name:'Retry unconfirmed library save',exact:true})).not.toBeVisible();
    expect(writes[2].client_request_id).toBe(writes[1].client_request_id);
    expect((await f.invokeLibrary()).body.workouts.filter(w=>w.name==='Original uncertain intent')).toHaveLength(1);
    expect((await f.invokeLibrary()).body.workouts.some(w=>w.name==='Edited intentional template')).toBe(false);
  }finally{await f.close();}
});

test('real calendar editor saves a full prescription through the signed library API and SQL, reloads and deletes',async({page},info)=>{
  test.setTimeout(60000);
  const f=await libraryFixture();const writes=[];
  try {
    await page.route('**/api/**',async route=>{
      const req=route.request(),url=new URL(req.url());let status=200,body={settings:{distance_unit:'mi'},workouts:[],events:[],notes:[],comments:[],notifications:[],unreadCount:0};
      if(url.pathname==='/api/me')body={athlete:{id:owner,name:'Isolated coach',onboarding_complete:true,primary_role:'coach',subscription_tier:'coach_pro'},account:{primary_role:'coach',capabilities:{athlete:true,coach:true},coach_profile:{id:coach},coach_access:{eligible:true}}};
      if(url.pathname==='/api/coach/relationships')body={relationships:[{athlete_id:athlete,status:'active',athlete:{name:'Isolated runner'}}]};
      if(url.pathname==='/api/workout-library'){
        const payload=req.postData()?req.postDataJSON():{};
        const result=await f.invokeLibrary({method:req.method(),body:payload,query:Object.fromEntries(url.searchParams)});
        status=result.code;body=result.body;if(req.method()==='POST')writes.push(payload);
      }
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    });
    await page.goto('/coach/training-calendar');
    await page.getByRole('button',{name:'+ Plan workout',exact:true}).click();
    const editor=page.getByRole('dialog',{name:'Workout editor'});
    await editor.getByLabel('Workout title',{exact:true}).fill('Trail economy prescription');
    await editor.getByPlaceholder('Coach instructions / session goal').fill('Runnable uphill repeats');
    await editor.getByPlaceholder('Workout objective / purpose').fill('Steady climbing economy');
    await editor.getByPlaceholder('Coach instructions (separate from description)',{exact:true}).fill('Walk recoveries; keep form relaxed');
    await editor.getByPlaceholder('Planned IF',{exact:true}).fill('0.82');
    await editor.getByLabel('Primary target').selectOption('heart_rate');
    await editor.getByLabel('Workout visibility').selectOption('coach_private');
    await editor.getByLabel('Planned duration (min)',{exact:true}).fill('58');
    await editor.getByLabel('Planned distance',{exact:true}).fill('6');
    await editor.getByRole('button',{name:'Save to library',exact:true}).click();
    await expect(editor.getByText('Saved to library.',{exact:true})).toBeVisible();
    // Existing calendar editor stores canonical km rounded to two decimals.
    expect(writes).toHaveLength(1);expect(writes[0].planned_distance_km).toBe(9.66);
    expect(writes[0].objective).toBe('Steady climbing economy');expect(writes[0].coach_instructions).toBe('Walk recoveries; keep form relaxed');
    expect(writes[0].planned_if).toBe(0.82);expect(writes[0].target_metric).toBe('heart_rate');expect(writes[0].visibility).toBe('coach_private');
    await editor.getByRole('button',{name:'Close',exact:true}).click();await page.reload();
    await page.getByRole('button',{name:'Library (2)',exact:true}).click();
    await expect(page.getByText('Trail economy prescription',{exact:true})).toBeVisible();
    const row=(await f.invokeLibrary()).body.workouts.find(w=>w.name==='Trail economy prescription');
    expect(row.objective).toBe('Steady climbing economy');expect(row.coach_instructions).toBe('Walk recoveries; keep form relaxed');expect(Number(row.planned_if)).toBe(0.82);
    expect(row.target_metric).toBe('heart_rate');expect(row.visibility).toBe('coach_private');expect(row.planned_distance_unit).toBe('mi');
    await page.screenshot({path:`../output/library-${info.project.name}.png`,fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole('button',{name:'Delete Trail economy prescription from library',exact:true}).click();
    await expect(page.getByText('Trail economy prescription',{exact:true})).not.toBeVisible();
    expect((await f.invokeLibrary()).body.workouts.some(w=>w.id===row.id)).toBe(false);
  }finally {await f.close();}
});
