const PackageGeneratorView = require("./package-generator-view");

module.exports = {
  activate() {
    this.view = new PackageGeneratorView();
  },

  deactivate() {
    this.view?.destroy();
    this.view = null;
  },
};
