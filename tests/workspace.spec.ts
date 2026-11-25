import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-25T12:30:00+05:30") });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore the demo workspace" }).click();
  await expect(page.getByRole("heading", { name: /Hey Alex/ })).toBeVisible();
});
test("dashboard, navigation, QR, shifts and reports render without runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.screenshot({
    path: "artifacts/dashboard-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Every day, accounted for." }),
  ).toBeVisible();
  await page.getByLabel("Status", { exact: true }).selectOption("late");
  await expect(page.locator("tbody tr")).not.toHaveCount(0);
  await page.getByRole("button", { name: "Shifts", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The everyday shift", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Locations", exact: true }).click();
  await page.getByRole("button", { name: "Workplace QR" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".qr-image svg")).toHaveCount(1);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your team, by the numbers" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("creates a workplace and assigned shift, creates an invite, and persists changes", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Locations", exact: true }).click();
  await page.getByRole("button", { name: "Add a workplace", exact: true }).click();
  await page.getByLabel("Workplace name").fill("QA workspace");
  await page.getByLabel("Address", { exact: true }).fill("Test Avenue, Bengaluru");
  await page.getByLabel("Latitude", { exact: true }).fill("12.97");
  await page.getByLabel("Longitude", { exact: true }).fill("77.59");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add workplace", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "QA workspace", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Shifts", exact: true }).click();
  await page.getByRole("button", { name: "Create a shift", exact: true }).click();
  await page.getByLabel("Shift name").fill("QA morning");
  await page
    .getByRole("combobox", { name: "Workplace", exact: true })
    .selectOption({ label: "QA workspace" });
  await page.getByRole("checkbox", { name: "Alex Morgan People & Culture" }).check();
  await page.getByRole("button", { name: "Create shift", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "QA morning", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Team", exact: true }).click();
  await page.getByRole("button", { name: "Invite a teammate", exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Taylor Test");
  await page.getByLabel("Work email").fill("taylor@example.test");
  await page
    .getByRole("dialog")
    .getByLabel("Department", { exact: true })
    .fill("Engineering");
  await page.getByRole("button", { name: "Create invitation" }).click();
  await expect(
    page.getByRole("heading", { name: "A place for taylor@example.test" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Got it" }).click();
  await expect(page.getByText("Taylor Test", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Taylor Test", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  await expect(page.getByText("Taylor Test", { exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "Shifts", exact: true }).click();
  const shift = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "QA morning", exact: true }) });
  await shift.getByRole("button", { name: "Pause shift" }).click();
  await expect(shift.getByText("Paused", { exact: true })).toBeVisible();
  await shift.getByRole("button", { name: "Resume shift" }).click();
  await expect(shift.getByText("Recurring shift", { exact: true })).toBeVisible();
});
test("reviews a correction and exports a filtered CSV", async ({ page }) => {
  await page.getByRole("button", { name: /^Requests/ }).click();
  const review = page.getByRole("button", { name: "Review request" });
  await expect(review.first()).toBeVisible();
  await review.first().click();
  await page
    .getByLabel("A note for your teammate")
    .fill("Confirmed with your team lead.");
  await page.getByRole("button", { name: "Save decision" }).click();
  await page.getByRole("button", { name: /^Approved/ }).click();
  await expect(page.locator(".request-item")).toHaveCount(1);
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  await page.getByLabel("Status", { exact: true }).selectOption("late");
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await event;
  expect(download.suggestedFilename()).toBe("attendance-buddy-records.csv");
});
test("demo check-out completes and records attendance", async ({ page }) => {
  await page.getByRole("button", { name: "Let’s check in" }).click();
  await page.getByLabel("Demo workplace").selectOption({ label: "The Studio · HQ" });
  await page.getByRole("button", { name: "That’s my workplace" }).click();
  await page.getByRole("button", { name: "Verify my location" }).click();
  await expect(page.getByText("Demo coordinates ready")).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Confirm check-out" }).click();
  await expect(
    page.getByRole("heading", { name: "You’re all checked out, Alex." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "See my attendance" }).click();
  await expect(page.locator("tbody tr").first()).toContainText("Check-out");
});
test("mobile navigation, layout and dialog remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: /Hey Alex/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({
    path: "artifacts/dashboard-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Team", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Good people. Great team." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Invite a teammate" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("account sign-out and recovery form are reachable", async ({ page }) => {
  await page.getByRole("button", { name: "Alex Morgan Workspace admin" }).click();
  await page.getByRole("button", { name: "Sign out of demo" }).click();
  await expect(page.getByRole("heading", { name: "Hey, welcome back." })).toBeVisible();
  await page.getByRole("button", { name: "Forgot your password?" }).click();
  await expect(
    page.getByRole("heading", { name: "A little help getting back in." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Send a reset link" })).toBeVisible();
  await page.screenshot({
    path: "artifacts/sign-in.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Back to sign in" }).click();
  await page.getByRole("button", { name: "Create an account" }).click();
  await expect(page.getByRole("textbox", { name: "Full name" })).toBeVisible();
});
