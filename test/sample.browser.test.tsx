/// <reference types="vite/client" />

import * as React from "react";
import { expect } from "vitest";
import { Numbers } from "../src/component/some-component";
import { render } from "vitest-browser-react";
import { ConvexProvider } from "convex/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { test } from "./_utils-browser";

test("sample", async ({ convexClient, queryClient }) => {
  const $ = await render(
    <QueryClientProvider client={queryClient}>
      <ConvexProvider client={convexClient}>
        <Numbers />
      </ConvexProvider>
    </QueryClientProvider>,
  );

  expect($.getByTestId("numbers")).toBeInTheDocument();
});
