/**
 * NextAuth.js main module for ResellerOS
 *
 * Exports the auth handlers and helper functions.
 */
import NextAuth from "next-auth";
import { authConfig } from "./config";

/**
 * NextAuth.js handlers and helpers
 */
export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth(authConfig);

/**
 * Re-export configs
 */
export { authConfig } from "./config";
export { edgeAuthConfig } from "./edge-config";

/**
 * Re-export eBay provider utilities
 */
export { EbayProvider, refreshEbayToken } from "./ebay-provider";
