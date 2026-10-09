import { randomUUID } from 'node:crypto';
export function mockMessagingPersistence(request,store,role) {
  const url=new URL(request.url());const payload=request.method()==='GET'?null:request.postDataJSON();
  if(url.pathname==='/api/message-preferences') {
    store.preferences ||= {email_enabled:false,badge_enabled:true};
    if(request.method()==='PUT') {
      if(store.preferenceFail)return {status:503,body:{error:'Preferences could not be saved.'}};
      store.preferences={...payload};
    }
    return {status:200,body:{preferences:store.preferences,email_available:true}};
  }
  if(url.pathname!=='/api/message-drafts')return null;
  store.drafts ||= new Map();
  const athleteId=payload?.athlete_id || url.searchParams.get('athlete_id');const key=`${role}:${athleteId}`;
  if(request.method()==='GET')return {status:200,body:{draft:store.drafts.get(key)||null}};
  if(store.draftFail)return {status:503,body:{error:'Save unavailable'}};
  const existing=store.drafts.get(key);
  if((existing?.version || null)!==(payload.expected_version || null))return {status:409,body:{error:'Draft changed'}};
  const draft={body:payload.body,template_key:payload.template_key,client_message_id:payload.client_message_id,version:randomUUID()};
  store.drafts.set(key,draft);return {status:200,body:{draft}};
}
export function clearMockDraft(store,role,athleteId,payload) {
  const key=`${role}:${athleteId}`;const draft=store.drafts?.get(key);
  if(draft?.client_message_id===payload.client_message_id)store.drafts.delete(key);
}
