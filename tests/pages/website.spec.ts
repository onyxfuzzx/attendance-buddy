import { test, expect } from "@playwright/test";

test("project website, sample interaction, accessible steps, and links work", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("./");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: /Less admin/ })).toBeVisible();
  await page.getByRole("button", { name: "Try a little check-in" }).click();
  await expect(page.locator("#sample-status")).toHaveText("Right on time");
  await expect(page.locator("#sample-count")).toHaveText("9/12");
  await page.getByRole("tab", { name: /Right place/ }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "The server checks your reported GPS coordinates",
  );
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("tab", { name: /One little check/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tabpanel")).toContainText("Check-in recorded");
  await page
    .locator("summary")
    .filter({ hasText: "Can I run the entire app on GitHub Pages?" })
    .click();
  await expect(
    page.getByText("GitHub Pages hosts this project website", { exact: false }),
  ).toBeVisible();
  const brokenAnchors = await page
    .locator('a[href^="#"]')
    .evaluateAll((links) =>
      links
        .map((link) => link.getAttribute("href")!)
        .filter((href) => href !== "#" && !document.getElementById(href.slice(1))),
    );
  expect(brokenAnchors).toEqual([]);
  const githubLinks = await page
    .locator('a[href*="github.com"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")!));
  expect(
    githubLinks.every((url) =>
      url.startsWith("https://github.com/onyxfuzzx/attendance-buddy"),
    ),
  ).toBe(true);
  await page.goto("./");
  await page.screenshot({
    path: "artifacts/website-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("mobile website fits the viewport and navigation works", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "For developers" })
    .click();
  await expect(page.getByRole("button", { name: "Open navigation" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.goto("./");
  await page.screenshot({
    path: "artifacts/website-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("public app demo is usable without auth, Supabase, or API requests", async ({
  page,
}) => {
  const serviceRequests: string[] = [];
  page.on("request", (request) => {
    if (/supabase\.co|\/api\//.test(request.url()))
      serviceRequests.push(new URL(request.url()).pathname);
  });
  await page.goto("./demo/");
  await expect(page.getByRole("heading", { name: /Hey Alex/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Get the open-source app" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Every day, accounted for." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Every day, accounted for." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.screenshot({ path: "website/public/workspace.png", animations: "disabled" });
  await page.getByRole("button", { name: "Alex Morgan Workspace admin" }).click();
  await page.getByRole("button", { name: "Sign out of demo" }).click();
  await expect(page.getByRole("heading", { name: /Less admin/ })).toBeVisible();
  expect(serviceRequests).toEqual([]);
});
