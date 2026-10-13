describe("package-generator native template loading", () => {
  let main, view;

  beforeEach(async () => {
    if (lumine.packages.isPackageLoaded("package-generator")) {
      await lumine.packages.unloadPackage("package-generator");
    }
    main = (await lumine.packages.activatePackage("package-generator")).mainModule;
    view = main.ensureView();
  });

  afterEach(async () => {
    await lumine.packages.unloadPackage("package-generator");
  });

  it("opens its dialog without loading the scaffold templates", () => {
    spyOn(view, "loadTemplates").and.callThrough();
    view.attach("package");
    expect(view.inputDialogHost.isVisible()).toBe(true);
    expect(view.loadTemplates).not.toHaveBeenCalled();
  });

  it("shares native CommonJS template exports across concurrent requests", async () => {
    const [first, second] = await Promise.all([view.loadTemplates(), view.loadTemplates()]);
    expect(first).toBe(second);
    expect(first).toBe(require("../lib/templates"));
    expect(typeof first.generatePackage).toBe("function");
  });

  it("keeps a confirmed job owned while templates load, without publishing into a retired prompt", async () => {
    const templates = await view.loadTemplates();
    let release;
    spyOn(view, "loadTemplates").and.returnValue(
      new Promise((resolve) => (release = () => resolve(templates))),
    );
    spyOn(view, "validPackagePath").and.returnValue(true);
    spyOn(view, "isStoredInLumine").and.returnValue(true);
    spyOn(templates, "generatePackage").and.resolveTo();
    spyOn(lumine.project, "addPath");
    view.attach("package");
    const pending = view.confirm();
    expect(view.pendingJob).not.toBeNull();
    await lumine.packages.deactivatePackage("package-generator");
    release();
    await pending;
    expect(templates.generatePackage).toHaveBeenCalledTimes(1);
    expect(lumine.project.addPath).not.toHaveBeenCalled();
  });

  it("presents import failures in the current dialog and allows another confirmation", async () => {
    const templates = await view.loadTemplates();
    spyOn(view, "loadTemplates").and.rejectWith(new Error("Held template import failed"));
    spyOn(view, "validPackagePath").and.returnValue(true);
    spyOn(view, "isStoredInLumine").and.returnValue(true);
    spyOn(templates, "generatePackage").and.resolveTo();
    spyOn(lumine.project, "addPath");
    spyOn(view.inputDialog, "setStatus").and.callThrough();
    view.attach("package");
    await view.confirm();
    expect(view.inputDialog.setStatus).toHaveBeenCalledWith({
      type: "error",
      message: "Held template import failed",
    });
    expect(view.pendingJob).toBeNull();
    view.loadTemplates.and.resolveTo(templates);
    await view.confirm();
    expect(templates.generatePackage).toHaveBeenCalledTimes(1);
    expect(lumine.project.addPath).toHaveBeenCalledTimes(1);
  });
});
