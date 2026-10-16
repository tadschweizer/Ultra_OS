import { test, expect } from '@playwright/test';

test('shared document payloads render as text and unsafe stored links are not clickable', async ({page}) => {
  const payload='<img src=x onerror="window.__xss=true">';
  await page.addInitScript(()=>{window.__xss=false;});
  await page.route('**/api/**', async route => {
    const path=new URL(route.request().url()).pathname;
    let body={activities:[],workouts:[],relationships:[],connections:[],protocols:[],notifications:[],docs:[],messages:[],unreadCount:0};
    if(path==='/api/me')body={athlete:{id:'athlete-1',name:'Security QA',onboarding_complete:true,subscription_tier:'free',primary_role:'athlete'},account:{primary_role:'athlete',capabilities:{athlete:true,coach:false},default_path:'/dashboard'}};
    if(path==='/api/athlete/shared-docs')body={docs:[
      {id:'unsafe',title:payload,content:payload,doc_type:'link',resource_url:'javascript:window.__xss=true'},
      {id:'active-file',title:'Blocked script file',doc_type:'file',resource_url:'https://example.test/script.svg'},
      {id:'safe',title:'Training guide',doc_type:'file',resource_url:'https://example.test/guide.pdf'},
    ]};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  const result=await page.goto('/dashboard');
  expect(result.headers()['x-content-type-options']).toBe('nosniff');
  expect(result.headers()['content-security-policy']).toContain("object-src 'none'");
  const unsafe=page.locator('article').filter({hasText:payload});
  await expect(unsafe).toBeVisible();
  await expect(unsafe.locator('a')).toHaveCount(0);
  await expect(unsafe.locator('img')).toHaveCount(0);
  await expect(page.locator('article').filter({hasText:'Blocked script file'}).locator('a')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Open external resource'})).toHaveAttribute('href','https://example.test/guide.pdf');
  expect(await page.evaluate(()=>window.__xss)).toBe(false);
});
