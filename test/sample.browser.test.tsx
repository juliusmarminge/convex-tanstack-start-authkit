import { expect } from "vitest";
import { AddNumberButton, Numbers } from "../src/component/numbers";
import { render } from "vitest-browser-react";
import { test } from "./_utils-browser";
import { userEvent } from "vitest/browser";
import {
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";

test("render numbers", async ({ rootRoute }) => {
  const index = createRoute({
    path: "/",
    getParentRoute: () => rootRoute,
    component: () => (
      <>
        <Numbers />
      </>
    ),
  });
  const routeTree = rootRoute.addChildren([index]);
  const router = createRouter({ routeTree });
  await router.load();
  const $ = await render(<RouterProvider router={router} />);

  await expect.element($.getByTestId("numbers")).toBeInTheDocument();
});

test("add number", async ({ rootRoute }) => {
  const index = createRoute({
    path: "/",
    getParentRoute: () => rootRoute,
    component: () => (
      <>
        <Numbers />
        <AddNumberButton />
      </>
    ),
  });
  const routeTree = rootRoute.addChildren([index]);
  const router = createRouter({ routeTree });
  await router.load();
  const $ = await render(<RouterProvider router={router} />);

  await userEvent.click($.getByText("Add Number"));

  await expect.element($.getByTestId("numbers")).toBeVisible();
});
