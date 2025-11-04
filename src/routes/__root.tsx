import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { AuthKitProvider } from "@workos/authkit-tanstack-react-start/client";
import { ConvexReactSessionClient } from "convex-helpers/react/sessions";

import appCssUrl from "../app.css?url";
import { SessionId } from "convex-helpers/server/sessions";

const upsertConvexSessionId = createServerFn().handler(() => {
  const existingSessionId = getCookie("convex-session-id");
  if (existingSessionId) return existingSessionId;
  const newSessionId = crypto.randomUUID();
  setCookie("convex-session-id", newSessionId, { httpOnly: false, path: "/" });
  return newSessionId;
});

const getAuth = createServerFn({ method: "GET" }).handler(
  async ({ context }) => {
    const auth = context.auth();
    return { accessToken: auth.accessToken, user: auth.user };
  },
);

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexClient: ConvexReactSessionClient;
  convexQueryClient: ConvexQueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Convex + TanStack Start + WorkOS AuthKit" },
    ],
    links: [
      { rel: "stylesheet", href: appCssUrl },
      { rel: "icon", href: "/convex.svg" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: () => <div>Not Found</div>,
  beforeLoad: async ({ context }) => {
    const { user, accessToken } = await getAuth();

    // Initialize the convex session id
    const currentId = context.convexClient.getSessionId();
    if (!currentId) {
      const convexSessionId = await upsertConvexSessionId();
      context.convexClient.setSessionId(convexSessionId as SessionId);
    }

    // Allow making authenticated queries during SSR
    if (accessToken) {
      context.convexQueryClient.serverHttpClient?.setAuth(accessToken);
    }

    console.log("[beforeLoad] user", user);
  },
});

function RootComponent() {
  return (
    <RootDocument>
      <AuthKitProvider>
        <Outlet />
      </AuthKitProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
