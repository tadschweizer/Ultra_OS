import { randomUUID } from 'node:crypto';
export const ATHLETE = '11111111-1111-4111-8111-111111111111';
export const COACH_ACCOUNT = '22222222-2222-4222-8222-222222222222';
export const COACH = '33333333-3333-4333-8333-333333333333';

// Minimal PostgREST fixture: column projection, filters, bulk inserts, defaults,
// PK and completed_activity_id uniqueness. This is NOT a deployed DB emulator.
export function fixtureStore(extra = {}) {
  const tables = {
    athletes: [
      {id:ATHLETE,name:'Synthetic runner',primary_role:'athlete',subscription_tier:'core',is_admin:false,onboarding_complete:true},
      {id:COACH_ACCOUNT,name:'Synthetic coach',primary_role:'coach',subscription_tier:'coach_pro',is_admin:false,onboarding_complete:true},
    ],
    coach_profiles: [{id:COACH,athlete_id:COACH_ACCOUNT}],
    workout_library: [{id:'55555555-5555-4555-8555-555555555555',coach_id:COACH,name:'Synthetic trail template',sport:'run',structure:[]}],
    coach_athlete_relationships: [{id:randomUUID(),coach_id:COACH,athlete_id:ATHLETE,status:'active'}],
    planned_workouts: [], interventions: [], strava_activities: [], workout_comments: [],
    ...structuredClone(extra),
  };
  const queries = [], inserts = [];
  const admin = {from(table) {
    if (!Object.hasOwn(tables, table)) throw Error(`Unmodelled table: ${table}`);
    let columns='*', mode='select', payload, singular=false, count=false, head=false, limit=Infinity;
    const filters=[], orders=[];
    const q = {
      select(value, options={}) {columns=value;count=options.count==='exact';head=options.head===true;return q;},
      insert(value) {mode='insert';payload=value;return q;},
      eq(k,v){filters.push(row=>row[k]===v);return q;},
      gte(k,v){filters.push(row=>row[k]>=v);return q;},
      lte(k,v){filters.push(row=>row[k]<=v);return q;},
      in(k,values){filters.push(row=>values.includes(row[k]));return q;},
      not(k,op,v){if(op!=='is'||v!==null)throw Error('Unmodelled filter');filters.push(row=>row[k]!=null);return q;},
      order(k,opts={}){orders.push([k,opts.ascending!==false]);return q;},
      limit(n){limit=n;return q;},
      single(){singular=true;return q;},maybeSingle(){singular=true;return q;},
      then(resolve,reject){
        try {
          queries.push({table,mode,columns});
          let rows;
          if(mode==='insert') {
            const batch=(Array.isArray(payload)?payload:[payload]);
            inserts.push({table,payload:structuredClone(batch)});
            rows=batch.map(value=>({
              ...(table==='planned_workouts'?{
                id:randomUUID(),status:'planned',objective:null,coach_instructions:null,target_metric:'duration',
                planned_if:null,visibility:'athlete_visible',export_status:'not_exported',sync_provider:null,
                activity_match_mode:'auto',completed_activity_id:null,completed_duration_min:null,
                completed_distance_km:null,athlete_rpe:null,athlete_comment:null,coach_feedback:null,
                created_at:'2026-10-10T12:00:00Z',updated_at:'2026-10-10T12:00:00Z',
              }:{}),...structuredClone(value),
            }));
            const combined=[...tables[table],...rows];
            const keys=new Set(),links=new Set();
            for(const row of combined){
              if(keys.has(row.id)) return Promise.resolve({data:null,error:{code:'23505',message:'duplicate PK'}}).then(resolve,reject);
              keys.add(row.id);
              if(table==='planned_workouts'&&row.completed_activity_id){
                const key=`${row.athlete_id}:${row.completed_activity_id}`;
                if(links.has(key)) return Promise.resolve({data:null,error:{code:'23505',message:'duplicate activity'}}).then(resolve,reject);
                links.add(key);
              }
            }
            tables[table].push(...rows);
          } else rows=tables[table].filter(row=>filters.every(fn=>fn(row)));
          for(const [k,asc] of orders.toReversed()) rows=[...rows].sort((a,b)=>String(a[k]).localeCompare(String(b[k]))*(asc?1:-1));
          const total=rows.length;
          rows=rows.slice(0,limit).map(row=>columns.trim()==='*'?structuredClone(row):Object.fromEntries(columns.split(',').map(k=>k.trim()).filter(Boolean).map(k=>[k,structuredClone(row[k]??null)])));
          return Promise.resolve({data:head?null:singular?(rows[0]??null):rows,error:null,...(count?{count:total}:{})}).then(resolve,reject);
        } catch(e){return Promise.reject(e).then(resolve,reject);}
      },
    };return q;
  },rpc(){throw Error('No fixture RPC is authorized');}};
  return {admin,tables,queries,inserts};
}
export async function call(handler, {method='GET',body={},query={},actor=ATHLETE,store}={}) {
  globalThis.__fixture={actor,admin:store.admin};
  const res={statusCode:200,status(code){this.statusCode=code;return this;},json(data){this.body=data;return this;}};
  await handler({method,body,query},res);
  return {status:res.statusCode,body:res.body};
}
