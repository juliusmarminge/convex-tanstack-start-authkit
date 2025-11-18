/// <reference types="vite/client" />

import * as React from "react";
import { expect } from "vitest";
import { AddNumberButton, Numbers } from "../src/component/numbers";
import { render } from "vitest-browser-react";
import { ConvexProvider } from "convex/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { test } from "./_utils-browser";
import { userEvent } from "vitest/browser";

test("render numbers", async ({ convexClient, queryClient }) => {
  const $ = await render(
    <QueryClientProvider client={queryClient}>
      <ConvexProvider client={convexClient}>
        <Numbers />
      </ConvexProvider>
    </QueryClientProvider>,
  );

  await expect.element($.getByTestId("numbers")).toBeInTheDocument();
});

test("add number", async ({ convexClient, queryClient }) => {
  const $ = await render(
    <QueryClientProvider client={queryClient}>
      <ConvexProvider client={convexClient}>
        <Numbers />
        <AddNumberButton />
      </ConvexProvider>
    </QueryClientProvider>,
  );

  await userEvent.click($.getByText("Add Number"));

  await expect.element($.getByTestId("numbers")).toBeVisible();
});
