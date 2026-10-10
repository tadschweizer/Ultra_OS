import { test, expect } from "@playwright/test";
import fs from "node:fs";
import crypto from "node:crypto";

test("static artifact identity and closed network policy", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");
  expect(policy).toContain("connect-src 'none'");
  const html = fs.readFileSync("dist/index.html", "utf8");
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(
    (m) => m[1],
  );
  expect(assets.length).toBeGreaterThanOrEqual(2);
  for (const asset of assets) {
    const hosted = await request.get(asset);
    expect(hosted.ok()).toBeTruthy();
    const digest = (bytes) =>
      crypto.createHash("sha256").update(bytes).digest("hex");
    expect(digest(await hosted.body())).toBe(
      digest(fs.readFileSync(`dist${asset}`)),
    );
  }
  if (process.env.DEMO_BASE_URL) {
    const document = await request.get("/");
    expect(document.headers()["content-security-policy"]).toContain(
      "connect-src 'none'",
    );
    for (const endpoint of [
      "planned-workouts",
      "coach/messages",
      "message-drafts",
      "admin/demo",
    ]) {
      expect((await request.get(`/api/${endpoint}`)).status()).toBe(404);
    }
  }
});
test.beforeEach(async ({ page }) => {
  page.demoErrors = [];
  page.demoRequests = [];
  page.on("pageerror", (e) => page.demoErrors.push(e.message));
  page.on("request", (r) => page.demoRequests.push(r.url()));
});
test.afterEach(async ({ page }) => {
  expect(page.demoErrors).toEqual([]);
  const origin = new URL(page.url()).origin;
  expect(
    page.demoRequests.filter(
      (url) => url.includes("/api/") || !url.startsWith(origin),
    ),
  ).toEqual([]);
});
const KEY = "threshold-synthetic-v3";
const state = (page) =>
  page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)), KEY);
const navigate = async (
  page,
  view,
  role = "coach",
  id = "demo-robin",
  extra = {},
) => {
  await page.goto(
    `/#${view}?${new URLSearchParams({ mode: role, athlete_id: id, ...extra })}`,
  );
};
const openWorkout = async (page, title) => {
  await page.getByRole("button").filter({ hasText: title }).first().click();
  await expect(
    page.getByRole("dialog", { name: "Workout details" }),
  ).toBeVisible();
};
const dialog = (page) => page.getByRole("dialog", { name: "Workout details" });
for (const width of [1440, 390, 320])
  test(`QA F1/F2: visible library prescription and unknown actual load at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await navigate(page, "calendar");
    await page
      .getByRole("button", { name: "+ Plan workout", exact: true })
      .click();
    await page
      .getByLabel("Workout title", { exact: true })
      .fill("QA progression 3x5");
    await page.getByLabel("Workout date", { exact: true }).fill("2026-10-09");
    await page.getByLabel("Planned duration (min)", { exact: true }).fill("50");
    await page.getByLabel("Planned distance", { exact: true }).fill("8");
    await page
      .getByPlaceholder("Workout objective / purpose")
      .fill("Controlled aerobic progression");
    await page
      .getByPlaceholder("Coach instructions (separate from description)")
      .fill("Stop if pain. Keep recoveries easy.");
    await page.getByPlaceholder("Planned IF").fill("0.72");
    await page.getByRole("button", { name: /Add step/ }).click();
    await page.getByLabel("Reps", { exact: true }).fill("3");
    await page.getByLabel("Min", { exact: true }).fill("5");
    await page
      .getByRole("combobox", { name: "Target", exact: true })
      .selectOption("heart_rate");
    await page.getByPlaceholder("150", { exact: true }).fill("145");
    await page.getByPlaceholder("160", { exact: true }).fill("155");
    await page
      .getByRole("button", { name: "Save to library", exact: true })
      .click();
    await expect(
      page.getByText("Saved to library.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Save workout", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.getByRole("button", { name: /Library \(/ }).click();
    const card = page
      .locator("div.rounded-2xl")
      .filter({
        has: page.getByRole("button", {
          name: "Delete QA progression 3x5 from library",
          exact: true,
        }),
      })
      .last();
    await card.getByLabel("Add library workout on").fill("2026-10-10");
    await card.getByRole("button", { name: "Add", exact: true }).click();
    await expect(
      card.getByText("Added to calendar.", { exact: true }),
    ).toBeVisible();
    const assigned = (await state(page)).workouts.find(
      (w) =>
        w.title === "QA progression 3x5" && w.workout_date === "2026-10-10",
    );
    await navigate(page, "calendar", "athlete", "demo-robin", {
      workout: assigned.id,
    });
    await expect(
      dialog(page).getByText("Objective: Controlled aerobic progression", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      dialog(page).getByText(/Stop if pain\. Keep recoveries easy\./),
    ).toBeVisible();
    await expect(dialog(page).getByText(/IF 0.72/)).toBeVisible();
    await expect(dialog(page).getByText(/145.*155.*bpm/)).toBeVisible();
    await page.screenshot({ path: `test-results/qa-library-${width}.png` });
    await page.getByLabel("Actual duration in minutes").fill("40");
    await page.getByLabel("Actual distance in km").fill("6.4");
    await page
      .getByRole("button", { name: "Mark completed", exact: true })
      .click();
    await expect(dialog(page).getByText(/80% of plan/)).toBeVisible();
    await page.keyboard.press("Escape");
    const week = page.locator('[data-week-key="2026-10-05"]');
    await expect(
      week
        .getByText(
          "Actual TSS unknown for 1 completed session; total includes recorded TSS only.",
          { exact: true },
        )
        .filter({ visible: true }),
    ).toBeVisible();
    if (width < 1024)
      await expect(week.getByText(/Actual 40m.*6.4 km.*TSS 0/)).toBeVisible();
    await navigate(page, "calendar");
    await page
      .getByRole("button", { name: "+ Plan workout", exact: true })
      .click();
    await page
      .getByLabel("Workout title", { exact: true })
      .fill("QA blank actuals");
    await page.getByLabel("Workout date", { exact: true }).fill("2026-10-09");
    await page.getByLabel("Planned duration (min)", { exact: true }).fill("22");
    await page
      .getByRole("button", { name: "Save workout", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeHidden();
    const blank = (await state(page)).workouts.find(
      (w) => w.title === "QA blank actuals",
    );
    expect(blank.planned_tss).toBeGreaterThan(0);
    await navigate(page, "calendar", "athlete", "demo-robin", {
      workout: blank.id,
    });
    await expect(page.getByLabel("Actual duration in minutes")).toHaveValue("");
    await expect(page.getByLabel("Actual distance in km")).toHaveValue("");
    await page.getByLabel("Workout RPE").selectOption("5");
    await page
      .getByRole("button", { name: "Mark completed", exact: true })
      .click();
    await expect(dialog(page).getByText(/Completed.*RPE 5/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      week
        .getByText(
          "Actual TSS unknown for 2 completed sessions; total includes recorded TSS only.",
          { exact: true },
        )
        .filter({ visible: true }),
    ).toBeVisible();
    if (width < 1024)
      await expect(week.getByText(/Actual 40m.*6.4 km.*TSS 0/)).toBeVisible();
    await week.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/qa-load-${width}.png` });
    await openWorkout(page, "QA blank actuals");
    await page
      .getByRole("button", { name: "Undo completion / skip", exact: true })
      .click();
    await expect(dialog(page).getByText("Not completed yet.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      week
        .getByText(
          "Actual TSS unknown for 1 completed session; total includes recorded TSS only.",
          { exact: true },
        )
        .filter({ visible: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      week
        .getByText(
          "Actual TSS unknown for 1 completed session; total includes recorded TSS only.",
          { exact: true },
        )
        .filter({ visible: true }),
    ).toBeVisible();
  });
for (const width of [1440, 390, 320])
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: width === 1440 ? 1000 : 844 } });
    test("full coach / athlete loop, actuals, feedback, adjusted plan, message and reply", async ({
      page,
    }, info) => {
      const errors = [],
        requests = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => requests.push(r.url()));
      await navigate(page, "calendar");
      await page
        .getByRole("button", { name: "+ Plan workout", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Workout editor" }),
      ).toBeVisible();
      await page
        .getByLabel("Workout title", { exact: true })
        .fill("QA trail steady");
      await page.getByLabel("Workout date", { exact: true }).fill("2026-10-09");
      await page
        .getByLabel("Planned duration (min)", { exact: true })
        .fill("50");
      await page.getByLabel("Planned distance", { exact: true }).fill("8");
      await page
        .getByPlaceholder("Workout objective / purpose")
        .fill("Sustainable climbing");
      await page
        .getByPlaceholder("Coach instructions (separate from description)")
        .fill("Back off if legs feel heavy");
      await page.getByPlaceholder("Planned IF").fill("0.72");
      await page
        .getByRole("button", { name: "Add step", exact: false })
        .click();
      const step = page.getByRole("textbox", { name: /Step notes/ });
      await step.fill("Smooth running");
      await page
        .getByRole("button", { name: "Save workout", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Workout editor" }),
      ).toBeHidden();
      const created = (await state(page)).workouts.find(
        (w) => w.title === "QA trail steady",
      );
      expect(created.structure).toHaveLength(1);
      expect(created.objective).toBe("Sustainable climbing");
      expect(created.planned_if).toBe(0.72);
      await page
        .getByRole("button", { name: "+ Plan workout", exact: true })
        .click();
      await page
        .getByLabel("Workout title", { exact: true })
        .fill("QA next easy");
      await page.getByLabel("Workout date", { exact: true }).fill("2026-10-11");
      await page
        .getByLabel("Planned duration (min)", { exact: true })
        .fill("60");
      await page
        .getByRole("button", { name: "Save workout", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Workout editor" }),
      ).toBeHidden();
      const nextPlan = (await state(page)).workouts.find(
        (w) => w.title === "QA next easy",
      );
      await navigate(page, "calendar", "athlete", "demo-robin", {
        workout: created.id,
      });
      await expect(dialog(page)).toBeVisible();
      await page.getByLabel("Actual duration in minutes").fill("35");
      await page.getByLabel("Actual distance in km").fill("5.2");
      await page.getByLabel("Workout RPE").selectOption("8");
      await page.getByLabel("Workout notes").fill("Heavy legs on the climb");
      await page
        .getByRole("button", { name: "Mark completed", exact: true })
        .dblclick();
      await expect(dialog(page).getByText(/70% of plan/)).toBeVisible();
      await page.reload();
      await expect(dialog(page)).toBeVisible();
      await expect(page.getByLabel("Workout RPE")).toHaveValue("8");
      await navigate(page, "calendar", "coach", "demo-robin", {
        workout: created.id,
      });
      await expect(
        dialog(page).getByText("Athlete: Heavy legs on the climb"),
      ).toBeVisible();
      await page
        .getByPlaceholder("Feedback the athlete will see on this workout")
        .fill("Good call stopping early. Easy tomorrow.");
      await page
        .getByRole("button", { name: "Save feedback", exact: true })
        .click();
      await expect(
        dialog(page).getByText("Saved.", { exact: true }),
      ).toBeVisible();
      await navigate(page, "calendar", "coach", "demo-robin", {
        workout: nextPlan.id,
      });
      await page
        .getByRole("button", { name: "Edit workout", exact: true })
        .click();
      await page
        .getByLabel("Planned duration (min)", { exact: true })
        .fill("40");
      await page
        .getByRole("button", { name: "Save workout", exact: true })
        .click();
      await navigate(page, "calendar", "athlete", "demo-robin", {
        workout: created.id,
      });
      await expect(
        dialog(page).getByText(
          "Coach: Good call stopping early. Easy tomorrow.",
        ),
      ).toBeVisible();
      await navigate(page, "calendar", "athlete", "demo-robin", {
        workout: nextPlan.id,
      });
      await expect(dialog(page).getByText(/Planned 40m/)).toBeVisible();
      await navigate(page, "messages", "coach");
      await page
        .getByLabel("Your message", { exact: true })
        .fill("Next plan reduced. How do your legs feel?");
      await expect(
        page.getByRole("button", { name: "Send", exact: true }),
      ).toBeEnabled();
      await page.getByRole("button", { name: "Send", exact: true }).dblclick();
      await expect(
        page.getByLabel("Your message", { exact: true }),
      ).toHaveValue("");
      let s = await state(page);
      expect(
        s.messages.filter(
          (m) => m.message_body === "Next plan reduced. How do your legs feel?",
        ),
      ).toHaveLength(1);
      await navigate(page, "overview", "athlete");
      await expect(
        page.getByRole("button", { name: "Messages (1 unread)", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Messages (1 unread)", exact: true })
        .click();
      await expect(
        page
          .getByText("Next plan reduced. How do your legs feel?", {
            exact: true,
          })
          .last(),
      ).toBeVisible();
      await page
        .getByLabel("Your message", { exact: true })
        .fill("Much better. I see the shorter plan.");
      await page.getByRole("button", { name: "Send", exact: true }).click();
      await expect(
        page.getByLabel("Your message", { exact: true }),
      ).toHaveValue("");
      s = await state(page);
      expect(s.messages.at(-1).sender_role).toBe("athlete");
      expect(
        s.messages.find((m) => m.message_body.startsWith("Next plan")).read_at,
      ).toBeTruthy();
      await navigate(page, "overview", "coach");
      await expect(
        page.getByRole("button", { name: "Messages (2 unread)", exact: true }),
      ).toBeVisible();
      await navigate(page, "messages", "coach");
      await expect(
        page
          .getByText("Much better. I see the shorter plan.", { exact: true })
          .last(),
      ).toBeVisible();
      expect(errors).toEqual([]);
      expect(
        requests.filter(
          (u) =>
            u.includes("/api/") || !u.startsWith(new URL(page.url()).origin),
        ),
      ).toEqual([]);
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.activeElement?.blur();
      });
      await page.screenshot({
        path: `test-results/loop-${width}.png`,
        fullPage: true,
      });
      await info.attach("loop screenshot", {
        path: `test-results/loop-${width}.png`,
        contentType: "image/png",
      });
    });
    test("draft persistence, role and recipient isolation, failed save retry, reset cancel/confirm", async ({
      page,
    }) => {
      await navigate(page, "messages");
      await page
        .getByLabel("Your message", { exact: true })
        .fill("Draft survives reload");
      await expect(
        page.getByText("Draft saved", { exact: true }),
      ).toBeVisible();
      await page.reload();
      await expect(
        page.getByLabel("Your message", { exact: true }),
      ).toHaveValue("Draft survives reload");
      await navigate(page, "messages", "athlete");
      await expect(
        page.getByLabel("Your message", { exact: true }),
      ).toHaveValue("");
      await navigate(page, "messages", "coach", "demo-jules");
      await expect(
        page.getByLabel("Your message", { exact: true }),
      ).toHaveValue("");
      await navigate(page, "limits");
      await page.getByRole("button", { name: "Fail next save" }).click();
      await navigate(page, "calendar");
      await page
        .getByRole("button", { name: "+ Plan workout", exact: true })
        .click();
      await page.getByLabel("Workout title", { exact: true }).fill("Retry run");
      await page
        .getByRole("button", { name: "Save workout", exact: true })
        .click();
      await expect(page.getByText(/Simulated save failure/)).toBeVisible();
      await expect(
        page.getByText(
          "The next local save will fail once. Retry it to complete the simulation.",
          { exact: true },
        ),
      ).toHaveCount(0);
      await expect(
        page.getByLabel("Workout title", { exact: true }),
      ).toHaveValue("Retry run");
      await page
        .getByRole("button", { name: "Save workout", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Workout editor" }),
      ).toBeHidden();
      await expect(page.getByText(/Simulated save failure/)).toHaveCount(0);
      await navigate(page, "overview");
      await expect(
        page.getByText(
          "The next local save will fail once. Retry it to complete the simulation.",
          { exact: true },
        ),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Reset demo", exact: true })
        .click();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      expect(
        (await state(page)).workouts.some((w) => w.title === "Retry run"),
      ).toBe(true);
      await page
        .getByRole("button", { name: "Reset demo", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Restore seed", exact: true })
        .click();
      expect((await state(page)).workouts).toHaveLength(15);
      expect((await state(page)).drafts).toEqual({});
    });
    test("check-in propagation, empty and missing states, mobile navigation and browser history", async ({
      page,
    }) => {
      await navigate(page, "overview", "athlete");
      await expect(
        page.getByText("No sessions yet. Plan a workout from the calendar."),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Daily check-in", exact: true })
        .click();
      await page.getByLabel("Sleep (hours)").fill("5");
      await page.getByLabel("energy", { exact: true }).selectOption("1");
      await page.getByLabel("soreness", { exact: true }).selectOption("5");
      await page.getByLabel("Check-in context").fill("Very tired today");
      await page
        .getByRole("button", { name: "Save check-in", exact: true })
        .click();
      await expect(page.getByTestId("checkin-summary")).toContainText(
        /sleep 5h.*energy 1\/5.*soreness 5\/5/,
      );
      await page.getByLabel("Demo role", { exact: true }).selectOption("coach");
      await expect(
        page.getByText(/Low energy or elevated soreness/).last(),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Training Calendar", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Training Calendar", exact: true }),
      ).toBeVisible();
      await page.goBack();
      await expect(
        page.getByRole("heading", { name: "Command Center", exact: true }),
      ).toBeVisible();
      await page.reload();
      await expect(page.getByTestId("checkin-summary")).toContainText(
        "Very tired today",
      );
      for (const view of [
        "overview",
        "calendar",
        "messages",
        "checkin",
        "limits",
      ]) {
        await navigate(page, view, "coach", "demo-jules");
        await expect(page.getByText("Demo screen could not load")).toHaveCount(
          0,
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    });
  });
for (const width of [1440, 390, 320])
  test(`library, reschedule, private draft, copy/duplicate and keyboard at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await navigate(page, "calendar");
    await page
      .getByRole("button", { name: "+ Plan workout", exact: true })
      .click();
    await page
      .getByLabel("Workout title", { exact: true })
      .fill("Structured private hills");
    await page
      .getByPlaceholder("Workout objective / purpose")
      .fill("Private objective");
    await page
      .getByPlaceholder("Coach instructions (separate from description)")
      .fill("Private instruction");
    await page.getByPlaceholder("Planned IF").fill("0.6");
    await page
      .getByLabel("Primary target", { exact: true })
      .selectOption("distance");
    await page.getByLabel("Workout date", { exact: true }).fill("2026-10-09");
    await page.getByLabel("Workout visibility").selectOption("coach_private");
    await page.getByRole("button", { name: /Add step/ }).click();
    await page.getByLabel("Reps", { exact: true }).fill("4");
    await page.getByLabel("Min", { exact: true }).fill("5");
    await page
      .getByRole("combobox", { name: "Target", exact: true })
      .selectOption("heart_rate");
    await page.getByPlaceholder("150", { exact: true }).fill("145");
    await page.getByPlaceholder("160", { exact: true }).fill("155");
    await page
      .getByRole("button", { name: "Save to library", exact: true })
      .dblclick();
    await expect(
      page.getByText("Saved to library.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Save workout", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Workout editor" }),
    ).toBeHidden();
    let s = await state(page);
    const original = s.workouts.find(
      (w) => w.title === "Structured private hills",
    );
    expect(original.structure[0]).toMatchObject({
      repeat: 4,
      duration_min: 5,
      target_type: "heart_rate",
      target_min: "145",
      target_max: "155",
      target_units: "bpm",
    });
    expect(
      s.library.filter((w) => w.name === "Structured private hills"),
    ).toHaveLength(1);
    await navigate(page, "overview", "athlete");
    await expect(
      page.getByText("Structured private hills", { exact: true }),
    ).toHaveCount(0);
    await navigate(page, "calendar", "coach", "demo-robin", {
      workout: original.id,
    });
    await page
      .getByRole("button", { name: "Edit workout", exact: true })
      .click();
    await page.getByLabel("Workout date", { exact: true }).fill("2026-10-10");
    await page
      .getByRole("button", { name: "Save workout", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Workout editor" }),
    ).toBeHidden();
    expect(
      (await state(page)).workouts.find((w) => w.id === original.id)
        .workout_date,
    ).toBe("2026-10-10");
    await page.getByRole("button", { name: /Library \(/ }).click();
    const card = page
      .locator("div.rounded-2xl")
      .filter({
        has: page.getByRole("button", {
          name: "Delete Structured private hills from library",
          exact: true,
        }),
      })
      .last();
    await card.getByLabel("Add library workout on").fill("2026-10-11");
    await card.getByRole("button", { name: "Add", exact: true }).click();
    await expect(
      card.getByText("Added to calendar.", { exact: true }),
    ).toBeVisible();
    s = await state(page);
    expect(
      s.workouts.filter((w) => w.title === "Structured private hills"),
    ).toHaveLength(2);
    const assigned = s.workouts.find(
      (w) =>
        w.title === "Structured private hills" &&
        w.workout_date === "2026-10-11",
    );
    expect(assigned).toMatchObject({
      objective: "Private objective",
      coach_instructions: "Private instruction",
      planned_if: 0.6,
      target_metric: "distance",
      visibility: "coach_private",
    });
    expect(assigned.structure).toEqual(original.structure);
    await navigate(page, "calendar", "coach", "demo-robin", {
      workout: assigned.id,
    });
    await page
      .getByRole("button", { name: "Edit workout", exact: true })
      .click();
    await expect(
      page.getByPlaceholder("Workout objective / purpose"),
    ).toHaveValue("Private objective");
    await expect(
      page.getByPlaceholder("Coach instructions (separate from description)"),
    ).toHaveValue("Private instruction");
    await expect(page.getByPlaceholder("Planned IF")).toHaveValue("0.6");
    await expect(
      page.getByLabel("Primary target", { exact: true }),
    ).toHaveValue("distance");
    await expect(page.getByLabel("Workout visibility")).toHaveValue(
      "coach_private",
    );
    await page.keyboard.press("Escape");
    await navigate(page, "calendar", "athlete");
    await expect(
      page.getByText("Structured private hills", { exact: true }),
    ).toHaveCount(0);
    await navigate(page, "calendar");
    const copy = page
      .getByTitle("Copy this week's workouts to next week")
      .filter({ visible: true })
      .first();
    await copy.dblclick();
    expect(
      (await state(page)).workouts.filter((w) => w.athlete_id === "demo-robin"),
    ).toHaveLength(4);
    await navigate(page, "overview");
    await page
      .getByRole("button", {
        name: "Duplicate Structured private hills",
        exact: true,
      })
      .first()
      .dblclick();
    expect(
      (await state(page)).workouts.filter((w) => w.athlete_id === "demo-robin"),
    ).toHaveLength(5);
    await page.getByRole("button", { name: "Reset demo", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(
      page.getByRole("button", { name: "Restore seed", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Reset demo", exact: true }),
    ).toBeFocused();
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.activeElement?.blur();
    });
    await page.screenshot({
      path: `test-results/overview-${width}.png`,
      fullPage: true,
    });
  });
test("session thread identities, activity detail and matching correction, no double count", async ({
  page,
}) => {
  await navigate(page, "calendar", "athlete", "demo-river", {
    workout: "seed-0-3",
  });
  await expect(dialog(page)).toBeVisible();
  await page
    .getByLabel("Choose an imported activity")
    .selectOption("demo-activity");
  await page.getByRole("button", { name: "Confirm activity match" }).click();
  await expect(
    dialog(page).getByText("Confirmed imported activity."),
  ).toBeVisible();
  await page
    .getByLabel("Write a comment", { exact: true })
    .fill("Trail was steeper than expected");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    dialog(page).getByText("Trail was steeper than expected", { exact: true }),
  ).toBeVisible();
  await navigate(page, "calendar", "coach", "demo-river", {
    workout: "seed-0-3",
  });
  await expect(
    dialog(page).getByText("River Lane", { exact: true }),
  ).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export JSON", exact: true }).click();
  const download = await downloading;
  const exported = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
  expect(exported.demo).toBe(true);
  expect(exported.workout.id).toBe("seed-0-3");
  await navigate(page, "calendar", "athlete", "demo-river", {
    workout: "seed-0-3",
  });
  await page
    .getByRole("button", { name: "Unlink activity", exact: true })
    .click();
  await expect(dialog(page).getByText("Not completed yet.")).toBeVisible();
  await navigate(page, "calendar", "athlete", "demo-river", {
    activity: "demo-activity",
  });
  await expect(
    page
      .getByRole("dialog", { name: "Workout details" })
      .getByText("Ridge exploration", { exact: true }),
  ).toBeVisible();
  await expect(dialog(page).getByText("620 m", { exact: true })).toBeVisible();
});
test("completion correction, skip/undo, cancel, missing actuals and independent browser sessions", async ({
  page,
  context,
}) => {
  await navigate(page, "calendar", "athlete", "demo-jules", {
    workout: "seed-1-0",
  });
  await expect(dialog(page)).toBeVisible();
  await expect(page.getByLabel("Actual distance in km")).toHaveValue("");
  await page.getByLabel("Actual duration in minutes").fill("20");
  await page
    .getByRole("button", { name: "Save correction", exact: true })
    .click();
  await expect(dialog(page).getByText(/44% of plan/)).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(
    dialog(page).getByText("Skipped", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Undo completion / skip", exact: true })
    .click();
  await expect(dialog(page).getByText("Not completed yet.")).toBeVisible();
  await navigate(page, "calendar", "coach", "demo-jules");
  const before = (await state(page)).workouts.length;
  await page
    .getByRole("button", { name: "+ Plan workout", exact: true })
    .click();
  await page
    .getByLabel("Workout title", { exact: true })
    .fill("Cancelled workout");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  expect((await state(page)).workouts).toHaveLength(before);
  await page.reload();
  expect(
    (await state(page)).workouts.some((w) => w.title === "Cancelled workout"),
  ).toBe(false);
  const second = await context.newPage();
  await navigate(second, "overview", "coach", "demo-jules");
  await expect(second.getByText(/45 min planned.*42 min actual/)).toBeVisible();
  await second.close();
});
