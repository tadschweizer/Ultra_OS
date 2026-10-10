import { owner, athlete, coach } from "../../tests/helpers/message-lifecycle-fixture.mjs";
export async function connect(page, role, f, state={}) {
  const paths={'/api/coach/messages':'messages','/api/message-center':'center',
    '/api/message-drafts':'draft','/api/message-preferences':'preferences'};
  await page.route('**/api/**',async route=>{
    const request=route.request(),url=new URL(request.url());let status=200,body={notifications:[],unreadCount:0};
    if(url.pathname==='/api/me')body={athlete:{id:role==='coach'?owner:athlete,name:role,onboarding_complete:true,primary_role:role,subscription_tier:'free'},
      account:{primary_role:role,capabilities:{athlete:true,coach:role==='coach'},coach_profile:role==='coach'?{id:coach,display_name:'Coach'}:null}};
    if(paths[url.pathname]){
      if(state.sendDelay && paths[url.pathname]==='messages' && request.method()==='POST')await state.sendDelay;
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
