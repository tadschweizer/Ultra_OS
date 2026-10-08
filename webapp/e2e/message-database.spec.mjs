import { test, expect } from '@playwright/test';
import { fixture, owner, athlete, coach } from '../tests/helpers/message-lifecycle-fixture.mjs';

// Only the outer browser API transport and /api/me are isolated here. Message,
// draft, preferences and read requests run actual signed-session handlers and SQL.
async function connect(page, role, f, state={}) {
  const paths={'/api/coach/messages':'messages','/api/message-center':'center',
    '/api/message-drafts':'draft','/api/message-preferences':'preferences'};
  await page.route('**/api/**',async route=>{
    const request=route.request(),url=new URL(request.url());let status=200,body={notifications:[],unreadCount:0};
    if(url.pathname==='/api/me')body={athlete:{id:role==='coach'?owner:athlete,name:role,onboarding_complete:true,primary_role:role,subscription_tier:'free'},
      account:{primary_role:role,capabilities:{athlete:true,coach:role==='coach'},coach_profile:role==='coach'?{id:coach,display_name:'Coach'}:null}};
    if(paths[url.pathname]){
      const query=Object.fromEntries(url.searchParams),payload=request.postData()?request.postDataJSON():{};
      if(state.draftFail && paths[url.pathname]==='draft' && request.method()==='PUT'){
        status=503;body={error:'Isolated database outage'};
      }else{
        const result=await f.invoke(paths[url.pathname],{actor:role==='coach'?owner:athlete,method:request.method(),body:payload,query});
        status=result.code;body=result.body;
        if(state.loseSendResponse && paths[url.pathname]==='messages' && request.method()==='POST' && status===200){
          state.loseSendResponse=false;status=503;body={error:'Commit succeeded, response lost'};
        }
      }
    }
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
}

test('real signed handlers and SQL persist drafts, deliver between roles, acknowledge and suppress read alerts',async({page,context})=>{
  const f=await fixture();try {
    await connect(page,'coach',f);await page.goto('/messages?mode=coach');
    await page.getByLabel('Your message').fill('Database-backed private draft.');
    await expect(page.getByText('Draft saved',{exact:true})).toBeVisible();await page.reload();
    await expect(page.getByLabel('Your message')).toHaveValue('Database-backed private draft.');
    const runner=await context.newPage();await connect(runner,'athlete',f);await runner.goto('/messages?mode=athlete');
    await runner.getByText('Notification preferences',{exact:true}).click();
    await runner.getByLabel('Email me about unread direct messages').check();
    await runner.getByRole('button',{name:'Save notification preferences'}).click();
    await expect(runner.getByText('Notification preferences saved.')).toBeVisible();
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await expect(page.getByLabel('Your message')).toHaveValue('');
    await expect(runner.getByText('Database-backed private draft.',{exact:true}).last()).toBeVisible({timeout:8000});
    await expect.poll(async()=> (await f.pg.query('select count(*)::int n from coach_messages where read_at is null')).rows[0].n).toBe(0);
    expect((await f.rpc('claim_message_email')).skipped).toBe(true);
    await runner.getByLabel('Your message').fill('Reply persisted through the real API.');
    await runner.getByRole('button',{name:'Send',exact:true}).click();
    await expect(page.getByText('Reply persisted through the real API.',{exact:true}).last()).toBeVisible({timeout:8000});
    expect((await f.pg.query('select count(*)::int n from coach_messages')).rows[0].n).toBe(2);
    await expect.poll(async()=> (await f.invoke('center',{query:{mode:'coach'}})).body.unread_total).toBe(0);
  }finally{await f.close();}
});

test('database-backed send retry survives a lost commit response without duplicate message or alert',async({page})=>{
  const f=await fixture();try {
    const state={draftFail:true,loseSendResponse:true};await connect(page,'coach',f,state);await page.goto('/messages?mode=coach');
    await page.getByLabel('Your message').fill('Retry the committed message.');
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await expect(page.locator('main [role="alert"]').first()).toContainText('Draft could not be saved');
    expect((await f.pg.query('select count(*)::int n from coach_messages')).rows[0].n).toBe(0);
    state.draftFail=false;await page.getByRole('button',{name:'Send',exact:true}).click();
    await expect(page.locator('main [role="alert"]')).toContainText('Unable to send');
    await expect(page.getByLabel('Your message')).toHaveValue('Retry the committed message.');
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await expect(page.getByLabel('Your message')).toHaveValue('');
    expect((await f.pg.query('select count(*)::int n from coach_messages')).rows[0].n).toBe(1);
    expect((await f.pg.query('select count(*)::int n from message_email_deliveries')).rows[0].n).toBe(1);
    await page.reload();await expect(page.getByLabel('Your message')).toHaveValue('');
  }finally{await f.close();}
});
