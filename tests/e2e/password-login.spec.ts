import { test, expect, type Page } from '@playwright/test';

async function googleLogin(page: Page, email: string) {
  await page.goto('/');
  const access = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/access' && response.request().method() === 'POST'
  );
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Accedi con Google', exact: true }).click();
  const popup = await popupPromise;
  await expect(popup.locator('.provider-name').first()).toHaveText('Google.com');
  const existing = popup.getByText(email, { exact: true });
  if (await existing.count()) await existing.first().click();
  else {
    await popup.getByRole('button', { name: 'Add new account' }).click();
    await popup.getByLabel('Email').fill(email);
    await popup.getByLabel('Display name').fill('Password test');
    await popup.getByRole('button', { name: 'Sign in with Google.com', exact: true }).click();
  }
  const response = await access;
  expect(response.ok(), await response.text()).toBe(true);
  await expect(
    page.getByRole('heading', { name: 'Chi intervistiamo?', exact: true })
  ).toBeVisible();
  return {
    headers: { Authorization: response.request().headers().authorization },
    uid: (await response.json()).uid
  };
}

async function passwordLogin(page: Page, email: string, password: string) {
  await page.goto('/');
  const form = page.getByRole('form', { name: 'Accesso con email e password' });
  await form.getByLabel('Email', { exact: true }).fill(email);
  await form.getByLabel('Password', { exact: true }).fill(password);
  await form.getByRole('button', { name: 'Accedi con email e password', exact: true }).click();
}

test('superadmin adds, changes and disables a password on the existing Google UID', async ({
  page,
  browser,
  request,
  baseURL
}, info) => {
  const id = `password-existing-${info.project.name}-${Date.now()}`;
  const email = `${id}@example.test`;
  const password = 'Bacaro-test-initial-2026!';
  const replacement = 'Bacaro-test-replacement-2026!';
  const admin = await googleLogin(page, 'editor-desktop@example.test');
  const enable = await request.post('/api/admin/access', {
    headers: admin.headers,
    data: { email, enabled: true }
  });
  expect(enable.ok(), await enable.text()).toBe(true);
  let userContext = await browser.newContext({ baseURL });
  try {
    const member = await googleLogin(await userContext.newPage(), email);
    const created = await request.post('/api/data', {
      headers: admin.headers,
      data: {
        action: 'save',
        changes: [
          {
            collection: 'speakers',
            data: { id, fullName: 'Existing password speaker', inInterviewList: true },
            expectedRevision: null
          }
        ]
      }
    });
    expect(created.ok(), await created.text()).toBe(true);
    expect(
      (
        await request.post('/api/conductor/interests', {
          headers: member.headers,
          data: { speakerId: id, interested: true }
        })
      ).ok()
    ).toBe(true);
    await userContext.close();
    await page.goto('/backoffice/accessi');
    const row = page.locator(`[data-email="${email}"]`);
    const setPassword = async (value: string, label: string) => {
      await row.getByRole('button', { name: label, exact: true }).click();
      const form = row.getByRole('form', { name: `Password per ${email}`, exact: true });
      await form.getByLabel('Nuova password', { exact: true }).fill(value);
      await form.getByRole('button', { name: 'Salva password', exact: true }).click();
      await expect(form).toHaveCount(0);
      await expect(row.getByRole('button', { name: 'Cambia password', exact: true })).toBeEnabled();
    };
    await setPassword(password, 'Imposta password');
    await page.reload();
    await expect(row).toContainText('Accesso con password: Abilitato');
    userContext = await browser.newContext({ baseURL });
    let userPage = await userContext.newPage();
    await passwordLogin(userPage, email, 'Wrong-password-2026!');
    await expect(userPage.getByRole('alert')).toContainText('Email o password non corrette');
    const signedIn = userPage.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/access' && r.request().method() === 'POST'
    );
    await passwordLogin(userPage, email, password);
    const access = await signedIn;
    expect((await access.json()).uid).toBe(member.uid);
    const personal = userPage.getByRole('region', {
      name: 'I miei speaker e i miei assegnati',
      exact: true
    });
    await expect(
      personal.getByRole('heading', { name: 'Existing password speaker' })
    ).toBeVisible();
    const denied = await request.post('/api/admin/password', {
      headers: { Authorization: access.request().headers().authorization },
      data: { email, enabled: true, password: replacement }
    });
    expect(denied.status()).toBe(403);
    await userContext.close();
    await setPassword(replacement, 'Cambia password');
    const oldToken = await request.post('/api/access', {
      headers: { Authorization: access.request().headers().authorization }
    });
    expect([401, 403]).toContain(oldToken.status());
    userContext = await browser.newContext({ baseURL });
    userPage = await userContext.newPage();
    await passwordLogin(userPage, email, password);
    await expect(userPage.getByRole('alert')).toContainText('Email o password non corrette');
    const newAccess = userPage.waitForResponse(
      (r) => new URL(r.url()).pathname === '/api/access' && r.request().method() === 'POST'
    );
    await passwordLogin(userPage, email, replacement);
    const replacementAccess = await newAccess;
    await expect(
      userPage.getByRole('heading', { name: 'Chi intervistiamo?', exact: true })
    ).toBeVisible();
    await userContext.close();
    await row.getByRole('button', { name: 'Disabilita accesso con password', exact: true }).click();
    const disabledToken = await request.get('/api/data/speakers', {
      headers: { Authorization: replacementAccess.request().headers().authorization }
    });
    expect([401, 403]).toContain(disabledToken.status());
    await expect(row.getByRole('button', { name: 'Imposta password', exact: true })).toBeEnabled();
    userContext = await browser.newContext({ baseURL });
    userPage = await userContext.newPage();
    await passwordLogin(userPage, email, replacement);
    await expect(
      userPage.getByRole('heading', { name: 'Accesso non abilitato', exact: true })
    ).toBeVisible();
    await userContext.close();
    userContext = await browser.newContext({ baseURL });
    expect((await googleLogin(await userContext.newPage(), email)).uid).toBe(member.uid);
    await page.screenshot({ path: info.outputPath('password-admin.png'), fullPage: true });
  } finally {
    await userContext.close();
    await request.post('/api/admin/access', {
      headers: admin.headers,
      data: { email, enabled: false }
    });
    const rows = await (await request.get('/api/data/speakers', { headers: admin.headers })).json();
    const speaker = rows.find((row: { id: string }) => row.id === id);
    if (speaker)
      await request.post('/api/data', {
        headers: admin.headers,
        data: {
          action: 'delete',
          changes: [{ collection: 'speakers', data: speaker, expectedRevision: speaker.revision }]
        }
      });
  }
});

test('new manual users can enter but ordinary password signups and revoked members cannot', async ({
  page,
  browser,
  request,
  baseURL
}, info) => {
  const id = `password-new-${info.project.name}-${Date.now()}`;
  const email = `${id}@example.test`;
  const ordinary = `${id}-ordinary@example.test`;
  const changedEmail = `${id}-changed@example.test`;
  const password = 'Bacaro-test-new-member-2026!';
  const admin = await googleLogin(page, 'editor-desktop@example.test');
  for (const address of [email, ordinary, changedEmail])
    expect(
      (
        await request.post('/api/admin/access', {
          headers: admin.headers,
          data: { email: address, enabled: true }
        })
      ).ok()
    ).toBe(true);
  let userContext = await browser.newContext({ baseURL });
  try {
    expect(
      (
        await request.post('/api/admin/password', {
          headers: admin.headers,
          data: { email, enabled: true, password: 'weak' }
        })
      ).status()
    ).toBe(400);
    expect(
      (
        await request.post('/api/admin/password', {
          headers: admin.headers,
          data: { email: `${id}-outside@example.test`, enabled: true, password }
        })
      ).status()
    ).toBe(403);
    const saved = await request.post('/api/admin/password', {
      headers: admin.headers,
      data: { email, enabled: true, password }
    });
    expect(saved.ok(), await saved.text()).toBe(true);
    expect(await saved.json()).toEqual({ saved: true });
    const userPage = await userContext.newPage();
    await passwordLogin(userPage, email, password);
    await expect(
      userPage.getByRole('heading', { name: 'Chi intervistiamo?', exact: true })
    ).toBeVisible();
    await userContext.close();
    expect(
      (
        await request.post('/api/admin/access', {
          headers: admin.headers,
          data: { email, enabled: false }
        })
      ).ok()
    ).toBe(true);
    userContext = await browser.newContext({ baseURL });
    await passwordLogin(await userContext.newPage(), email, password);
    await expect(
      userContext.pages()[0].getByRole('heading', { name: 'Accesso non abilitato', exact: true })
    ).toBeVisible();
    // A password user cannot reuse their grant after changing to another allowed email.
    const authEndpoint = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:`;
    const login = await request.post(authEndpoint + 'signInWithPassword?key=fake-emulator-key', {
      data: { email, password, returnSecureToken: true }
    });
    expect(login.ok(), await login.text()).toBe(true);
    const changed = await request.post(authEndpoint + 'update?key=fake-emulator-key', {
      data: { idToken: (await login.json()).idToken, email: changedEmail, returnSecureToken: true }
    });
    expect(changed.ok(), await changed.text()).toBe(true);
    const changedAccess = await request.post('/api/access', {
      headers: { Authorization: 'Bearer ' + (await changed.json()).idToken }
    });
    expect(changedAccess.status()).toBe(403);
    // Even an otherwise allowlisted email cannot grant itself password access.
    const signup = await request.post(
      `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-emulator-key`,
      { data: { email: ordinary, password, returnSecureToken: true } }
    );
    expect(signup.ok(), await signup.text()).toBe(true);
    const unauthorized = await request.post('/api/access', {
      headers: { Authorization: 'Bearer ' + (await signup.json()).idToken }
    });
    expect(unauthorized.status()).toBe(403);
    expect(
      (
        await request.post('/api/admin/password', {
          headers: admin.headers,
          data: { email, enabled: true, password }
        })
      ).status()
    ).toBe(403);
  } finally {
    await userContext.close();
    for (const address of [email, ordinary, changedEmail])
      await request.post('/api/admin/access', {
        headers: admin.headers,
        data: { email: address, enabled: false }
      });
  }
});
