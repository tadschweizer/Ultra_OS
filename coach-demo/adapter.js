import { seed, KEY, TODAY } from "./seed.js";
import {
  decorateWorkoutsWithCompliance,
  estimateTss,
  summarizeStructure,
  summarizeReconciliationWindow,
} from "../webapp/lib/workoutCompliance.js";
import { validateWorkoutFields, sameWorkoutRequest } from "../webapp/lib/workoutValidation.js";
import { normalizeLibraryPayload } from "../webapp/lib/libraryValidation.js";
const clone = (x) => structuredClone(x);
const stamp = (s) =>
  new Date(Date.parse(TODAY + "T12:00:00Z") + s.revision * 1000).toISOString();
const response = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => clone(data),
});
const plus = (date, days) =>
  new Date(Date.parse(date + "T12:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
const PLAN = [
  "title",
  "sport",
  "workout_date",
  "description",
  "objective",
  "coach_instructions",
  "target_metric",
  "planned_if",
  "visibility",
  "structure",
  "planned_duration_min",
  "planned_distance_km",
  "planned_distance_unit",
  "planned_tss",
  "order_index",
  "library_workout_id",
];
const ACTUAL = [
  "status",
  "completed_duration_min",
  "completed_distance_km",
  "athlete_rpe",
  "athlete_comment",
];
const pick = (x, keys) =>
  Object.fromEntries(keys.filter((k) => k in x).map((k) => [k, clone(x[k])]));
function fillPlanTotals(plan) {
  const totals = summarizeStructure(plan.structure || []);
  if (plan.status !== "completed") {
    if (plan.planned_duration_min == null && totals.durationMin > 0)
      plan.planned_duration_min = totals.durationMin;
    if (plan.planned_distance_km == null && totals.distanceKm > 0)
      plan.planned_distance_km = totals.distanceKm;
    if (plan.planned_tss == null)
      plan.planned_tss = estimateTss(plan.structure, plan.planned_duration_min);
  }
  return plan;
}

export class DemoStore {
  constructor(storage = null) {
    this.storage = storage;
    this.listeners = new Set();
    this.failure = null;
    this.warning = "";
    try {
      const raw = storage?.getItem(KEY);
      this.state = raw ? JSON.parse(raw) : seed();
      if (this.state.schema !== 3 || !Array.isArray(this.state.workouts))
        throw Error();
    } catch {
      this.state = seed();
      this.warning =
        "Saved demo data could not be read. A fresh seed is shown; Reset demo clears the damaged copy.";
    }
  }
  subscribe = (fn) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  emit() {
    for (const fn of this.listeners) fn();
  }
  commit(next) {
    next.revision++;
    this.storage?.setItem(KEY, JSON.stringify(next));
    this.state = next;
    this.emit();
  }
  reset() {
    const next = seed();
    this.storage?.setItem(KEY, JSON.stringify(next));
    this.state = next;
    this.warning = "";
    this.failure = null;
    this.emit();
  }
  failNext() {
    this.failure = "before";
    this.emit();
  }
  rows(id, role = "coach") {
    const ws = this.state.workouts.filter(
      (w) =>
        w.athlete_id === id &&
        (role === "coach" || w.visibility !== "coach_private"),
    );
    return decorateWorkoutsWithCompliance(
      ws,
      this.state.activities.filter((a) => a.athlete_id === id),
      { today: new Date(TODAY + "T12:00:00") },
    );
  }
  summary(id, role = "coach") {
    return summarizeReconciliationWindow(
      this.state.workouts.filter(
        (w) =>
          w.athlete_id === id &&
          (role === "coach" || w.visibility !== "coach_private"),
      ),
      this.state.activities.filter((a) => a.athlete_id === id),
      {
        start: "2026-10-05",
        end: "2026-10-11",
        today: new Date(TODAY + "T12:00:00"),
      },
    );
  }
  unread(role, id) {
    return this.state.messages.filter(
      (m) =>
        (!id || m.athlete_id === id) && m.sender_role !== role && !m.read_at,
    ).length;
  }
  checkin(id, data) {
    if (
      !Number.isFinite(data.sleep) ||
      data.sleep < 0 ||
      data.sleep > 24 ||
      ![1, 2, 3, 4, 5].includes(data.energy) ||
      ![1, 2, 3, 4, 5].includes(data.soreness)
    )
      throw Error("Check the sleep and readiness values.");
    const next = clone(this.state);
    next.checkins[id] = { ...data, date: TODAY };
    this.commit(next);
  }
  transport(role, id) {
    return async (url, options = {}) => {
      if (options.signal?.aborted)
        throw new DOMException("Aborted", "AbortError");
      if (typeof url !== "string" || !url.startsWith("/api/"))
        return response(
          { error: "Only local demo requests are supported." },
          403,
        );
      const parsed = new URL(url, "https://demo.invalid");
      const path = parsed.pathname;
      const q = parsed.searchParams;
      const method = options.method || "GET";
      const body = options.body ? JSON.parse(options.body) : {};
      const target = body.athlete_id || q.get("athlete_id") || id;
      if (
        !this.state.athletes.some((a) => a.id === target) ||
        (role === "athlete" && target !== id)
      )
        return response(
          { error: "This athlete is not available in this demo role." },
          403,
        );
      const next = clone(this.state);
      const now = stamp({ ...next, revision: next.revision + 1 });
      const newId = () => crypto.randomUUID();
      if (method !== "GET" && this.failure === "before") {
        this.failure = null;
        this.emit();
        return response(
          {
            error: "Simulated save failure. Your answers are retained; retry.",
          },
          503,
        );
      }
      const save = (result) => {
        try {
          this.commit(next);
          return response(result);
        } catch {
          return response(
            {
              error:
                "Browser storage is unavailable or full. Your changes were not saved.",
            },
            507,
          );
        }
      };
      if (path === "/api/settings")
        return response({ settings: { distance_unit: "km" } });
      if (path === "/api/planned-workouts") {
        if (method === "GET") {
          const rows = this.rows(target, role)
            .filter(
              (w) =>
                (!q.get("start") || w.workout_date >= q.get("start")) &&
                (!q.get("end") || w.workout_date <= q.get("end")),
            )
            .map((w) => ({
              ...w,
              comment_count: next.comments.filter((c) => c.workout_id === w.id)
                .length,
            }));
          const acts = next.activities.filter(
            (a) =>
              a.athlete_id === target &&
              (!q.get("start") || a.activity_date >= q.get("start")) &&
              (!q.get("end") || a.activity_date <= q.get("end")),
          );
          const used = new Set(
            rows
              .flatMap((w) => [w.completed_activity_id, w.matched_activity?.id])
              .filter(Boolean),
          );
          return response({
            workouts: rows,
            activities: acts.filter((a) => !used.has(a.id)),
            match_activities: acts.map((a) => ({
              ...a,
              linked_workout_id: next.workouts.find(
                (w) => w.completed_activity_id === a.id,
              )?.id,
            })),
            import_source: { strava_connected: false },
          });
        }
        if (method === "DELETE") {
          const w = next.workouts.find((w) => w.id === q.get("id"));
          if (!w || w.athlete_id !== target)
            return response({ error: "Workout not found." }, 404);
          if (role !== "coach" && w.coach_id)
            return response(
              { error: "Only the demo coach can delete assigned plans." },
              403,
            );
          next.workouts = next.workouts.filter((x) => x.id !== w.id);
          next.comments = next.comments.filter((c) => c.workout_id !== w.id);
          return save({ success: true });
        }
        if (method === "PATCH") {
          const w = next.workouts.find((w) => w.id === body.id);
          if (
            !w ||
            w.athlete_id !== target ||
            (role === "athlete" && w.visibility === "coach_private")
          )
            return response({ error: "Workout not available." }, 404);
          if (
            body.expected_updated_at &&
            body.expected_updated_at !== w.updated_at
          )
            return response(
              {
                error:
                  "This workout changed. Close and reopen it before saving.",
              },
              409,
            );
          if (role === "athlete" && w.coach_id && PLAN.some((k) => k in body))
            return response(
              { error: "Athletes can log actuals, not edit coach plans." },
              403,
            );
          const error = validateWorkoutFields(body);
          if (error) return response({ error }, 400);
          if (body.match_action) {
            if (role !== "athlete")
              return response(
                { error: "Switch to athlete to correct matching." },
                403,
              );
            if (body.match_action === "confirm") {
              const a = next.activities.find(
                (a) => a.id === body.activity_id && a.athlete_id === target,
              );
              if (
                !a ||
                next.workouts.some(
                  (x) => x.id !== w.id && x.completed_activity_id === a.id,
                )
              )
                return response(
                  { error: "Activity is unavailable or already linked." },
                  409,
                );
              Object.assign(w, {
                completed_activity_id: a.id,
                status: "completed",
                completed_duration_min: a.duration_min,
                completed_distance_km: a.distance_km,
                activity_match_mode: "manual",
              });
            } else if (["reject", "auto"].includes(body.match_action))
              Object.assign(w, {
                completed_activity_id: null,
                status: "planned",
                completed_duration_min: null,
                completed_distance_km: null,
                activity_match_mode:
                  body.match_action === "auto" ? "auto" : "manual",
              });
            else return response({ error: "Unknown match action." }, 400);
          } else {
            Object.assign(
              w,
              pick(
                body,
                role === "coach"
                  ? [...PLAN, "coach_feedback"]
                  : w.coach_id
                    ? ACTUAL
                    : [...PLAN, ...ACTUAL],
              ),
            );
            if (role === "athlete") {
              w.completed_activity_id = null;
              w.activity_match_mode = "manual";
              if (body.status === "skipped")
                Object.assign(w, {
                  completed_duration_min: null,
                  completed_distance_km: null,
                  athlete_rpe: null,
                });
            }
          }
          if (PLAN.some((k) => k in body)) fillPlanTotals(w);
          w.updated_at = now;
          return save({ workout: w });
        }
        if (method === "POST") {
          if (body.client_request_id && next.requests[body.client_request_id]) {
            const original = next.workouts.find((w) => w.id === next.requests[body.client_request_id]);
            const payload = fillPlanTotals(pick(body, [...PLAN, ...ACTUAL]));
            if (!sameWorkoutRequest(original, payload)) return response({error: 'This retry key already saved different workout details. Reopen the calendar before editing.'}, 409);
            return response({workout: original});
          }
          if (body.action === "copy_week" || body.action === "duplicate") {
            if (role !== "coach")
              return response({ error: "Coach planning action only." }, 403);
            const sources =
              body.action === "duplicate"
                ? next.workouts.filter(
                    (w) => w.id === body.id && w.athlete_id === target,
                  )
                : next.workouts.filter(
                    (w) =>
                      w.athlete_id === target &&
                      w.workout_date >= body.from_week_start &&
                      w.workout_date <= plus(body.from_week_start, 6),
                  );
            if (!sources.length)
              return response({ error: "No source workouts." }, 400);
            const shift =
              body.action === "duplicate"
                ? 1
                : Math.round(
                    (Date.parse(body.to_week_start) -
                      Date.parse(body.from_week_start)) /
                      86400000,
                  );
            const retryKey = JSON.stringify([
              body.action,
              target,
              body.id,
              body.from_week_start,
              body.to_week_start,
              sources.map((w) => [w.id, pick(w, PLAN)]),
            ]);
            if (next.requests[retryKey])
              return response({
                workouts: next.workouts.filter((w) =>
                  next.requests[retryKey].includes(w.id),
                ),
              });
            const created = sources.map((w) => ({
              ...pick(w, PLAN),
              id: newId(),
              athlete_id: target,
              coach_id: "demo-coach",
              workout_date: plus(w.workout_date, shift),
              status: "planned",
              activity_match_mode: "manual",
              updated_at: now,
            }));
            next.workouts.push(...created);
            next.requests[retryKey] = created.map((w) => w.id);
            return save({ workouts: created });
          }
          if (role === "athlete" && body.visibility === "coach_private")
            return response(
              { error: "Coach-private planning is unavailable to athletes." },
              403,
            );
          const lib = body.library_workout_id
            ? next.library.find((w) => w.id === body.library_workout_id)
            : null;
          if (body.library_workout_id && !lib)
            return response({ error: "Template not found." }, 404);
          if (lib && role !== "coach")
            return response({ error: "Coach library action only." }, 403);
          const plan = lib
            ? { ...lib, title: lib.name, workout_date: body.workout_date }
            : body;
          const error = validateWorkoutFields(plan);
          if (error) return response({ error }, 400);
          if (!plan.title || !plan.workout_date)
            return response(
              { error: "Workout title and date are required." },
              400,
            );
          const w = {
            ...pick(plan, PLAN),
            ...pick(body, ACTUAL),
            id: newId(),
            athlete_id: target,
            coach_id: role === "coach" ? "demo-coach" : null,
            status: body.status || "planned",
            activity_match_mode: "manual",
            visibility: plan.visibility || "athlete_visible",
            updated_at: now,
          };
          // A library assignment copies the saved prescription exactly,
          // including a deliberately cleared load/duration/distance. Only
          // directly planned workouts derive omitted totals here.
          if (!lib) fillPlanTotals(w);
          next.workouts.push(w);
          if (body.client_request_id)
            next.requests[body.client_request_id] = w.id;
          return save({ workout: w });
        }
      }
      if (path === "/api/workout-library") {
        if (role !== "coach")
          return response({ error: "Coach library only." }, 403);
        if (method === "GET") return response({ workouts: next.library });
        if (method === "PATCH") {
          const existing = next.library.find((w) => w.id === body.id);
          if (!existing) return response({ error: "Library workout not found." }, 404);
          try {
            // Same pure field validation as the signed API; all state remains
            // synthetic and local to this browser store. Never replace IDs.
            Object.assign(existing, normalizeLibraryPayload(body), { updated_at: now });
            return save({ workout: existing });
          } catch (error) {
            return response({ error: error.message }, error.status || 400);
          }
        }
        if (method === "DELETE") {
          next.library = next.library.filter((w) => w.id !== q.get("id"));
          return save({ success: true });
        }
        if (method === "POST") {
          const error = validateWorkoutFields(body);
          if (error) return response({ error }, 400);
          const fingerprint = JSON.stringify(body);
          const existing = next.library.find(
            (w) => w.request_fingerprint === fingerprint,
          );
          if (existing) return response({ workout: existing });
          const w = fillPlanTotals({
            ...body,
            id: newId(),
            request_fingerprint: fingerprint,
            planned_tss: estimateTss(body.structure, body.planned_duration_min),
          });
          next.library.push(w);
          return save({ workout: w });
        }
      }
      if (path === "/api/calendar-notes" || path === "/api/race-events") {
        const field = path.endsWith("notes") ? "notes" : "events",
          singular = field === "notes" ? "note" : "event";
        if (method === "GET")
          return response({
            [field]: next[field].filter((x) => x.athlete_id === target),
          });
        const previous = next[field].find(
          (x) => x.id === (body.id || q.get("id")) && x.athlete_id === target,
        );
        if (previous?.coach_id && role === "athlete")
          return response(
            { error: "Coach note editing is unavailable to athletes." },
            403,
          );
        if (method === "DELETE") {
          next[field] = next[field].filter(
            (x) => x.id !== q.get("id") || x.athlete_id !== target,
          );
          return save({ success: true });
        }
        const row = {
          ...previous,
          ...body,
          id: previous?.id || newId(),
          athlete_id: target,
          coach_id:
            previous?.coach_id || (role === "coach" ? "demo-coach" : null),
        };
        next[field] = [...next[field].filter((x) => x.id !== row.id), row];
        return save({ [singular]: row });
      }
      if (path === "/api/workout-comments") {
        const subject =
          body.workout_id ||
          q.get("workout_id") ||
          body.activity_id ||
          q.get("activity_id");
        const object =
          next.workouts.find((w) => w.id === subject) ||
          next.activities.find((a) => a.id === subject);
        if (
          !object ||
          object.athlete_id !== target ||
          (role === "athlete" && object.visibility === "coach_private")
        )
          return response({ error: "Discussion not available." }, 404);
        if (method === "GET")
          return response({
            comments: next.comments.filter(
              (c) => (c.workout_id || c.activity_id) === subject,
            ),
          });
        if (!body.body?.trim())
          return response({ error: "Write a comment." }, 400);
        const comment = {
          id: newId(),
          ...(body.workout_id
            ? { workout_id: subject }
            : { activity_id: subject }),
          body: body.body.trim(),
          sender_role: role,
          author_name:
            role === "coach"
              ? "Demo coach"
              : next.athletes.find((a) => a.id === target).name,
          created_at: now,
        };
        next.comments.push(comment);
        return save({ comment });
      }
      if (path === "/api/coach/messages") {
        if (method === "GET") {
          const conversations = next.athletes
            .filter((a) => role === "coach" || a.id === id)
            .map((a) => ({
              coach_id: "demo-coach",
              athlete_id: a.id,
              athlete: { name: role === "coach" ? a.name : "Demo coach" },
              unread_count: this.unread(role, a.id),
              last_message: next.messages
                .filter((m) => m.athlete_id === a.id)
                .at(-1),
            }));
          return response({
            role,
            conversations,
            messages: next.messages.filter((m) => m.athlete_id === target),
            templates: {
              general_checkin: "How did your legs feel after the last run?",
              race_week_checkin: "How is race preparation going?",
            },
            next_cursor: null,
          });
        }
        if (method === "POST") {
          if (!body.message_body?.trim())
            return response({ error: "Write a message." }, 400);
          const old = next.messages.find(
            (m) => m.id === body.client_message_id,
          );
          if (old) return response({ message: old });
          const message = {
            id: body.client_message_id || newId(),
            athlete_id: target,
            sender_role: role,
            message_body: body.message_body.trim(),
            created_at: now,
            read_at: null,
            email_notification: "skipped",
          };
          next.messages.push(message);
          delete next.drafts[`${role}:${target}`];
          return save({ message });
        }
      }
      if (path === "/api/message-drafts") {
        const key = `${role}:${target}`;
        if (method === "GET")
          return response({ draft: next.drafts[key] || null });
        if (
          (next.drafts[key]?.version || null) !==
          (body.expected_version || null)
        )
          return response(
            { error: "Draft changed in this demo session." },
            409,
          );
        const draft = {
          body: body.body || "",
          template_key: body.template_key,
          client_message_id: body.client_message_id || null,
          version: newId(),
        };
        next.drafts[key] = draft;
        return save({ draft });
      }
      if (path === "/api/message-center" && method === "POST") {
        for (const m of next.messages)
          if (
            m.athlete_id === target &&
            m.sender_role !== role &&
            body.message_ids?.includes(m.id)
          )
            m.read_at = now;
        return save({ success: true });
      }
      if (path === "/api/message-preferences") {
        if (method === "GET")
          return response({
            preferences: next.preferences[role],
            email_available: false,
          });
        if (body.email_enabled)
          return response({ error: "Email is unavailable in the demo." }, 400);
        next.preferences[role] = {
          badge_enabled: !!body.badge_enabled,
          email_enabled: false,
        };
        return save({
          preferences: next.preferences[role],
          email_available: false,
        });
      }
      return response(
        { error: `Unavailable in this demo: ${method} ${path}` },
        501,
      );
    };
  }
}
