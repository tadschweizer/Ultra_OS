import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { libraryFixture } from '../tests/helpers/library-fixture.mjs';
import { owner, coach, athlete } from '../tests/helpers/message-lifecycle-fixture.mjs';
import { planFixture, owner as planOwner, other as planCoach, plan as assignedPlanId } from '../tests/helpers/plan-prescription-fixture.mjs';

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

test('O1 saved templates have an in-place editor',async({page})=>{
  const f=await libraryFixture();try{
    await signedLibraryRoutes(page,f);await page.goto('/coach/training-calendar');
    await page.getByRole('button',{name:'Library (1)',exact:true}).click();
    await expect(page.getByRole('button',{name:'Edit Legacy easy run in library',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Edit Legacy easy run in library',exact:true}).click();
    const editor=page.getByRole('dialog',{name:'Library template editor'});
    await expect(editor.getByText('No structured steps',{exact:false})).toBeVisible();
    await editor.getByRole('button',{name:'Close',exact:true}).click();
    expect((await f.pg.query('select structure from workout_library')).rows[0].structure).toEqual([]);
  }finally{await f.close();}
});

test('O1 edits preserve exact fields, recover lost PATCH acknowledgement, cancel and survive reload',async({page},info)=>{
  test.setTimeout(60000);const f=await libraryFixture();const writes=[];let lose=true;
  const structure=[{type:'work',repeat:3,duration_min:5.25,intensity:'threshold',target_type:'heart_rate',target_min:150,target_max:160,target_units:'bpm',notes:'Relax',calibration:'preserve'},
    {type:'recovery',repeat:3,duration_min:2,intensity:'easy',target_type:'pace',target_min:6,target_max:7,target_units:'min/km',notes:'Walk'}];
  try{
    if(info.project.name==='mobile-chromium')await page.setViewportSize({width:320,height:844});
    const created=await f.invokeLibrary({method:'POST',body:{client_request_id:randomUUID(),name:'Stored hill template',sport:'run',description:null,
      objective:null,coach_instructions:'Original',planned_duration_min:null,planned_distance_km:9.656064,planned_distance_unit:'mi',
      planned_if:0,planned_tss:0,target_metric:'heart_rate',visibility:'coach_private',structure,tags:['trail','hill']}});
    expect(created.code).toBe(200);const id=created.body.workout.id;
    await signedLibraryRoutes(page,f,async(req,body)=>{
      if(req.method()==='POST')throw new Error('Editing must never create another template');
      if(req.method()!=='PATCH')return null;
      writes.push(body);const result=await f.invokeLibrary({method:'PATCH',body});
      if(lose&&result.code===200){lose=false;return {code:503,body:{error:'Update committed; acknowledgement lost. Retry.'}};}
      return result;
    });
    const row=async()=> {
      const r=(await f.pg.query('select * from workout_library where id=$1',[id])).rows[0];
      for(const k of ['planned_duration_min','planned_distance_km','planned_tss','planned_if'])if(r[k]!=null)r[k]=Number(r[k]);
      return r;
    };
    const open=async(name='Stored hill template')=>{await page.getByRole('button',{name:`Edit ${name} in library`,exact:true}).click();return page.getByRole('dialog',{name:'Library template editor'});};
    await page.goto('/coach/training-calendar');await page.getByRole('button',{name:'Library (2)',exact:true}).click();
    let editor=await open();await expect(editor.getByLabel('Workout date')).toHaveCount(0);
    await expect(editor.getByRole('button',{name:'Save to library',exact:true})).toHaveCount(0);
    await expect(editor.getByPlaceholder('Planned IF',{exact:true})).toHaveValue('0');
    await expect(editor.getByLabel('Planned TSS',{exact:true})).toHaveValue('0');
    await expect(editor.getByText('min/km',{exact:true})).toBeVisible();
    await page.screenshot({path:`../output/library-o1-open-${info.project.name}.png`});
    await editor.getByLabel('Workout title',{exact:true}).fill('Cancelled edit');await editor.getByRole('button',{name:'Close',exact:true}).click();
    expect((await row()).name).toBe('Stored hill template');expect(writes).toHaveLength(0);
    editor=await open();await editor.getByLabel('Workout title',{exact:true}).fill('Revised hill template');
    await editor.getByPlaceholder('Coach instructions (separate from description)',{exact:true}).fill('Keep recoveries easy');
    await editor.getByPlaceholder('Workout objective / purpose',{exact:true}).fill('Economy');
    await editor.getByLabel('Primary target').selectOption('power');await editor.getByLabel('Workout visibility').selectOption('athlete_visible');
    await editor.getByRole('button',{name:'Save template',exact:true}).click();
    await expect(editor.getByText('Update committed; acknowledgement lost. Retry.',{exact:true})).toBeVisible();
    await expect(editor.getByLabel('Workout title',{exact:true})).toHaveValue('Revised hill template');
    await editor.getByRole('button',{name:'Save template',exact:true}).click();await expect(editor).not.toBeVisible();
    expect(writes).toHaveLength(2);expect(writes[0]).toEqual(writes[1]);expect(writes[0].id).toBe(id);
    expect(Object.keys(writes[0]).sort()).toEqual(['id','name','objective','coach_instructions','target_metric','visibility'].sort());
    let saved=await row();expect(saved.description).toBe(null);expect(saved.planned_duration_min).toBe(null);
    expect(saved.planned_distance_km).toBe(9.656064);expect(saved.planned_if).toBe(0);expect(saved.planned_tss).toBe(0);
    expect(saved.structure).toEqual(structure);expect(saved.tags).toEqual(['trail','hill']);
    await page.reload();await page.getByRole('button',{name:'Library (2)',exact:true}).click();editor=await open('Revised hill template');
    await expect(editor.getByPlaceholder('Coach instructions (separate from description)',{exact:true})).toHaveValue('Keep recoveries easy');
    await editor.getByLabel('Distance unit').selectOption('km');await editor.getByRole('button',{name:'Save template',exact:true}).click();await expect(editor).not.toBeVisible();
    expect((await row()).planned_distance_km).toBe(9.656064);expect((await row()).planned_distance_unit).toBe('km');
    editor=await open('Revised hill template');await editor.getByLabel('Planned duration (min)',{exact:true}).fill('0');
    await editor.getByPlaceholder('Planned IF',{exact:true}).fill('');await editor.getByLabel('Planned TSS',{exact:true}).fill('');
    await editor.getByLabel('Planned distance',{exact:true}).fill('0');await editor.getByLabel('Template tags (one per line)').fill('');
    await editor.getByPlaceholder('Workout objective / purpose',{exact:true}).fill('');
    await page.screenshot({path:`../output/library-o1-editor-${info.project.name}.png`,fullPage:true});
    await editor.getByRole('button',{name:'Save template',exact:true}).dblclick();await expect(editor).not.toBeVisible();
    saved=await row();expect(saved.planned_duration_min).toBe(0);expect(saved.planned_distance_km).toBe(0);
    expect(saved.planned_if).toBe(null);expect(saved.planned_tss).toBe(null);expect(saved.objective).toBe(null);expect(saved.tags).toBe(null);
    expect(saved.structure).toEqual(structure);expect((await f.pg.query('select count(*)::int n from workout_library')).rows[0].n).toBe(2);
    editor=await open('Revised hill template');await editor.getByLabel('Workout title',{exact:true}).fill('x'.repeat(201));
    await editor.getByRole('button',{name:'Save template',exact:true}).click();await expect(editor.getByText('Invalid name.',{exact:true})).toBeVisible();
    expect((await row()).name).toBe('Revised hill template');
    await editor.getByLabel('Workout title',{exact:true}).fill('Final trail template');await editor.getByLabel('Sport',{exact:true}).selectOption('hike');
    await editor.getByPlaceholder('Coach instructions / session goal',{exact:true}).fill('Runnable climb');
    await editor.getByLabel('Template tags (one per line)').fill('trail\nbase');
    await editor.getByPlaceholder(/Step notes/).first().fill('Edited recovery advice');
    await editor.getByRole('button',{name:'Save template',exact:true}).click();await expect(editor).not.toBeVisible();
    saved=await row();expect(saved.sport).toBe('hike');expect(saved.description).toBe('Runnable climb');expect(saved.tags).toEqual(['trail','base']);
    expect(saved.structure).toEqual([{...structure[0],notes:'Edited recovery advice'},structure[1]]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{await f.close();}
});

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

test('fast acknowledgement ignores the second pointer event while later intentional clicks and keyboard saves remain new',async({page},info)=>{
  test.setTimeout(60000);const f=await libraryFixture(),writes=[];
  try {
    if(info.project.name==='mobile-chromium')await page.setViewportSize({width:320,height:844});
    await signedLibraryRoutes(page,f,async(req,body)=>{
      if(req.method()!=='POST')return null;writes.push(body);return f.invokeLibrary({method:'POST',body});
    });
    await page.goto('/coach/training-calendar');await page.getByRole('button',{name:'+ Plan workout',exact:true}).click();
    const editor=page.getByRole('dialog',{name:'Workout editor'}),save=editor.getByRole('button',{name:'Save to library',exact:true});
    await editor.getByLabel('Workout title',{exact:true}).fill('Fast pointer acknowledgement');
    await save.click();await expect(editor.getByText('Saved to library.',{exact:true})).toBeVisible();
    // Explicitly deliver click two after the real first transaction completes.
    // This controls the failure race without substituting a fake save response.
    // Locator.click({clickCount:2}) emits a whole extra two-click sequence.
    // Native down/up with count2 emits only the second event of this sequence.
    const bounds=await save.boundingBox();expect(bounds).not.toBeNull();
    await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
    await page.mouse.down({clickCount:2});await page.mouse.up({clickCount:2});
    await expect(editor.getByText('Saved to library.',{exact:true})).toBeVisible();
    let rows=(await f.invokeLibrary()).body.workouts.filter(w=>w.name==='Fast pointer acknowledgement');
    expect(rows).toHaveLength(1);expect(writes).toHaveLength(1);
    await save.click();await expect(editor.getByText('Saved to library.',{exact:true})).toBeVisible();
    rows=(await f.invokeLibrary()).body.workouts.filter(w=>w.name==='Fast pointer acknowledgement');
    expect(rows).toHaveLength(2);expect(writes[1].client_request_id).not.toBe(writes[0].client_request_id);
    await save.focus();await page.keyboard.press('Enter');await expect(editor.getByText('Saved to library.',{exact:true})).toBeVisible();
    rows=(await f.invokeLibrary()).body.workouts.filter(w=>w.name==='Fast pointer acknowledgement');
    expect(rows).toHaveLength(3);expect(writes[2].client_request_id).not.toBe(writes[1].client_request_id);
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
    await editor.getByRole('button',{name:'Save to library',exact:true}).dblclick();
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

const structure = [
  {type:'cooldown',repeat:1,duration_min:5.25,intensity:'easy',target_type:'pace',target_min:6.2,target_max:7.4,target_units:'min/km',notes:'Keep exact',extra:'retained'},
  {type:'work',repeat:1,duration_min:2,intensity:'easy',target_type:'pace',target_min:10,target_max:null,target_units:'min/mi'},
  ...[['heart_rate','bpm',150,160],['power','W',0,250],['rpe','RPE',3,5],['zone','zone',2,3]].map(([target_type,target_units,target_min,target_max])=>({type:'work',repeat:1,duration_min:1,intensity:'easy',target_type,target_units,target_min,target_max})),
];
test('F9 assigned plan edits preserve independent target units through signed SQL and athlete reload',async({page},info)=>{
  const owner=planOwner,other=planCoach,plan=assignedPlanId;
  test.setTimeout(60000);const f=await planFixture({stravaConnected:false});let actor=other;const writes=[];
  const today=new Date().toISOString().slice(0,10);
  const tomorrow=new Date(Date.parse(today+'T12:00:00Z')+86400000).toISOString().slice(0,10);
  const external=[];page.on('request',req=>{if(!new URL(req.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/))external.push(req.url());});
  try{
    if(info.project.name==='mobile-chromium')await page.setViewportSize({width:320,height:900});
    await f.pg.query('update planned_workouts set workout_date=$1,structure=$2,planned_distance_unit=$3 where id=$4',[today,JSON.stringify(structure),'mi',plan]);
    await page.route('**/api/**',async route=>{
      const req=route.request(),u=new URL(req.url());let result={code:200,body:{settings:{distance_unit:'mi'},events:[],notes:[],comments:[],notifications:[],unreadCount:0,workouts:[]}};
      if(u.pathname==='/api/me')result.body={athlete:{id:actor,name:'Isolated runner',onboarding_complete:true,primary_role:actor===other?'coach':'athlete',subscription_tier:actor===other?'coach_pro':'free'},account:{primary_role:actor===other?'coach':'athlete',capabilities:{athlete:true,coach:actor===other},coach_access:{eligible:actor===other}}};
      if(u.pathname==='/api/coach/relationships')result.body={relationships:[{athlete_id:owner,status:'active',athlete:{name:'Isolated runner'}}]};
      if(u.pathname==='/api/planned-workouts'){
        const body=req.postData()?req.postDataJSON():{};if(req.method()==='PATCH')writes.push(body);
        result=await f.invoke(body,{actor,method:req.method(),query:Object.fromEntries(u.searchParams)});
      }
      if(u.pathname==='/api/workout-library')result=await f.invokeLibrary(req.postData()?req.postDataJSON():{},{actor,method:req.method(),query:Object.fromEntries(u.searchParams)});
      await route.fulfill({status:result.code,contentType:'application/json',body:JSON.stringify(result.body)});
    });
    const open=async()=>{
      await page.goto(`/coach/training-calendar?athlete_id=${owner}&workout=${plan}`);
      await page.getByRole('dialog',{name:'Workout details'}).getByRole('button',{name:'Edit workout',exact:true}).click();
      return page.getByRole('dialog',{name:'Workout editor'});
    };
    let editor=await open();await editor.getByLabel('Planned duration (min)',{exact:true}).fill('25');
    await editor.getByLabel('Workout date',{exact:true}).fill(tomorrow);
    await editor.getByPlaceholder('Coach instructions (separate from description)',{exact:true}).fill('Only instructions changed');
    expect(await editor.locator('input:invalid,select:invalid').evaluateAll(nodes=>nodes.map(n=>({value:n.value,label:n.getAttribute('aria-label'),message:n.validationMessage})))).toEqual([]);
    await editor.getByRole('button',{name:'Save workout',exact:true}).click();await expect(editor).not.toBeVisible();
    expect(writes[0].structure).toEqual(structure);expect((await f.row()).structure).toEqual(structure);
    actor=owner;await page.goto(`/calendar?workout=${plan}`);await page.reload();
    const details=page.getByRole('dialog',{name:'Workout details'});await expect(details).toContainText('min/km');await expect(details).toContainText('min/mi');
    await expect(details).toContainText(/power 0.250 W/);
    await page.screenshot({path:`../output/library-f9-athlete-${info.project.name}.png`,fullPage:true});
    expect((await f.invoke({}, {actor:owner,method:'GET',query:{start:today,end:tomorrow}})).body.workouts.find(w=>w.id===plan).structure).toEqual(structure);
    actor=other;editor=await open();await editor.getByLabel('Distance unit',{exact:true}).selectOption('km');
    await editor.getByRole('button',{name:'Save to library',exact:true}).click();await expect(editor.getByText('Saved to library.',{exact:true})).toBeVisible();
    expect((await f.pg.query('select structure from workout_library')).rows[0].structure).toEqual(structure);
    await editor.getByRole('button',{name:'Save workout',exact:true}).click();await expect(editor).not.toBeVisible();expect((await f.row()).structure).toEqual(structure);
    editor=await open();await editor.getByLabel('Pace target unit',{exact:true}).first().selectOption('min/mi');
    await editor.getByRole('button',{name:'Save workout',exact:true}).click();await expect(editor).not.toBeVisible();
    const converted=[{...structure[0],target_units:'min/mi',target_min:6.2*1.609344,target_max:7.4*1.609344},...structure.slice(1)];
    expect((await f.row()).structure).toEqual(converted);
    actor=owner;await page.goto(`/calendar?workout=${plan}`);await page.reload();await expect(details).toContainText('min/mi');
    expect((await f.invoke({}, {actor:owner,method:'GET',query:{start:today,end:tomorrow}})).body.workouts.find(w=>w.id===plan).structure).toEqual(converted);
    actor=other;editor=await open();await editor.getByLabel('Target minimum',{exact:true}).first().fill('easy');
    await editor.getByLabel('Pace target unit',{exact:true}).first().selectOption('min/km');
    await expect(editor.getByText('Enter a numeric pace or minutes:seconds before converting its unit.',{exact:true})).toBeVisible();
    await expect(editor.getByLabel('Pace target unit',{exact:true}).first()).toHaveValue('min/mi');
    await editor.getByRole('button',{name:'Close',exact:true}).click();expect((await f.row()).structure).toEqual(converted);
    expect((await f.invoke({id:plan,structure:[]},{actor:null})).code).toBe(401);
    expect((await f.invoke({id:plan,structure:[]},{actor:owner})).code).toBe(400);expect((await f.row()).structure).toEqual(converted);
    expect(external).toEqual([]);
  }finally{await f.close();}
});
