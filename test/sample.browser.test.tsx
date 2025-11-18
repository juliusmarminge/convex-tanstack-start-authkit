import * as React from "react";
import { expect, test } from "vitest";
import { SomeComponentToBeTested } from "../src/component/some-component";
import { render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

test("sample", async () => {
  const $ = await render(<SomeComponentToBeTested />);
  expect($.getByText("Count: 0")).toBeInTheDocument();
  await userEvent.click($.getByText("Increment"));
  expect($.getByText("Count: 1")).toBeInTheDocument();
});
