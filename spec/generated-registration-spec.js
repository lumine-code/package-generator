const fs = require("node:fs");
const promises = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

describe("generated package registration and tips", () => {
  let main, directory, view;
  const generatedNames = new Set();
  const links = new Set();

  beforeEach(async () => {
    jasmine.useRealClock();
    jasmine.attachToDOM(lumine.views.getView(lumine.workspace));
    directory = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "generated-ready-")));
    main = (await lumine.packages.activatePackage("package-generator")).mainModule;
    view = main.ensureView();
  });

  afterEach(async () => {
    for (const name of generatedNames) {
      if (lumine.packages.isPackageLoaded(name)) await lumine.packages.unloadPackage(name);
    }
    generatedNames.clear();
    await lumine.packages.deactivatePackage("package-generator");
    lumine.project.setPaths([]);
    for (const link of links) {
      if (fs.existsSync(link) && fs.lstatSync(link).isSymbolicLink()) fs.unlinkSync(link);
    }
    links.clear();
    await lumine.fileWatchClient.settlePendingTeardown();
    const relative = path.relative(fs.realpathSync.native(os.tmpdir()), directory);
    if (path.isAbsolute(relative) || relative === ".." || relative.startsWith(`..${path.sep}`)) {
      throw new Error("Unsafe generated fixture cleanup");
    }
    fs.rmSync(directory, { recursive: true, force: true });
  });

  function destination(prefix) {
    const name = `${prefix}-${randomUUID()}`;
    generatedNames.add(name);
    links.add(path.join(view.getLinkDirectory(), name));
    return path.join(directory, name);
  }

  it("registers a confirmed new syntax theme with the current Core registry", async () => {
    const target = destination("generated-theme");
    view.attach("theme");
    view.miniEditor.setText(target);
    await view.confirm();
    const metadata = JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8"));
    const theme = metadata.themes[0].name;
    expect(lumine.packages.getAvailablePackages().some((pack) => pack.name === metadata.name)).toBe(
      true,
    );
    expect(lumine.themes.getLoadedThemes().map((pack) => pack.name)).toContain(theme);
    expect(lumine.packages.getLoadedPackage(theme)?.metadata.theme).toBe("syntax");
    expect(lumine.themes.getActiveThemeNames()).not.toContain(theme);
  });

  it("finishes an explicitly confirmed theme job after retirement without late registry publication", async () => {
    const target = destination("retired-theme");
    let release, notifyStarted;
    const started = new Promise((resolve) => (notifyStarted = resolve));
    const blocked = new Promise((resolve) => (release = resolve));
    const write = promises.writeFile;
    spyOn(promises, "writeFile").and.callFake(async (file, ...args) => {
      await write(file, ...args);
      if (file === path.join(target, "package.json")) {
        notifyStarted();
        await blocked;
      }
    });
    view.attach("theme");
    view.miniEditor.setText(target);
    const confirmed = view.confirm();
    await started;
    await lumine.packages.deactivatePackage("package-generator");
    release();
    await confirmed;
    const metadata = JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8"));
    expect(fs.existsSync([...links][0])).toBe(true);
    expect(lumine.packages.getLoadedPackage(metadata.themes[0].name)).toBeUndefined();
    expect(lumine.project.getPaths()).not.toContain(target);
  });

  it("renders an unbound generated command tip and upgrades it for an optional user binding", async () => {
    const target = destination("generated-command");
    const { generatePackage } = require("../lib/templates");
    await generatePackage("package", target);
    const generated = await lumine.packages.activatePackage(target);
    const provider = generated.mainModule.provideBackgroundTips();
    const BackgroundTips = require(
      path.join(lumine.packages.resolvePackagePath("background-tips"), "lib/background-tips-view"),
    );
    const render = () =>
      BackgroundTips.prototype.renderTip({
        source: provider.tips[0],
        packageName: provider.packageName,
      });
    expect(render()).toContain("Command Palette");
    const source = "generated-command-tip-binding";
    lumine.keymaps.add(source, {
      "lumine-workspace": { "ctrl-alt-g": `${provider.packageName}:toggle` },
    });
    try {
      expect(render()).toContain('class="keystroke"');
    } finally {
      lumine.keymaps.removeBindingsFromSource(source);
    }
  });
});
