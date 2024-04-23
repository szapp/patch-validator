# Patch Validator

[![CI](https://github.com/szapp/patch-validator/actions/workflows/ci.yml/badge.svg)](https://github.com/szapp/patch-validator/actions/workflows/ci.yml)
[![Coverage](badges/coverage.svg)](https://github.com/szapp/patch-validator/actions/workflows/ci.yml)

GitHub action for checking if Daedalus script symbols and resource files in a Gothic VDF patch adhere to the [naming conventions](https://github.com/szapp/Ninja/wiki/Inject-Changes#naming-conventions), if all symbol references are valid, and that no vital symbols are overwritten. This allows to determine the general compatibility of a patch.

The action collects symbol tables of all Daedalus parsers (e.g. content, menu, etc.) and walks through the resource file tree (i.e. everything under "\_work/Data"). For symbols, symbol references, and resource file names that violate the compatibility assurances, the action fails with code annotations. This GitHub action is useful for CI of Gothic VDF patches that include Daedalus code and/or resource files.

> [!Important]
> This action does not check the integrity of the scripts (i.e. no syntax or type checks). Do not mistake valid scripts for sound code. Please refer to additional packages for that, e.g. [Parsiphae](https://github.com/szapp/parsiphae-action).

## Usage

Create a new GitHub Actions workflow in your project, e.g. at `.github/workflows/validation.yml`.
The content of the file should be in the following format:

```yaml
name: validation

# Trigger workflow on push events with changes in SRC or D files
on:
  push:
    paths:
      - '**.src'
      - '**.d'

# These permissions are necessary for creating the check runs
permissions:
  contents: read
  checks: write

# The checkout action needs to be run first
jobs:
  patch-validator:
    name: Run validator on scripts
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check for validity
        uses: szapp/patch-validator@v1
        with:
          patchName: # Optional (see below)
          rootPath: # Optional
          token: # Optional
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

Additionally, place a file named `.validator.yml` in `rootPath` of your repository with the following content.
All settings are optional, but the file must exist (even if empty).

- `prefix`:
  One or several additional short descriptors that prefix global symbol names. By default the `patchName` and `PATCH_` + `patchName` are expected symbol prefixes, e.g. `MyWork` and `Patch_MyWork`.  
  May either be blank, a string or a YAML list of strings

- `ignore-declaration`:
  One or several symbols names that intentionally overwrite common symbols.  
  May either be blank, a string or a YAML list of strings

- `ignore-resource`:
  One or several resource file paths that intentionally overwrite existing textures, meshes, worlds, animations, sounds, or presets. The paths are case-insensitive and glob pattern wildcards are supported.
  May either be blank, a string or a YAML list of strings

Example content:

```yaml
prefix: FOA # Either a single entry
ignore-declaration:
  - DIA_NONE_9022_KALIF # Or a YAML list
  - B_SomeFunction
ignore-resource:
  - '_work/Data/Textures/_compiled/Overwrite-C.TEX'
  - '_work/Data/Sounds/SFX/Hero*.WAV'
```

## Remove second commit status check

The way GitHub check suites are designed, there will be two check statuses attached to a commit when using the 'push' event trigger.
One check status is the actual check run containing the error report and line annotations, the second one is the workflow run.
Unfortunately, the creation of the superfluous workflow check status cannot be suppressed.

One workaround is to delete the entire workflow after the checks have been performed, effectively removing the check status from the commit.
However, this is not possible with the default `GITHUB_TOKEN`, to avoid recursive workflow runs.
To remove the additional status check, call this GitHub Action with an authentication `token` of a GitHub App and enable the `check_run` event with `completed` (see below).
For more details the issue, see [here](https://github.com/peter-murray/workflow-application-token-action#readme).
Always leave the additional input `cleanup-token` at its default.

> [!Tip]
> This is only an optional cosmetic enhancement and this GitHub action works fine without.

```yaml
name: validation

on:
  push:
    paths:
      - '**.src'
      - '**.d'
  check_run:
    types: completed

permissions:
  contents: read
  checks: write
  actions: write

jobs:
  patch-validator:
    name: Run validator on scripts
    if: github.event_name != 'check_run' || github.event.check_run.external_id == github.workflow
    runs-on: ubuntu-latest
    steps:
      - uses: actions/create-github-app-token@v1
        id: app-token
        with:
          app-id: ${{ vars.APP_ID }} # GitHub App ID
          private-key: ${{ secrets.APP_KEY }} # GitHub App private key
      - uses: actions/checkout@v4
      - name: Check for validity
        uses: szapp/patch-validator@v1
        with:
          patchName: # Optional (see below)
          rootPath: # Optional
          token: ${{ steps.app-token.outputs.token }}
```

> [!Note]
> This procedure only works reasonably well if `patch-validator` is only called once in the workflow file.
