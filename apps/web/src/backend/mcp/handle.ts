import { createMcpHandler } from "agents/mcp/server";

import { authenticateMcp } from "./auth";
import { createPworMcpServer } from "./server";

const CORS = {
  origin: "*",
  methods: "GET, POST, DELETE, OPTIONS",
  headers: "Authorization, Content-Type, mcp-session-id, x-api-key",
};

function mcpHostnames(env: Env): string[] {
  const hosts = new Set(["localhost", "127.0.0.1"]);
  try {
    hosts.add(new URL(env.BETTER_AUTH_URL).hostname);
  } catch {
    // BETTER_AUTH_URL is required in wrangler; ignore parse failures.
  }
  return [...hosts];
}

function unauthorized(): Response {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Bearer realm="pwor", error="invalid_token"',
      "Access-Control-Allow-Origin": CORS.origin,
      "Access-Control-Allow-Headers": CORS.headers,
      "Access-Control-Allow-Methods": CORS.methods,
    },
  });
}

function handlerOptions(env: Env) {
  return {
    route: "/mcp",
    corsOptions: CORS,
    allowedHostnames: mcpHostnames(env),
    allowedOriginHostnames: mcpHostnames(env),
  };
}

export async function handleMcp(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": CORS.origin,
        "Access-Control-Allow-Headers": CORS.headers,
        "Access-Control-Allow-Methods": CORS.methods,
      },
    });
  }

  const user = await authenticateMcp(env, request);
  if (!user) return unauthorized();

  return createMcpHandler(() => createPworMcpServer({ env, user, ctx }), {
    ...handlerOptions(env),
    authContext: { props: { userId: user.id } },
  })(request, env, ctx);
}
