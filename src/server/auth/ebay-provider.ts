/**
 * eBay OAuth 2.0 Provider for NextAuth.js
 *
 * Custom implementation to handle eBay's non-standard OAuth response
 * (eBay returns token_type: "user access token" instead of "Bearer")
 */
import type { OAuthConfig } from "next-auth/providers";

export interface EbayProfile {
  userId: string;
  username: string;
}

export interface EbayProviderConfig {
  clientId: string;
  clientSecret: string;
  environment?: "sandbox" | "production";
  scopes?: string[];
}

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

const DEFAULT_SCOPES = ["https://api.ebay.com/oauth/api_scope"];

export function EbayProvider(config: EbayProviderConfig): OAuthConfig<EbayProfile> {
  const environment = config.environment ?? "sandbox";
  const endpoints = EBAY_ENDPOINTS[environment];
  const scopes = config.scopes ?? DEFAULT_SCOPES;

  return {
    id: "ebay",
    name: "eBay",
    type: "oauth",

    clientId: config.clientId,
    clientSecret: config.clientSecret,

    authorization: {
      url: endpoints.authorization,
      params: {
        scope: scopes.join(" "),
        response_type: "code",
      },
    },

    // Completely custom token endpoint handling
    token: {
      url: endpoints.token,
      conform: async (response: Response) => {
        // Clone the response so we can read it
        const cloned = response.clone();
        const body = await cloned.json();

        // Fix the token_type to be "Bearer" which NextAuth expects
        body.token_type = "Bearer";

        // Return a new response with fixed body
        return new Response(JSON.stringify(body), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      },
    },

    client: {
      token_endpoint_auth_method: "client_secret_basic",
    },

    userinfo: {
      url: endpoints.userinfo,
      async request({ tokens }: { tokens: { access_token?: string } }) {
        try {
          const response = await fetch(endpoints.userinfo, {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            return { userId: "ebay-user", username: "eBay User" };
          }

          return await response.json();
        } catch {
          return { userId: "ebay-user", username: "eBay User" };
        }
      },
    },

    profile(profile: EbayProfile) {
      return {
        id: profile.userId || "ebay-user",
        name: profile.username || "eBay User",
        email: null,
        image: null,
      };
    },

    style: {
      bg: "#0064D2",
      text: "#FFFFFF",
    },
  };
}

/**
 * Refresh an eBay access token
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
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

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
      refresh_token: tokens.refresh_token || refreshToken,
      expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
    };
  } catch (error) {
    console.error("eBay token refresh error:", error);
    return null;
  }
}

export default EbayProvider;
