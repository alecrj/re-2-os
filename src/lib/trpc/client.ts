import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/trpc/root";

/**
 * A set of typesafe hooks for consuming your API.
 */
export const trpc = createTRPCReact<AppRouter>();
