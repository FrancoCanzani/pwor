import { z } from "zod";

export const appUserSchema = z.object({
  id: z.string(),
  email: z.string(),
});

export type AppUser = z.infer<typeof appUserSchema>;

export type AppEnv = {
  Bindings: Env;
  Variables: {
    user: AppUser | null;
  };
};

export type WaitUntilCtx = Pick<ExecutionContext, "waitUntil">;
