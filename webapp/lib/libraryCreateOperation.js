// Session storage belongs to one tab and is explicitly scoped to the signed
// coach. Persist before POST; never rotate an uncertain operation on retry.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
export const sameLibraryCreatePayload = (a,b) => JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
export const libraryCreateStorageKey = coachId => `threshold:library-create:v1:${coachId}`;
export function readLibraryCreate(storage,coachId) {
  const raw=storage.getItem(libraryCreateStorageKey(coachId));if(!raw)return null;
  const operation=JSON.parse(raw);
  if(!UUID.test(operation?.id)||!operation.payload||typeof operation.payload!=='object'||Array.isArray(operation.payload)) {
    throw new Error('The unconfirmed library save could not be read. Reload this tab before creating another template.');
  }
  return operation;
}
export function prepareLibraryCreate(storage,coachId,payload,makeId=()=>crypto.randomUUID()) {
  const previous=readLibraryCreate(storage,coachId);
  if(previous) {
    if(!sameLibraryCreatePayload(previous.payload,payload))throw new Error('Retry the unconfirmed library save before creating a different template. Your editor changes are still here.');
    return previous;
  }
  const operation={id:makeId(),payload};
  storage.setItem(libraryCreateStorageKey(coachId),JSON.stringify(operation));
  return operation;
}
export function confirmLibraryCreate(storage,coachId,id) {
  if(readLibraryCreate(storage,coachId)?.id===id)storage.removeItem(libraryCreateStorageKey(coachId));
}
