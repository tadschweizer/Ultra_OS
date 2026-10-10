import test from "node:test";
import assert from "node:assert/strict";
import { DemoStore } from "../adapter.js";
import { seed, KEY } from "../seed.js";
const call = async (request, url, method = "GET", body) => {
  const r = await request(url, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, ...(await r.json()) };
};
const storage = () => {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) || null,
    setItem: (k, v) => values.set(k, v),
  };
};
test("deterministic fixtures and refresh persistence; sessions are independent", async () => {
  assert.deepEqual(seed(), seed());
  const saved = storage(),
    s = new DemoStore(saved),
    coach = s.transport("coach", "demo-river");
  await call(coach, "/api/planned-workouts", "POST", {
    title: "Persisted run",
    workout_date: "2026-10-10",
    sport: "run",
    planned_duration_min: 60,
  });
  assert.equal(
    new DemoStore(saved).state.workouts.at(-1).title,
    "Persisted run",
  );
  assert.equal(new DemoStore(storage()).state.workouts.length, 15);
  s.reset();
  assert.deepEqual(s.state, seed());
});
test("full plan → athlete partial completion → coach feedback and adjustment → athlete update", async () => {
  const s = new DemoStore(),
    c = s.transport("coach", "demo-robin"),
    a = s.transport("athlete", "demo-robin");
  const plan = {
    title: "New trail run",
    workout_date: "2026-10-09",
    sport: "run",
    planned_duration_min: 50,
    planned_distance_km: 8,
    planned_distance_unit: "km",
    objective: "Climb steadily",
    coach_instructions: "Keep HR below 150",
    target_metric: "heart_rate",
    planned_if: 0.7,
    structure: [
      {
        type: "work",
        repeat: 4,
        duration_min: 5,
        target_type: "heart_rate",
        target_min: 140,
        target_max: 150,
        intensity: "z2",
      },
    ],
  };
  let { workout: w } = await call(c, "/api/planned-workouts", "POST", plan);
  await call(a, "/api/planned-workouts", "PATCH", {
    id: w.id,
    status: "completed",
    completed_duration_min: 35,
    completed_distance_km: null,
    athlete_rpe: 8,
    athlete_comment: "Legs heavy",
  });
  let row = s.rows("demo-robin")[0];
  assert.equal(row.compliance_pct, 70);
  assert.equal(row.completed_distance_km, null);
  assert.equal(s.summary("demo-robin").completedCount, 1);
  await call(c, "/api/planned-workouts", "PATCH", {
    id: w.id,
    coach_feedback: "Recover tomorrow",
    planned_duration_min: 45,
  });
  row = s.rows("demo-robin", "athlete")[0];
  assert.equal(row.coach_feedback, "Recover tomorrow");
  assert.equal(row.planned_duration_min, 45);
  assert.deepEqual(row.structure, plan.structure);
  assert.equal(row.objective, plan.objective);
});
test("role restrictions, private draft filtering and cross-athlete denial", async () => {
  const s = new DemoStore(),
    c = s.transport("coach", "demo-river"),
    a = s.transport("athlete", "demo-river");
  const { workout: w } = await call(c, "/api/planned-workouts", "POST", {
    title: "Private plan",
    workout_date: "2026-10-10",
    visibility: "coach_private",
  });
  assert.ok(!s.rows("demo-river", "athlete").some((x) => x.id === w.id));
  assert.equal(
    (
      await call(a, "/api/planned-workouts", "PATCH", {
        id: "seed-0-0",
        planned_duration_min: 500,
      })
    ).status,
    403,
  );
  assert.equal(
    (await call(a, "/api/planned-workouts?athlete_id=demo-sage")).status,
    403,
  );
  assert.equal(
    (await call(a, "/api/planned-workouts?id=seed-0-0", "DELETE")).status,
    403,
  );
});
test("create retry key prevents duplicates, validation retains state", async () => {
  const s = new DemoStore(),
    r = s.transport("coach", "demo-river"),
    body = {
      title: "Repeat",
      workout_date: "2026-10-10",
      client_request_id: crypto.randomUUID(),
    };
  const first = await call(r, "/api/planned-workouts", "POST", body),
    second = await call(r, "/api/planned-workouts", "POST", body);
  assert.equal(first.workout.id, second.workout.id);
  assert.equal(s.state.workouts.length, 16);
  assert.equal((await call(r, "/api/planned-workouts", "POST", {...body,title:"Different details"})).status,409);
  for (const bad of [
    { title: " " },
    { workout_date: "2026-02-30" },
    { planned_duration_min: -1 },
    { athlete_rpe: 11 },
  ])
    assert.equal(
      (
        await call(r, "/api/planned-workouts", "PATCH", {
          id: first.workout.id,
          ...bad,
        })
      ).status,
      400,
    );
});
test("duplicates and copy-week retain all plan fields and clear completion/discussion", async () => {
  const s = new DemoStore(),
    r = s.transport("coach", "demo-river");
  const original = s.state.workouts[1];
  original.visibility = "coach_private";
  const { workouts } = await call(r, "/api/planned-workouts", "POST", {
    action: "duplicate",
    id: original.id,
  });
  const w = workouts[0];
  for (const k of [
    "objective",
    "coach_instructions",
    "target_metric",
    "planned_if",
    "visibility",
    "structure",
  ])
    assert.deepEqual(w[k], original[k]);
  assert.equal(w.workout_date, "2026-10-07");
  assert.equal(w.status, "planned");
  assert.equal(w.athlete_comment, undefined);
  const copied = await call(r, "/api/planned-workouts", "POST", {
    action: "copy_week",
    from_week_start: "2026-10-05",
    to_week_start: "2026-10-12",
  });
  assert.equal(copied.workouts.length, 6);
  assert.equal(copied.workouts[1].visibility, "coach_private");
  assert.ok(
    copied.workouts.every(
      (x) => x.status === "planned" && !x.completed_duration_min,
    ),
  );
});
test("skip and undo preserve unknown actuals and do not derive completion from plan", async () => {
  const s = new DemoStore(),
    r = s.transport("athlete", "demo-river");
  await call(r, "/api/planned-workouts", "PATCH", {
    id: "seed-0-3",
    status: "skipped",
  });
  assert.equal(
    s.rows("demo-river").find((w) => w.id === "seed-0-3").status,
    "skipped",
  );
  await call(r, "/api/planned-workouts", "PATCH", {
    id: "seed-0-3",
    status: "planned",
    completed_duration_min: null,
    completed_distance_km: null,
    athlete_rpe: null,
  });
  const w = s.rows("demo-river").find((w) => w.id === "seed-0-3");
  assert.equal(w.status, "planned");
  assert.equal(w.completed_duration_min, null);
});
test("activity linking cannot double count and unlink retains the activity", async () => {
  const s = new DemoStore(),
    r = s.transport("athlete", "demo-river");
  assert.equal(
    (
      await call(r, "/api/planned-workouts", "PATCH", {
        id: "seed-0-3",
        match_action: "confirm",
        activity_id: "demo-activity",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call(r, "/api/planned-workouts", "PATCH", {
        id: "seed-0-4",
        match_action: "confirm",
        activity_id: "demo-activity",
      })
    ).status,
    409,
  );
  let got = await call(r, "/api/planned-workouts");
  assert.equal(got.activities.length, 0);
  assert.equal(s.summary("demo-river").unplannedActivities.length, 0);
  await call(r, "/api/planned-workouts", "PATCH", {
    id: "seed-0-3",
    match_action: "reject",
  });
  got = await call(r, "/api/planned-workouts");
  assert.equal(got.activities.length, 1);
  assert.equal(got.workouts.find((w) => w.id === "seed-0-3").status, "planned");
});
test("stale workout write conflicts instead of replacing latest change", async () => {
  const s = new DemoStore(),
    r = s.transport("coach", "demo-river"),
    old = s.state.workouts[0].updated_at;
  await call(r, "/api/planned-workouts", "PATCH", {
    id: "seed-0-0",
    planned_duration_min: 10,
    expected_updated_at: old,
  });
  assert.equal(
    (
      await call(r, "/api/planned-workouts", "PATCH", {
        id: "seed-0-0",
        planned_duration_min: 500,
        expected_updated_at: old,
      })
    ).status,
    409,
  );
  assert.equal(s.state.workouts[0].planned_duration_min, 10);
});
test("role-correct direct messages, exact acknowledgements and retry idempotency", async () => {
  const s = new DemoStore(),
    c = s.transport("coach", "demo-river"),
    a = s.transport("athlete", "demo-river");
  const body = {
    message_body: "Recover tomorrow",
    client_message_id: crypto.randomUUID(),
  };
  await call(c, "/api/coach/messages", "POST", body);
  await call(c, "/api/coach/messages", "POST", body);
  assert.equal(s.unread("athlete", "demo-river"), 1);
  await call(a, "/api/message-center", "POST", {
    message_ids: [body.client_message_id],
  });
  assert.equal(s.unread("athlete", "demo-river"), 0);
  await call(a, "/api/coach/messages", "POST", {
    message_body: "Thanks, understood",
    client_message_id: crypto.randomUUID(),
  });
  assert.equal(s.state.messages.at(-1).sender_role, "athlete");
  assert.equal(s.unread("coach", "demo-river"), 1);
  assert.equal(s.state.messages.length, 3);
  assert.equal(s.state.messages.at(-1).email_notification, "skipped");
});
test("drafts are isolated per role/recipient, durable and version checked", async () => {
  const saved = storage(),
    s = new DemoStore(saved),
    c = s.transport("coach", "demo-river");
  const d = await call(c, "/api/message-drafts", "PUT", {
    body: "Saved draft",
    expected_version: null,
  });
  assert.equal(
    (
      await call(c, "/api/message-drafts", "PUT", {
        body: "stale",
        expected_version: null,
      })
    ).status,
    409,
  );
  assert.equal(
    (await call(s.transport("athlete", "demo-river"), "/api/message-drafts"))
      .draft,
    null,
  );
  assert.equal(
    (await call(s.transport("coach", "demo-jules"), "/api/message-drafts"))
      .draft,
    null,
  );
  assert.equal(
    new DemoStore(saved).state.drafts["coach:demo-river"].version,
    d.draft.version,
  );
});
test("failure simulation and storage errors cannot claim saved success", async () => {
  const s = new DemoStore();
  s.failNext();
  const r = s.transport("coach", "demo-river");
  assert.equal(
    (
      await call(r, "/api/planned-workouts", "POST", {
        title: "Retry",
        workout_date: "2026-10-09",
      })
    ).status,
    503,
  );
  assert.equal(s.state.workouts.length, 15);
  assert.equal(
    (
      await call(r, "/api/planned-workouts", "POST", {
        title: "Retry",
        workout_date: "2026-10-09",
      })
    ).status,
    200,
  );
  const broken = new DemoStore({
    getItem: () => null,
    setItem: () => {
      throw Error("full");
    },
  });
  assert.equal(
    (
      await call(
        broken.transport("coach", "demo-river"),
        "/api/planned-workouts",
        "PATCH",
        { id: "seed-0-0", planned_duration_min: 99 },
      )
    ).status,
    507,
  );
  assert.equal(broken.state.workouts[0].planned_duration_min, 40);
});
test("check-in updates all fields; corrupt storage warns; unsupported provider endpoints fail closed", async () => {
  const s = new DemoStore();
  s.checkin("demo-river", {
    sleep: 5,
    energy: 1,
    soreness: 5,
    note: "Rest today",
  });
  assert.deepEqual(s.state.checkins["demo-river"], {
    sleep: 5,
    energy: 1,
    soreness: 5,
    note: "Rest today",
    date: "2026-10-09",
  });
  assert.ok(new DemoStore({ getItem: () => "{bad" }).warning);
  let fetchCount = 0;
  const old = globalThis.fetch;
  globalThis.fetch = () => {
    fetchCount++;
    throw Error();
  };
  try {
    const r = s.transport("coach", "demo-river");
    assert.equal((await call(r, "/api/strava/sync", "POST", {})).status, 501);
    assert.equal(
      (await call(r, "https://production.invalid/api/me")).status,
      403,
    );
    assert.equal(fetchCount, 0);
  } finally {
    globalThis.fetch = old;
  }
});
