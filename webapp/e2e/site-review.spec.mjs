import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function setup(page,{enabled=true,owner=true}={}) {
  const state={notes:[],failSave:true,failLoad:false,reads:0};
  await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url());let status=200,body={};
    if(url.pathname==='/api/me')status=401;
    if(url.pathname==='/api/site-review') {
      if(!enabled){status=403;body={error:'Not permitted'};}
      else if(url.searchParams.has('access'))body={enabled:true,canManage:owner,actor:owner?'owner':'beth'};
      else if(req.method()==='GET'){
        state.reads++; if(state.loadDelay) await new Promise(resolve=>setTimeout(resolve,state.loadDelay));
        if(state.failLoad){status=503;body={error:'Temporary load failure'};}
        else body={notes:state.notes,canManage:owner,actor:owner?'owner':'beth'};
      } else if(req.method()==='POST') {
        const draft=req.postDataJSON();
        // Persist before a lost response to exercise exactly the same retry UUID.
        if(!state.notes.some(n=>n.id===draft.id))state.notes.push({...draft,athlete_id:owner?'owner':'beth',submitter:{display_name:owner?'Tad':'Beth'},version:1,status:'pending_review',created_at:new Date().toISOString(),history:[]});
        if(state.failSave){state.failSave=false;status=503;body={error:'Temporary save failure. Please retry.'};}
        else body={saved:true};
      } else {
        const update=req.postDataJSON(),note=state.notes.find(n=>n.id===update.id);
        if(!note.history.some(h=>h.id===update.requestId)){note.status=update.status||note.status;note.version++;note.updated_at=new Date().toISOString();
        note.history.push({id:update.requestId,status:note.status,message:update.message,actor_name:owner?'Tad':'Beth',created_at:note.updated_at});}body={note};if(state.failUpdate){state.failUpdate=false;status=503;body={error:'Update response lost. Retry safely.'};}
      }
    }
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });return state;
}
const open=async page=>{await page.goto('/privacy');await page.getByRole('button',{name:'Leave feedback',exact:true}).click();};
test('owner submits with lost-response retry, approves, tracks work and explicitly accepts completion',async({page})=>{
  const state=await setup(page);await open(page);
  await page.getByRole('button',{name:'Select an element'}).click();await page.locator('h1').first().click();
  const field=page.getByLabel('What would you like changed, or what went wrong?');await field.fill('Please clarify this heading.');
  await page.getByRole('button',{name:'Save note',exact:true}).click();await expect(page.getByRole('status')).toContainText('Temporary save failure');await expect(field).toHaveValue('Please clarify this heading.');
  await page.getByRole('button',{name:'Save note',exact:true}).click();await expect(page.getByText('Please clarify this heading.',{exact:true})).toBeVisible();expect(state.notes).toHaveLength(1);
  expect((await new AxeBuilder({page}).include('[role="dialog"]').analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Approve task',exact:true}).click();await page.getByRole('button',{name:'Start work',exact:true}).click();
  await page.getByLabel('Add an update').fill('The heading is ready to review.');await page.getByRole('button',{name:'Request acceptance',exact:true}).click();
  expect(state.notes[0].status).toBe('awaiting_acceptance');await expect(page.getByRole('button',{name:'Accept and complete'})).toBeVisible();
  await page.getByRole('button',{name:'Accept and complete'}).click();await page.getByLabel('Filter review notes').selectOption('completed');
  await expect(page.getByRole('button',{name:'Reopen task'})).toBeVisible();await page.getByText('Updates and history',{exact:true}).click();await expect(page.getByText('The heading is ready to review.',{exact:true})).toBeVisible();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export',exact:true}).click();expect((await download).suggestedFilename()).toBe('threshold-review-notes.json');
  await page.screenshot({path:`../output/playwright/feedback-${test.info().project.name}.png`});
});
test('contributor gets own status and history updates through polling, handles refresh errors and cannot approve',async({page})=>{
  const state=await setup(page,{owner:false});state.failSave=false;state.failLoad=true;state.loadDelay=500;await open(page);
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Loading');await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Temporary load failure');await expect(page.getByText('No tasks match this filter. Add feedback as you browse.')).toHaveCount(0);state.failLoad=false;state.loadDelay=0;await page.getByRole('button',{name:'Refresh',exact:true}).click();
  await page.getByRole('button',{name:'General page note'}).click();await page.getByLabel('What would you like changed, or what went wrong?').fill('Improve mobile navigation');await page.getByRole('button',{name:'Save note',exact:true}).click();
  await expect(page.getByText('Improve mobile navigation',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Approve task'})).toHaveCount(0);await expect(page.getByLabel('Filter by submitter')).toHaveCount(0);
  await page.getByLabel('Add an update').fill('My context stays here');
  state.notes[0].status='approved';
  await expect(page.locator('ol > li > strong').first()).toHaveText('Approved',{timeout:15000});
  await expect(page.getByLabel('Add an update')).toHaveValue('My context stays here');
  state.failLoad=true;await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Temporary load failure');await expect(page.getByText('Improve mobile navigation',{exact:true})).toBeVisible();
  state.failLoad=false;await page.getByRole('button',{name:'Refresh',exact:true}).click();await expect(page.getByRole('dialog').getByRole('alert')).toHaveCount(0);
  state.failUpdate=true;await page.getByRole('button',{name:'Save update',exact:true}).click();await expect(page.getByLabel('Add an update')).toBeDisabled();await page.getByRole('button',{name:'Retry last change'}).click();expect(state.notes[0].history).toHaveLength(1);await page.getByText('Updates and history',{exact:true}).click();await expect(page.getByText('My context stays here',{exact:true})).toBeVisible();
});
test('draft survives closure and selection cancellation; unauthorized account has no feedback control',async({page})=>{
  await setup(page);await open(page);await page.getByRole('button',{name:'Select an element'}).click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'General page note'}).click();await page.getByLabel('What would you like changed, or what went wrong?').fill('Keep this draft');await page.getByRole('button',{name:'Close review panel'}).click();await page.getByRole('button',{name:/Leave feedback/}).click();await expect(page.getByLabel('What would you like changed, or what went wrong?')).toHaveValue('Keep this draft');
  await page.unrouteAll();await setup(page,{enabled:false});page.on('dialog',d=>d.accept());await page.reload();await expect(page.getByRole('button',{name:/Leave feedback/})).toHaveCount(0);
});
