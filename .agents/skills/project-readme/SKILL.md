---
name: project-readme
description: >-
  Write and maintain the project's README.md — the app's name and description, requirements, how to
  run it from source, how to build the installers, and where to download releases. Use when a new
  app is built and verified, and whenever a change alters a fact the README states: the app's name
  or purpose, a native module, npm scripts, or the GitHub release workflow.
---

# Project README

The scaffolding ships no `README.md`, because only the finished app knows what to say in it. Write
it **once the first build of the app passes verification**, so it describes what exists, not what
was planned. After that, keep it true: a change that alters a fact the README states updates the
README in the same change.

The README is for people who use or build the app, not for agents. Leave out the `agent` commands,
the skills, and `AGENTS.md`.

## Where each fact comes from

Read every fact from the project. Never write one from memory, and never leave a placeholder.

| Section | Source |
| --- | --- |
| Title | `app.name` in `mobrowser.conf.json`, as the `#` heading. |
| Description | What the app does for its user, in one or two sentences, from what you built. Put the same sentence in `app.description` in `mobrowser.conf.json`: Settings → About shows it. A short feature list may follow. |
| Requirements | The **Prerequisites** of `node_modules/@mobrowser/api/docs/guides/quickstart/_index.md` (operating systems and Node.js). With a native module, also the **Prerequisites** of `guides/develop/native-module.md` (C++, `CMakeLists.txt` at the root) or `guides/develop/native-module-rust.md` (Rust, `Cargo.toml` at the root). Link the downloads the docs link. |
| Run from source | `git clone`, `npm install`, then the `dev` script, written out as an `npm run` command. Add `npm run test:e2e` for the end-to-end tests when `package.json` has that script and `test/` has tests. |
| Build | `npm run build` puts the app in `build/dist/<platform>-<arch>/bin`; `npm run pack` puts the installer in `build/dist/<platform>-<arch>/pack`: a DMG on macOS and a `Setup.exe` on Windows. Linux has no installer; the app is the `bin` folder. Mention `npm run build -- --x64` only for a Mac that builds the Intel version. See `guides/package/packaging.md`. |
| Download | Only when `.github/workflows/release.yml` exists — see below. |

Add a License section only when the project has a `LICENSE` file, and link it.

## Download

`.github/workflows/release.yml` builds the app for macOS (Apple Silicon and Intel), Windows, and
Linux when a `v*` tag is pushed, and **drafts** a GitHub Release. The release becomes visible only
once its owner publishes the draft.

- Link `https://github.com/<owner>/<repo>/releases/latest`, with `<owner>/<repo>` taken from
  `git remote get-url origin` (both `git@github.com:owner/repo.git` and
  `https://github.com/owner/repo.git` give `owner/repo`). With no GitHub `origin`, leave the section
  out and tell the user that it is waiting for the repository; never invent a URL.
- Say which file to download on each platform: `<name>-<version>-arm64.dmg` for Apple Silicon Macs,
  `<name>-<version>-x64.dmg` for Intel Macs, the `.exe` installer for Windows, and
  `<name>-<version>-linux-x64.tar.gz` for Linux (extract it and run the executable inside). The
  `.nupkg` and `releases.*.json` files are for app updates, not for download; say so.
- A section on publishing a release is for the project's maintainers: if you add one, link
  `node_modules/@mobrowser/api/docs/guides/distribute/github-workflows.md` rather than copy it.
- Don't claim the builds are signed. Only when the user says they are not, add that macOS asks to
  confirm opening the app in System Settings → Privacy & Security, and Windows SmartScreen asks to
  "Run anyway".

Without the workflow, leave the section out. Don't add the workflow to get one; `AGENTS.md` says when
it is added.

## An existing README

A project created in a repository that already had a README keeps it. Add the missing sections to
it and correct what is wrong, but keep what the user wrote.

## When to update it

- The app's name, purpose, or main features change: the title, the description, and
  `app.description` in `mobrowser.conf.json`.
- `npm run add native` adds a C++ or Rust module: the requirements.
- `npm run add github-actions` adds the release workflow, or a GitHub `origin` appears: the Download
  section.
- An npm script the README names is added, renamed, or removed: the commands.

## Probe

Run it from the project root after writing or updating the README. The command must print nothing:

```bash
node -e '
const fs = require("fs"), { execSync } = require("child_process")
const fail = (m) => console.log("README.md: " + m)
if (!fs.existsSync("README.md")) { fail("missing"); process.exit() }
const readme = fs.readFileSync("README.md", "utf8")
const app = require("./mobrowser.conf.json").app
const scripts = require("./package.json").scripts
if (!readme.split("\n").includes("# " + app.name)) fail(`no "# ${app.name}" title`)
if (!app.description) fail("app.description in mobrowser.conf.json is empty")
for (const m of readme.matchAll(/TODO|TBD|<owner>|<repo>|your-(user|org|name)|\$\{/gi)) fail(`placeholder "${m[0]}"`)
for (const [, s] of readme.matchAll(/npm run ([a-z][\w:-]*)/g)) if (!scripts[s]) fail(`"npm run ${s}": no such script`)
const workflow = fs.existsSync(".github/workflows/release.yml")
let origin = ""
try { origin = execSync("git remote get-url origin", { stdio: "pipe" }).toString() } catch {}
const repo = origin.match(/github\.com[:/]([^/]+\/[^/\s]+?)(\.git)?\s*$/)?.[1]
const link = readme.match(/github\.com\/([^/\s)]+\/[^/\s)]+)\/releases/)?.[1]
if (link && !workflow) fail("links releases, but there is no release workflow")
if (link && repo && link !== repo) fail(`releases link is for ${link}, origin is ${repo}`)
if (!link && workflow && repo) fail("no link to the GitHub releases")
'
```
