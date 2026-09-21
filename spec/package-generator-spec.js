const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
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

  it("creates a modern editor package", async () => {
    const target = await generate("package", "sample-tools");
    const manifest = JSON.parse(fs.readFileSync(path.join(target, "package.json")));
    expect(manifest.engines).toEqual({ lumine: "^1.0.0" });
    expect(fs.existsSync(path.join(target, "lib", "main.js"))).toBe(true);
    const stylesheet = fs.readFileSync(path.join(target, "styles", "main.css"), "utf8");
    expect(stylesheet).toContain("--sample-tools-accent-color: var(--accent-color);");
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
    const manifest = JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf8"));
    expect(manifest.themes).toEqual([
      { name: "sample-syntax", theme: "syntax", styles: "styles/variables" },
    ]);
    const stylesheet = fs.readFileSync(path.join(target, "styles", "variables.css"), "utf8");
    expect(stylesheet).toContain("--syntax-background-color");
  });
});
