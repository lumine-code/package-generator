# package-generator

Generate ready-to-edit packages, languages, and syntax themes.

## Features

- **Package scaffolds**: creates a JavaScript package with a command, CSS, specs, and current quality tooling.
- **Language scaffolds**: creates a JSON grammar with file recognition and a loading spec.
- **Syntax theme scaffolds**: creates a CSS custom-property palette and a registered syntax theme.
- **Development links**: links generated projects into `packages` or `packages-dev` without overwriting an existing entry.
- **Project handoff**: adds the generated project to the current workspace immediately.

## Installation

To install `package-generator` search for _package-generator_ in the Install pane of the Lumine settings or run `lumine --install lumine-code/package-generator`.

## Commands

Commands available in `lumine-workspace`:

- `package-generator:generate-package`: create a JavaScript package.
- `package-generator:generate-language-package`: create a language grammar package.
- `package-generator:generate-syntax-theme`: create a syntax theme package.

## Configuration

- `package-generator.createInDevMode`: link generated projects in `packages-dev` instead of `packages`.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
