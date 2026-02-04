import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { type Context } from "./context";

/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Export reusable router and procedure helpers
 */
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * Public (unauthenticated) procedure
 * Can be used by anyone without logging in
 */
export const publicProcedure = t.procedure;

/**
 * Middleware to enforce authentication
 */
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      // Override context with non-null session and user
      session: ctx.session,
      user: ctx.user,
    },
  });
});

/**
 * Protected (authenticated) procedure
 * Requires user to be logged in
 */
export const protectedProcedure = t.procedure.use(enforceAuth);

/**
 * Alias for backward compatibility
 */
export const authedProcedure = protectedProcedure;
