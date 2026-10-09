import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function pilot(page,{admin=false,catalog=false,recorded=false}={}) {
  const deferred=[],writes=[];let events=[],saveFails=true;
  let entry={id:'paper-1',title:'Reviewed study',plain_english_summary:'Existing human summary',topic_tags:[],sport_tags:[],distance_tags:[]};
  await page.route('**/api/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    let status=200,body={connections:[],relationships:[],notifications:[],conversations:[],messages:[],entries:[],activities:[],interventions:[],events:[],races:[],workouts:[]};
    if(path.startsWith('/api/exa/') || path==='/api/research-library/draft'){deferred.push(path);status=403;body={code:'FEATURE_DEFERRED'};}
    if(path==='/api/me')body={athlete:{id:'athlete-1',name:'Pilot Athlete',onboarding_complete:true,subscription_tier:'pro',primary_role:'athlete',is_admin:admin},account:{primary_role:'athlete',is_admin:admin,capabilities:{athlete:true,coach:false,admin},coach_access:{eligible:false}}};
    if(path==='/api/settings')body={settings:{hr_zone_3_min:150},supplements:[]};
    if(path==='/api/interventions' && recorded)body={interventions:[1,2,3].map(n=>({id:`gut-${n}`,intervention_type:'Gut Training',date:`2026-10-0${n}`,subjective_feel:7,protocol_payload:{carb_actual_g_per_hr:70+n*10}}))};
    if(path==='/api/race-catalog')body={races:catalog?[{id:'catalog-1',name:'Catalog Race',event_date:'2027-05-01',distance_miles:50,sport_type:'Ultrarunning'}]:[]};
    if(path==='/api/race-events'){
      body={events};if(req.method()==='POST'){
        writes.push(req.postDataJSON());
        if(saveFails){status=503;body={error:'Temporary save failure'};saveFails=false;}
        else {const event={...req.postDataJSON(),id:`race-${events.length+1}`};events.push(event);body={event};}
      }
    }
    if(path==='/api/research-library/admin'){
      body={entries:[entry]};if(req.method()==='PUT'){entry={...entry,...req.postDataJSON()};writes.push(entry);body={entry};}
    }
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });return {deferred,writes};
}
async function fits(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
test('manual race entry survives failed save, retry and reload without generated lookup',async({page})=>{
  const state=await pilot(page);await page.goto('/races');
  await page.getByLabel('Search race catalog').fill('My local race');
  await page.getByRole('button',{name:'+ Add manually',exact:true}).click();
  await expect(page.getByLabel('Race name',{exact:true})).toHaveValue('My local race');
  await page.getByLabel('Race date',{exact:true}).fill('2027-05-10');
  await page.getByLabel('Distance (mi)',{exact:true}).fill('31');
  await page.getByLabel('Location',{exact:true}).fill('Local trail');
  await page.getByRole('button',{name:'Add to calendar',exact:true}).click();
  await expect(page.getByText('Temporary save failure')).toBeVisible();
  await expect(page.getByLabel('Race name',{exact:true})).toHaveValue('My local race');
  await page.getByRole('button',{name:'Add to calendar',exact:true}).click();
  await expect(page.getByText('My local race',{exact:true})).toBeVisible();
  expect(state.writes[1]).toMatchObject({name:'My local race',source:'manual',catalog_id:null,distance_miles:31});
  await page.reload();await expect(page.getByText('My local race',{exact:true})).toBeVisible();
  expect(state.deferred).toEqual([]);await fits(page);
});
test('catalog supports keyboard selection and human corrections without web enrichment',async({page})=>{
  const state=await pilot(page,{catalog:true});await page.goto('/races');
  await page.getByLabel('Search race catalog').fill('Catalog');
  const choice=page.getByRole('button',{name:/Catalog Race/});await choice.focus();await page.keyboard.press('Enter');
  await expect(page.getByLabel('Race name',{exact:true})).toHaveValue('Catalog Race');
  await page.getByLabel('Race name',{exact:true}).fill('Corrected catalog race');
  await expect(page.getByLabel('Distance (mi)',{exact:true})).toHaveValue('50');expect(state.deferred).toEqual([]);
});
test('direct planner is deferred for paid account and preserves saved browser data',async({page})=>{
  const state=await pilot(page);
  await page.addInitScript(()=>localStorage.setItem('ultraos-default-race',JSON.stringify({name:'Saved race',event_date:'2027-05-10'})));
  await page.goto('/race-plan');await expect(page.getByRole('heading',{name:'Automatic race plans are deferred'})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('ultraos-default-race')))).toEqual({name:'Saved race',event_date:'2027-05-10'});
  await page.getByRole('link',{name:'Edit race details'}).click();await expect(page).toHaveURL(/\/races$/);
  expect(state.writes).toEqual([]);expect(state.deferred).toEqual([]);await fits(page);
});
test('administrator edits saved human research without generating drafts',async({page})=>{
  const state=await pilot(page,{admin:true});await page.goto('/content/admin');
  await page.getByRole('button',{name:'Edit',exact:true}).click();
  await expect(page.getByLabel('Plain-English Summary')).toHaveValue('Existing human summary');
  await page.getByLabel('Plain-English Summary').fill('Revised human summary');
  await page.getByRole('button',{name:'Update Entry',exact:true}).click();await expect.poll(()=>state.writes.length).toBe(1);
  expect(state.writes[0].plain_english_summary).toBe('Revised human summary');
  await expect(page.getByRole('button',{name:/Generate Draft/})).toHaveCount(0);expect(state.deferred).toEqual([]);await fits(page);
});
test('pilot pages retain manual data views without deferred requests',async({page})=>{
  const state=await pilot(page,{recorded:true});
  for(const path of ['/dashboard','/insights','/guide']){
    await page.goto(path);await expect(page.locator('main')).toBeVisible();
    await expect(page.getByText('AI Readiness',{exact:true})).toHaveCount(0);
    await expect(page.getByText('AI Insights + Fun Facts',{exact:true})).toHaveCount(0);
    await expect(page.locator('main a[href="/race-plan"]')).toHaveCount(0);
    await expect(page.getByText('Gut training progression',{exact:true})).toHaveCount(0);await fits(page);
  }expect(state.deferred).toEqual([]);
});
test('public claims disclose deferred scope without AI purchase benefits',async({page})=>{
  await page.route('**/api/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{}'}));
  await page.goto('/');await expect(page.getByText(/Automatic reviews, generated plans and automatic research summaries/)).toBeVisible();
  await expect(page.getByText(/pilot does not claim TrainingPeaks parity/)).toBeVisible();
  expect((await new AxeBuilder({page}).include('main').analyze()).violations).toEqual([]);
  await fits(page);await page.goto('/pricing');await expect(page.getByText('AI analysis',{exact:true})).toHaveCount(0);
  await expect(page.getByText('Race Blueprint',{exact:true})).toHaveCount(0);await fits(page);
});
