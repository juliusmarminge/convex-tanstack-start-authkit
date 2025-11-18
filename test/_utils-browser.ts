import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { ConvexReactSessionClient } from "convex-helpers/react/sessions";
import { it, inject } from "vitest";

export const test = it.extend<{
  convexBackendUrl: string;
  convexClient: ConvexReactSessionClient;
  convexQueryClient: ConvexQueryClient;
  queryClient: QueryClient;
}>({
  convexBackendUrl: async ({}, use) => {
    const convexBackendUrl = inject("convexBackendUrl");
    await use(convexBackendUrl);
    // TODO: Stop the backend
  },
  convexClient: async ({ convexBackendUrl }, use) => {
    const convexClient = new ConvexReactSessionClient(convexBackendUrl);
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
});
