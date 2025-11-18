import * as FS from "node:fs";
import * as FSP from "node:fs/promises";
import * as OS from "node:os";
import * as Https from "node:https";
import * as ChildProcess from "node:child_process";
import * as Path from "node:path";
import { ConvexHttpClient } from "convex/browser";

export class ConvexBackend {
  public port?: number;
  public siteProxyPort?: number;
  public process?: ChildProcess.ChildProcess;
  public backendUrl?: string;
  private _client?: ConvexHttpClient;

  private readonly projectDir: string;
  private readonly stdio: "inherit" | "ignore" | ["ignore", "pipe", "pipe"];
  private readonly instanceName: string;
  private readonly instanceSecret: string;
  private readonly adminKey: string;

  get client(): ConvexHttpClient {
    if (!this._client) throw new Error("Backend not initialized");
    return this._client;
  }

  constructor(options: {
    instanceName: string;
    instanceSecret: string;
    adminKey: string;
    projectDir?: string;
    stdio?: "inherit" | "ignore" | ["ignore", "pipe", "pipe"];
  }) {
    this.projectDir = options.projectDir ?? process.cwd();
    this.stdio = options.stdio ?? "inherit";
    this.instanceName = options.instanceName;
    this.instanceSecret = options.instanceSecret;
    this.adminKey = options.adminKey;
  }

  async init(env: Record<string, string>): Promise<void> {
    const backendDir = Path.join(this.projectDir, ".convex-e2e-test");

    console.log("🚀 Starting Convex backend...");
    await this.startBackend(backendDir);
    console.log(`✅ Backend running on port ${this.port}`);

    for (const variable in env) {
      console.log(`   Setting env var ${variable} = "${env[variable]}"`);
      await this.setEnv(variable, env[variable]);
    }

    console.log("📦 Deploying Convex code...");
    await this.deploy();
    console.log("✅ Deploy successful!");

    this.backendUrl = `http://localhost:${this.port}`;
    this._client = new ConvexHttpClient(this.backendUrl);
    (this._client as any).setAdminAuth(this.adminKey);

    console.log(`✅ Convex backend ready at ${this.backendUrl}\n`);

    onProcessExit(() => this.stop());
  }

  private async startBackend(backendDir: string): Promise<void> {
    const storageDir = Path.join(backendDir, "convex_local_storage");
    FS.mkdirSync(storageDir, { recursive: true });

    const sqlitePath = Path.join(backendDir, "convex_local_backend.sqlite3");
    const convexBinary = await downloadConvexBinary();

    this.port = findUnusedPort();
    this.siteProxyPort = findUnusedPort();

    this.process = ChildProcess.spawn(
      convexBinary,
      [
        "--port",
        String(this.port),
        "--site-proxy-port",
        String(this.siteProxyPort),
        "--instance-name",
        this.instanceName,
        "--instance-secret",
        this.instanceSecret,
        "--local-storage",
        storageDir,
        sqlitePath,
      ],
      {
        cwd: backendDir,
        stdio: this.stdio,
      },
    );

    // Wait for the backend to be healthy
    await this.healthCheck();

    // Verify the process has a PID (started successfully)
    if (!this.process.pid) {
      throw new Error("Convex process failed to start - no PID assigned");
    }
  }

  private async healthCheck(): Promise<void> {
    if (!this.port) throw new Error("Port not set for health check");
    const url = `http://localhost:${this.port}/version`;
    await waitForHttpOk(url, 10_000);
  }

  private async deploy(): Promise<void> {
    if (!this.port) throw new Error("Backend not started");

    const backendUrl = `http://localhost:${this.port}`;
    console.log(`   Running: pnpm convex deploy --url ${backendUrl}`);

    const deployResult = ChildProcess.spawnSync(
      "pnpm",
      ["convex", "deploy", "--admin-key", this.adminKey, "--url", backendUrl],
      {
        cwd: this.projectDir,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 60000,
      },
    );

    if (deployResult.error)
      throw new Error(
        `Failed to spawn convex deploy: ${deployResult.error.message}`,
      );

    if (deployResult.status !== 0)
      throw new Error(
        `Failed to deploy (exit code ${deployResult.status}):\n${deployResult.stdout + deployResult.stderr}`,
      );

    await this.setEnv("IS_TEST", "true");
  }

  async setEnv(name: string, value: string): Promise<void> {
    if (!this.port) throw new Error("Backend not started");

    const backendUrl = `http://localhost:${this.port}`;
    const displayValue = value.length > 50 ? `${value.slice(0, 50)}...` : value;
    console.log(`   Setting env var ${name} = "${displayValue}"`);

    // Use the Convex Deployment API to set environment variables
    // https://docs.convex.dev/deployment-api/update-environment-variables
    const response = await fetch(
      `${backendUrl}/api/v1/update_environment_variables`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Convex ${this.adminKey}`,
        },
        body: JSON.stringify({
          changes: [
            {
              name,
              value,
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to set ${name} env via API (${response.status}): ${errorText}`,
      );
    }

    console.log(`   ✓ Successfully set ${name}`);
  }

  async stop(cleanup = true): Promise<void> {
    if (!this.process || this.process.pid === undefined) return;

    console.log(`🛑 Stopping Convex backend...`);

    const pid = this.process.pid;
    try {
      // Try graceful SIGTERM first, tree-kill will kill all child processes
      process.kill(pid, "SIGTERM");
    } catch (error) {
      console.warn(`Failed to terminate Convex backend gracefully:`, error);
    }

    if (cleanup) {
      console.log(`🧹 Cleaning up backend files...`);
      await FSP.rm(Path.join(this.projectDir, ".convex-e2e-test"), {
        recursive: true,
      });
    }
  }

  /**
   * Reset the database by clearing all scheduled functions, files, and tables.
   * Im not sure if this is the best way to do this right now or if its better to use your own
   * reset database mutation.
   */
  async resetDatabase(): Promise<void> {
    if (!this.backendUrl) throw new Error("Backend URL not set");

    console.log("🔄 Resetting database...");

    // Clear all scheduled functions first
    let scheduledJobsDeleted = 0;
    let scheduledCursor: string | null = null;

    do {
      const result = (await this.client.query(
        "_system/frontend/paginatedScheduledJobs" as any,
        {
          componentId: null,
          paginationOpts: { cursor: scheduledCursor, numItems: 100 },
        },
      )) as {
        page: Array<{ _id: string }>;
        isDone: boolean;
        continueCursor: string;
      };

      if (result.page.length > 0) {
        const deleteResult = (await this.client.mutation(
          "_system/frontend/deleteDocuments" as any,
          {
            componentId: null,
            toDelete: result.page.map((job) => ({
              id: job._id,
              tableName: "_scheduled_jobs",
            })),
          },
        )) as { success: boolean; error?: string };

        if (!deleteResult.success) {
          console.warn(
            `  Failed to delete scheduled jobs: ${deleteResult.error}`,
          );
        } else {
          scheduledJobsDeleted += result.page.length;
        }
      }

      scheduledCursor = result.isDone ? null : result.continueCursor;
    } while (scheduledCursor !== null);

    if (scheduledJobsDeleted > 0) {
      console.log(`  Cleared ${scheduledJobsDeleted} scheduled functions`);
    }

    // Clear all files from storage
    let filesDeleted = 0;
    let fileCursor: string | null = null;

    do {
      const result = (await this.client.query(
        "_system/fileStorageV2/fileMetadata" as any,
        {
          componentId: null,
          paginationOpts: { cursor: fileCursor, numItems: 100 },
        },
      )) as {
        page: Array<{ _id: string }>;
        isDone: boolean;
        continueCursor: string;
      };

      if (result.page.length > 0) {
        await this.client.mutation("_system/fileStorageV2/deleteFiles" as any, {
          componentId: null,
          storageIds: result.page.map((file) => file._id),
        });
        filesDeleted += result.page.length;
      }

      fileCursor = result.isDone ? null : result.continueCursor;
    } while (fileCursor !== null);

    if (filesDeleted > 0) {
      console.log(`  Cleared ${filesDeleted} files from storage`);
    }

    // Get all table names from the database
    const tableMapping = (await this.client.query(
      "_system/frontend/getTableMapping" as any,
      { componentId: null },
    )) as Record<string, string>;

    // Filter out system tables (those starting with _)
    const tableNames = Object.values(tableMapping).filter(
      (name) => !name.startsWith("_"),
    );

    // Clear each table (may require multiple calls for large tables)
    for (const tableName of tableNames) {
      let cursor: string | null = null;
      let totalDeleted = 0;

      do {
        const result = (await this.client.mutation(
          "_system/frontend/clearTablePage" as any,
          { tableName, cursor, componentId: null },
        )) as {
          deleted: number;
          hasMore: boolean;
          continueCursor: string | null;
        };

        totalDeleted += result.deleted;
        cursor = result.hasMore ? result.continueCursor : null;
      } while (cursor !== null);

      if (totalDeleted > 0) {
        console.log(`  Cleared ${totalDeleted} rows from ${tableName}`);
      }
    }

    console.log(
      `✅ Database reset complete (cleared ${tableNames.length} tables)`,
    );
  }
}

/**
 * HELPERS BELOW HERE
 */

function findUnusedPort(): number {
  // Simple approach: pick a random port in the ephemeral range
  // A more robust solution would actually bind to port 0 to get an OS-assigned port
  return 10000 + Math.floor(Math.random() * 50000);
}

async function waitForHttpOk(url: string, timeoutMs = 30000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let attempts = 0;
  while (true) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.ok || (res.status >= 300 && res.status < 400)) return;
    } catch {}
    const remaining = deadline - Date.now();
    if (remaining <= 0)
      throw new Error(`Timed out waiting for ${url} to become ready`);
    const delay = Math.min(200 * Math.pow(1.5, attempts), remaining);
    await new Promise((r) => setTimeout(r, delay));
    attempts++;
  }
}

/**
 * Register a cleanup handler to be called when the current process exits.
 * This handles SIGINT, SIGTERM, and uncaught exceptions.
 */
function onProcessExit(handler: () => void | Promise<void>): void {
  const handleExit = async (signal: string) => {
    try {
      await handler();
    } catch (error) {
      console.error(`Error during cleanup (${signal}):`, error);
    } finally {
      process.exit(signal === "uncaughtException" ? 1 : 0);
    }
  };

  process.on("SIGINT", () => handleExit("SIGINT"));
  process.on("SIGTERM", () => handleExit("SIGTERM"));
  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    handleExit("uncaughtException");
  });
}

interface GitHubRelease {
  tag_name: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

async function fetchConvexReleases(): Promise<GitHubRelease[]> {
  return new Promise((resolve, reject) => {
    const url =
      "https://api.github.com/repos/get-convex/convex-backend/releases?per_page=50";
    Https.get(url, { headers: { "User-Agent": "node" } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch releases: ${res.statusCode}`));
        return;
      }

      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error as Error);
        }
      });
    }).on("error", reject);
  });
}

function getPlatformTarget(): string {
  const arch =
    process.arch === "x64"
      ? "x86_64"
      : process.arch === "arm64"
        ? "aarch64"
        : process.arch;

  if (process.platform === "darwin")
    return `convex-local-backend-${arch}-apple-darwin`;
  if (process.platform === "linux")
    return `convex-local-backend-${arch}-unknown-linux-gnu`;
  if (process.platform === "win32")
    return `convex-local-backend-${arch}-pc-windows-msvc`;

  throw new Error(`Unsupported platform: ${process.platform}`);
}

function findAsset(
  releases: GitHubRelease[],
  target: string,
): {
  asset: { name: string; browser_download_url: string };
  version: string;
} | null {
  for (const release of releases) {
    const asset = release.assets.find((a) => a.name.includes(target));
    if (asset) return { asset, version: release.tag_name };
  }
  return null;
}

async function downloadConvexBinary(): Promise<string> {
  const { isWindows, target } = (() => {
    const isWindows = process.platform === "win32";
    return { isWindows, target: getPlatformTarget() };
  })();

  const releases = await fetchConvexReleases();
  const found = findAsset(releases, target);
  if (!found) throw new Error(`No Convex binary asset matches '${target}'`);

  const { asset, version } = found;
  const binaryDir = Path.join(OS.homedir(), ".convex-e2e", "releases");
  FS.mkdirSync(binaryDir, { recursive: true });

  const binaryName = `convex-local-backend-${version}${isWindows ? ".exe" : ""}`;
  const binaryPath = Path.join(binaryDir, binaryName);
  if (FS.existsSync(binaryPath)) return binaryPath;

  const zipPath = Path.join(binaryDir, asset.name);
  console.log(`Downloading Convex backend ${version}...`);
  await downloadFile(asset.browser_download_url, zipPath);
  console.log(`Downloaded: ${asset.name}`);

  await extractZip(zipPath, binaryDir);
  const extracted = Path.join(
    binaryDir,
    `convex-local-backend${isWindows ? ".exe" : ""}`,
  );
  await FSP.rename(extracted, binaryPath);
  if (!isWindows) FS.chmodSync(binaryPath, 0o755);
  await FSP.rm(zipPath);
  console.log(`Binary ready at: ${binaryPath}`);
  return binaryPath;
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    Https.get(url, { headers: { "User-Agent": "node" } }, (res) => {
      const isRedirect = res.statusCode === 302 || res.statusCode === 301;
      if (isRedirect) {
        const location = res.headers.location;
        if (!location) {
          reject(new Error(`Redirect without location for ${url}`));
          return;
        }
        Https.get(location, (redirectRes) =>
          pipeTo(destPath, redirectRes, resolve, reject),
        ).on("error", reject);
        return;
      }
      pipeTo(destPath, res, resolve, reject);
    }).on("error", reject);
  });
}

function pipeTo(
  destPath: string,
  stream: NodeJS.ReadableStream,
  resolve: () => void,
  reject: (err: Error) => void,
): void {
  const out = FS.createWriteStream(destPath);
  stream.pipe(out);
  out.on("finish", () => {
    out.close();
    resolve();
  });
  out.on("error", reject);
}

function extractZip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const unzip = ChildProcess.spawn("unzip", ["-o", zipPath, "-d", destDir], {
      stdio: "ignore",
    });

    unzip.on("error", (err) => {
      reject(err as Error);
    });

    unzip.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Failed to extract ${zipPath} (exit code ${code})`));
      }
    });
  });
}
