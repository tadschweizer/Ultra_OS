import { test, expect } from '@playwright/test';
import { libraryFixture } from '../tests/helpers/library-fixture.mjs';
import { owner, coach, athlete } from '../tests/helpers/message-lifecycle-fixture.mjs';

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
