import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { ConvexReactSessionClient } from "convex-helpers/react/sessions";
import { it } from "vitest";

export const test = it.extend<{
  convexServerUrl: string;
  convexClient: ConvexReactSessionClient;
  convexQueryClient: ConvexQueryClient;
  queryClient: QueryClient;
}>({
  convexServerUrl: async ({}, use) => {
    // TODO: Launch local convex backend
    const convexServerUrl = "http://localhost:3000";

    // TODO: Push to local backend

    // Provide the convex server url to the test
    await use(convexServerUrl);

    // TODO: Stop local convex backend
  },
  convexClient: async ({ convexServerUrl }, use) => {
    const convexClient = new ConvexReactSessionClient(convexServerUrl);
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
