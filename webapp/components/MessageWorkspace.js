import MessageNotificationSettings from './MessageNotificationSettings.js';

export default function MessageWorkspace({role,conversations,messages,athleteId,threadOpen,loading,error,inboxLoaded,loadError,sending,loadingOlder,nextCursor,
  selectedConversation,selectConversation,showConversations,load,loadOlder,historyRef,composerRef,send,draft,canSend,templates,templateMeta,selectedTemplate,conversationName,formatTimestamp}) {
  const {body,setBody,templateKey,setTemplateKey}=draft;
  return (
    <main className="min-h-screen bg-paper px-3 py-4 text-ink md:px-6 md:py-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-4 flex items-center justify-between gap-4">
          <div><h1 className="font-display text-3xl font-semibold tracking-tight">Messages</h1><p className="mt-1 text-xs text-ink/60">Training questions and feedback, together.</p></div>
          {role==='coach' && <a href="/coach-command-center" className="text-sm font-semibold text-panel hover:underline">Triage feed</a>}
        </header>
        <div className="grid overflow-hidden rounded-2xl border border-ink/15 bg-white md:grid-cols-[300px_minmax(0,1fr)]">
          <aside aria-label="Conversations" className={`min-w-0 border-ink/10 md:border-r ${threadOpen?'hidden md:block':'block'}`}>
            <div className="flex items-center justify-between border-b border-ink/10 px-4 py-4"><h2 className="text-sm font-semibold">Conversations</h2><span className="text-xs text-ink/55">{inboxLoaded ? conversations.length : loadError ? 'Unavailable' : 'Loading'}</span></div>
            {loadError&&inboxLoaded&&<p role="status" className="p-4 text-xs text-ink/60">Showing the last loaded conversations.</p>}
            {loading&&!conversations.length && <p role="status" className="p-4 text-sm text-ink/60">Loading conversations.</p>}
            {!loading&&inboxLoaded&&!loadError&&!conversations.length && <p className="p-4 text-sm leading-6 text-ink/60">{role==='coach'?'No active athletes found. Add athletes from the Command Center first.':'No active coach conversation found.'}</p>}
            {!threadOpen&&error && <div className="p-4"><p role="alert" className="text-sm text-red-700">{error}</p><button onClick={()=>load('')} className="mt-2 text-sm font-semibold text-panel">Retry loading</button></div>}
            <div className="max-h-[65dvh] overflow-y-auto">
              {conversations.map(c=>{
                const name=conversationName(c,role),active=c.athlete_id===athleteId;
                return <button key={c.athlete_id} data-conversation={c.athlete_id} aria-current={active&&threadOpen?'true':undefined}
                  aria-label={`Open conversation with ${name}${c.unread_count>0?`, ${c.unread_count} unread`:''}`} disabled={sending} onClick={()=>selectConversation(c.athlete_id)}
                  className={`flex min-h-[84px] w-full items-center gap-3 border-b border-ink/5 px-4 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-accent disabled:opacity-60 ${active&&threadOpen?'bg-accent/10':'hover:bg-paper'}`}>
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-panel/10 text-sm font-semibold text-panel">{name.slice(0,1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1"><span className="flex items-baseline justify-between gap-2"><span className="truncate text-sm font-semibold">{name}</span><span className="shrink-0 text-[10px] text-ink/55">{formatTimestamp(c.last_message?.created_at)}</span></span><span className="mt-1 block truncate text-xs text-ink/65">{c.last_message?.message_body||'No messages yet.'}</span>{c.group_name&&<span className="mt-1 block text-[10px] text-ink/55">{c.group_name}</span>}</span>
                  {c.unread_count>0&&<span aria-hidden="true" className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-ink">{c.unread_count}</span>}
                </button>;
              })}
            </div>
          </aside>
          <section aria-label="Message thread" className={`min-w-0 flex-col ${threadOpen?'flex':'hidden md:flex'}`}>
            <div className="flex min-h-[65px] items-center gap-3 border-b border-ink/10 px-4 py-3">
              <button type="button" onClick={showConversations} disabled={sending} aria-label="Back to conversations" className="min-h-11 min-w-11 rounded-full text-xl text-panel focus-visible:outline md:hidden">‹</button>
              <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{selectedConversation?conversationName(selectedConversation,role):'Select a conversation'}</h2><p className="mt-0.5 text-xs text-ink/55">{selectedConversation?'Open conversations refresh automatically.':'Your coaching inbox'}</p></div>
              {role==='coach'&&conversations.length>0&&<select aria-label="Selected athlete" disabled={sending} value={athleteId} onChange={e=>selectConversation(e.target.value)} className="max-w-[42%] rounded-lg border border-ink/10 bg-paper px-2 py-2 text-xs">{conversations.map(c=><option key={c.athlete_id} value={c.athlete_id}>{conversationName(c,role)}</option>)}</select>}
            </div>
            {selectedConversation&&<a href={role==='coach'?`/coach/training-calendar?athlete=${encodeURIComponent(athleteId)}`:'/calendar'} className="border-b border-ink/10 bg-paper/60 px-4 py-2 text-xs font-semibold text-panel hover:underline">View training calendar →</a>}
            <div ref={historyRef} tabIndex={0} aria-label="Conversation history" className="h-[42dvh] min-h-[180px] overflow-y-auto overscroll-contain px-4 py-4 md:h-[430px]">
              {loading&&<p role="status" className="text-sm text-ink/60">Loading messages.</p>}
              {error&&<div className="mb-4"><p role="alert" className="text-sm text-red-700">{error}</p>{error.startsWith('Unable to load')&&<button onClick={()=>load(athleteId,{keepSelection:true})} className="mt-2 text-sm font-semibold text-panel">Retry loading</button>}</div>}
              {!loading&&inboxLoaded&&!loadError&&!messages.length&&<p className="py-8 text-center text-sm text-ink/60">{selectedConversation?'No messages yet. Start the loop with a check-in.':'Choose someone to start a conversation.'}</p>}
              {nextCursor&&<div className="mb-4 text-center"><button disabled={loadingOlder} onClick={loadOlder} className="min-h-11 rounded-full border border-ink/20 px-4 text-xs">{loadingOlder?'Loading.':'Load older messages'}</button></div>}
              <ol className="space-y-4">
                {messages.map(m=>{
                  const own=m.sender_role===role;
                  return <li key={m.id} data-message-id={m.id} data-sender={own?'self':'other'} className={`flex ${own?'justify-end':'justify-start'}`}>
                    <div className="max-w-[88%] md:max-w-[78%]">
                      <p className={`mb-1 px-1 text-[10px] text-ink/60 ${own?'text-right':''}`}>{own?'You':conversationName(selectedConversation,role)} · {formatTimestamp(m.created_at)}</p>
                      <div className={`rounded-2xl px-4 py-3 ${own?'rounded-br-md bg-panel text-paper':'rounded-bl-md bg-paper text-ink'}`}>
                        {m.message_template_key&&templateMeta[m.message_template_key]&&<p className="mb-1 text-[10px] font-semibold opacity-75">{templateMeta[m.message_template_key].label}</p>}
                        <p className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">{m.message_body}</p>
                      </div>
                      {own&&<p className="mt-1 px-1 text-right text-[10px] leading-4 text-ink/60">{m.read_at?'Read':'Sent'}{m.email_notification==='sent'?' · Email alert sent':['pending','processing'].includes(m.email_notification)?' · Email alert pending':m.email_notification==='failed'?' · Email alert failed; your message is still in the inbox':m.email_notification==='skipped'?' · Email alert skipped':''}</p>}
                    </div>
                  </li>;
                })}
              </ol>
            </div>
            <form onSubmit={send} className="space-y-2 border-t border-ink/10 bg-white px-4 py-3">
              {role==='coach'&&<details className="text-xs"><summary className="cursor-pointer py-1 font-semibold text-ink/65">Message purpose</summary><label htmlFor="message-purpose" className="sr-only">Message purpose</label><select id="message-purpose" disabled={sending} value={templateKey} onChange={e=>{setTemplateKey(e.target.value);setBody(templates[e.target.value]||'');}} className="mt-2 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 text-sm">{Object.keys(templates).map(k=><option key={k} value={k}>{templateMeta[k]?.label||k}</option>)}</select>{selectedTemplate&&<p className="my-2 text-xs text-ink/60">{selectedTemplate.context}</p>}</details>}
              <label htmlFor="message-body" className="sr-only">Your message</label>
              <div className="flex items-end gap-2"><textarea id="message-body" ref={composerRef} disabled={sending||!selectedConversation||draft.status==='loading'} value={body} onChange={e=>setBody(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();send(e);}}} maxLength={5000} rows={2} className="max-h-36 min-h-11 min-w-0 flex-1 resize-y rounded-2xl border border-ink/20 bg-paper px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" placeholder="Message"/><button disabled={sending||!canSend} className="min-h-11 shrink-0 rounded-full bg-panel px-4 py-2 text-sm font-semibold text-paper disabled:cursor-not-allowed disabled:opacity-50">{sending?'Sending…':'Send'}</button></div>
              <p role="status" className="min-h-4 text-[11px] text-ink/60">{draft.status==='saving'?'Saving draft.':draft.status==='saved'?'Draft saved':draft.status==='loading'&&selectedConversation?'Loading draft.':''}</p>
              {draft.error&&<div className="text-sm"><p role="alert" className="text-red-700">{draft.error}</p>{draft.status==='conflict'||!draft.ready?<button type="button" onClick={draft.reload} className="mt-2 min-h-11 rounded-full border border-ink/20 px-4 text-xs">Load saved draft</button>:<button type="button" onClick={draft.retrySave} className="mt-2 min-h-11 rounded-full border border-ink/20 px-4 text-xs">Retry saving draft</button>}</div>}
            </form>
          </section>
        </div>
        <div className="mt-4"><MessageNotificationSettings/></div>
      </div>
    </main>
  );
}
