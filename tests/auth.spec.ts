import { test, expect, type Page } from "@playwright/test";

const userId = "30a86482-7f63-409a-9738-ec3f4fb0d602";
const orgId = "42156dab-94f1-494b-bbb9-4a20e62de336";
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "test@example.test",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Alex Test" },
};
const workspace = {
  organization: { id: orgId, name: "Auth Test Team", timezone: "UTC" },
  profile: { id: userId, org_id: orgId, role: "admin" },
  members: [
    {
      id: userId,
      org_id: orgId,
      full_name: "Alex Test",
      email: user.email,
      department: "Testing",
      role: "admin",
      is_active: true,
      created_at: user.created_at,
    },
  ],
  locations: [],
  shifts: [],
  attendance: [],
  corrections: [],
  assignments: [],
  invitations: [],
  audit: [],
};
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
test.beforeEach(async ({ page }) => {
  await page.route("**/auth/v1/**", async (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/token")) {
      const now = Math.floor(Date.now() / 1000);
      const encode = (value: object) =>
        Buffer.from(JSON.stringify(value)).toString("base64url");
      const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, aud: "authenticated", role: "authenticated", exp: now + 3600, iat: now })}.test-signature`;
      await route.fulfill({
        json: {
          access_token: token,
          refresh_token: "test-refresh-token",
          expires_in: 3600,
          token_type: "bearer",
          user,
        },
      });
    } else await route.fulfill({ json: user });
  });
});
async function signIn(page: Page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Email address" }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill("BrowserTestPassword123!");
  await page.getByRole("button", { name: "Sign in to your workspace" }).click();
}
test("successful sign-in stays in loading state until the workspace arrives", async ({
  page,
}) => {
  const requested = deferred(),
    release = deferred();
  await page.route("**/api/workspace", async (route) => {
    requested.resolve();
    await release.promise;
    await route.fulfill({ json: workspace });
  });
  try {
    await signIn(page);
    await requested.promise;
    await expect(page.getByText("Getting your workspace ready…")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "We couldn’t load your workspace" }),
    ).not.toBeVisible();
    release.resolve();
    await expect(page.getByRole("heading", { name: /Hey Alex/ })).toBeVisible();
  } finally {
    release.resolve();
  }
});
test("a real workspace failure is shown and retry loads the workspace", async ({
  page,
}) => {
  let calls = 0;
  const requested = deferred(),
    release = deferred();
  await page.route("**/api/workspace", async (route) => {
    if (++calls === 1)
      await route.fulfill({
        status: 503,
        json: { error: "Workspace temporarily unavailable." },
      });
    else {
      requested.resolve();
      await release.promise;
      await route.fulfill({ json: workspace });
    }
  });
  try {
    await signIn(page);
    await expect(page.getByText("Workspace temporarily unavailable.")).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await requested.promise;
    await expect(page.getByText("Getting your workspace ready…")).toBeVisible();
    release.resolve();
    await expect(page.getByRole("heading", { name: /Hey Alex/ })).toBeVisible();
  } finally {
    release.resolve();
  }
});
test("restoring a saved session waits for workspace data", async ({ page }) => {
  await page.route("**/api/workspace", (route) => route.fulfill({ json: workspace }));
  await signIn(page);
  await expect(page.getByRole("heading", { name: /Hey Alex/ })).toBeVisible();
  await page.unroute("**/api/workspace");
  const requested = deferred(),
    release = deferred();
  await page.route("**/api/workspace", async (route) => {
    requested.resolve();
    await release.promise;
    await route.fulfill({ json: workspace });
  });
  try {
    await page.reload();
    await requested.promise;
    await expect(page.getByText("Getting your workspace ready…")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "We couldn’t load your workspace" }),
    ).not.toBeVisible();
    release.resolve();
    await expect(page.getByRole("heading", { name: /Hey Alex/ })).toBeVisible();
  } finally {
    release.resolve();
  }
});
