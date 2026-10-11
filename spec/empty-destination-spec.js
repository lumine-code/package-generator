const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

describe("Package Generator empty destination", () => {
  let scratch, cwd, previousCwd, previousProjects, view;

  beforeEach(async () => {
    jasmine.useRealClock();
    for (const method of ["openExternal", "openPath", "showItemInFolder", "openApplication"]) {
      spyOn(lumine.shell, method).and.resolveTo();
    }
    spyOn(lumine.application, "openWindow").and.resolveTo();
    jasmine.attachToDOM(lumine.views.getView(lumine.workspace));
    scratch = fs.realpathSync.native(
      fs.mkdtempSync(path.join(os.tmpdir(), "package-empty-destination-")),
    );
    cwd = path.join(scratch, "Current Folder");
    fs.mkdirSync(cwd);
    previousCwd = process.cwd();
    previousProjects = lumine.project.getPaths();
    process.chdir(cwd);
    const pack = await lumine.packages.activatePackage("package-generator");
    view = pack.mainModule.ensureView();
    // Keep the real symlink writer confined to this fixture's own directory.
    spyOn(view, "getLinkDirectory").and.returnValue(path.join(scratch, "install"));
    lumine.commands.dispatch(
      lumine.views.getView(lumine.workspace),
      "package-generator:generate-package",
    );
    spyOn(view.inputDialog, "setStatus").and.callThrough();
  });

  afterEach(async () => {
    if (previousCwd) process.chdir(previousCwd);
    if (previousProjects) lumine.project.setPaths(previousProjects);
    if (lumine.packages.isPackageActive("package-generator")) {
      await lumine.packages.deactivatePackage("package-generator");
    }
    if (lumine.packages.isPackageLoaded("package-generator")) {
      await lumine.packages.unloadPackage("package-generator");
    }
    await lumine.fileWatchClient.settlePendingTeardown();
    if (!scratch) return;
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
      throw new Error("Empty destination fixture escaped the private temporary root");
    }
    fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });

  async function refusesEmptyQuery(query) {
    view.miniEditor.setText(query);
    await view.confirm();
    expect(fs.existsSync(path.join(scratch, "current-folder"))).toBe(false);
    expect(fs.existsSync(path.join(scratch, "current-folder", "package.json"))).toBe(false);
    expect(fs.existsSync(path.join(scratch, "install"))).toBe(false);
    expect(lumine.project.getPaths()).toEqual(previousProjects);
    expect(view.panel.isVisible()).toBe(true);
    expect(view.inputDialog.setStatus).toHaveBeenCalledWith({
      type: "error",
      message: "Enter a package name.",
    });
  }

  it("refuses an empty query before cwd normalization can create a sibling scaffold", async () => {
    await refusesEmptyQuery("");
  });

  it("refuses a whitespace-only query with the same owned filesystem boundary", async () => {
    await refusesEmptyQuery("   ");
  });

  it("keeps explicit destination normalization and the real confirmed scaffold/link", async () => {
    const target = path.join(cwd, "explicit-package");
    view.miniEditor.setText(path.join(cwd, "Explicit Package"));
    await view.confirm();
    expect(JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8")).name).toBe(
      "explicit-package",
    );
    expect(fs.realpathSync.native(path.join(scratch, "install", "explicit-package"))).toBe(
      fs.realpathSync.native(target),
    );
    expect(lumine.project.getPaths()).toContain(target);
    expect(view.panel.isVisible()).toBe(false);
    expect(
      view.inputDialog.setStatus.calls.allArgs().filter(([status]) => status?.type === "error"),
    ).toEqual([]);
  });
});
