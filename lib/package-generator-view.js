const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { CompositeDisposable } = require("lumine");
const { generatePackage } = require("./templates");

const MODE_DETAILS = {
  package: { placeholder: "my-package", selection: [0, Infinity], label: "package" },
  theme: { placeholder: "my-theme-syntax", selection: [0, 8], label: "syntax theme" },
};

function dasherize(value) {
  return value
    .replace(/([a-z\d])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z\d]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

class PackageGeneratorView {
  constructor({ registerCommands = true } = {}) {
    this.disposables = new CompositeDisposable();
    this.inputDialogHost = lumine.workspace.addInputDialog(
      {
        commands: {
          "package-generator:generate": {
            description: "Generate the requested package or syntax theme at the entered path.",
            didDispatch: () => this.confirm(),
          },
        },
        actions: [
          {
            command: "package-generator:generate",
            context: "dialog",
            primary: true,
            // Invalid paths and generation failures leave the prompt in place;
            // confirm() closes it only after a successful generation.
            disposition: "stay",
            dispatch: "local",
          },
        ],
      },
      { className: "package-generator" },
    );
    this.inputDialog = this.inputDialogHost.getModel();
    this.miniEditor = this.inputDialog.getQueryEditor();
    this.panel = this.inputDialogHost.getPanel();
    if (registerCommands) {
      this.disposables.add(
        lumine.commands.add("lumine-workspace", {
          "package-generator:generate-package": {
            description: "Scaffold a new package and open it in a window.",
            didDispatch: () => this.attach("package"),
          },
          "package-generator:generate-syntax-theme": {
            description: "Scaffold a new syntax theme and open it.",
            didDispatch: () => this.attach("theme"),
          },
        }),
      );
    }
  }

  destroy() {
    this.disposables.dispose();
    return this.inputDialogHost.destroy();
  }

  attach(mode) {
    const details = MODE_DETAILS[mode];
    if (!details) throw new Error(`Unknown generator mode: ${mode}`);
    this.mode = mode;
    this.inputDialog.clearStatus();
    this.inputDialog.setInfoMessage(`Enter the destination path for the new ${details.label}.`);
    const query = path.join(this.getPackagesDirectory(), details.placeholder);
    this.inputDialogHost.show({ query, selectQuery: false });
    this.selectPathText(details.placeholder, details.selection);
  }

  selectPathText(placeholderName, rangeToSelect = [0, placeholderName.length]) {
    const pathLength = this.miniEditor.getText().length;
    const nameStart = pathLength - placeholderName.length;
    this.miniEditor.setSelectedBufferRange([
      [0, nameStart + rangeToSelect[0]],
      [0, nameStart + rangeToSelect[1]],
    ]);
  }

  close() {
    if (!this.inputDialogHost.isVisible()) return;
    this.inputDialogHost.hide();
  }

  async confirm() {
    const packagePath = this.getPackagePath();
    if (!this.validPackagePath(packagePath)) return;

    this.inputDialog.clearStatus();
    this.inputDialog.setLoadingState({ message: "Generating package…" });
    try {
      await generatePackage(this.mode, packagePath);
      if (!this.isStoredInLumine(packagePath)) this.linkPackage(packagePath);
      lumine.project.addPath(packagePath);
      this.close();
      lumine.notifications.addSuccess(`Generated ${path.basename(packagePath)}`, {
        detail: packagePath,
      });
    } catch (error) {
      this.inputDialog.setStatus({ type: "error", message: error.message });
    } finally {
      this.inputDialog.clearLoadingState();
    }
  }

  getPackagePath() {
    const input = this.miniEditor.getText().trim();
    const expanded = input === "~" ? os.homedir() : input.replace(/^~(?=[/\\])/, os.homedir());
    const normalized = path.resolve(expanded);
    const packageName = dasherize(path.basename(normalized));
    return path.join(path.dirname(normalized), packageName);
  }

  getPackagesDirectory() {
    return (
      process.env.LUMINE_REPOS_HOME ||
      lumine.config.get("core.projectHome") ||
      path.join(os.homedir(), "github")
    );
  }

  validPackagePath(packagePath = this.getPackagePath()) {
    if (!path.basename(packagePath)) {
      this.inputDialog.setStatus({ type: "error", message: "Enter a package name." });
      return false;
    }
    if (fs.existsSync(packagePath)) {
      this.inputDialog.setStatus({
        type: "error",
        message: `Path already exists: ${packagePath}`,
      });
      return false;
    }
    return true;
  }

  isStoredInLumine(packagePath) {
    const configPath = lumine.getConfigDirPath();
    return ["packages", "packages-dev"].some((directory) =>
      isWithin(path.join(configPath, directory), packagePath),
    );
  }

  linkPackage(packagePath) {
    const directory = lumine.config.get("package-generator.createInDevMode")
      ? "packages-dev"
      : "packages";
    const linkDirectory = path.join(lumine.getConfigDirPath(), directory);
    const linkPath = path.join(linkDirectory, path.basename(packagePath));
    fs.mkdirSync(linkDirectory, { recursive: true });
    if (fs.existsSync(linkPath)) {
      throw new Error(`A package entry already exists: ${linkPath}`);
    }
    fs.symlinkSync(packagePath, linkPath, process.platform === "win32" ? "junction" : "dir");
  }
}

module.exports = PackageGeneratorView;
