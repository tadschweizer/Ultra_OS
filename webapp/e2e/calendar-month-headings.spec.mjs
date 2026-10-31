import {test,expect} from '@playwright/test';
const athlete='11111111-1111-4111-8111-111111111111';
async function setup(page,role,dates){
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;let body={workouts:[],notes:[],events:[],settings:{},comments:[],messages:[],conversations:[]};
  if(path==='/api/me')body={athlete:{id:athlete,name:'Synthetic athlete',primary_role:role,onboarding_complete:true,subscription_tier:'coach_pro'},account:{primary_role:role,capabilities:{athlete:true,coach:role==='coach'},coach_access:{eligible:true},coach_profile:{id:'33333333-3333-4333-8333-333333333333'}}};
  if(path==='/api/coach/relationships')body={relationships:[{athlete_id:athlete,status:'active',athlete:{name:'Synthetic athlete'}}]};
  if(path==='/api/planned-workouts')body={workouts:dates.map((date,i)=>({id:`44444444-4444-4444-8444-${String(i).padStart(12,'0')}`,athlete_id:athlete,title:`Session ${date}`,sport:'run',workout_date:date,status:'planned',visibility:'athlete_visible',planned_duration_min:30,structure:[]})),activities:[],match_activities:[],import_source:{strava_connected:false}};
  if(path==='/api/workout-review')body={items:[],has_more:false};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
}
async function sequence(page){return page.locator('[data-week-key]').evaluateAll(weeks=>weeks.flatMap(week=>Array.from(week.querySelectorAll('span,[data-calendar-day]')).filter(e=>(e.hasAttribute('data-calendar-day')||(!e.children.length&&/^(January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/.test(e.textContent.trim())))&&e.getClientRects().length&&getComputedStyle(e).display!=='none').map(e=>e.hasAttribute('data-calendar-day')?e.getAttribute('data-calendar-day'):`month:${e.textContent.trim()}`)));}
for(const role of ['coach','athlete']){
 test(`${role}: phone month heading follows the last previous-month session, even when day one is empty`,async({page})=>{
  await page.setViewportSize({width:390,height:844});await setup(page,role,['2026-09-29','2026-09-30','2026-10-03']);
  await page.goto(`${role==='coach'?'/coach/training-calendar':'/calendar'}?week=2026-09-28`);
  await expect(page.getByRole('button',{name:/Session 2026-10-03/})).toBeVisible();
  expect(await sequence(page)).toEqual(['month:September 2026','2026-09-29','2026-09-30','month:October 2026','2026-10-03']);
  await page.locator('[data-calendar-day="2026-09-29"]').scrollIntoViewIfNeeded();
  await page.screenshot({path:`output/month-headings/${role}-phone.png`});
  await page.setViewportSize({width:768,height:844});
  await expect(page.locator('[data-week-key="2026-09-28"]').getByText('October 2026',{exact:true}).filter({visible:true})).toHaveCount(1);
  await expect(page.locator('[data-calendar-day="2026-09-28"]')).toBeVisible();
  for(const width of [768,1440]){
   await page.setViewportSize({width,height:844});
   const cells=await page.locator('[data-week-key="2026-09-28"] [data-calendar-day]').evaluateAll(days=>days.map(day=>{const r=day.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width};}));
   expect(cells).toHaveLength(7);expect(new Set(cells.map(c=>c.y)).size).toBe(1);
   expect(cells.every((c,i)=>c.width>0&&(i===0||c.x>cells[i-1].x))).toBe(true);
  }
 });
 test(`${role}: phone headings handle year boundaries and refresh without duplicates`,async({page})=>{
  await page.setViewportSize({width:320,height:844});await setup(page,role,['2026-12-30','2026-12-31','2027-01-02']);
  const url=`${role==='coach'?'/coach/training-calendar':'/calendar'}?week=2026-12-28`;await page.goto(url);
  await expect(page.getByRole('button',{name:/Session 2027-01-02/})).toBeVisible();
  const expected=['month:December 2026','2026-12-30','2026-12-31','month:January 2027','2027-01-02'];
  expect(await sequence(page)).toEqual(expected);await page.reload();await expect(page.getByRole('button',{name:/Session 2027-01-02/})).toBeVisible();expect(await sequence(page)).toEqual(expected);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=320)).toBe(true);
 });
}
