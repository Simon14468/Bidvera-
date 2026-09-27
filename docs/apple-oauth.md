# Sign in with Apple (Bidvera)

Bidvera uses Super Admin auth settings + an encrypted vault for Apple credentials. Sessions reuse `createSession` / `bidvera_session` cookies — the same account-linking path as Google and Microsoft (`provider = "apple"`).

Do **not** put the `.p8` private key, generated `client_secret` JWT, or any Apple secret in the repository, screenshots, logs, or chat.

## Authority

Authorize / token endpoints (fixed):

```
https://appleid.apple.com/auth/authorize
https://appleid.apple.com/auth/token
```

Bidvera generates Apple’s `client_secret` as a short-lived ES256 JWT (`iss` = Team ID, `sub` = Services ID, `aud` = `https://appleid.apple.com`). The private key never leaves the server.

## Exact Redirect URI

Register **exactly** this path in Apple Developer (Identifiers → Services ID → Sign in with Apple → Return URLs):

| Environment | Redirect URI |
|-------------|--------------|
| Local | `http://localhost:3000/api/auth/apple/callback` |
| Production (`getbidvera.com`) | `https://getbidvera.com/api/auth/apple/callback` |

Optional override (must match Apple):

```bash
APPLE_OAUTH_REDIRECT_URI=https://getbidvera.com/api/auth/apple/callback
```

If unset, Bidvera builds:

`{NEXT_PUBLIC_APP_URL}/api/auth/apple/callback`

## Routes

| Route | Purpose |
|-------|---------|
| `GET /api/auth/apple/start` | Sets HttpOnly CSRF cookie, redirects to Apple |
| `GET` / `POST /api/auth/apple/callback` | Validates state, exchanges code, verifies ID token, creates Bidvera session |

Apple is configured with `response_type=code` and `response_mode=form_post`, so the live callback is a **POST**. GET is supported for the same parameter names.

Start accepts optional `?next=/safe/path` (same rules as `safeInternalPath`). Post-login redirect matches Google/Microsoft.

## Apple Developer setup

1. Apple Developer → **Certificates, Identifiers & Profiles**.
2. Create a **Services ID** (this is `APPLE_CLIENT_ID`, e.g. `com.bidvera.web`).
3. Enable **Sign in with Apple** on that Services ID.
4. Configure domains / return URLs using the table above.
5. Create a **Sign in with Apple** key. Download the `.p8` once.
6. Note **Team ID** and **Key ID**.

No extra Apple libraries are required.

## Bidvera configuration

Prefer Super Admin → **Auth**:

1. Enable **Apple login**.
2. Paste **Apple Client ID** (Services ID), **Team ID**, and **Key ID**.
3. Paste the **.p8 private key** (stored encrypted in `auth.apple.vault`; never returned to the browser).
4. Save.

The login/signup button appears only when Apple is enabled **and** Client ID + Team ID + Key ID + private key resolve (vault or env). Enabled without credentials hides the button.

Optional env fallbacks:

```bash
APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
# Optional explicit redirect (must match Apple)
# APPLE_OAUTH_REDIRECT_URI=https://getbidvera.com/api/auth/apple/callback
NEXT_PUBLIC_APP_URL=https://getbidvera.com
```

`APPLE_PRIVATE_KEY` may be a full PEM or the key body; `\n` escapes are accepted. Never commit these values.

## Scopes

`name email` only. Apple may send the user’s name **only on the first authorization** (`user` form field). Later logins do not require a name. Private relay addresses (`@privaterelay.appleid.com`) are accepted.

## Account behavior

Same rules as Google / Microsoft:

- Existing `OAuthIdentity` (apple + `sub`) → sign in that user.
- Existing user with the same verified email → link Apple identity; do not overwrite password.
- New email → create user if registration is enabled (`passwordHash` null, email verified, onboarding at company).
- Registration disabled + unknown email → error.
- Missing / non-email identity, or explicitly unverified email → rejected.
- Incomplete onboarding → redirect to the correct onboarding step.
