import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import EmptyStateCard from '../../components/EmptyStateCard';
import ProtocolComplianceRing from '../../components/ProtocolComplianceRing';
import { getProtocolStripeClass } from '../../lib/protocolAssignmentEngine';

function formatDate(value) {
  if (!value) return 'Not set';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function CoachProtocolsPage() {
  const [loading, setLoading] = useState(true);
  const [protocols, setProtocols] = useState([]);
  const [profile, setProfile] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/coach/protocols');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Could not load protocols.');
        }
        setProtocols(data.protocols || []);
        setProfile(data.profile || null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const filteredProtocols = useMemo(() => {
    const query = search.trim().toLowerCase();

    return protocols.filter((protocol) => {
      const statusMatch = statusFilter === 'all' || protocol.status === statusFilter;
      if (!statusMatch) return false;
      if (!query) return true;
      const haystack = [
        protocol.protocol_name,
        protocol.protocol_type,
        protocol.athlete?.name,
        protocol.description,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [protocols, search, statusFilter]);

  if (loading) {
    return <main className="ui-shell"><div className="ui-card text-sm text-ink/70">Loading protocols...</div></main>;
  }

  if (!profile) {
    return (
      <main className="ui-shell">
        <EmptyStateCard
          icon="clipboard"
          title="Coach profile required"
          body="Finish coach setup before you start managing protocols."
          ctaLabel="Open Coach Setup"
          ctaHref="/coach/setup"
        />
      </main>
    );
  }

  return (
    <main className="ui-shell text-ink">
      <section className="ui-hero">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">Protocols</p>
        <h1 className="font-display mt-4 text-4xl md:text-6xl">Assigned Protocols</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/68">
          Track live protocol assignments across your roster, including current-week instructions and compliance progress.
        </p>
      </section>

      <section className="mt-6 ui-card">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="ui-input"
            placeholder="Search by athlete, protocol, or type"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="ui-input"
          >
            <option value="all">All statuses</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="abandoned">Abandoned</option>
          </select>
          <Link href="/coach/templates" className="ui-button-primary">
            Open Templates
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-5">
        {filteredProtocols.length ? filteredProtocols.map((protocol) => (
          <article key={protocol.id} className="ui-card overflow-hidden">
            <div className="flex gap-4">
              <div className={`w-2 shrink-0 rounded-full ${getProtocolStripeClass(protocol.protocol_type)}`} />
              <div className="flex-1">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.18em] text-accent">{protocol.athlete?.name || 'Athlete'}</p>
                    <h2 className="mt-2 text-xl font-semibold text-ink">{protocol.protocol_name}</h2>
                    <p className="mt-1 text-sm text-ink/60">{protocol.protocol_type}</p>
                    <p className="mt-3 text-sm leading-7 text-ink/68">{protocol.description || 'No description added.'}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/68">
                        {formatDate(protocol.start_date)} to {formatDate(protocol.end_date)}
                      </span>
                      <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/68">
                        Status: {protocol.status.replace('_', ' ')}
                      </span>
                      <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/68">
                        {protocol.actual_entries} / {protocol.expected_entries} entries
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-4 lg:items-end">
                    <ProtocolComplianceRing value={protocol.compliance} />
                    <Link href={`/coach/athletes/${protocol.athlete_id}`} className="ui-button-secondary py-2">
                      Open Athlete
                    </Link>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="rounded-[20px] bg-paper p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-accent">Current Week</p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      Week {protocol.current_week}
                    </p>
                    <p className="mt-2 text-sm text-ink/68">
                      {protocol.current_week_block?.instruction_text || 'No weekly instructions written yet.'}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-ink/42">
                      {protocol.current_week_block?.frequency_per_week ? `${protocol.current_week_block.frequency_per_week}x/week` : 'Frequency not set'}
                      {protocol.current_week_block?.target_metric ? ` · ${protocol.current_week_block.target_metric}` : ''}
                    </p>
                  </div>

                  <div className="rounded-[20px] bg-paper p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-accent">Target Race</p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {protocol.races?.name || 'No race linked'}
                    </p>
                    <p className="mt-2 text-sm text-ink/68">
                      Target compliance is {protocol.compliance_target}%.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </article>
        )) : (
          <div className="ui-card text-sm text-ink/60">No protocols matched that filter.</div>
        )}
      </section>
    </main>
  );
}
