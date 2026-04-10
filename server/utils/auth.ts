import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, genericOAuth } from "better-auth/plugins";
import { sso } from "@better-auth/sso";
import { eq } from "drizzle-orm";
import { ac, owner, admin, member } from "~~/shared/permissions";
import { sendOrgInvitationEmail } from "./email";
import * as schema from "../database/schema";

type Auth = ReturnType<typeof betterAuth>;
let _auth: Auth | undefined;

/**
 * Runtime cache of OIDC endpoint origins discovered from IdP discovery documents.
 *
 * Populated by `prefetchOidcEndpointOrigins()` before provider registration so
 * that better-auth's trusted-origins check passes for IdPs whose token/userinfo
 * endpoints live on a different domain than the issuer (e.g. Google).
 */
const discoveredIdpOrigins = new Set<string>();

/**
 * Fetch an OIDC discovery document and cache every endpoint origin so
 * better-auth trusts them during provider registration.
 *
 * Must be called **before** `auth.api.registerSSOProvider()` so the
 * origins are available when better-auth validates discovery endpoints.
 */
export async function prefetchOidcEndpointOrigins(issuerUrl: string): Promise<void> {
  const discoveryUrl = issuerUrl.replace(/\/+$/, "") + "/.well-known/openid-configuration";
  const res = await $fetch<Record<string, unknown>>(discoveryUrl, {
    timeout: 10_000,
  });

  // Extract origins from all *_endpoint fields in the discovery document
  const endpointKeys = [
    "authorization_endpoint",
    "token_endpoint",
    "userinfo_endpoint",
    "revocation_endpoint",
    "introspection_endpoint",
    "end_session_endpoint",
    "jwks_uri",
  ];
  for (const key of endpointKeys) {
    const value = res[key];
    if (typeof value === "string") {
      try {
        discoveredIdpOrigins.add(new URL(value).origin);
      } catch {
        // Skip malformed URLs
      }
    }
  }
}

/**
 * Resolve trusted origins for CSRF checks and OIDC discovery.
 *
 * Combines:
 *  1. App origins (base URL, configured origins, dev defaults)
 *  2. Origins auto-discovered from OIDC discovery documents
 *  3. Already-registered SSO provider issuers from the database
 *
 * For IdPs that cannot be auto-discovered, add their origin to the
 * BETTER_AUTH_TRUSTED_ORIGINS environment variable.
 */
function resolveTrustedOrigins(baseUrl: string): (request?: Request) => Promise<string[]> {
  const configuredOrigins = env.BETTER_AUTH_TRUSTED_ORIGINS;
  const baseOrigin = new URL(baseUrl);
  const isLocalBase =
    baseOrigin.hostname === "localhost" || baseOrigin.hostname === "127.0.0.1";
  const defaultDevOrigins =
    import.meta.dev || isLocalBase
      ? [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:3002",
          "http://localhost:3333",
          "http://127.0.0.1:3000",
          "http://127.0.0.1:3001",
          "http://127.0.0.1:3002",
          "http://127.0.0.1:3333",
        ]
      : [];

  const staticOrigins = Array.from(
    new Set([baseOrigin.origin, ...configuredOrigins, ...defaultDevOrigins]),
  );

  return async () => {
    const allOrigins = [...staticOrigins, ...discoveredIdpOrigins];

    // Load already-registered SSO provider issuers from the database
    try {
      const providers = await db
        .select({ issuer: schema.ssoProvider.issuer })
        .from(schema.ssoProvider);

      for (const p of providers) {
        try { allOrigins.push(new URL(p.issuer).origin); } catch {}
      }
    } catch {
      // Table may not exist yet (pre-migration)
    }

    return Array.from(new Set(allOrigins));
  };
}

function resolveBetterAuthUrl(): string {
  const explicitUrl = env.BETTER_AUTH_URL?.trim();
  const railwayDomain = env.RAILWAY_PUBLIC_DOMAIN?.trim();

  // Explicit URL always wins (custom domain, local dev, etc.)
  if (explicitUrl) {
    return explicitUrl;
  }

  // Derive from Railway's auto-injected public domain (works for all environments)
  if (railwayDomain) {
    // Railway sets this as bare domain (e.g. "app.up.railway.app"), never with protocol
    const domain = railwayDomain.replace(/^https?:\/\//, "");
    const url = `https://${domain}`;
    console.info(
      `[Reqcore] Using Railway public-domain BETTER_AUTH_URL: ${url}`,
    );
    return url;
  }

  throw new Error(
    "BETTER_AUTH_URL is required. Either set it explicitly or generate a public domain in Railway.\n" +
      "Railway users: go to Settings → Networking → Generate Domain, then redeploy.",
  );
}

/**
 * Lazily create the Better Auth instance on first access.
 * Prevents build-time prerendering from crashing when auth env vars
 * aren't available (Railway injects env vars only at deploy time).
 */
function getAuth(): Auth {
  if (!_auth) {
    const baseURL = resolveBetterAuthUrl();

    _auth = betterAuth({
      baseURL,
      trustedOrigins: resolveTrustedOrigins(baseURL),
      database: drizzleAdapter(db, {
        provider: "pg",
        schema,
      }),
      secret: env.BETTER_AUTH_SECRET,
      emailAndPassword: {
        enabled: true,
      },
      plugins: [
        organization({
          // ── Access Control ──────────────────────────────────────
          // Declarative RBAC — permissions defined once in shared/permissions.ts,
          // enforced on every API route via requirePermission().
          ac,
          roles: {
            owner,
            admin,
            member,
          },

          // ── Invitation Email ────────────────────────────────────
          // Required for Better Auth's built-in invitation flow.
          // Constructs a link the invitee clicks to accept.
          // Uses Resend when RESEND_API_KEY is configured, otherwise logs to console.
          async sendInvitationEmail(data) {
            const inviteLink = `${baseURL}/auth/accept-invitation/${data.id}`;
            await sendOrgInvitationEmail(data, inviteLink);
          },

          // ── Security Hardening ──────────────────────────────────
          // Cancel stale invitations when a new one is sent to the same email.
          cancelPendingInvitationsOnReInvite: true,
          // 48 hours (default) — explicitly stated for auditability.
          invitationExpiresIn: 48 * 60 * 60,
        }),

        // ── OIDC SSO (Keycloak, Authentik, Authelia, Okta, Azure AD, etc.) ──
        // Activated only when all three OIDC env vars are set.
        // Uses better-auth's genericOAuth plugin with OIDC discovery.
        ...(env.OIDC_CLIENT_ID &&
        env.OIDC_CLIENT_SECRET &&
        env.OIDC_DISCOVERY_URL
          ? [
              genericOAuth({
                config: [
                  {
                    providerId: "oidc",
                    clientId: env.OIDC_CLIENT_ID,
                    clientSecret: env.OIDC_CLIENT_SECRET,
                    discoveryUrl: env.OIDC_DISCOVERY_URL,
                    scopes: ["openid", "email", "profile"],
                    pkce: true,
                    requireIssuerValidation: true,
                    async mapProfileToUser(profile) {
                      if (!profile.email) {
                        throw new Error(
                          "Email is required but was not provided by the identity provider. Ensure the 'email' scope is granted and the user has a verified email.",
                        );
                      }
                      return {
                        name:
                          profile.name ||
                          [profile.given_name, profile.family_name]
                            .filter(Boolean)
                            .join(" ") ||
                          profile.preferred_username ||
                          profile.email,
                        email: profile.email,
                        image: profile.picture,
                      };
                    },
                  },
                ],
              }),
            ]
          : []),

        // ── Enterprise SSO (per-organization OIDC, cloud-hosted) ─────────
        // Each organization can register their own Identity Provider (Okta,
        // Azure AD, Google Workspace, etc.). Users are auto-provisioned into
        // the linked organization on first SSO login.
        sso({
          // Auto-provision SSO users into the linked organization
          organizationProvisioning: {
            disabled: false,
            defaultRole: "member",
          },
          // Run provisioning on every login to keep profile data in sync
          provisionUserOnEveryLogin: true,
          provisionUser: async ({ user, userInfo }) => {
            // Sync name/image from IdP on each login
            if (userInfo.name || userInfo.image) {
              await db
                .update(schema.user)
                .set({
                  ...(userInfo.name ? { name: userInfo.name } : {}),
                  ...(userInfo.image ? { image: userInfo.image } : {}),
                  updatedAt: new Date(),
                })
                .where(eq(schema.user.id, user.id));
            }
          },
        }),
      ],
    }) as unknown as Auth;
  }
  return _auth!;
}

/**
 * Lazily-initialized Better Auth instance.
 * The auth configuration is created on first property access — not at import time.
 * This prevents build-time prerendering from failing when BETTER_AUTH_SECRET
 * and BETTER_AUTH_URL aren't available.
 */
export const auth: Auth = new Proxy({} as Auth, {
  get(_, prop) {
    const instance = getAuth();
    const value = (instance as Record<string | symbol, unknown>)[prop];
    return typeof value === "function"
      ? (value as Function).bind(instance)
      : value;
  },
});
