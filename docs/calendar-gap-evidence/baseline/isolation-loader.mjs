import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Only service/session/provider boundaries are replaced. Handler, role access,
// validation, compliance, TRIMP, EWMA and subscription logic run from main.
const boundaries = new Map([
  ['/lib/authServer.js', 'export const getSupabaseAdminClient = () => globalThis.__fixture.admin;'],
  ['/lib/auth/requireAthlete.js', 'export const getEffectiveAthleteIdFromRequest = async () => globalThis.__fixture.actor; export const resolveEffectiveAthleteId = async () => ({athleteId:globalThis.__fixture.actor,isImpersonating:false,session:{}});'],
  ['/lib/activitySync.js', 'export const syncAthleteActivities = async () => {throw Error("Provider sync forbidden");}; export const getStoredActivities = async () => {throw Error("Provider reads forbidden");};'],
  ['/lib/auth/sessionCookies.js', 'export const clearAthleteCookie=()=>{}; export const renewAthleteCookieIfStale=()=>{};'],
  ['/lib/pilotEntitlementsServer.js', 'export const loadCheckInEntitlement=async()=>({linkedToPaidCoach:false}); export const loadCoachEntitlement=async()=>({pilot:false});'],
]);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.')) {
      const url = new URL(specifier, context.parentURL);
      if (url.protocol === 'file:' && !existsSync(fileURLToPath(url)) && existsSync(fileURLToPath(`${url.href}.js`))) {
        return nextResolve(`${specifier}.js`, context);
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    for (const [suffix, source] of boundaries) if (url.endsWith(suffix)) return {format:'module',source,shortCircuit:true};
    return nextLoad(url, context);
  },
});
// No HTTP requests are permitted, even if an unexpected source path calls one.
globalThis.fetch = async () => { throw Error('Network forbidden in isolated verification'); };
