const { TextBuffer } = require("lumine");
const View = require("../lib/package-generator-view");

describe("Package generator path budget", () => {
  let view;
  beforeEach(() => {
    jasmine.useRealClock();
    view = new View();
  });
  afterEach(() => view.destroy());
  it("preserves giant path drafts and rejects confirmation before text reads or filesystem work", async () => {
    let source = TextBuffer.createTextSnapshot("x".repeat(32768));
    while (source.canMaterialize()) source = source.replace(source.length, source.length, source);
    view.miniEditor.getBuffer().setText(source);
    const read = spyOn(view.miniEditor, "getText").and.throwError("must not read giant path");
    const load = spyOn(view, "loadTemplates").and.throwError("must not generate");
    view.selectPathText("name");
    expect(view.getPackagePath()).toBeNull();
    await view.confirm();
    expect(read).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
    expect(view.miniEditor.getBuffer().getTextSnapshot().equals(source)).toBeTrue();
    read.and.callThrough();
    view.miniEditor.setText("valid-package");
    expect(view.getPackagePath()).toContain("valid-package");
  });
});
