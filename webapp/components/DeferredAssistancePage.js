export default function DeferredAssistancePage() {
  return (
    <main className="min-h-screen bg-paper px-4 py-10 text-ink">
      <section className="mx-auto max-w-2xl rounded-2xl border border-ink/10 bg-white p-6">
        <h1 className="text-3xl font-semibold">Automatic race plans are deferred</h1>
        <p className="mt-4 text-sm leading-7 text-ink/75">
          The closed pilot focuses on workouts you and your coach plan, logged results and feedback.
          Your saved race details and training history are retained.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a className="ui-button-primary" href="/races">Edit race details</a>
          <a className="ui-button-secondary" href="/calendar">Open training calendar</a>
          <a className="ui-button-secondary" href="/messages">Ask your coach</a>
        </div>
      </section>
    </main>
  );
}
