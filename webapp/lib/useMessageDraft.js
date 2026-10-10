import { useWorkspaceTransport } from './WorkspaceTransport';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function useMessageDraft({ role, conversation, seedBody = '', seedTemplate = 'general_checkin' }) {
  const { request } = useWorkspaceTransport();
  const [body,setBody]=useState('');const [templateKey,setTemplateKey]=useState('general_checkin');
  const [status,setStatus]=useState('loading');const [error,setError]=useState('');
  const current=useRef(null);const value=useRef({body:'',templateKey:'general_checkin'});
  const key=conversation ? `${role}:${conversation.coach_id || ''}:${conversation.athlete_id}` : '';
  value.current={body,templateKey};

  const save = useCallback(async (ctx, snapshot, clientId = null) => {
    const perform=async()=>{
      if(ctx.sending && !clientId)return;
      if(!ctx.ready || ctx.conflict)throw new Error('Draft must be reviewed.');
      const response=await request('/api/message-drafts',{method:'PUT',keepalive:true,signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json'},
        body:JSON.stringify({mode:ctx.role,athlete_id:ctx.athleteId,body:snapshot.body,
          template_key:ctx.role==='coach' ? snapshot.templateKey : null,client_message_id:clientId,expected_version:ctx.version})});
      const data=await response.json();
      if(!response.ok) {if(response.status===409)ctx.conflict=true;throw new Error(response.status===409
        ? 'This draft changed in another session. Your text is still here. Load the saved draft before sending.'
        : 'Draft could not be saved. Your text is still here. Retry before leaving this page.');}
      ctx.version=data.draft?.version || null;ctx.saved=JSON.stringify(snapshot);ctx.savedClientId=clientId;
      if(current.current===ctx){setStatus(ctx.saved===JSON.stringify(value.current)?'saved':'saving');setError('');}
      return data.draft;
    };
    const task=ctx.queue.catch(()=>{}).then(perform);ctx.queue=task;
    try{return await task;}catch(e){if(current.current===ctx){setStatus(ctx.conflict?'conflict':'error');setError(e.message);}throw e;}
  },[request]);

  useEffect(()=>{
    if(!key){current.current=null;setBody('');setStatus('loading');return;}
    const ctx={key,role,athleteId:conversation.athlete_id,ready:false,version:null,queue:Promise.resolve(),conflict:false,retry:null};
    current.current=ctx;setBody('');setTemplateKey(seedTemplate);setStatus('loading');setError('');
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
    request(`/api/message-drafts?${new URLSearchParams({mode:role,athlete_id:ctx.athleteId})}`,{signal:controller.signal}).then(async response=>{
      const data=await response.json();if(!response.ok)throw new Error('Draft could not be loaded. Retry to avoid replacing a saved draft.');
      if(current.current!==ctx)return;
      const next={body:data.draft?.body ?? seedBody,templateKey:data.draft?.template_key || seedTemplate};
      ctx.version=data.draft?.version || null;ctx.ready=true;ctx.saved=JSON.stringify(next);ctx.savedClientId=data.draft?.client_message_id || null;
      ctx.retry=ctx.savedClientId ? {signature:JSON.stringify(next),id:ctx.savedClientId} : null;
      setBody(next.body);setTemplateKey(next.templateKey);setStatus(data.draft?'saved':'ready');
    }).catch(e=>{if(current.current===ctx){setStatus('error');setError(e.message || 'Draft could not be loaded.');}}).finally(()=>clearTimeout(timeout));
    return ()=>{
      controller.abort();clearTimeout(timeout);
      // React state may not have rendered the final keystroke into an autosave yet.
      if(ctx.ready && !ctx.conflict && !ctx.sending && JSON.stringify(value.current)!==ctx.saved)save(ctx,value.current).catch(()=>{});
      if(current.current===ctx)current.current=null;
    };
    // Seeds initialize a conversation only. Background polls cannot replace a draft.
  },[key,save]);

  useEffect(()=>{
    const ctx=current.current;if(!ctx?.ready || ctx.conflict || ctx.sending || JSON.stringify({body,templateKey})===ctx.saved)return;
    setStatus('saving');const timer=setTimeout(()=>save(ctx,{body,templateKey}).catch(()=>{}),500);
    return()=>clearTimeout(timer);
  },[body,templateKey,save]);

  async function prepareSend() {
    const ctx=current.current;if(!ctx?.ready || ctx.conflict)throw new Error('Draft is not ready.');
    ctx.sending=true;
    const snapshot=value.current;const signature=JSON.stringify(snapshot);
    if(ctx.retry?.signature!==signature)ctx.retry={signature,id:crypto.randomUUID()};
    await save(ctx,snapshot,ctx.retry.id);return ctx.retry.id;
  }
  function sent(messageId) {
    const ctx=current.current;if(!ctx || ctx.retry?.id!==messageId)return;
    ctx.sending=false;ctx.version=null;ctx.retry=null;ctx.saved=JSON.stringify({body:'',templateKey:value.current.templateKey});
    ctx.savedClientId=null;setBody('');setStatus('ready');setError('');
  }
  function sendFailed(){if(current.current)current.current.sending=false;}
  function retrySave(){const ctx=current.current;if(ctx?.ready && !ctx.conflict)return save(ctx,value.current).catch(()=>{});}
  async function reload() {
    const ctx=current.current;if(!ctx)return;
    try {
      const response=await request(`/api/message-drafts?${new URLSearchParams({mode:ctx.role,athlete_id:ctx.athleteId})}`,{signal:AbortSignal.timeout(10000)});
      const data=await response.json();if(!response.ok)throw new Error();
      const next={body:data.draft?.body || '',templateKey:data.draft?.template_key || 'general_checkin'};
      ctx.ready=true;ctx.conflict=false;ctx.version=data.draft?.version || null;ctx.saved=JSON.stringify(next);
      ctx.retry=data.draft?.client_message_id ? {signature:JSON.stringify(next),id:data.draft.client_message_id} : null;
      if(current.current===ctx){setBody(next.body);setTemplateKey(next.templateKey);setStatus('saved');setError('');}
    }catch{if(current.current===ctx)setError('Could not load the saved draft. Your text is still here.');}
  }
  return {body,setBody,templateKey,setTemplateKey,status,error,prepareSend,sent,sendFailed,retrySave,reload,
    ready:Boolean(current.current?.ready && !current.current?.conflict)};
}
