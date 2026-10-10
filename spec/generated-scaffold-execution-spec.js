const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

describe("Package Generator runnable scaffolds", () => {
  let scratch, generatePackage;

  beforeEach(async () => {
    jasmine.useRealClock();
    for (const method of ["openExternal", "openPath", "showItemInFolder", "openApplication"]) {
      spyOn(lumine.shell, method).and.resolveTo();
    }
    spyOn(lumine.application, "openWindow").and.resolveTo();
    scratch = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "scaffold-specs-")));
    const pack = await lumine.packages.activatePackage("package-generator");
    ({ generatePackage } = require(path.join(pack.path, "lib", "templates.js")));
  });

  afterEach(async () => {
    if (lumine.packages.isPackageActive("package-generator")) {
      await lumine.packages.deactivatePackage("package-generator");
    }
    if (lumine.packages.getLoadedPackage("package-generator")) {
      await lumine.packages.unloadPackage("package-generator");
    }
    await lumine.fileWatchClient.settlePendingTeardown();
    const relative = path.relative(
      fs.realpathSync.native(os.tmpdir()),
      fs.realpathSync.native(scratch),
    );
    if (
      !relative ||
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      throw new Error("Owned scaffold directory escaped the private temporary root");
    }
    fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });

  async function runScaffold(mode, name) {
    const generated = path.join(scratch, name);
    await generatePackage(mode, generated);
    const home = path.join(scratch, "home");
    const temporary = path.join(home, "tmp");
    for (const directory of [
      temporary,
      path.join(home, "electronUserData"),
      path.join(home, "packages"),
    ]) {
      fs.mkdirSync(directory, { recursive: true });
    }
    fs.symlinkSync(
      generated,
      path.join(home, "packages", name),
      process.platform === "win32" ? "junction" : "dir",
    );
    fs.writeFileSync(
      path.join(generated, "spec", "00-owned-boundaries-spec.js"),
      `beforeEach(() => {
  for (const method of ["openExternal", "openPath", "showItemInFolder", "openApplication"]) {
    spyOn(lumine.shell, method).and.resolveTo();
  }
  spyOn(lumine.application, "openWindow").and.resolveTo();
});
afterEach(async () => {
  if (lumine.packages.isPackageActive(${JSON.stringify(name)})) await lumine.packages.deactivatePackage(${JSON.stringify(name)});
  if (lumine.packages.getLoadedPackage(${JSON.stringify(name)})) await lumine.packages.unloadPackage(${JSON.stringify(name)});
  await lumine.fileWatchClient.settlePendingTeardown();
});
`,
    );
    const editorRoot = process.env.LUMINE_RESOURCE_PATH;
    if (!editorRoot || !fs.existsSync(path.join(editorRoot, "package.json"))) {
      throw new Error("Actual editor source checkout is required for the owned scaffold test");
    }
    const env = {
      ...process.env,
      LUMINE_HOME: home,
      TEMP: temporary,
      TMP: temporary,
      TMPDIR: temporary,
      LUMINE_RESOURCE_PATH: editorRoot,
      LUMINE_TEST_PACKAGES: "",
      LUMINE_DISABLE_SHELLING_OUT_FOR_ENVIRONMENT: "true",
      LUMINE_JASMINE_REPORTER: "list",
    };
    delete env.ELECTRON_RUN_AS_NODE;
    const logPath = path.join(scratch, "scaffold-runtime.log");
    const fd = fs.openSync(logPath, "wx");
    let result;
    try {
      result = spawnSync(
        process.execPath,
        [
          "--no-sandbox",
          "--enable-logging",
          ".",
          "-f",
          "--dev",
          "--test",
          path.join(generated, "spec"),
        ],
        {
          cwd: editorRoot,
          env,
          windowsHide: true,
          stdio: ["ignore", fd, fd],
          timeout: 30000,
          killSignal: "SIGKILL",
        },
      );
    } finally {
      fs.closeSync(fd);
    }
    const log = fs.readFileSync(logPath, "utf8");
    console.log(`Owned generated-scaffold runtime (${mode}):\n${log}`);
    const summary = log
      .split(/\r?\n/)
      .filter((line) => /specs?,|ReferenceError|LUMINE_TEST_EXIT/.test(line))
      .join("\n");
    expect(result.status).withContext(summary).toBe(0);
    expect(log).withContext(summary).toContain("1 spec, 0 failures");
    expect(log).not.toMatch(/\b[1-9]\d* pending specs?\b/);
  }

  it("executes the generated editor-package spec in the actual current Jasmine runtime", async () => {
    await runScaffold("package", "owned-generated-package");
  }, 45000);

  it("keeps the generated syntax-theme spec runnable", async () => {
    await runScaffold("theme", "owned-generated-theme-syntax");
  }, 45000);
});
