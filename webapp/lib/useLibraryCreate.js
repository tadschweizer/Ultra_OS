import { useCallback, useEffect, useRef, useState } from 'react';
import { confirmLibraryCreate, prepareLibraryCreate, readLibraryCreate, sameLibraryCreatePayload } from './libraryCreateOperation';

export default function useLibraryCreate({coachId,request,onConfirmed}) {
  const [pending,setPending]=useState(null),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const operationRef=useRef(null),busy=useRef(false),ownerRef=useRef(coachId);
  ownerRef.current=coachId;
  useEffect(()=>{
    operationRef.current=null;setPending(null);setError('');
    if(!coachId)return;
    try{const stored=readLibraryCreate(sessionStorage,coachId);operationRef.current=stored;setPending(stored);}
    catch{setError('Unconfirmed library saves could not be loaded from this tab. Reload before creating another template.');}
  },[coachId]);
  const save=useCallback(async(payload)=>{
    if(busy.current)return false;
    busy.current=true;setSaving(true);setError('');const owner=coachId;
    try {
      let operation;
      if(owner)operation=prepareLibraryCreate(sessionStorage,owner,payload);
      else {
        // The isolated synthetic workspace has no production account/storage.
        operation=operationRef.current;
        if(operation&&!sameLibraryCreatePayload(operation.payload,payload))throw new Error('Retry the unconfirmed library save before creating a different template.');
        operation ||= {id:crypto.randomUUID(),payload};
      }
      operationRef.current=operation;setPending(operation);
      const response=await request('/api/workout-library',{method:'POST',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json'},
        body:JSON.stringify({...operation.payload,client_request_id:operation.id})});
      const result=await response.json();
      // These statuses establish rejection before the transaction, or confirm
      // deletion of its result. An edited, intentional next attempt may be new.
      // Transport/5xx/malformed responses and key mismatches remain uncertain.
      if([400,401,403,410].includes(response.status)) {
        if(owner)confirmLibraryCreate(sessionStorage,owner,operation.id);
        if(ownerRef.current===owner){operationRef.current=null;setPending(null);}
      }
      if(!response.ok||!result.workout?.id)throw new Error(result.error||'Library save was not confirmed. Retry the same save safely.');
      if(owner)confirmLibraryCreate(sessionStorage,owner,operation.id);
      if(ownerRef.current===owner){operationRef.current=null;setPending(null);setError('');onConfirmed(result.workout);}
      return true;
    }catch(e){
      if(ownerRef.current===owner)setError(e.message||'Library save was not confirmed. Retry the same save safely.');
      return false;
    }finally{busy.current=false;setSaving(false);}
  },[coachId,request,onConfirmed]);
  return {save,pending,error,saving,retry:()=>operationRef.current?save(operationRef.current.payload):Promise.resolve(false)};
}
