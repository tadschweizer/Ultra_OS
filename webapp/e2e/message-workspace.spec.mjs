import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {fixture,athlete,coach,owner} from '../tests/helpers/message-lifecycle-fixture.mjs';
import {connect} from './helpers/message-database-transport.mjs';
const second='88888888-8888-4888-8888-888888888888';

test('F8 inbox outage is unavailable, preserves known conversations, and retry verifies empty versus existing',async({page},info)=>{
  test.setTimeout(60000);const f=await fixture();
  try{
    if(info.project.name==='mobile-chromium')await page.setViewportSize({width:320,height:720});
    await f.send(undefined,'athlete','Unread training question');
    await f.pg.exec('reset role; alter function message_inbox_summary(uuid,text) rename to qa_missing_inbox; set role service_role;');
    await connect(page,'coach',f);await page.goto('/messages?mode=coach');
    const list=page.getByRole('complementary',{name:'Conversations'});
    const retry=()=>page.getByRole('button',{name:'Retry loading'}).filter({visible:true});
    await expect(page.getByRole('alert').filter({hasText:'Unable to load messages'}).filter({visible:true})).toBeVisible();
    await expect(page.getByText('No active coach conversation found.',{exact:true})).not.toBeVisible();
    await expect(page.getByText('No active athletes found.',{exact:false})).not.toBeVisible();
    await expect(list.getByText('Unavailable',{exact:true})).toBeVisible();
    await page.screenshot({path:`../output/messages-f8-unavailable-${info.project.name}.png`,fullPage:true});
    await f.pg.exec('reset role; alter function qa_missing_inbox(uuid,text) rename to message_inbox_summary; set role service_role;');
    await retry().click();await expect(list.getByRole('button',{name:/Open conversation with Runner/})).toBeVisible();
    if(info.project.name==='mobile-chromium')expect((await f.pg.query('select count(*)::int n from coach_messages where read_at is null')).rows[0].n).toBe(1);
    await f.pg.exec('reset role; alter function message_inbox_summary(uuid,text) rename to qa_missing_inbox; set role service_role;');
    await expect(list.getByText('Showing the last loaded conversations.',{exact:true})).toBeVisible({timeout:10000});
    await expect(list.getByRole('button',{name:/Open conversation with Runner/})).toBeVisible();
    await page.screenshot({path:`../output/messages-f8-retained-${info.project.name}.png`,fullPage:true});
    await f.pg.exec('reset role; alter function qa_missing_inbox(uuid,text) rename to message_inbox_summary; set role service_role;');
    await retry().click();await expect(list.getByText('Showing the last loaded conversations.',{exact:true})).not.toBeVisible();
    await f.pg.exec("update coach_athlete_relationships set status='paused';");
    await page.goto('/messages?mode=coach');
    await expect(list.getByText('No active athletes found.',{exact:false})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{await f.close();}
});

test('visible thread alone is read; recipient drafts survive list, switching, browser Back and refresh',async({page},info)=>{
  test.setTimeout(60000);
  const f=await fixture();try {
    await f.pg.exec(`insert into athletes(id,name,email) values('${second}','Valley runner','valley@example.test');
      insert into coach_athlete_relationships(coach_id,athlete_id,status) values('${coach}','${second}','active');
      insert into coach_messages(coach_id,athlete_id,sender_role,message_body) values
      ('${coach}','${athlete}','athlete','First training question'),('${coach}','${second}','athlete','Second training question');`);
    await connect(page,'coach',f);await page.goto('/messages?mode=coach');
    const thread=page.getByRole('region',{name:'Message thread'}),list=page.getByRole('complementary',{name:'Conversations'});
    const unread=async(id)=>Number((await f.pg.query('select count(*) n from coach_messages where athlete_id=$1 and read_at is null',[id])).rows[0].n);
    const mobile=info.project.name==='mobile-chromium';
    await expect(list.getByRole('button',{name:/Open conversation with Runner/})).toBeVisible();
    expect((await new AxeBuilder({page}).include('[aria-label="Conversations"]').withTags(['wcag2a','wcag2aa']).analyze()).violations).toEqual([]);
    if(mobile){
      await expect(thread).not.toBeVisible();expect(await unread(athlete)).toBe(1);expect(await unread(second)).toBe(1);
      await page.screenshot({path:`../output/messages-list-${info.project.name}.png`,fullPage:true});
      await list.getByRole('button',{name:/Open conversation with Runner/}).click();
      await expect(list).not.toBeVisible();
    }
    await expect(thread.getByText('First training question',{exact:true})).toBeVisible();
    await expect.poll(()=>unread(athlete)).toBe(0);expect(await unread(second)).toBe(1);
    await page.getByLabel('Your message').fill('Draft for the first runner');await expect(page.getByText('Draft saved',{exact:true})).toBeVisible();
    if(mobile){
      await page.getByRole('button',{name:'Back to conversations'}).click();
      await expect(list.getByRole('button',{name:/Open conversation with Runner/})).toBeFocused();
      await list.getByRole('button',{name:/Open conversation with Valley runner/}).click();
    }else await page.getByLabel('Selected athlete').selectOption(second);
    await expect(page.getByLabel('Your message')).toHaveValue('');
    await expect(thread.getByText('Second training question',{exact:true})).toBeVisible();await expect.poll(()=>unread(second)).toBe(0);
    await page.getByLabel('Your message').fill('Draft for the valley runner');await expect(page.getByText('Draft saved',{exact:true})).toBeVisible();
    await page.reload();await expect(page.getByLabel('Your message')).toHaveValue('Draft for the valley runner');
    if(mobile){await page.getByRole('button',{name:'Back to conversations'}).click();await list.getByRole('button',{name:/Open conversation with Runner/}).click();}
    else await page.getByLabel('Selected athlete').selectOption(athlete);
    await expect(page.getByLabel('Your message')).toHaveValue('Draft for the first runner');
    await page.goBack();
    if(mobile)await expect(list).toBeVisible();
    else await expect(page.getByLabel('Selected athlete')).toHaveValue(second);
    // A new reply while the mobile list is open stays unread through background polling.
    if(mobile){
      await f.pg.exec(`insert into coach_messages(coach_id,athlete_id,sender_role,message_body) values('${coach}','${athlete}','athlete','Reply while inbox is open');`);
      await expect(list.getByRole('button',{name:/Open conversation with Runner, 1 unread/})).toBeVisible({timeout:8000});
      expect(await unread(athlete)).toBe(1);
      await list.getByRole('button',{name:/Open conversation with Runner/}).click();await expect.poll(()=>unread(athlete)).toBe(0);
    }else await page.getByLabel('Selected athlete').selectOption(athlete);
    await expect(page.getByLabel('Your message')).toHaveValue('Draft for the first runner');
    const accessibility=await new AxeBuilder({page}).include('[aria-label="Message thread"]').withTags(['wcag2a','wcag2aa']).analyze();expect(accessibility.violations).toEqual([]);
    await page.screenshot({path:`../output/messages-thread-${info.project.name}.png`,fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{await f.close();}
});

test('keyboard send keeps newline and focus, bubbles follow the viewer, context and 320px layout remain usable',async({page},info)=>{
  const f=await fixture();try{
    await f.send(undefined,'coach','Coach context');
    await connect(page,'athlete',f);await page.goto(`/messages?mode=athlete&athlete_id=${athlete}`);
    const thread=page.getByRole('region',{name:'Message thread'}),composer=page.getByLabel('Your message');
    await expect(page.getByRole('button',{name:/^Messages(?: \(|$)/})).toHaveCount(0);
    await expect(thread.locator('[data-sender="other"]')).toContainText('Coach context');
    await expect(thread.getByRole('link',{name:'View training calendar'})).toHaveAttribute('href','/calendar');
    await composer.fill('First line');await composer.press('Enter');await composer.type('Second line');
    await expect(composer).toHaveValue('First line\nSecond line');
    await composer.press('Control+Enter');await expect(composer).toHaveValue('');await expect(composer).toBeFocused();
    await expect(thread.locator('[data-sender="self"]')).toContainText('First line\nSecond line');
    expect((await f.pg.query('select count(*)::int n from coach_messages')).rows[0].n).toBe(2);
    if(info.project.name==='mobile-chromium'){
      await page.setViewportSize({width:320,height:720});await expect(composer).toBeVisible();await expect(thread.getByRole('button',{name:'Send',exact:true})).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:'../output/messages-thread-320.png',fullPage:true});
    }
  }finally{await f.close();}
});

test('browser Back during a pending send cannot replace the new thread or clear another recipient draft',async({page})=>{
  const f=await fixture();let release;const state={sendDelay:new Promise(resolve=>{release=resolve;})};
  try{
    await f.pg.exec(`insert into athletes(id,name,email) values('${second}','Valley runner','valley@example.test');insert into coach_athlete_relationships(coach_id,athlete_id,status) values('${coach}','${second}','active');`);
    await connect(page,'coach',f,state);await page.goto(`/messages?mode=coach&athlete_id=${second}`);
    await page.getByLabel('Your message').fill('Keep the other recipient draft');await expect(page.getByText('Draft saved',{exact:true})).toBeVisible();
    await page.getByLabel('Selected athlete').selectOption(athlete);await expect(page.getByLabel('Your message')).toHaveValue('');
    await page.getByLabel('Your message').fill('Pending send for the first runner');await page.getByRole('button',{name:'Send',exact:true}).click();
    await expect(page.getByRole('button',{name:'Sending…'})).toBeDisabled();await page.goBack();
    await expect(page.getByLabel('Selected athlete')).toHaveValue(second);release();
    await expect(page.getByLabel('Your message')).toHaveValue('Keep the other recipient draft');await expect(page.getByLabel('Your message')).toBeEnabled();
    await expect.poll(async()=>Number((await f.pg.query('select count(*) n from coach_messages where athlete_id=$1',[athlete])).rows[0].n)).toBe(1);
    await expect(page.getByRole('region',{name:'Message thread'})).not.toContainText('Pending send for the first runner');
    await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByLabel('Your message')).toHaveValue('');
    expect(Number((await f.pg.query('select count(*) n from coach_messages where athlete_id=$1',[second])).rows[0].n)).toBe(1);
  }finally{release();await f.close();}
});
