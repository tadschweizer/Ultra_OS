import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import TrainingCalendar from "../webapp/components/TrainingCalendar.js";
import MessagesPage from "../webapp/pages/messages.js";
import { ReconciliationSummary } from "../webapp/components/WeeklyReconciliation.js";
import { WorkspaceTransport } from "../webapp/lib/WorkspaceTransport.js";
import { useDialogFocus } from "../webapp/lib/useDialogFocus.js";
import { RouterContext } from "./router.jsx";
import { DemoStore } from "./adapter.js";
import { TODAY } from "./seed.js";
import "../webapp/styles/globals.css";
import "./styles.css";
let storage = null;
try {
  storage = window.sessionStorage;
} catch {}
const store = new DemoStore(storage);
if (!storage)
  store.warning =
    "Browser session storage is unavailable. Changes last only until this page reloads.";
const demoToday = new Date(TODAY + "T12:00:00");
function readRoute() {
  const [path, search] = location.hash.slice(1).split("?");
  const q = Object.fromEntries(new URLSearchParams(search));
  return {
    view: ["calendar", "messages", "checkin", "limits"].includes(path)
      ? path
      : "overview",
    role: q.mode === "athlete" ? "athlete" : "coach",
    id: store.state.athletes.some((a) => a.id === q.athlete_id)
      ? q.athlete_id
      : "demo-river",
    query: q,
  };
}
function alerts(id) {
  const check = store.state.checkins[id];
  const rows = store.rows(id);
  return [
    !check
      ? "No check-in yet"
      : check.energy <= 2 || check.soreness >= 4
        ? "Low energy or elevated soreness — review next session"
        : null,
    rows.some((w) => w.compliance_status === "red" && w.status === "planned")
      ? "Missed session — ask about context"
      : null,
    rows.some((w) => w.athlete_rpe >= 8)
      ? "High recent RPE — compare plan and actuals"
      : null,
    rows.some(
      (w) => w.status === "completed" && w.completed_distance_km == null,
    )
      ? "Missing distance — actual duration is retained"
      : null,
  ].filter(Boolean);
}
class Boundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <main role="alert">
        <h1>Demo screen could not load</h1>
        <p>{this.state.error.message}</p>
        <button
          onClick={() => {
            location.hash = "overview";
            this.setState({ error: null });
          }}
        >
          Return to overview
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const [route, setRoute] = useState(readRoute);
  const [revision, setRevision] = useState(store.state.revision);
  const [resetOpen, setResetOpen] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => store.subscribe(() => setRevision(store.state.revision)), []);
  useEffect(() => {
    const change = () => setRoute(readRoute());
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const go = (view, role = route.role, id = route.id, extra = {}) => {
    location.hash = `${view}?${new URLSearchParams({ mode: role, athlete_id: id, ...extra })}`;
  };
  const router = useMemo(
    () => ({
      isReady: true,
      pathname:
        route.view === "calendar"
          ? "/calendar"
          : route.view === "messages"
            ? "/messages"
            : "/coach-command-center",
      query: { ...route.query, mode: route.role, athlete_id: route.id },
      push: (url) => {
        const u = new URL(url, "https://demo.invalid");
        go(
          u.pathname.includes("calendar")
            ? "calendar"
            : u.pathname.includes("messages")
              ? "messages"
              : "overview",
          u.searchParams.get("mode") || route.role,
          u.searchParams.get("athlete_id") || route.id,
          Object.fromEntries(u.searchParams),
        );
      },
    }),
    [route],
  );
  const transport = useMemo(
    () => ({
      request: store.transport(route.role, route.id),
      today: demoToday,
    }),
    [route.role, route.id],
  );
  const a = store.state.athletes.find((a) => a.id === route.id);
  const unread = store.unread(
    route.role,
    route.role === "athlete" ? route.id : null,
  );
  useEffect(() => {
    document.title = `${route.view} · Threshold demo`;
  }, [route.view]);
  return (
    <RouterContext.Provider value={router}>
      <WorkspaceTransport.Provider value={transport}>
        <div
          className="demo-app"
          onClick={(e) => {
            const anchor = e.target.closest('a[href^="/"]');
            if (anchor) {
              e.preventDefault();
              const href = anchor.getAttribute("href");
              if (href.startsWith("/api/workout-export")) {
                const id = new URL(
                  href,
                  "https://demo.invalid",
                ).searchParams.get("id");
                const workout = store
                  .rows(route.id, route.role)
                  .find((w) => w.id === id);
                if (workout) {
                  const url = URL.createObjectURL(
                    new Blob(
                      [JSON.stringify({ demo: true, workout }, null, 2)],
                      { type: "application/json" },
                    ),
                  );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "threshold-demo-workout.json";
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                }
                return;
              }
              router.push(href);
            }
          }}
        >
          <a
            className="skip-link"
            href="#main"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("main").focus();
            }}
          >
            Skip to workspace
          </a>
          <header className="demo-banner">
            <strong>Synthetic demo</strong>
            <span>
              No login · all athletes and activities are fictional · sample date{" "}
              {TODAY}
            </span>
            <button onClick={() => setResetOpen(true)}>Reset demo</button>
          </header>
          <aside className="demo-sidebar">
            <div className="demo-brand">
              <img src="/favicon.svg" alt="" />
              <strong>Threshold</strong>
            </div>
            <p className="eyebrow">Training workspace</p>
            <nav aria-label="Demo navigation">
              {[
                [
                  "overview",
                  route.role === "coach" ? "Command Center" : "Today",
                ],
                ["calendar", "Training Calendar"],
                ["messages", `Messages${unread ? ` (${unread} unread)` : ""}`],
                ["checkin", "Daily check-in"],
                ["limits", "Demo boundaries"],
              ].map(([v, label]) => (
                <button
                  key={v}
                  aria-current={route.view === v ? "page" : undefined}
                  onClick={() => go(v)}
                >
                  {label}
                </button>
              ))}
            </nav>
            <p className="sidebar-note">
              Shared production calendar and messages.
              <br />
              Changes stay in this tab; refresh keeps them. A new tab starts its
              own demo.
            </p>
            <small>Source fa8ebe2b · demo v3</small>
          </aside>
          <div className="demo-content">
            <section
              className="demo-controls"
              aria-label="Demo role and athlete"
            >
              <label>
                View as
                <select
                  aria-label="Demo role"
                  value={route.role}
                  onChange={(e) => go(route.view, e.target.value)}
                >
                  <option value="coach">Coach</option>
                  <option value="athlete">Athlete</option>
                </select>
              </label>
              <label>
                {route.role === "coach"
                  ? "Selected athlete"
                  : "Acting as athlete"}
                <select
                  aria-label="Demo athlete"
                  value={route.id}
                  onChange={(e) => go(route.view, route.role, e.target.value)}
                >
                  {store.state.athletes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                Messages and workout feedback are simulated locally. No emails
                or device sync.
              </p>
            </section>
            <div id="main" tabIndex="-1">
              <Boundary key={`${route.view}:${route.role}:${route.id}`}>
                {store.warning && (
                  <p role="alert" className="demo-notice">
                    {store.warning}
                  </p>
                )}
                {notice && (
                  <p role="status" className="demo-notice">
                    {notice}
                  </p>
                )}
                {route.view === "overview" && (
                  <main className="overview">
                    <div className="workspace-heading">
                      <p className="eyebrow">
                        {route.role === "coach" ? "Coaching" : "My training"}
                      </p>
                      <h1>
                        {route.role === "coach" ? "Command Center" : "Today"}
                      </h1>
                      <p>
                        Plan, log, review and reply across both sides of the
                        training loop.
                      </p>
                    </div>
                    {route.role === "coach" && (
                      <section aria-label="Athlete roster" className="roster">
                        <h2>Athletes</h2>
                        {store.state.athletes.map((x) => (
                          <button
                            key={x.id}
                            className={route.id === x.id ? "selected" : ""}
                            onClick={() => go("overview", route.role, x.id)}
                          >
                            <span className="avatar">
                              {x.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </span>
                            <span>
                              <strong>{x.name}</strong>
                              <small>{x.focus}</small>
                              <small>
                                {alerts(x.id)[0] || "No current review flags"}
                              </small>
                            </span>
                            <span>
                              {store.unread("coach", x.id) > 0
                                ? `${store.unread("coach", x.id)} unread`
                                : "Open"}
                            </span>
                          </button>
                        ))}
                      </section>
                    )}
                    <section className="athlete-context">
                      <div>
                        <p className="eyebrow">Selected athlete</p>
                        <h2>{a.name}</h2>
                        <p>{a.focus}</p>
                        <p>{a.context}</p>
                      </div>
                      <div className="actions">
                        <button onClick={() => go("calendar")}>
                          {route.role === "coach"
                            ? "Plan training"
                            : "View / log training"}
                        </button>
                        <button onClick={() => go("messages")}>
                          Open conversation
                        </button>
                        <button onClick={() => go("checkin")}>Check-in</button>
                      </div>
                    </section>
                    <section className="triage">
                      <h2>
                        {route.role === "coach"
                          ? "Needs review"
                          : "Your recent context"}
                      </h2>
                      {alerts(route.id).length ? (
                        <ul>
                          {alerts(route.id).map((x) => (
                            <li key={x}>{x}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>
                          No current review flags. Missing data is shown as
                          unknown.
                        </p>
                      )}
                      {store.state.checkins[route.id] && (
                        <p data-testid="checkin-summary">
                          Check-in: sleep {store.state.checkins[route.id].sleep}
                          h · energy {store.state.checkins[route.id].energy}/5 ·
                          soreness {store.state.checkins[route.id].soreness}/5 —{" "}
                          {store.state.checkins[route.id].note}
                        </p>
                      )}
                    </section>
                    <ReconciliationSummary
                      summary={store.summary(route.id, route.role)}
                    />
                    <section className="recent">
                      <h2>
                        {route.role === "coach"
                          ? "Recent sessions and next plan"
                          : "Your sessions"}
                      </h2>
                      {store.rows(route.id, route.role).length ? (
                        store.rows(route.id, route.role).map((w) => (
                          <div key={w.id} className="session-row">
                            <button
                              onClick={() =>
                                go("calendar", route.role, route.id, {
                                  workout: w.id,
                                })
                              }
                            >
                              <small>
                                {w.workout_date} · {w.status}{" "}
                                {w.compliance_pct != null
                                  ? `· ${w.compliance_pct}%`
                                  : ""}
                              </small>
                              <strong>{w.title}</strong>
                              <span>
                                {w.planned_duration_min ?? "Unknown"} min
                                planned ·{" "}
                                {w.completed_duration_min ?? "Unknown"} min
                                actual · {w.completed_distance_km ?? "Unknown"}{" "}
                                km actual{" "}
                                {w.athlete_rpe ? `· RPE ${w.athlete_rpe}` : ""}
                              </span>
                              {w.athlete_comment && (
                                <span>{w.athlete_comment}</span>
                              )}
                              {w.coach_feedback && (
                                <span>Coach: {w.coach_feedback}</span>
                              )}
                            </button>
                            {route.role === "coach" && (
                              <button
                                className="duplicate"
                                aria-label={`Duplicate ${w.title}`}
                                onClick={async () => {
                                  const result = await transport.request(
                                    "/api/planned-workouts",
                                    {
                                      method: "POST",
                                      body: JSON.stringify({
                                        action: "duplicate",
                                        id: w.id,
                                      }),
                                    },
                                  );
                                  const data = await result.json();
                                  setNotice(
                                    result.ok
                                      ? "Duplicated plan to the next day; completion and discussion were cleared."
                                      : data.error,
                                  );
                                }}
                              >
                                Duplicate
                              </button>
                            )}
                          </div>
                        ))
                      ) : (
                        <p>
                          No sessions yet. Plan a workout from the calendar.
                        </p>
                      )}
                    </section>
                  </main>
                )}
                {route.view === "calendar" && (
                  <main className="calendar-workspace">
                    <div className="workspace-heading">
                      <p className="eyebrow">
                        {a.name} · {route.role}
                      </p>
                      <h1>Training Calendar</h1>
                      <p>
                        Sample weeks surround {TODAY}. Imported sessions are
                        fixtures; no provider is connected.
                      </p>
                    </div>
                    <TrainingCalendar
                      key={`${route.role}:${route.id}`}
                      athleteId={route.id}
                      athleteName={a.name}
                      role={route.role}
                    />
                  </main>
                )}
                {route.view === "messages" && (
                  <MessagesPage key={`${route.role}:${route.id}`} />
                )}
                {route.view === "checkin" && (
                  <Checkin
                    key={route.id}
                    id={route.id}
                    role={route.role}
                    onSave={() => go("overview")}
                  />
                )}
                {route.view === "limits" && (
                  <main className="limits">
                    <h1>Demo boundaries</h1>
                    <p>
                      This working demo shares the current production calendar,
                      structured workout editor, completion review, session
                      discussion, reconciliation and messages screens. Rosters,
                      triage, Today and this check-in form are adapted for the
                      synthetic workspace.
                    </p>
                    <p>
                      Compliance and weekly totals recalculate after changes.
                      Missing actual metrics stay unknown. The deterministic
                      sample date is October 9, 2026. Each tab has a separate
                      browser session; refresh retains changes, closing that
                      session may clear them. The coach and athlete controls
                      simulate both participants in one tab.
                    </p>
                    <h2>Unavailable in this demo</h2>
                    <p>
                      Signup, invitations, real messaging delivery, email,
                      device connections/imports, billing, account deletion,
                      groups, protocols, interventions, race management, shared
                      documents, research, calculators, account profile and
                      deeper progress/explorer analytics. Use the production app
                      with normal authentication for those workflows.
                    </p>
                    <h2>Try the full loop</h2>
                    <ol>
                      <li>
                        Coach: choose an athlete, plan a structured run on the
                        calendar.
                      </li>
                      <li>
                        Athlete: open that workout, log actual
                        duration/distance, RPE and context.
                      </li>
                      <li>
                        Coach: review actuals and recent check-in, save
                        feedback, send a message, adjust the next workout.
                      </li>
                      <li>
                        Athlete: see the changed plan and feedback, reply;
                        refresh to confirm persistence.
                      </li>
                    </ol>
                    <h2>Save failure simulation</h2>
                    <p>
                      The next calendar or message mutation will fail once;
                      entered answers stay available to retry.
                    </p>
                    <button
                      onClick={() => {
                        store.failNext();
                        setNotice(
                          "The next local save will fail once. Retry it to complete the simulation.",
                        );
                      }}
                    >
                      Fail next save
                    </button>
                  </main>
                )}
              </Boundary>
            </div>
            <footer>
              Threshold demo · fictional running and trail data · no external
              delivery
            </footer>
          </div>
          {resetOpen && (
            <ResetDialog
              onClose={() => setResetOpen(false)}
              onReset={() => {
                try {
                  store.reset();
                  setResetOpen(false);
                  setNotice("Demo reset to the original seed.");
                  go("overview", "coach", "demo-river");
                } catch {
                  setNotice("Storage could not be reset.");
                }
              }}
            />
          )}
        </div>
      </WorkspaceTransport.Provider>
    </RouterContext.Provider>
  );
}
function ResetDialog({ onClose, onReset }) {
  const ref = useDialogFocus(onClose);
  return (
    <div className="reset-backdrop">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-title"
        className="reset-dialog"
      >
        <h2 id="reset-title">Reset this demo?</h2>
        <p>
          This clears this tab's plans, actuals, messages, drafts and check-ins,
          then restores the deterministic seed.
        </p>
        <button onClick={onClose}>Cancel</button>
        <button onClick={onReset}>Restore seed</button>
      </div>
    </div>
  );
}
function Checkin({ id, role, onSave }) {
  const [form, setForm] = useState(
    store.state.checkins[id] || { sleep: 7, energy: 3, soreness: 2, note: "" },
  );
  const [error, setError] = useState("");
  return (
    <main className="checkin">
      <h1>Daily check-in</h1>
      <p>
        {role === "coach"
          ? "Switch to athlete to submit a check-in."
          : "Your check-in updates the coach’s review context."}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            store.checkin(id, form);
            onSave();
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        <label>
          Sleep (hours)
          <input
            aria-label="Sleep (hours)"
            type="number"
            step="0.5"
            min="0"
            max="24"
            required
            value={form.sleep}
            disabled={role === "coach"}
            onChange={(e) =>
              setForm({ ...form, sleep: Number(e.target.value) })
            }
          />
        </label>
        {["energy", "soreness"].map((k) => (
          <label key={k}>
            {k === "energy"
              ? "Energy (1 low, 5 high)"
              : "Soreness (1 low, 5 high)"}
            <select
              aria-label={k}
              value={form[k]}
              disabled={role === "coach"}
              onChange={(e) =>
                setForm({ ...form, [k]: Number(e.target.value) })
              }
            >
              {[1, 2, 3, 4, 5].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        ))}
        <label>
          Context
          <textarea
            aria-label="Check-in context"
            maxLength="3000"
            value={form.note}
            disabled={role === "coach"}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </label>
        <button disabled={role === "coach"}>Save check-in</button>
        {error && <p role="alert">{error}</p>}
      </form>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
