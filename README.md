# package-generator

Generate ready-to-edit packages and syntax themes.

## Features

- **Package scaffolds**: creates a JavaScript package with a command, CSS, specs, and current quality tooling.
- **Syntax theme scaffolds**: creates a CSS custom-property palette and a registered syntax theme.
- **Development links**: links generated projects into `packages` or `packages-dev` without overwriting an existing entry.
- **Project handoff**: adds the generated project to the current workspace immediately.

## Installation

To install `package-generator` search for it in the Install pane of the Lumine settings, or run the command `lumine --install lumine-code/package-generator`.

## Commands

Commands available in `lumine-workspace`:

- `package-generator:generate-package`: create a JavaScript package,
- `package-generator:generate-syntax-theme`: create a syntax theme package.

Tree-sitter language packages require a real parser, queries and capture fixtures, so maintainers create them with the dedicated `.dev/grammar-authoring/new-grammar-package.js` workflow in a full Lumine workspace rather than this general-purpose generator.

## Customization

Generated editor packages seed their package-local accent hook from the UI accent:

```css
:root {
  --your-package-accent-color: var(--accent-color);
}
```

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
