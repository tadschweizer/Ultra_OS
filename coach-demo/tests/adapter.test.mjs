import test from "node:test";
import assert from "node:assert/strict";
import { DemoStore } from "../adapter.js";
import { seed, KEY } from "../seed.js";
import { libraryWorkoutPayload } from "../../webapp/lib/libraryWorkoutPayload.js";
import { summarizeActualTss } from "../../webapp/lib/workoutCompliance.js";
import { calendarSelectionUrl } from "../../webapp/lib/calendarSelection.js";
import { summarizeCalendarWeek } from "../../webapp/lib/calendarSummary.js";
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

test('O1 synthetic template PATCH shares validation, persists, isolates stores and assigns edited metadata',async()=>{
  const saved=storage(),s=new DemoStore(saved),request=s.transport('coach','demo-robin');
  const {workout:created}=await call(request,'/api/workout-library','POST',{
    name:'Editable synthetic trail',sport:'run',planned_duration_min:40,planned_distance_km:9.656064,planned_distance_unit:'mi',
    objective:null,coach_instructions:'Original',planned_if:0,planned_tss:0,structure:[],visibility:'coach_private',target_metric:'heart_rate'});
  const before=await call(request,'/api/planned-workouts','POST',{library_workout_id:created.id,workout_date:'2026-10-14'});
  const body={id:created.id,coach_instructions:'Revised recovery',planned_if:0,planned_tss:null,objective:null,visibility:'athlete_visible'};
  for(let i=0;i<2;i++){
    const changed=await call(request,'/api/workout-library','PATCH',body);assert.equal(changed.status,200);
    assert.equal(changed.workout.id,created.id);assert.equal(changed.workout.planned_distance_km,9.656064);
    assert.equal(changed.workout.planned_if,0);assert.equal(changed.workout.planned_tss,null);
  }
  assert.equal((await call(request,'/api/workout-library','PATCH',{id:created.id,target_metric:'bogus'})).status,400);
  assert.equal((await call(request,'/api/workout-library','PATCH',{id:'unknown',name:'Other'})).status,404);
  assert.equal((await call(s.transport('athlete','demo-robin'),'/api/workout-library','PATCH',body)).status,403);
  const refreshed=new DemoStore(saved).transport('coach','demo-robin');
  const library=await call(refreshed,'/api/workout-library');assert.equal(library.workouts.filter(w=>w.id===created.id).length,1);
  assert.equal(library.workouts.find(w=>w.id===created.id).coach_instructions,'Revised recovery');
  const after=await call(refreshed,'/api/planned-workouts','POST',{library_workout_id:created.id,workout_date:'2026-10-15'});
  assert.equal(before.workout.coach_instructions,'Original');assert.equal(after.workout.coach_instructions,'Revised recovery');
  assert.equal(after.workout.planned_if,0);assert.equal(after.workout.planned_tss,null);
  assert.equal(after.workout.library_workout_id,created.id);
  await call(refreshed,'/api/workout-library','PATCH',{id:created.id,planned_duration_min:null,planned_distance_km:null,planned_if:null});
  const cleared=await call(refreshed,'/api/planned-workouts','POST',{library_workout_id:created.id,workout_date:'2026-10-16'});
  for(const key of ['planned_duration_min','planned_distance_km','planned_if','planned_tss'])assert.equal(cleared.workout[key],null);
  const isolated=await call(new DemoStore(storage()).transport('coach','demo-robin'),'/api/workout-library');
  assert.equal(isolated.workouts.some(w=>w.id===created.id),false);
  s.reset();assert.equal((await call(request,'/api/workout-library')).workouts.some(w=>w.id===created.id),false);
});

test("QA F4: selecting/closing details replaces stale deep links while retaining participant context", () => {
  const query = {
    mode: "athlete",
    athlete_id: "demo-river",
    workout: "seed-0-3",
    activity: "old-activity",
    log: "1",
    filters: ["run", "trail"],
  };
  const selected = new URL(
    calendarSelectionUrl("/calendar", query, { workout: "seed-0-2" }),
    "https://demo.invalid",
  );
  assert.equal(selected.searchParams.get("workout"), "seed-0-2");
  assert.equal(selected.searchParams.get("mode"), "athlete");
  assert.equal(selected.searchParams.get("athlete_id"), "demo-river");
  assert.deepEqual(selected.searchParams.getAll("filters"), ["run", "trail"]);
  assert.ok(
    !selected.searchParams.has("activity") && !selected.searchParams.has("log"),
  );
  const closed = new URL(
    calendarSelectionUrl("/calendar", query),
    "https://demo.invalid",
  );
  assert.ok(
    !closed.searchParams.has("workout") &&
      !closed.searchParams.has("activity") &&
      !closed.searchParams.has("log"),
  );
  const activity = new URL(
    calendarSelectionUrl("/calendar", query, { activity: 123 }),
    "https://demo.invalid",
  );
  assert.equal(activity.searchParams.get("activity"), "123");
  assert.ok(!activity.searchParams.has("workout"));
});

test("QA F5: matching changes attribution, retaining every weekly actual metric once through reload/unlink", async () => {
  const saved = storage(),
    s = new DemoStore(saved),
    a = s.transport("athlete", "demo-river");
  s.state.activities[0].kilojoules = 410;
  const summary = async (request) => {
    const result = await call(
      request,
      "/api/planned-workouts?start=2026-10-05&end=2026-10-11",
    );
    return summarizeCalendarWeek([
      { workouts: result.workouts, activities: result.activities },
    ]);
  };
  const metricKeys = [
    "actualDurationMin",
    "actualDistanceKm",
    "actualTss",
    "elevationGainM",
    "kilojoules",
  ];
  const metrics = (week) =>
    Object.fromEntries(metricKeys.map((key) => [key, week[key]]));
  const before = metrics(await summary(a));
  assert.equal(before.elevationGainM, 620);
  assert.equal(before.kilojoules, 410);
  assert.equal(before.actualTss, 58);
  await call(a, "/api/planned-workouts", "PATCH", {
    id: "seed-0-3",
    match_action: "confirm",
    activity_id: "demo-activity",
  });
  assert.deepEqual(metrics(await summary(a)), before);
  const reloaded = new DemoStore(saved);
  assert.deepEqual(
    metrics(await summary(reloaded.transport("athlete", "demo-river"))),
    before,
  );
  await call(a, "/api/planned-workouts", "PATCH", {
    id: "seed-0-3",
    match_action: "reject",
  });
  assert.deepEqual(metrics(await summary(a)), before);
  const activity = s.state.activities[0];
  const deduplicated = summarizeCalendarWeek([
    {
      workouts: [
        { status: "completed", linked_activity: activity },
        { status: "completed", matched_activity: { ...activity } },
      ],
      activities: [],
    },
  ]);
  assert.equal(deduplicated.elevationGainM, 620);
  assert.equal(deduplicated.kilojoules, 410);
  const rawSource = summarizeCalendarWeek([
    {
      workouts: [
        {
          status: "completed",
          linked_activity: {
            id: 123,
            total_elevation_gain: 620,
            kilojoules: 410,
          },
        },
      ],
      activities: [],
    },
  ]);
  assert.equal(rawSource.elevationGainM, 620);
  assert.equal(rawSource.kilojoules, 410);
});

test("QA F1: shared production library payload and demo reuse retain private prescription", async () => {
  const form = {
    title: "Private trail repeats",
    sport: "run",
    description: "Easy recoveries",
    objective: "Controlled aerobic progression",
    coach_instructions: "Stop if pain",
    target_metric: "distance",
    planned_if: "0.6",
    visibility: "coach_private",
    planned_duration_min: "25",
    planned_distance_km: 4,
    planned_distance_unit: "km",
    planned_tss: 18,
    structure: [
      {
        type: "work",
        repeat: 3,
        duration_min: 5,
        target_type: "heart_rate",
        target_min: "145",
        target_max: "155",
        target_units: "bpm",
        notes: "Jog between",
      },
    ],
  };
  const payload = libraryWorkoutPayload(form);
  for (const key of [
    "objective",
    "coach_instructions",
    "planned_if",
    "visibility",
    "target_metric",
  ])
    assert.ok(key in payload);
  const saved = storage(),
    s = new DemoStore(saved),
    coach = s.transport("coach", "demo-robin");
  const { workout: template } = await call(
    coach,
    "/api/workout-library",
    "POST",
    payload,
  );
  const { workout: assigned } = await call(
    coach,
    "/api/planned-workouts",
    "POST",
    { library_workout_id: template.id, workout_date: "2026-10-15" },
  );
  for (const key of [
    "objective",
    "coach_instructions",
    "target_metric",
    "visibility",
    "structure",
    "planned_distance_unit",
    "planned_distance_km",
  ])
    assert.deepEqual(assigned[key], payload[key]);
  assert.equal(assigned.planned_if, 0.6);
  assert.equal(assigned.status, "planned");
  assert.equal(s.rows("demo-robin", "athlete").length, 0);
  assert.deepEqual(new DemoStore(saved).state.workouts.at(-1), assigned);
});

test("QA F2: missing/partial actuals never substitute planned TSS; recorded and linked loads count once", async () => {
  const s = new DemoStore(),
    c = s.transport("coach", "demo-robin"),
    a = s.transport("athlete", "demo-robin");
  const { workout } = await call(c, "/api/planned-workouts", "POST", {
    title: "Unknown actual load",
    workout_date: "2026-10-09",
    planned_duration_min: 22,
  });
  assert.ok(workout.planned_tss > 0);
  await call(a, "/api/planned-workouts", "PATCH", {
    id: workout.id,
    status: "completed",
    completed_duration_min: null,
    completed_distance_km: null,
    athlete_rpe: 5,
  });
  assert.deepEqual(summarizeActualTss(s.rows("demo-robin")), {
    tss: 0,
    missingCount: 1,
  });
  await call(a, "/api/planned-workouts", "PATCH", {
    id: workout.id,
    completed_duration_min: 10,
  });
  assert.deepEqual(summarizeActualTss(s.rows("demo-robin")), {
    tss: 0,
    missingCount: 1,
  });
  assert.deepEqual(
    summarizeActualTss(
      [
        { planned_tss: 45, completed_tss: null },
        { completed_tss: "" },
        { completed_tss: 0 },
        { completed_tss: 28 },
        { linked_activity: { tss: 34 }, planned_tss: 99 },
      ],
      [{ tss: 12 }],
    ),
    { tss: 74, missingCount: 2 },
  );
});

test("QA F3: consumed failure emits a state change without saving; reset disarms pending failure", async () => {
  const s = new DemoStore(),
    request = s.transport("coach", "demo-robin"),
    events = [];
  s.subscribe(() => events.push(s.failure));
  s.failNext();
  const before = s.state.revision;
  const body = {
    title: "Retry retained plan",
    workout_date: "2026-10-09",
    client_request_id: "qa-retry",
  };
  assert.equal(
    (await call(request, "/api/planned-workouts", "POST", body)).status,
    503,
  );
  assert.equal(s.state.revision, before);
  assert.equal(s.failure, null);
  assert.deepEqual(events, ["before", null]);
  assert.equal(
    (await call(request, "/api/planned-workouts", "POST", body)).status,
    200,
  );
  assert.equal(
    s.state.workouts.filter((w) => w.title === body.title).length,
    1,
  );
  s.failNext();
  s.reset();
  assert.equal(s.failure, null);
});
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
  assert.equal(
    (
      await call(r, "/api/planned-workouts", "POST", {
        ...body,
        title: "Different details",
      })
    ).status,
    409,
  );
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
