import { pathToFileURL } from 'node:url';

const surfaces = {
  coach_messages:'id,coach_id,athlete_id,sender_role,message_body,message_template_key,created_at,read_at',
  coach_shared_docs:'id,coach_id,athlete_id,title,category,doc_type,content,resource_url,sort_order,created_at,updated_at',
  coach_groups:'id,coach_id,name,description,created_at,coach_group_members(athlete_id,athletes(id,name,email))',
  coach_group_members:'id,group_id,athlete_id',
  message_preferences:'athlete_id,email_enabled,badge_enabled',
  message_drafts:'owner_id,coach_id,athlete_id,sender_role,body,version,client_message_id',
  message_email_deliveries:'message_id,recipient_id,status,lease_token,expires_at',
  planned_workouts:'id,activity_match_mode',
  workout_comments:'id,athlete_id,planned_workout_id,activity_id,read_at',
};

/** GET-only, zero-row Data API verification. Never writes, sends email or logs responses. */
export async function verifyPilotRelease({ url, key, fetchImpl=fetch, timeoutMs=8000 }={}) {
  let base;
  try {
    base=new URL(url);
    if(!key || base.username || base.password || base.pathname !== '/' || base.search || base.hash
      || !(base.protocol==='https:' || (base.protocol==='http:' && ['localhost','127.0.0.1'].includes(base.hostname)))) throw new Error();
  } catch {return {ready:false,checks:{configuration:'unconfigured'}};}
  const check=async(path,accept)=>{
    try {
      const response=await fetchImpl(new URL(`/rest/v1/${path}`,base),{
        method:'GET',headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(timeoutMs),redirect:'error',
      });
      if(!response.ok)return 'down';
      return accept(await response.json())?'ok':'down';
    } catch {return 'down';}
  };
  const entries=await Promise.all([
    check('rpc/pilot_schema_readiness',data=>data===true).then(status=>['schema',status]),
    ...Object.entries(surfaces).map(async([table,columns])=>[
      table,await check(`${table}?${new URLSearchParams({select:columns,limit:'0'})}`,data=>Array.isArray(data)&&data.length===0),
    ]),
  ]);
  return {ready:entries.every(([,status])=>status==='ok'),checks:Object.fromEntries(entries)};
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const report=await verifyPilotRelease({url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY});
  console.log(JSON.stringify(report,null,2));
  process.exitCode=report.ready?0:1;
}
