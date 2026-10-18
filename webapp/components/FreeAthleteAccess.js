import Head from 'next/head';

export default function FreeAthleteAccess() {
  return <main className="min-h-screen bg-paper px-4 py-8 text-ink">
    <Head><title>Free athlete access | Threshold</title><meta name="description" content="Use Threshold's currently available athlete features free during early access. No card needed. Coach access is approved separately." /></Head>
    <div className="mx-auto max-w-4xl">
      <nav aria-label="Access navigation" className="flex flex-wrap gap-6 text-sm font-semibold"><a className="text-ink" href="/">Threshold</a><a className="text-ink" href="/guide">How it works</a><a className="text-ink" href="/login">Log in</a></nav>
      <section className="mt-10 rounded-3xl border border-ink/10 bg-white p-6 md:p-10">
        <p className="text-sm font-semibold">Early access</p>
        <h1 className="mt-3 text-4xl font-semibold">Athlete access is free.</h1>
        <p className="mt-5 text-lg leading-8">Use all currently available athlete features without a subscription or payment card. This includes training plans, workout feedback, check-ins, training trends and available analysis.</p>
        <p className="mt-4 leading-7">There is no scheduled end date for free athlete access. If paid plans return, you will need to choose a subscription before being charged. Signing up now does not start a paid trial.</p>
        <a href="/signup" className="ui-button-primary mt-6">Create a free athlete account</a>
      </section>
      <section className="mt-6 rounded-3xl border border-ink/10 bg-white p-6 md:p-10">
        <h2 className="text-2xl font-semibold">Coach together, without a second athlete subscription</h2>
        <p className="mt-4 leading-7">Coaches can copy and customize a week, compare a session with its results, and reply or adjust upcoming training. Athletes see the instructions, share how it went and read the response in Threshold.</p>
        <p className="mt-4 leading-7">Coach access is approved separately during the pilot, with up to five athletes per approved pilot coach. Creating a coach account does not automatically grant coach access.</p>
        <a href="/signup?role=coach" className="ui-button-secondary mt-5">Create a coach pilot account</a>
      </section>
      <section className="mt-6 px-2 leading-7"><h2 className="text-xl font-semibold">What is still in progress?</h2><p className="mt-3">Strava, COROS and Suunto integrations are in progress; Garmin is next. You can record workouts manually now. Automatic reviews and generated plans remain deferred. Calculated analysis depends on your recorded data and its available inputs.</p></section>
      <footer className="mt-8 flex gap-6 text-sm"><a className="text-ink" href="/support">Support</a><a className="text-ink" href="/privacy">Privacy</a><a className="text-ink" href="/terms">Terms</a></footer>
    </div>
  </main>;
}
