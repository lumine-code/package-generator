const { CompositeDisposable } = require("lumine");

module.exports = {
  provideBackgroundTips() {
    return {
      packageName: "package-generator",
      tips: [
        "{% if keys['package-generator:generate-package'] %}You can generate a new package scaffold with {{ 'package-generator:generate-package' | keystroke }}{% else %}You can generate ready-to-edit project scaffolds from the Packages menu.{% endif %}",
      ],
    };
  },

  ensureView() {
    if (!this.view) {
      const PackageGeneratorView = require("./package-generator-view");
      this.view = new PackageGeneratorView({ registerCommands: false });
    }
    return this.view;
  },

  activate() {
    this.subscriptions = new CompositeDisposable(
      lumine.commands.add("lumine-workspace", {
        "package-generator:generate-package": {
          description: "Scaffold a new package and open it in a window.",
          didDispatch: () => this.ensureView().attach("package"),
        },
        "package-generator:generate-syntax-theme": {
          description: "Scaffold a new syntax theme and open it.",
          didDispatch: () => this.ensureView().attach("theme"),
        },
      }),
    );
  },

  deactivate() {
    this.subscriptions?.dispose();
    this.subscriptions = null;
    this.view?.destroy();
    this.view = null;
  },
};
