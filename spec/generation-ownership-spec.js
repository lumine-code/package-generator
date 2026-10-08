const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

describe("package-generator confirmed job ownership", () => {
  let view, directory, configDirectory, destination, gates, starts;

  function deferred() {
    let resolve, reject;
    const promise = new Promise((done, fail) => {
      resolve = done;
      reject = fail;
    });
    return { promise, resolve, reject };
  }

  async function flush() {
    for (let turn = 0; turn < 10; turn++) await Promise.resolve();
  }

  function pause(target) {
    const gate = deferred();
    gates.set(target, gate);
    return gate;
  }

  beforeEach(async () => {
    jasmine.attachToDOM(lumine.views.getView(lumine.workspace));
    const pack = await lumine.packages.activatePackage("package-generator");
    view = pack.mainModule.ensureView();
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "generator-owned-"));
    configDirectory = path.join(directory, "config");
    destination = path.join(directory, "scaffold");
    spyOn(lumine, "getConfigDirPath").and.returnValue(configDirectory);
    spyOn(lumine.project, "addPath");
    spyOn(lumine.notifications, "addSuccess").and.callThrough();
    gates = new Map();
    starts = new Map();
    const mkdir = fs.promises.mkdir.bind(fs.promises);
    spyOn(fs.promises, "mkdir").and.callFake(async (target, options) => {
      if (gates.has(target) && options?.recursive === false) {
        starts.set(target, (starts.get(target) ?? 0) + 1);
        await gates.get(target).promise;
      }
      return mkdir(target, options);
    });
    view.attach("package");
    view.miniEditor.setText(destination);
  });

  afterEach(async () => {
    if (lumine.packages.isPackageActive("package-generator")) {
      await lumine.packages.deactivatePackage("package-generator");
    }
    const relative = path.relative(os.tmpdir(), directory);
    if (path.isAbsolute(relative) || relative === ".." || relative.startsWith(`..${path.sep}`)) {
      throw new Error("Temporary directory escaped the test root");
    }
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });

  it("finishes the confirmed scaffold and install link after deactivation without project or UI effects", async () => {
    const gate = pause(destination);
    const pending = view.confirm();
    await flush();
    await lumine.packages.deactivatePackage("package-generator");
    spyOn(view.inputDialog, "setStatus").and.callThrough();
    spyOn(view.inputDialog, "clearLoadingState").and.callThrough();
    gate.resolve();
    await pending;

    expect(fs.existsSync(path.join(destination, "lib/main.js"))).toBe(true);
    expect(fs.realpathSync(path.join(configDirectory, "packages/scaffold"))).toBe(
      fs.realpathSync(destination),
    );
    expect(lumine.project.addPath).not.toHaveBeenCalled();
    expect(lumine.notifications.addSuccess).not.toHaveBeenCalled();
    expect(view.inputDialog.setStatus).not.toHaveBeenCalled();
    expect(view.inputDialog.clearLoadingState).not.toHaveBeenCalled();
  });

  it("keeps the confirmed link directory when configuration changes during generation", async () => {
    const gate = pause(destination);
    const pending = view.confirm();
    await flush();
    lumine.getConfigDirPath.and.returnValue(path.join(directory, "new-config"));
    lumine.config.set("package-generator.createInDevMode", true);
    gate.resolve();
    await pending;

    expect(fs.existsSync(path.join(configDirectory, "packages/scaffold"))).toBe(true);
    expect(fs.existsSync(path.join(directory, "new-config/packages-dev/scaffold"))).toBe(false);
  });

  it("leaves a newer prompt and its loading state untouched when an older confirmed job finishes", async () => {
    const firstGate = pause(destination);
    const first = view.confirm();
    await flush();
    const newerDestination = path.join(directory, "new-theme");
    const nextGate = pause(newerDestination);
    view.attach("theme");
    view.miniEditor.setText(newerDestination);
    const second = view.confirm();
    await flush();
    spyOn(view.inputDialog, "clearLoadingState").and.callThrough();
    firstGate.resolve();
    await first;

    expect(view.inputDialogHost.isVisible()).toBe(true);
    expect(view.miniEditor.getText()).toBe(newerDestination);
    expect(view.inputDialog.clearLoadingState).not.toHaveBeenCalled();
    expect(lumine.project.addPath).not.toHaveBeenCalled();
    nextGate.resolve();
    await second;
    expect(lumine.project.addPath).toHaveBeenCalledOnceWith(newerDestination);
    expect(JSON.parse(fs.readFileSync(path.join(destination, "package.json"))).engines.lumine).toBe(
      "^1.0.0",
    );
    expect(
      JSON.parse(fs.readFileSync(path.join(newerDestination, "package.json"))).themes.length,
    ).toBe(1);
  });

  it("keeps already confirmed files after cancellation without changing the project", async () => {
    const gate = pause(destination);
    const pending = view.confirm();
    await flush();
    view.inputDialogHost.cancel("test-cancel");
    gate.resolve();
    await pending;
    expect(fs.existsSync(path.join(destination, "package.json"))).toBe(true);
    expect(lumine.project.addPath).not.toHaveBeenCalled();
    expect(lumine.notifications.addSuccess).not.toHaveBeenCalled();
  });

  it("starts only one filesystem job for repeated confirmation in the same session", async () => {
    const gate = pause(destination);
    const first = view.confirm();
    const second = view.confirm();
    await flush();
    expect(starts.get(destination)).toBe(1);
    gate.resolve();
    await Promise.all([first, second]);
    expect(lumine.project.addPath).toHaveBeenCalledTimes(1);
  });

  it("does not publish a failure or clear loading state into a retired dialog", async () => {
    const gate = pause(destination);
    const pending = view.confirm();
    await flush();
    await lumine.packages.deactivatePackage("package-generator");
    spyOn(view.inputDialog, "setStatus").and.callThrough();
    spyOn(view.inputDialog, "clearLoadingState").and.callThrough();
    gate.reject(new Error("Held scaffold failed"));
    await pending;
    expect(view.inputDialog.setStatus).not.toHaveBeenCalled();
    expect(view.inputDialog.clearLoadingState).not.toHaveBeenCalled();
    expect(fs.existsSync(destination)).toBe(false);
  });

  it("requires a real install directory boundary", () => {
    expect(view.isStoredInLumine(path.join(configDirectory, "packages", "nested", "pkg"))).toBe(
      true,
    );
    expect(view.isStoredInLumine(path.join(configDirectory, "packages-other", "pkg"))).toBe(false);
    expect(view.isStoredInLumine(path.join(configDirectory, "packages", "..", "outside"))).toBe(
      false,
    );
  });

  if (process.platform === "win32") {
    it("treats another drive as outside the install directories", () => {
      const currentDrive = path.parse(configDirectory).root.charAt(0).toUpperCase();
      const drive = currentDrive === "D" ? "C" : "D";
      expect(view.isStoredInLumine(`${drive}:\\package`)).toBe(false);
    });
  }
});
