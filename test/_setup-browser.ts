import "../src/app.css";
import * as Path from "node:path";
import type { TestProject } from "vitest/node";
import { ConvexBackend } from "./convex-backend.ts";

declare module "vitest" {
  export interface ProvidedContext {
    convexBackendUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const backend = new ConvexBackend({
    projectDir: Path.join(import.meta.dirname, ".."),
    stdio: "ignore",
    instanceName: "carnitas",
    instanceSecret:
      "4361726e697461732c206c69746572616c6c79206d65616e696e6720226c6974",
    adminKey:
      "0135d8598650f8f5cb0f30c34ec2e2bb62793bc28717c8eb6fb577996d50be5f4281b59181095065c5d0f86a2c31ddbe9b597ec62b47ded69782cd",
  });

  await backend.init({
    WORKOS_CLIENT_ID: "",
  });

  project.provide("convexBackendUrl", backend.backendUrl!);

  return async function teardown() {
    await backend.stop();
  };
}
