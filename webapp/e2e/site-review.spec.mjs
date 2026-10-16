import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function setup(page, enabled=true) {
  const notes=[];let fails=true;
  await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url());let status=200,body={};
    if(url.pathname==='/api/me'){status=401;}
    if(url.pathname==='/api/site-review') {
      if(!enabled){status=403;body={error:'Not permitted'};}
      else if(url.searchParams.has('access'))body={enabled:true};
      else if(req.method()==='GET')body={notes};
      else if(req.method()==='POST') {
        if(fails){fails=false;status=503;body={error:'Temporary save failure. Please retry.'};}
        else {notes.push({...req.postDataJSON(),status:'open',created_at:new Date().toISOString()});body={saved:true};}
      } else {const update=req.postDataJSON();Object.assign(notes.find(n=>n.id===update.id),update);body={note:notes.find(n=>n.id===update.id)};}
    }
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });return notes;
}
test('owner selects a real page element, retries save, reloads, resolves and exports',async({page})=>{
  const notes=await setup(page);await page.goto('/privacy');
  await page.getByRole('button',{name:'Leave feedback',exact:true}).click();
  await page.getByRole('button',{name:'Select an element'}).click();
  await page.locator('h1').first().click();
  const field=page.getByLabel('What would you like changed, or what went wrong?');
  await field.fill('Please clarify this heading.');
  await page.getByRole('button',{name:'Save note',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Temporary save failure');
  await expect(field).toHaveValue('Please clarify this heading.');
  await page.getByRole('button',{name:'Save note',exact:true}).click();
  await expect(page.getByText('Please clarify this heading.',{exact:true})).toBeVisible();
  expect(notes).toHaveLength(1);expect(notes[0].pathname).toBe('/privacy');expect(notes[0].element).toContain('h1');
  expect((await new AxeBuilder({page}).include('[role="dialog"]').analyze()).violations).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.reload();await page.getByRole('button',{name:'Leave feedback',exact:true}).click();
  await expect(page.getByText('Please clarify this heading.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Mark resolved'}).click();
  await expect.poll(()=>notes[0].status).toBe('resolved');
  await page.getByLabel('Filter review notes').selectOption('resolved');
  await expect(page.getByRole('button',{name:'Reopen'})).toBeVisible();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export',exact:true}).click();expect((await download).suggestedFilename()).toBe('threshold-review-notes.json');
  await page.screenshot({path:`../output/playwright/review-${test.info().project.name}.png`});
});
test('general note draft survives closing, keyboard cancel restores browsing, guests have no control',async({page})=>{
  await setup(page);await page.goto('/privacy');
  await page.getByRole('button',{name:'Leave feedback',exact:true}).click();
  await page.getByRole('button',{name:'Select an element'}).click();await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'General page note'}).click();
  await page.getByLabel('What would you like changed, or what went wrong?').fill('Keep this draft');
  await page.getByRole('button',{name:'Close review panel'}).click();
  await page.getByRole('button',{name:'Leave feedback · Draft'}).click();
  await expect(page.getByLabel('What would you like changed, or what went wrong?')).toHaveValue('Keep this draft');
  await page.unrouteAll();await setup(page,false);page.on('dialog',d=>d.accept());await page.reload();
  await expect(page.getByRole('button',{name:/Leave feedback/})).toHaveCount(0);
});
