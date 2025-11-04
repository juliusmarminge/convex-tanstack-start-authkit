import { createRouter } from "@tanstack/react-router";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ConvexReactSessionClient } from "convex-helpers/react/sessions";
import { routeTree } from "./routeTree.gen";
import { createServerFn } from "@tanstack/react-start";
import { AuthTokenFetcher, ConvexProvider } from "convex/react";

const fetchAccessToken = createServerFn().handler(async ({ context }) => {
  const auth = context.auth();
  return auth.accessToken;
});

const tokenFetcher: AuthTokenFetcher = (args) => {
  console.log("[tokenFetcher] forceRefreshToken", args.forceRefreshToken);
  return fetchAccessToken();
};

export function getRouter() {
  // Initialize the convex client
  const convexClient = new ConvexReactSessionClient(
    import.meta.env.VITE_CONVEX_URL,
  );
  convexClient.setAuth(tokenFetcher);

  // Hook up convex react query integration
  const convexQueryClient = new ConvexQueryClient(convexClient);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });
  convexQueryClient.connect(queryClient);

  // Create the router
  const router = createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultPreloadStaleTime: 0, // Let React Query handle all caching
    defaultErrorComponent: (err) => <p>{err.error.stack}</p>,
    defaultNotFoundComponent: () => <p>not found</p>,
    context: { queryClient, convexClient, convexQueryClient },
    Wrap: ({ children }) => (
      <ConvexProvider client={convexClient}>{children}</ConvexProvider>
    ),
  });

  // Hook up router ssr query integration
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}
