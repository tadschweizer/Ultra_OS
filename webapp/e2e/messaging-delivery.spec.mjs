import { test, expect } from '@playwright/test';

const athlete='11111111-1111-4111-8111-111111111111';
const second='22222222-2222-4222-8222-222222222222';
const owner='33333333-3333-4333-8333-333333333333';
const coach='44444444-4444-4444-8444-444444444444';
const notification='55555555-5555-4555-8555-555555555555';
const next='66666666-6666-4666-8666-666666666666';

async function setup(page) {
  const store={actor:owner,role:'coach',coach,posts:[],messages:[],fail:false,loseResponse:false,prefs:{athlete_message:true,coach_message:true},
    notificationWrites:[],feed:[{id:notification,athlete_id:athlete,entity_type:'coach_message',entity_id:notification,title:'New athlete message',body:'Open the conversation to read the reply.',read_at:null,created_at:'2026-10-07T12:00:00Z'}],unread:61,next:'2026-10-07T12:00:00Z|'+notification};
  await page.route('**/api/**',async route=>{
    const request=route.request(),url=new URL(request.url()); let status=200,body={};
    if(url.pathname==='/api/me') body={athlete:{id:store.actor,name:'QA account',primary_role:store.role,subscription_tier:'free',onboarding_complete:true},account:{primary_role:store.role,capabilities:{athlete:true,coach:store.role==='coach'},coach_profile:store.role==='coach'?{id:store.coach}:null}};
    if(url.pathname==='/api/coach/messages') {
      if(request.method()==='POST') {
        const payload=request.postDataJSON(); store.posts.push(payload);
        if(store.sendDelay) await store.sendDelay;
        if(store.fail){status=503;body={error:'Unavailable'};}
        else {
          if(!store.messages.some(m=>m.id===payload.client_message_id)) store.messages.push({id:payload.client_message_id,athlete_id:payload.athlete_id||athlete,sender_role:store.role,message_body:payload.message_body,created_at:new Date().toISOString()});
          if(store.loseResponse){store.loseResponse=false;await route.abort('failed');return;}
          body={message:store.messages.at(-1)};
        }
      } else body={actor_id:store.actor,role:store.role,templates:{general_checkin:'How are you?',race_week_checkin:'How is race week?'},
        conversations:[athlete,...(store.role==='coach'?[second]:[])].map(id=>({coach_id:store.coach,athlete_id:id,athlete:{name:id===athlete?'First athlete':'Second athlete'},unread_count:1105})),
        messages:store.messages.filter(m=>m.athlete_id===(url.searchParams.get('athlete_id')||athlete))};
    }
    if(url.pathname==='/api/message-center') {
      if(store.failSummary){status=503;body={error:'Summary unavailable'};}
      else body=request.method()==='GET'?{role:store.role,has_messaging:true,unread_total:1105,workout_threads:[],conversations:[{athlete_id:athlete,name:'First athlete',unread:1105}]}:{success:true};
    }
    if(url.pathname==='/api/notifications') {
      if(request.method()==='PATCH') {
        const payload=request.postDataJSON(); store.notificationWrites.push(payload);
        if(store.fail){status=503;body={error:'Unavailable'};}
        else if(payload.preferences){Object.assign(store.prefs,payload.preferences);body={preferences:store.prefs};}
        else {store.feed.forEach(n=>{if(payload.notification_ids.includes(n.id)&&!n.read_at){n.read_at=new Date().toISOString();store.unread--;}});body={success:true};}
      } else body={actor_id:store.actor,preferences:store.prefs,notifications:url.searchParams.has('before')?[{...store.feed[0],id:next,title:'Older notification'}]:store.feed,unread_count:store.unread,next_cursor:url.searchParams.has('before')?null:store.next};
    }
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  return store;
}

test('recipient drafts and message purpose survive reload; sending clears only the sent draft',async({page})=>{
  const store=await setup(page);await page.goto('/messages');
  await page.getByLabel('Message purpose').selectOption('race_week_checkin');
  await page.getByLabel('Your message').fill('First athlete saved draft');
  await expect(page.getByRole('status')).toContainText('Draft saved on this device');
  await page.getByLabel('Selected athlete').selectOption(second);
  await page.getByLabel('Your message').fill('Second athlete saved draft');
  await page.reload();await expect(page.getByLabel('Your message')).toHaveValue('First athlete saved draft');
  await expect(page.getByLabel('Message purpose')).toHaveValue('race_week_checkin');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.getByLabel('Your message')).toHaveValue('');
  await page.getByLabel('Selected athlete').selectOption(second);await expect(page.getByLabel('Your message')).toHaveValue('Second athlete saved draft');
  await page.getByRole('button',{name:'Discard draft'}).click();await page.reload();
  await page.getByLabel('Selected athlete').selectOption(second);await expect(page.getByLabel('Your message')).toHaveValue('');
  expect(store.posts).toHaveLength(1);
});

test('lost send response and reload reuse the saved retry ID and persist exactly one message',async({page})=>{
  const store=await setup(page);store.loseResponse=true;await page.goto('/messages');
  await page.getByLabel('Your message').fill('Keep one copy after a lost response');await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.locator('main [role="alert"]')).toContainText('Unable to send');
  await page.reload();await expect(page.getByLabel('Your message')).toHaveValue('Keep one copy after a lost response');
  await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByLabel('Your message')).toHaveValue('');
  expect(store.posts).toHaveLength(2);expect(store.posts[0].client_message_id).toBe(store.posts[1].client_message_id);expect(store.messages).toHaveLength(1);
});

test('drafts stay isolated across sign-out/account changes and resume for the original account',async({page})=>{
  const store=await setup(page);await page.goto('/messages');await page.getByLabel('Your message').fill('Private original account draft');
  store.actor=second;await page.goto('/guide');await page.goto('/messages');await expect(page.getByLabel('Your message')).toHaveValue('');
  await page.getByLabel('Your message').fill('Other account draft');
  store.actor=owner;await page.reload();await expect(page.getByLabel('Your message')).toHaveValue('Private original account draft');
});

test('blocked browser storage reports that a draft is not saved and keeps the current text usable',async({page})=>{
  await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new Error('Fixture storage denied');};});
  await setup(page);await page.goto('/messages');await page.getByLabel('Your message').fill('Keep the page open');
  await expect(page.getByRole('status')).toContainText('Draft could not be saved');await expect(page.getByLabel('Your message')).toHaveValue('Keep the page open');
});

test('failed preference save retains the previous setting; successful save survives reload',async({page})=>{
  const store=await setup(page);await page.goto('/notifications');const checkbox=page.getByRole('checkbox',{name:'New athlete messages'});
  await expect(checkbox).toBeChecked();store.fail=true;await checkbox.click();
  await expect(page.getByRole('status')).toContainText('Could not save preference');await expect(checkbox).toBeChecked();
  store.fail=false;await checkbox.click();await expect(page.getByRole('status')).toHaveText('Saved.');await page.reload();await expect(checkbox).not.toBeChecked();
  await expect(page.getByRole('button',{name:'Messages (1105 unread)'})).toBeVisible();
});

test('mark shown read leaves unseen notifications unread; pagination and conversation links remain usable',async({page})=>{
  const store=await setup(page);await page.goto('/notifications');
  await expect(page.getByRole('button',{name:'Mark shown read (61 unread total)'})).toBeVisible();
  store.fail=true;await page.getByRole('button',{name:'Mark shown read'}).click();await expect(page.getByRole('status')).toContainText('Could not mark notifications read');
  await expect(page.getByRole('button',{name:'Mark shown read (61 unread total)'})).toBeVisible();
  store.fail=false;await page.getByRole('button',{name:'Mark shown read'}).click();await expect(page.getByRole('button',{name:'Mark shown read (60 unread total)'})).toBeVisible();
  expect(store.notificationWrites.at(-1).notification_ids).toEqual([notification]);
  await page.getByRole('button',{name:'Load older notifications'}).click();await expect(page.getByText('Older notification',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Open conversation'}).first()).toHaveAttribute('href',`/messages?mode=coach&athlete_id=${athlete}`);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('unread summary failure displays an unavailable count and recovers with retry',async({page})=>{
  const store=await setup(page);store.failSummary=true;await page.goto('/messages');
  await page.getByRole('button',{name:'Messages (unread count unavailable)'}).click();
  await expect(page.getByRole('status')).toContainText('Unread count could not be refreshed');
  store.failSummary=false;await page.getByRole('button',{name:'Retry',exact:true}).click();
  await expect(page.getByRole('button',{name:'Messages (1105 unread)'})).toBeVisible();
});

test('a completed send preserves newer text saved by another tab, including conversation switching',async({page,context})=>{
  const store=await setup(page);let release;
  store.sendDelay=new Promise(resolve=>{release=resolve;});
  await page.goto('/messages');await page.getByLabel('Your message').fill('Send this original draft');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sending…'})).toBeDisabled();
  const otherTab=await context.newPage();await setup(otherTab);await otherTab.goto('/messages');
  await expect(otherTab.getByLabel('Your message')).toHaveValue('Send this original draft');
  await otherTab.getByLabel('Your message').fill('Newer draft from the other tab');
  release();await expect(page.getByLabel('Your message')).toHaveValue('Newer draft from the other tab');
  await page.getByLabel('Selected athlete').selectOption(second);await page.getByLabel('Selected athlete').selectOption(athlete);
  await expect(page.getByLabel('Your message')).toHaveValue('Newer draft from the other tab');
  await otherTab.reload();await expect(otherTab.getByLabel('Your message')).toHaveValue('Newer draft from the other tab');
  expect(store.messages).toHaveLength(1);
});
