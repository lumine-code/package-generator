// Authentic package usage. Run with lumine/script/demo.js; fixtures stay in demo/.
module.exports = {
  version: 1,
  dependencies: ["language-gfm"],
  viewport: { width: 1100, height: 500 },
  async before() {},
  async prepare(context) {
    const { lumine, state, fixture, open } = context;
    state.editor = await open("more/README.md");
    await lumine.project.setPaths([fixture("more")]);
  },
  scenes: [
    {
      id: "scene-1",
      file: "demo.png",
      caption: "Choose a destination for a new package scaffold.",
      timeout: 60000,
      async run() {},
      async afterPointerMove(context) {
        const { lumine, state, fixture } = context;
        {
          lumine.commands.dispatch(
            lumine.views.getView(state.editor),
            "package-generator:generate-package",
          );
          lumine.packages
            .getActivePackage("package-generator")
            .mainModule.view.miniEditor.setText(fixture("signal-tools"));
          lumine.packages
            .getActivePackage("package-generator")
            .mainModule.view.miniEditor.moveToEndOfLine();
        }
      },
      ready() {
        return Boolean(
          document.querySelector(".package-generator")?.getBoundingClientRect().height > 40,
        );
      },
    },
  ],
  async cleanup() {},
};
