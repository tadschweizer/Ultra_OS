import test from 'node:test';
import assert from 'node:assert/strict';
import { canSeedDemo } from '../lib/stagingSafety.js';
import { createDemoHandler } from '../pages/api/admin/demo.js';
process.env.NEXT_PUBLIC_SITE_URL='https://threshold.example';
const local={ALLOW_DEMO_SEED:'true',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321'};
test('demo writes require explicit opt-in even on localhost',()=>{
  assert.equal(canSeedDemo(local),true);assert.equal(canSeedDemo({...local,ALLOW_DEMO_SEED:undefined}),false);
});
test('production and preview pointing at the real database cannot seed',()=>{
  for(const VERCEL_ENV of ['production','preview']) assert.equal(canSeedDemo({...local,VERCEL_ENV,
    APP_ENV:'staging',SUPABASE_STAGING_PROJECT_REF:'jzfctjaaowdvubhqswpa',NEXT_PUBLIC_SUPABASE_URL:'https://jzfctjaaowdvubhqswpa.supabase.co'}),false);
  assert.equal(canSeedDemo({...local,VERCEL_ENV:'production'}),false);
});
test('remote staging must match an explicitly isolated project reference exactly',()=>{
  const staging={...local,APP_ENV:'staging',SUPABASE_STAGING_PROJECT_REF:'abcdefghijklmnopqrst',NEXT_PUBLIC_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co'};
  assert.equal(canSeedDemo(staging),true);
  assert.equal(canSeedDemo({...staging,NEXT_PUBLIC_SUPABASE_URL:'https://attacker.example'}),false);
  assert.equal(canSeedDemo({...staging,APP_ENV:'preview'}),false);
});
for(const method of ['POST','DELETE']) test(`${method}: seed guard denies before any service-role access`,async()=>{
  let accesses=0;const handler=createDemoHandler({getClient:()=>{accesses++;throw new Error('must not access');},env:()=>({...local,VERCEL_ENV:'production'})});
  const res={code:null,setHeader(){},status(c){this.code=c;return this;},json(){return this;}};
  await handler({method,headers:{origin:'https://threshold.example','content-type':'application/json'},body:{}},res);
  assert.equal(res.code,403);assert.equal(accesses,0);
});
