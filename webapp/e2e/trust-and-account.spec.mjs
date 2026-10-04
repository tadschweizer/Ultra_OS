import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fileURLToPath } from 'node:url';
async function accountMock(page, { deleteFails = false, authFails = false } = {}) {
  const calls=[];
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;let status=200;let body={};
    if(path==='/api/me')body={athlete:{id:'athlete-1',name:'Test Athlete',onboarding_complete:true,primary_role:'athlete',subscription_tier:'free'},account:{primary_role:'athlete',capabilities:{athlete:true,coach:false}}};
    if(path==='/api/coach-connection')body={connections:[]};
    if(path==='/api/account-export'){calls.push(['export',route.request().method()]);body={format:'threshold-personal-training-v1',unavailableSections:[],sections:{profile:{name:'Test Athlete'},interventions:[]}};}
    if(path==='/api/delete-account'){calls.push(['delete',route.request().method(),route.request().postDataJSON()]);status=deleteFails?503:200;body=deleteFails?{error:'We could not stop billing, so your account has not been deleted.'}:{success:true,auth_cleanup:authFails?'failed':'done',stripe_cleanup:'done'};}
    if(path==='/api/billing/preview')body={plan:{id:'pro_annual',label:'Athlete Pro Annual'},price:{amount:14400,currency:'usd',interval:'year',intervalCount:1},changing:false,intent:'review'};
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });return calls;
}
async function noOverflow(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
test('public trust pages expose real support, cancellation and coach-sharing information without sign-in',async({page})=>{
  await page.route('**/api/**',route=>route.fulfill({status:401,contentType:'application/json',body:'{}'}));
  for(const [path,heading] of [['/privacy','Privacy'],['/terms','Terms of use'],['/support','How can we help?']]){
    await page.goto(path);await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();
    await expect(page.locator('main a[href="mailto:tad.s@mythreshold.co"]').first()).toBeVisible();await noOverflow(page);
  }
  await expect(page.getByText(/Manage Billing to update a payment method or cancel/)).toBeVisible();
  await page.getByRole('navigation',{name:'Trust and support'}).getByRole('link',{name:'Privacy',exact:true}).click();
  await expect(page.getByRole('heading',{name:'What a connected coach can see'})).toBeVisible();
});
test('account training download uses protected POST and creates a JSON archive',async({page})=>{
  const calls=await accountMock(page);await page.goto('/account');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download my training records'}).click();
  expect((await download).suggestedFilename()).toBe('threshold-personal-training.json');
  await expect(page.locator('section[aria-labelledby="your-data-heading"] [role="status"]')).toContainText('archive is ready');
  expect(calls).toEqual([['export','POST']]);await noOverflow(page);
});
test('deletion requires typed confirmation; failed billing retains the account and answers',async({page})=>{
  const calls=await accountMock(page,{deleteFails:true});await page.goto('/account');
  await page.getByRole('button',{name:'Review account deletion'}).click();
  const button=page.getByRole('button',{name:'Permanently delete my account'});await expect(button).toBeDisabled();
  await page.getByLabel('Type DELETE MY ACCOUNT to confirm').fill('DELETE MY ACCOUNT');await button.click();
  await expect(page.locator('section[aria-labelledby="your-data-heading"] [role="alert"]')).toContainText('account has not been deleted');
  await expect(page.getByLabel('Type DELETE MY ACCOUNT to confirm')).toHaveValue('DELETE MY ACCOUNT');
  expect(calls).toEqual([['delete','DELETE',{confirm:'DELETE MY ACCOUNT'}]]);await noOverflow(page);
});
test('confirmed successful deletion shows signed-out result and removes destructive controls',async({page})=>{
  await accountMock(page);await page.goto('/account');await page.getByRole('button',{name:'Review account deletion'}).click();
  await page.getByLabel('Type DELETE MY ACCOUNT to confirm').fill('DELETE MY ACCOUNT');await page.getByRole('button',{name:'Permanently delete my account'}).click();
  await expect(page.locator('section[aria-labelledby="your-data-heading"] [role="status"]')).toContainText('account was deleted');
  await expect(page.getByRole('button',{name:'Permanently delete my account'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Account deleted',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Refresh billing status',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Download my training records',exact:true})).toHaveCount(0);
  const results=await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(results.violations).toEqual([]);
});
test('partial external sign-in cleanup is explicit and routes the user to support',async({page})=>{
  await accountMock(page,{authFails:true});await page.goto('/account');await page.getByRole('button',{name:'Review account deletion'}).click();
  await page.getByLabel('Type DELETE MY ACCOUNT to confirm').fill('DELETE MY ACCOUNT');await page.getByRole('button',{name:'Permanently delete my account'}).click();
  await expect(page.locator('main [role="status"]')).toContainText('External sign-in cleanup still needs help');
  await expect(page.locator('main a[href="mailto:tad.s@mythreshold.co"]')).toBeVisible();
  await expect(page.getByRole('button',{name:'Refresh billing status',exact:true})).toHaveCount(0);
});
test('keyboard confirmation can be reviewed and cancelled without a deletion request',async({page},testInfo)=>{
  const calls=await accountMock(page);await page.goto('/account');
  await page.getByRole('button',{name:'Review account deletion'}).focus();await page.keyboard.press('Enter');
  await expect(page.getByLabel('Type DELETE MY ACCOUNT to confirm')).toBeFocused();
  await page.keyboard.type('DELETE MY ACCOUNT');await page.keyboard.press('Tab');
  await expect(page.getByRole('button',{name:'Permanently delete my account'})).toBeFocused();
  await page.keyboard.press('Tab');await page.keyboard.press('Enter');
  await expect(page.getByLabel('Type DELETE MY ACCOUNT to confirm')).toHaveCount(0);expect(calls).toEqual([]);
  await page.locator('section[aria-labelledby="your-data-heading"]').screenshot({path:fileURLToPath(new URL(`../../output/p010-012-account-${testInfo.project.name}.png`,import.meta.url))});
  await page.goto('/support');await page.screenshot({path:fileURLToPath(new URL(`../../output/p010-012-support-${testInfo.project.name}.png`,import.meta.url)),fullPage:true});
});
for(const path of ['/privacy','/terms','/support'])test(`WCAG smoke: public ${path} page`,async({page})=>{
  await accountMock(page);await page.goto(path);await expect(page.locator('main h1')).toBeVisible();
  const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
});
test('WCAG smoke: billing review and typed account deletion controls',async({page})=>{
  await accountMock(page);await page.goto('/billing/checkout?plan=pro_annual');await expect(page.getByRole('button',{name:'Continue to Stripe for confirmation'})).toBeVisible();
  let results=await new AxeBuilder({page}).include('main').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(results.violations).toEqual([]);
  await page.goto('/account');await page.getByRole('button',{name:'Review account deletion'}).click();
  results=await new AxeBuilder({page}).include('section[aria-labelledby="your-data-heading"]').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(results.violations).toEqual([]);
});
