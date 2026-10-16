// Fixed-host GET-only monitoring sample. Never log the monitoring credential.
const secret = process.env.READINESS_PROBE_SECRET;
if (!secret || secret.length < 32) throw new Error('Set READINESS_PROBE_SECRET before running the deep readiness sample.');
const urls=['https://mythreshold.co/api/ready','https://www.mythreshold.co/api/ready'];
const observations=[];
for(let round=1;round<=3;round++) {
  for(const url of urls) {
    const timestamp=new Date().toISOString(),started=performance.now();
    try {
      const response=await fetch(url,{method:'GET',headers:{Authorization:`Bearer ${secret}`},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});
      const body=await response.json().catch(()=>null);
      // Only known public diagnostic fields are retained, never raw errors/HTML.
      const checks=Object.fromEntries(['database','schema'].map(name=>[name,{
        status:['ok','down','timeout','unconfigured'].includes(body?.checks?.[name]?.status)?body.checks[name].status:'unknown',
        latencyMs:Number.isFinite(body?.checks?.[name]?.latencyMs)?body.checks[name].latencyMs:null,
      }]));
      observations.push({round,url,timestamp,httpStatus:response.status,elapsedMs:Math.round(performance.now()-started),checks});
    } catch {observations.push({round,url,timestamp,httpStatus:null,elapsedMs:Math.round(performance.now()-started),transport:'unavailable'});}
  }
}
console.log(JSON.stringify({scope:'six authenticated monitoring GETs; does not establish sustained availability or workflow acceptance',observations},null,2));
process.exitCode=observations.every(row=>row.httpStatus===200&&Object.values(row.checks||{}).every(check=>check.status==='ok'))?0:1;
