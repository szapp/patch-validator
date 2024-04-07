# Patch Validator

[![CI](https://github.com/szapp/patch-validator/actions/workflows/ci.yml/badge.svg)](https://github.com/szapp/patch-validator/actions/workflows/ci.yml)
[![Coverage](badges/coverage.svg)](https://github.com/szapp/patch-validator/actions/workflows/ci.yml)

GitHub action for checking if Daedalus script symbols in a Gothic VDF patch adhere to the [naming conventions](https://github.com/szapp/Ninja/wiki/Inject-Changes#naming-conventions). The action collects a table of all global (unscoped) symbols across all Daedalus parsers. For symbol names without the necessary prefix, the action fails with a code annotation. This GitHub action is useful for CI of Gothic VDF patches that include Daedalus code.

> [!Important]
> This action does not check the integrity of the scripts (i.e. no syntax or type checks). Do not mistake valid scripts for sound code. Please refer to additional packages for that, e.g. [Parsiphae](https://github.com/szapp/parsiphae-action).

## Usage

Create a new GitHub Actions workflow in your project, e.g. at `.github/workflows/validation.yml`.
The content of the file should be in the following format:

```yaml
name: validation

# Run workflow on push with changes of src or d files
on:
  push:
    paths:
      - '**.src'
      - '**.d'

# These permissions are necessary for creating the check runs
permissions:
  checks: write
  contents: read

# The checkout action needs to be run first
jobs:
  patch-validator:
    name: Run validator on scripts
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check for validity
        uses: szapp/patch-validator@v1
        # with:
        #   - patchName: # Optional (see below)
        #   - rootPath: # Optional
        #   - token: # Optional
```

## Configuration

- `patchName`:
  Identifier of the patch, i.e. the VDF name.  
  Defaults to the repository name.

- `rootPath`:
  The path to the patch root, i.e. where the Ninja directory and `.validator.yml` (see below) are.  
  Defaults to the repository root.

- `token`:
  The `GITHUB_TOKEN` to [authenticate on behalf of GitHub Actions](https://docs.github.com/en/actions/security-guides/automatic-token-authentication#using-the-github_token-in-a-workflow).  
  Defaults to the GitHub token, i.e. checks are created by the GitHub Actions bot.

Additionally, place a file named `.validator.yml` in the root of your repository with the following content.
All settings are optional, but the file must exist (even if empty).

```yaml
prefix:
  - ... # Alternative short descriptor(s) that prefixes global symbol names
ignore:
  - ... # Symbol name(s) that intentionally overwrite common symbols
```
