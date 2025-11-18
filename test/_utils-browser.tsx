import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { ConvexReactSessionClient } from "convex-helpers/react/sessions";
import { it, inject } from "vitest";
import { AuthKitProvider } from "@workos/authkit-tanstack-react-start/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { ConvexProvider } from "convex/react";
import { AnyRootRoute } from "@tanstack/react-router";
import { SessionId } from "convex-helpers/server/sessions";

export const test = it.extend<{
  convexBackendUrl: string;
  convexClient: ConvexReactSessionClient;
  convexQueryClient: ConvexQueryClient;
  queryClient: QueryClient;
  rootRoute: AnyRootRoute;
}>({
  convexBackendUrl: async ({}, use) => {
    const convexBackendUrl = inject("convexBackendUrl");
    await use(convexBackendUrl);
    // TODO: Stop the backend
  },
  convexClient: async ({ convexBackendUrl }, use) => {
    const convexClient = new ConvexReactSessionClient(convexBackendUrl);
    convexClient.setSessionId(crypto.randomUUID() as SessionId);
    await use(convexClient);
  },
  convexQueryClient: async ({ convexClient }, use) => {
    const convexQueryClient = new ConvexQueryClient(convexClient);
    await use(convexQueryClient);
  },
  queryClient: async ({ convexQueryClient }, use) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          queryKeyHashFn: convexQueryClient.hashFn(),
          queryFn: convexQueryClient.queryFn(),
        },
      },
    });
    convexQueryClient.connect(queryClient);
    await use(queryClient);
  },
  rootRoute: async ({ convexClient, queryClient }, use) => {
    function RootComponent() {
      return (
        <AuthKitProvider>
          <ConvexProvider client={convexClient}>
            <QueryClientProvider client={queryClient}>
              <Outlet />
            </QueryClientProvider>
          </ConvexProvider>
        </AuthKitProvider>
      );
    }

    const rootRoute = createRootRoute({
      beforeLoad: async () => {
        // ...
      },
      component: RootComponent,
    });
    await use(rootRoute);
  },
});
