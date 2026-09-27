# Microsoft OAuth (Bidvera)

Bidvera uses the existing Super Admin auth settings + encrypted vault for Microsoft Entra credentials. Sessions reuse `createSession` / `bidvera_session` cookies — the same account-linking and session path as Google OAuth.

Do **not** put Client Secrets in the repository, screenshots, logs, or chat.

## Authority

Default tenant is **`common`**.

```
https://login.microsoftonline.com/common
```

Authorize / token endpoints:

```
https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize
https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
```

`MICROSOFT_TENANT_ID` may be `common` (default), `organizations`, `consumers`, or a directory (tenant) GUID. Any other value is ignored and Bidvera falls back to `common`.

## Exact Redirect URI

Register **exactly** this path in Microsoft Entra (App registration → Authentication → Web → Redirect URIs):

| Environment | Redirect URI |
|-------------|--------------|
| Local | `http://localhost:3000/api/auth/microsoft/callback` |
| Production (`getbidvera.com`) | `https://getbidvera.com/api/auth/microsoft/callback` |

Optional override (must match Entra):

```bash
MICROSOFT_OAUTH_REDIRECT_URI=https://getbidvera.com/api/auth/microsoft/callback
```

If unset, Bidvera builds:

`{NEXT_PUBLIC_APP_URL}/api/auth/microsoft/callback`

## Routes

| Route | Purpose |
|-------|---------|
| `GET /api/auth/microsoft/start` | Sets HttpOnly CSRF/PKCE cookie, redirects to Microsoft |
| `GET /api/auth/microsoft/callback` | Validates state, exchanges code, verifies ID token, creates Bidvera session |

Start accepts optional `?next=/safe/path` (same rules as `safeInternalPath`). Post-login redirect matches Google (onboarding step, or `next` / dashboard).

## Microsoft Entra setup

1. Open **Microsoft Entra admin center** → **App registrations** → **New registration**.
2. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts** (`common`) unless you intentionally lock to one tenant.
3. Platform: **Web**.
4. **Redirect URI** — use the table above (callback path only; not `/login`).
5. Create a **Client secret** (Certificates & secrets). Copy it once; Bidvera never displays it again.
6. Copy **Application (client) ID**.

No Graph `User.Read` permission is required. Bidvera uses the ID token only.

## Bidvera configuration

Prefer Super Admin → **Auth**:

1. Enable **Microsoft login**.
2. Paste **Microsoft Client ID**.
3. Paste **Microsoft Client Secret** (stored encrypted in `auth.microsoft.vault`; never returned to the browser).
4. Save.

The login/signup button appears only when Microsoft is enabled **and** Client ID + Client Secret resolve (vault or env). Enabled without credentials hides the button so the flow cannot start broken.

Optional env fallbacks:

```bash
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
# Optional explicit redirect (must match Entra)
# MICROSOFT_OAUTH_REDIRECT_URI=https://getbidvera.com/api/auth/microsoft/callback
NEXT_PUBLIC_APP_URL=https://getbidvera.com
```

`NEXT_PUBLIC_APP_URL` must match the public origin used in redirect URIs.

Never commit these values. Keep secrets in Super Admin vault or the server environment only.

## Scopes

`openid profile email` only. `User.Read` is not requested.

## Account behavior

Same rules as Google:

- Existing `OAuthIdentity` (microsoft + `sub`) → sign in that user.
- Existing user with the same verified email → link Microsoft identity; do not overwrite password.
- New email → create user if registration is enabled (`passwordHash` null, email verified, onboarding at company).
- Registration disabled + unknown email → error.
- Missing / non-email identity, or explicitly unverified email → rejected.
- Incomplete onboarding → redirect to the correct onboarding step.
