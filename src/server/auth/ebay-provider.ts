/**
 * eBay OAuth 2.0 Provider for NextAuth.js
 *
 * Implements the eBay User Access Token flow:
 * https://developer.ebay.com/api-docs/static/oauth-authorization-code-grant.html
 */
import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers";

/**
 * TokenSet type for OAuth tokens
 */
interface TokenSet {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  token_type?: string;
  id_token?: string;
  scope?: string;
}

export interface EbayProfile {
  userId: string;
  username: string;
}

export interface EbayProviderConfig extends OAuthUserConfig<EbayProfile> {
  /**
   * eBay environment: sandbox or production
   */
  environment?: "sandbox" | "production";
  /**
   * OAuth scopes to request
   * @default ["https://api.ebay.com/oauth/api_scope"]
   */
  scopes?: string[];
}

/**
 * eBay OAuth endpoints by environment
 */
const EBAY_ENDPOINTS = {
  sandbox: {
    authorization: "https://auth.sandbox.ebay.com/oauth2/authorize",
    token: "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
    userinfo: "https://apiz.sandbox.ebay.com/commerce/identity/v1/user/",
  },
  production: {
    authorization: "https://auth.ebay.com/oauth2/authorize",
    token: "https://api.ebay.com/identity/v1/oauth2/token",
    userinfo: "https://apiz.ebay.com/commerce/identity/v1/user/",
  },
};

/**
 * Default scopes for eBay OAuth
 * https://developer.ebay.com/api-docs/static/oauth-scopes.html
 */
const DEFAULT_SCOPES = [
  "https://api.ebay.com/oauth/api_scope", // Basic access
];

/**
 * Create eBay OAuth provider for NextAuth.js
 */
export function EbayProvider(
  config: EbayProviderConfig
): OAuthConfig<EbayProfile> {
  const environment = config.environment ?? "sandbox";
  const endpoints = EBAY_ENDPOINTS[environment];
  const scopes = config.scopes ?? DEFAULT_SCOPES;

  return {
    id: "ebay",
    name: "eBay",
    type: "oauth",

    // eBay requires Basic auth for token exchange
    client: {
      token_endpoint_auth_method: "client_secret_basic",
    },

    authorization: {
      url: endpoints.authorization,
      params: {
        scope: scopes.join(" "),
        response_type: "code",
      },
    },

    token: {
      url: endpoints.token,
      async request(context: {
        client: unknown;
        params: Record<string, unknown>;
        checks: unknown;
        provider: { callbackUrl: string };
      }): Promise<{ tokens: TokenSet }> {
        const { params, provider } = context;
        // eBay requires application/x-www-form-urlencoded
        // and Basic auth header
        const credentials = Buffer.from(
          `${config.clientId}:${config.clientSecret}`
        ).toString("base64");

        const response = await fetch(endpoints.token, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${credentials}`,
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: params.code as string,
            redirect_uri: provider.callbackUrl,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`eBay token error: ${error}`);
        }

        const tokens = await response.json();

        return {
          tokens: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
            // eBay returns "User Access Token" but NextAuth expects "Bearer"
            token_type: "Bearer",
          },
        };
      },
    },

    userinfo: {
      url: endpoints.userinfo,
      async request(context: {
        tokens: TokenSet;
        provider: unknown;
      }): Promise<EbayProfile> {
        const { tokens } = context;
        // eBay user info endpoint
        const response = await fetch(endpoints.userinfo, {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          // If we can't get user info, create a minimal profile
          // This can happen if the scope doesn't include identity
          return {
            userId: "unknown",
            username: "eBay User",
          };
        }

        const profile = await response.json();
        return profile;
      },
    },

    profile(profile: EbayProfile) {
      return {
        id: profile.userId || "ebay-user",
        name: profile.username || "eBay User",
        email: null, // eBay doesn't provide email in basic scope
        image: null,
      };
    },

    style: {
      bg: "#0064D2",
      text: "#FFFFFF",
    },

    options: config,
  };
}

/**
 * Refresh an eBay access token
 *
 * @param refreshToken - The refresh token to use
 * @param clientId - eBay client ID
 * @param clientSecret - eBay client secret
 * @param environment - sandbox or production
 * @returns New token data or null if refresh failed
 */
export async function refreshEbayToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  environment: "sandbox" | "production" = "sandbox"
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: number;
} | null> {
  const endpoints = EBAY_ENDPOINTS[environment];
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  try {
    const response = await fetch(endpoints.token, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      console.error("eBay token refresh failed:", await response.text());
      return null;
    }

    const tokens = await response.json();

    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || refreshToken, // eBay may not return new refresh token
      expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
    };
  } catch (error) {
    console.error("eBay token refresh error:", error);
    return null;
  }
}

export default EbayProvider;
