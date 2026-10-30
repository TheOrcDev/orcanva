import type { NeonAuth } from "@neon/auth/next/server";

import { getAuth } from "@/lib/auth/server";

type Handlers = ReturnType<NeonAuth["handler"]>;
type Context = RouteContext<"/api/auth/[...path]">;

let handlers: Handlers | undefined;
const getHandlers = (): Handlers => {
  handlers ??= getAuth().handler();
  return handlers;
};

// Proxies the browser's auth calls to Neon Auth and sets the session
// cookies on this origin
export const GET = (request: Request, context: Context) =>
  getHandlers().GET(request, context);
export const POST = (request: Request, context: Context) =>
  getHandlers().POST(request, context);
export const PUT = (request: Request, context: Context) =>
  getHandlers().PUT(request, context);
export const PATCH = (request: Request, context: Context) =>
  getHandlers().PATCH(request, context);
export const DELETE = (request: Request, context: Context) =>
  getHandlers().DELETE(request, context);
