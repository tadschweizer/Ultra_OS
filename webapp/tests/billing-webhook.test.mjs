import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import Stripe from 'stripe';
import { createBillingWebhookHandler } from '../pages/api/billing/webhook.js';
const secret = 'whsec_local_webhook_tests';
process.env.STRIPE_PRICE_INDIVIDUAL_MONTHLY = 'price_live';
const owner = '11111111-1111-4111-8111-111111111111';
function res() { return { code:null, body:null, headers:{}, setHeader(k,v){this.headers[k]=v;}, status(c){this.code=c;return this;},json(b){this.body=b;return this;} }; }
function harness() {
  const sdk = new Stripe('sk_test_local_fixture');
  const state = { fail:null, finishFail:false, busy:false, writes:[], receipts:new Set(), lists:0,
    live:{id:'sub_current',customer:'cus_1',status:'active',created:1800000000,metadata:{athlete_id:owner},items:{data:[{price:{id:'price_live'}}]} } };
  const admin = { async rpc(name,args) {
    if (name === 'claim_billing_webhook') return { data: state.receipts.has(args.p_event_id) ? {duplicate:true} : state.busy ? {busy:true} : {lease_token:'lease-1'} };
    if (name === 'finish_billing_webhook') {
      if (state.finishFail) return {error:{code:'db_failure',message:'private provider detail'}};
      if (args.p_snapshot) state.writes.push(args.p_snapshot);
      state.receipts.add(args.p_event_id);
    }
    return {data:null};
  }, from(){ return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:{id:owner,stripe_customer_id:'cus_1'}};} }; } };
  sdk.subscriptions.list = async () => { state.lists++; if (state.fail) throw state.fail; return {data:state.live?[state.live]:[]}; };
  const handler = createBillingWebhookHandler({getStripe:()=>sdk,getClient:()=>admin,secret:()=>secret});
  const event = (type='customer.subscription.updated', id='evt_1') => ({ id,type,data:{object:{id:'sub_historic',customer:'cus_1',status:'canceled',metadata:{athlete_id:owner}}} });
  const run = async (event, valid=true) => {
    const payload=JSON.stringify(event); const request=Readable.from([Buffer.from(payload)]);
    request.method='POST'; request.headers={'stripe-signature':valid?Stripe.webhooks.generateTestHeaderString({payload,secret}):'invalid'};
    const response=res(); await handler(request,response); return response;
  };
  return {state,event,run};
}
test('signed older cancellation reconciles CURRENT subscription instead of downgrading from event snapshot', async()=>{
  const h=harness(); assert.equal((await h.run(h.event('customer.subscription.deleted'))).code,200);
  assert.equal(h.state.writes[0].subscription_id,'sub_current'); assert.equal(h.state.writes[0].tier,'individual');
});
test('signed duplicate event is durable and does not reread provider or rewrite entitlement', async()=>{
  const h=harness(); const event=h.event(); await h.run(event); const duplicate=await h.run(event);
  assert.equal(duplicate.body.duplicate,true); assert.equal(h.state.lists,1); assert.equal(h.state.writes.length,1);
});
test('invalid signature denied before any provider or database work', async()=>{
  const h=harness(); assert.equal((await h.run(h.event(),false)).code,400); assert.equal(h.state.lists,0); assert.equal(h.state.writes.length,0);
});
test('customer lease contention is retryable', async()=>{
  const h=harness(); h.state.busy=true; const response=await h.run(h.event()); assert.equal(response.code,503); assert.equal(response.headers['Retry-After'],'5'); assert.equal(h.state.lists,0);
});
for (const kind of ['provider','database']) test(`${kind} failure returns 503, leaves receipt pending, and retry succeeds`,async()=>{
  const h=harness(); if(kind==='provider') h.state.fail=new Error('private provider detail'); else h.state.finishFail=true;
  const response=await h.run(h.event()); assert.equal(response.code,503); assert.equal(JSON.stringify(response.body).includes('private'),false); assert.equal(h.state.receipts.size,0);
  h.state.fail=null;h.state.finishFail=false; assert.equal((await h.run(h.event())).code,200);
});
test('unsettled checkout completion does not grant access; later async success settles it',async()=>{
  const h=harness(); const pending=h.event('checkout.session.completed'); pending.data.object.payment_status='unpaid';
  assert.equal((await h.run(pending)).body.pending,true);assert.equal(h.state.writes.length,0);
  const settled=h.event('checkout.session.async_payment_succeeded','evt_settled'); settled.data.object.payment_status='paid';
  await h.run(settled); assert.equal(h.state.writes[0].tier,'individual');
});
test('asynchronous failed payment reconciles an incomplete subscription without granting paid access',async()=>{
  const h=harness();h.state.live.status='incomplete';const failed=h.event('checkout.session.async_payment_failed');failed.data.object.payment_status='unpaid';
  await h.run(failed);assert.equal(h.state.writes[0].tier,'free');
});
for(const type of ['invoice.payment_failed','invoice.paid']) test(`${type} reconciles status and preserves established past_due grace`,async()=>{
  const h=harness();h.state.live.status='past_due';await h.run(h.event(type));assert.equal(h.state.writes[0].status,'past_due');assert.equal(h.state.writes[0].tier,'individual');
});
test('foreign subscription owner fails closed and remains retryable',async()=>{
  const h=harness();h.state.live.metadata.athlete_id='another-account';assert.equal((await h.run(h.event())).code,503);assert.equal(h.state.writes.length,0);
});
test('unrelated signed event acknowledged without subscription reconciliation',async()=>{
  const h=harness();assert.equal((await h.run(h.event('payment_method.attached'))).code,200);assert.equal(h.state.lists,0);
});
