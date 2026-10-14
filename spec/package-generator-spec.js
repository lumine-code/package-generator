const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const PackageGeneratorView = require("../lib/package-generator-view");
const { generatePackage } = require("../lib/templates");

describe("Package Generator", () => {
  let view;

  beforeEach(() => {
    jasmine.attachToDOM(lumine.views.getView(lumine.workspace));
    view = new PackageGeneratorView();
  });

  afterEach(() => {
    delete process.env.LUMINE_REPOS_HOME;
    view.destroy();
  });

  it("opens the package prompt with the expected name selected", () => {
    process.env.LUMINE_REPOS_HOME = path.join(os.tmpdir(), "lumine-repositories");
    view.attach("package");
    expect(view.panel.isVisible()).toBe(true);
    expect(view.miniEditor.getText()).toBe(path.join(process.env.LUMINE_REPOS_HOME, "my-package"));
    expect(view.miniEditor.getSelectedText()).toBe("my-package");
  });

  it("rejects the removed language generator mode", () => {
    expect(() => view.attach("language")).toThrowError(/Unknown generator mode/);
  });

  it("normalizes package names to lowercase dashes", () => {
    view.miniEditor.setText(path.join(os.tmpdir(), "CamelCase_is Great"));
    expect(path.basename(view.getPackagePath())).toBe("camel-case-is-great");
  });
});

describe("generated scaffolds", () => {
  let root;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "lumine-package-generator-"));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  async function generate(mode, name) {
    const target = path.join(root, name);
    await generatePackage(mode, target);
    return target;
  }

  function expectPrivateFilesIgnored(target) {
    const git = (args, input) =>
      spawnSync("git", ["-c", "core.excludesFile=", ...args], {
        cwd: target,
        encoding: "utf8",
        input,
      });
    const initialized = git(["init", "--quiet", "--template="]);
    expect(initialized.status).toBe(0);
    const privateFiles = [
      "node_modules/demo/index.js",
      ".env",
      ".env.local",
      ".npmrc",
      ".pypirc",
      ".netrc",
      "id_rsa",
      "id_ed25519",
      "secret-store.json",
      ".aws/credentials",
      ".ssh/id_rsa",
      ".ipython/profile_default/history.sqlite",
      ".jupyter/jupyter_server_config.json",
      ".dev/session.json",
      "capture-profile/config.json",
      "state-store/state.json",
      ".idea/workspace.xml",
      "project.creator.user",
      "spec/fixtures/.env",
      "spec/fixtures/.env.local",
      "spec/fixtures/.npmrc",
      "spec/fixtures/id_rsa",
      "spec/fixtures/secret-store.json",
      "spec/fixtures/project.creator.user",
    ];
    const ignored = git(
      ["check-ignore", "--no-index", "--stdin", "-z"],
      `${privateFiles.join("\0")}\0`,
    );
    expect(ignored.status).toBe(0);
    expect(ignored.stdout.split("\0").filter(Boolean).sort()).toEqual(privateFiles.toSorted());
    const examples = [
      ".env.example",
      ".env.sample",
      ".env.template",
      "spec/fixtures/.env.example",
      "spec/fixtures/.env.sample",
      "spec/fixtures/.env.template",
    ];
    const allowed = git(
      ["check-ignore", "--no-index", "--stdin", "-z"],
      `${examples.join("\0")}\0`,
    );
    expect(allowed.status).toBe(1);
    expect(allowed.stdout).toBe("");
  }

  it("creates a modern editor package", async () => {
    const target = await generate("package", "sample-tools");
    expectPrivateFilesIgnored(target);
    const manifest = JSON.parse(fs.readFileSync(path.join(target, "package.json")));
    expect(manifest.engines).toEqual({ lumine: "^1.0.0" });
    expect(manifest.providedServices["background-tips.provider"].versions["1.0.0"]).toBe(
      "provideBackgroundTips",
    );
    expect(fs.existsSync(path.join(target, "lib", "main.js"))).toBe(true);
    const main = fs.readFileSync(path.join(target, "lib", "main.js"), "utf8");
    expect(main).toContain('packageName: "sample-tools"');
    expect(main).toContain("sample-tools:toggle");
    const stylesheet = fs.readFileSync(path.join(target, "styles", "main.css"), "utf8");
    expect(stylesheet).toContain("--sample-tools-accent-color: var(--accent-indicator-color);");
  });

  it("does not offer a parserless language scaffold", async () => {
    const target = path.join(root, "language-sample");
    await expectAsync(generatePackage("language", target)).toBeRejectedWithError(
      /Unknown generator mode/,
    );
    expect(fs.existsSync(target)).toBe(false);
  });

  it("creates a CSS syntax theme", async () => {
    const target = await generate("theme", "sample-syntax");
    expectPrivateFilesIgnored(target);
    const manifest = JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8"));
    expect(manifest.themes).toEqual([
      { name: "sample-syntax-night", theme: "syntax", styles: "styles" },
    ]);
    const stylesheet = fs.readFileSync(path.join(target, "styles", "variables.css"), "utf8");
    expect(stylesheet).toContain("--syntax-background-color");
    await lumine.packages.activatePackage(target);
    try {
      await lumine.packages.activatePackage("sample-syntax-night");
      const probe = document.createElement("span");
      probe.style.backgroundColor = "var(--syntax-background-color)";
      document.body.appendChild(probe);
      try {
        expect(getComputedStyle(probe).backgroundColor).toBe("rgb(24, 28, 37)");
      } finally {
        probe.remove();
      }
    } finally {
      await lumine.packages.deactivatePackage("sample-syntax-night");
      await lumine.packages.unloadPackage("sample-syntax");
    }
  });
});
