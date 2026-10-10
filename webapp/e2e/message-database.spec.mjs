import { connect } from "./helpers/message-database-transport.mjs";
import { openFirstMessageThread } from "./helpers/message-navigation.mjs";
import { test, expect } from '@playwright/test';
import { fixture, owner, athlete, coach } from '../tests/helpers/message-lifecycle-fixture.mjs';

// Only the outer browser API transport and /api/me are isolated here. Message,
// draft, preferences and read requests run actual signed-session handlers and SQL.

test('real signed handlers and SQL persist drafts, deliver between roles, acknowledge and suppress read alerts',async({page,context})=>{
  const f=await fixture();try {
    await connect(page,'coach',f);await page.goto('/messages?mode=coach'); await openFirstMessageThread(page);
    await page.getByLabel('Your message').fill('Database-backed private draft.');
    await expect(page.getByText('Draft saved',{exact:true})).toBeVisible();await page.reload();
    await expect(page.getByLabel('Your message')).toHaveValue('Database-backed private draft.');
    const runner=await context.newPage();await connect(runner,'athlete',f);await runner.goto('/messages?mode=athlete'); await openFirstMessageThread(runner);
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
    const state={draftFail:true,loseSendResponse:true};await connect(page,'coach',f,state);await page.goto('/messages?mode=coach'); await openFirstMessageThread(page);
    await page.getByLabel('Your message').fill('Retry the committed message.');
    await page.getByRole('button',{name:'Send',exact:true}).click();
    await expect(page.locator('main [role="alert"]').filter({hasText:'Draft could not be saved'})).toBeVisible();
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
