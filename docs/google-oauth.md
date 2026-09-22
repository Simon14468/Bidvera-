# Google OAuth (Bidvera)

Bidvera uses the existing Super Admin auth settings + encrypted vault for Google credentials. Sessions reuse `createSession` / `bidvera_session` cookies.

## Exact Authorized redirect URI

Register **exactly** this path in Google Cloud Console (Authorized redirect URIs):

| Environment | Redirect URI |
|-------------|--------------|
| Local | `http://localhost:3000/api/auth/google/callback` |
| Production (`getbidvera.com`) | `https://getbidvera.com/api/auth/google/callback` |

Optional override (must match Console):

```bash
GOOGLE_OAUTH_REDIRECT_URI=https://getbidvera.com/api/auth/google/callback
```

If unset, Bidvera builds:

`{NEXT_PUBLIC_APP_URL}/api/auth/google/callback`

## Routes

| Route | Purpose |
|-------|---------|
| `GET /api/auth/google/start` | Sets HttpOnly CSRF/PKCE cookie, redirects to Google |
| `GET /api/auth/google/callback` | Validates state, exchanges code, verifies ID token, creates Bidvera session |

Start accepts optional `?next=/safe/path` (same rules as `safeInternalPath`).

## Google Cloud Console setup

1. Create (or open) an OAuth 2.0 **Web application** client.
2. **Authorized JavaScript origins**
   - Local: `http://localhost:3000`
   - Production: `https://getbidvera.com`
3. **Authorized redirect URIs** — use the table above (callback path only; not `/login`).
4. Copy **Client ID** and **Client Secret**.

## Bidvera configuration

Prefer Super Admin → **Auth**:

1. Enable **Google login**.
2. Paste **Google Client ID**.
3. Paste **Google Client Secret** (stored encrypted in `auth.google.vault`; never returned to the browser).
4. Save.

Optional env fallbacks (same as other OAuth vaults):

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# Optional explicit redirect (must match Console)
# GOOGLE_OAUTH_REDIRECT_URI=https://getbidvera.com/api/auth/google/callback
NEXT_PUBLIC_APP_URL=https://getbidvera.com
```

`NEXT_PUBLIC_APP_URL` must match the public origin used in redirect URIs.

## Scopes

`openid email profile` only.

## Account behavior

- Existing `OAuthIdentity` (google + `sub`) → sign in that user.
- Existing user with the same email → link Google identity (email proven by Google); do not overwrite password.
- New email → create user if registration is enabled (`passwordHash` null, email verified, onboarding at company).
- Registration disabled + unknown email → error.
- Unverified Google email → rejected.
- Incomplete onboarding → redirect to the correct onboarding step.

Microsoft OAuth remains Coming Soon until implemented separately.
