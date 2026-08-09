const fs = require("node:fs/promises");
const path = require("node:path");

const LICENSE = `MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

const ESLINT_CONFIG = `const js = require("@eslint/js");
const n = require("eslint-plugin-n");
const globals = require("globals");
const prettier = require("eslint-config-prettier");

module.exports = [
  js.configs.recommended,
  n.configs["flat/recommended-script"],
  {
    settings: { n: { version: ">=24.0.0" } },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: { ...globals.browser, ...globals.node, lumine: "readonly" },
    },
    rules: { "no-unused-vars": ["error", { argsIgnorePattern: "^_" }] },
  },
  {
    files: ["eslint.config.js", "spec/**"],
    languageOptions: { globals: { ...globals.jasmine } },
    rules: {
      "n/no-unpublished-require": "off",
      "n/no-extraneous-require": "off",
    },
  },
  prettier,
];
`;

const PRETTIER_CONFIG = `module.exports = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  tabWidth: 2,
  printWidth: 100,
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "auto",
};
`;

const DEV_DEPENDENCIES = {
  "@eslint/js": "^10.0.1",
  eslint: "^10.8.0",
  "eslint-config-prettier": "^10.1.8",
  "eslint-plugin-n": "^18.2.2",
  globals: "^17.9.0",
  prettier: "^3.9.6",
};

const SCRIPTS = {
  test: "lumine --test spec",
  lint: "eslint . --max-warnings 0",
  format: "prettier --write .",
  "format:check": "prettier --check .",
};

function titleFromName(name) {
  return name
    .replace(/^(language-)|(-syntax)$/g, "")
    .split("-")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function metadata(name, description, keywords) {
  return {
    name,
    author: "",
    version: "1.0.0",
    description,
    keywords,
    repository: `https://github.com/your-account/${name}`,
    bugs: { url: `https://github.com/your-account/${name}/issues` },
    license: "MIT",
    engines: { lumine: "^1.0.0" },
  };
}

function commonFiles(name, description, featureLines, commands = null) {
  const commandSection = commands
    ? `\n## Commands\n\nCommands available in \`lumine-workspace\`:\n\n${commands}\n`
    : "";
  return {
    "LICENSE.md": LICENSE,
    "eslint.config.js": ESLINT_CONFIG,
    "prettier.config.js": PRETTIER_CONFIG,
    "README.md": `# ${name}

${description}

## Features

${featureLines}

## Installation

To install \`${name}\` search for _${name}_ in the Install pane of the Lumine settings or run \`lumine --install your-account/${name}\`.
${commandSection}
## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
`,
  };
}

function editorPackage(name) {
  const title = titleFromName(name);
  const description = `Add ${title} commands and editing behavior.`;
  const command = `${name}:toggle`;
  const manifest = {
    ...metadata(name, description, ["editing", "productivity", "workflow"]),
    backgroundTips: [`Run the main ${title} action with {{ '${command}' | keystroke }}`],
    main: "./lib/main",
    files: ["lib", "spec", "styles"],
    activationCommands: { "lumine-workspace": [command] },
    scripts: SCRIPTS,
    devDependencies: DEV_DEPENDENCIES,
  };
  return {
    ...commonFiles(
      name,
      description,
      `- **Main command**: exposes a ready-to-customize workspace action.\n- **Modern source**: starts with JavaScript, JSON, and CSS configured for Node 24.\n- **Test scaffold**: includes a Lumine integration spec and current lint tooling.`,
      `- \`${command}\`: run the package's main action.`,
    ),
    "package.json": `${JSON.stringify(manifest, null, 2)}\n`,
    "lib/main.js": `let commandDisposable = null;

module.exports = {
  activate() {
    commandDisposable = lumine.commands.add("lumine-workspace", "${command}", () => {
      lumine.notifications.addInfo("${title} is ready to customize.");
    });
  },

  deactivate() {
    commandDisposable?.dispose();
    commandDisposable = null;
  },
};
`,
    [`styles/${name}.css`]: `:root {
  --${name}-accent-color: var(--syntax-accent);
}
`,
    [`spec/${name}-spec.js`]: `describe("${title}", () => {
  it("activates successfully", () => {
    waitsForPromise(async () => {
      const pack = await lumine.packages.activatePackage("${name}");
      expect(pack.mainModule).toBeDefined();
    });
  });
});
`,
  };
}

function languagePackage(name) {
  const title = titleFromName(name);
  const languageId = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const extension = languageId.replace(/-/g, "").slice(0, 8) || "sample";
  const scopeName = `source.${languageId}`;
  const description = `Add ${title} syntax highlighting and file recognition.`;
  const manifest = {
    ...metadata(name, description, ["syntax", "grammar", "highlighting"]),
    files: ["grammars", "spec"],
    scripts: SCRIPTS,
    devDependencies: DEV_DEPENDENCIES,
  };
  return {
    ...commonFiles(
      name,
      description,
      `- **File recognition**: recognizes \`.${extension}\` source files.\n- **Grammar scaffold**: provides a valid TextMate-compatible JSON grammar.\n- **Test scaffold**: verifies that Lumine loads the generated scope.`,
    ),
    "package.json": `${JSON.stringify(manifest, null, 2)}\n`,
    [`grammars/${languageId}.json`]: `${JSON.stringify(
      {
        name: title,
        scopeName,
        fileTypes: [extension],
        patterns: [],
      },
      null,
      2,
    )}\n`,
    [`spec/${name}-spec.js`]: `describe("${title} grammar", () => {
  it("loads the generated grammar", () => {
    const grammar = lumine.grammars.grammarForScopeName("${scopeName}");
    expect(grammar).toBeDefined();
  });
});
`,
  };
}

function syntaxTheme(name) {
  const title = titleFromName(name);
  const description = `Provide a customizable ${title} syntax color palette.`;
  const themeName = name.endsWith("-syntax") ? name : `${name}-syntax`;
  const manifest = {
    ...metadata(name, description, ["colors", "syntax", "palette", "dark"]),
    files: ["spec", "styles"],
    themes: [{ name: themeName, theme: "syntax", styles: "styles/variables" }],
    scripts: SCRIPTS,
    devDependencies: DEV_DEPENDENCIES,
  };
  return {
    ...commonFiles(
      name,
      description,
      `- **Complete palette**: defines editor, gutter, guide, selection, and terminal colors.\n- **CSS variables**: uses native custom properties for straightforward customization.\n- **Theme manifest**: registers a syntax theme directly with Lumine.`,
    ),
    "package.json": `${JSON.stringify(manifest, null, 2)}\n`,
    "styles/variables.css": `:root {
  --syntax-text-color: hsl(220, 16%, 78%);
  --syntax-cursor-color: hsl(205, 90%, 62%);
  --syntax-selection-color: hsl(220, 24%, 24%);
  --syntax-selection-flash-color: hsl(205, 90%, 62%);
  --syntax-background-color: hsl(220, 22%, 12%);
  --syntax-gutter-background-color: var(--syntax-background-color);
  --syntax-gutter-background-color-selected: hsl(220, 22%, 18%);
  --syntax-invisible-character-color: hsla(220, 16%, 78%, 0.18);
  --wrap-guide-color: hsla(220, 16%, 78%, 0.1);
  --indent-guide-color: hsla(220, 16%, 78%, 0.12);
  --indent-guide-stack-color: hsla(220, 16%, 78%, 0.2);
  --indent-guide-active-color: hsla(205, 90%, 62%, 0.32);
  --syntax-result-marker-color: hsla(205, 90%, 62%, 0.25);
  --syntax-result-marker-color-selected: hsl(205, 90%, 62%);
  --terminal-selection-background-color: var(--syntax-selection-color);
  --terminal-cursor-color: var(--syntax-cursor-color);
}
`,
    [`spec/${name}-spec.js`]: `const manifest = require("../package.json");

describe("${title} syntax theme", () => {
  it("registers a syntax theme", () => {
    expect(manifest.themes).toContain(
      jasmine.objectContaining({ name: "${themeName}", theme: "syntax" }),
    );
  });
});
`,
  };
}

async function generatePackage(mode, packagePath) {
  const name = path.basename(packagePath);
  const factories = { package: editorPackage, language: languagePackage, theme: syntaxTheme };
  const factory = factories[mode];
  if (!factory) throw new Error(`Unknown generator mode: ${mode}`);

  const files = factory(name);
  await fs.mkdir(packagePath, { recursive: false });
  await Promise.all(
    Object.entries(files).map(async ([relativePath, contents]) => {
      const target = path.join(packagePath, relativePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, contents, "utf8");
    }),
  );
  return Object.keys(files).sort();
}

module.exports = { generatePackage };
