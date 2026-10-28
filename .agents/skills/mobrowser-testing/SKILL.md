---
name: mobrowser-testing
description: Verify MōBrowser application changes and preserve meaningful regression coverage. Use for features, bug fixes, refactors, UI changes, and test work, including deciding when no new test is needed.
---

# MōBrowser verification and regression tests

Preserve important application behavior as executable knowledge for future agents. Choose tests
by the regressions they would catch, not by changed files, test counts, or coverage percentages.
The project's tests are end-to-end: Playwright drives the built app the way a user does. When the
user asks for specific tests, write them.

## Choose the tests

Read the affected code and existing tests first. Identify what the request changes and what must
stay the same, including other journeys using shared code. Run the existing tests covering the
affected behavior before editing, so pre-existing failures are distinguishable from regressions.

- Name the observable behavior at risk and a plausible defect existing coverage would miss.
  Prioritize important user journeys, business rules, data integrity, consequential error
  handling, and reported bugs. Decide by the risk, not by the size of the change.
- If you can't name such a defect, add no test. Otherwise add the steps and checks to the existing
  test of the journey they belong to. Add a separate test only for a different starting state or a
  journey no test covers; do not combine unrelated scenarios just to reduce the test count. Either
  way, when the request changes behavior a test asserts, change that assertion in place.
- Choose a realistic scenario that exposes the risk, not only the first successful run: include
  cancellation or error recovery when the request makes them matter.
- Cosmetic changes and behavior-preserving refactors need no new tests, even when the code they
  touch has none. Verify them with the existing tests and the first step of the ladder below.
- Skip tests of styling, implementation details, and exhaustive input permutations without a
  concrete risk. Use snapshot assertions only when the exact output is the contract. Keep
  exploratory checks temporary unless they fill a meaningful regression gap.

For a bug fix, see the new or extended test fail for the reported reason before fixing the code,
then pass with the fix.

## Verify in the real app

Verification is part of every change, in both directions: after you build something, and whenever
you're asked to check, verify, review, test, or QA existing behavior, which includes how it looks.
Hunt for defects rather than confirm them away: assume at least one exists and go find it. Passing
`tsc` proves nothing about how the app looks or behaves.

Launch, restart, stop, and drive the app only as `AGENTS.md` describes, with
`npm run -s agent -- <command>` (`npm run -s mobrowser -- agent <command>` in a project without an
`agent` script); `agent --help` lists the commands. Skills and rules never launch the app. Read "What the tooling cannot see" there before trusting any result.

**Size the check to the change.** Each step includes the ones above it.

1. **Cosmetic change** (copy, spacing, a token): run the existing tests, then one `agent screenshot`
   of the changed surface; both themes when a token changed.
2. **Behavior change or bug fix**: arm the error listener from `AGENTS.md`, drive the changed path
   with `agent` commands, and read the outcome back with `agent eval` (the resulting text, state,
   or file), not only that something appeared. Reproduce a reported bug before fixing it.
3. **New screen, new controls, or a new overlay**: also run the **`## Probe`** section of every rule
   you touched (each rule file under `.agents/skills/*/rules/` ends with one), and activate each new
   control once, including the ones inside menus and dialogs and the ones reached by hovering. For
   a screen with many controls, crawl it from inside the page with one `agent eval` instead of one
   command per control. A grep probe hit you keep on purpose gets a `probe-ok: <reason>` comment on
   the matched line, which every probe filters out; don't re-justify it on each run. When the
   matched line is a JSX tag, put the comment inside the tag, `<Icon className="size-8"
   /* probe-ok: standalone */ />` on one line. A `{/* … */}` beside the element can break the
   build: after an element inside `cond && (…)` it makes a second root. A `//` there is page text.
4. **Native-shell change** (`src/main`): restart the app first, since main-process changes don't
   hot-reload, then read the window and menu state back with the desktop-shell probes, and tell the
   user what the tooling can't see (native menus, tray, Dock, traffic lights).

Batch checks: one `agent eval` that returns an object with every value you need costs one turn;
ten single-value calls cost ten. Base the steps of saved scenarios on what you observed.

**What's worth protecting becomes a test.** Once a manual check has passed, repeat it by hand only
for new changes, failures, or unresolved risks. A behavior worth checking again on the next change
goes into the e2e suite below, which runs hidden, on a fresh profile, without touching the user's
app or data. Later changes run the suite plus a quick look, not the full manual pass again.

**Report evidence, not impressions.** State what you exercised and what you read back ("`#root`
mounted, no errors recorded, measured inset 8px"). Never report "works" with a known crash, console
error, or visible defect: fix it, or flag it to the user explicitly.

## Write regression tests

Save tests in `test/e2e/` as `.test.ts` or `.test.js`, importing `test` and `expect` from
`@mobrowser/cli/e2e`, not `@playwright/test`. Exercise the real renderer, IPC, main-process, and
native behavior involved; do not mock or bypass the parts of the app the test is meant to prove.

- Each test gets a fresh app and profile; `page` is the first window and `context.pages()` lists
  the windows. Read the installed `@mobrowser/cli/e2e.d.ts` before using unfamiliar fixtures or
  configuration: `browser` is Playwright's separate Chromium, and context options under `use`
  such as viewport, locale, and baseURL do not configure the app.
- Handle JavaScript dialogs with `page.on("dialog", ...)`. For native message boxes/file pickers,
  queue `app.answerDialog({ ... })` before triggering them; `app.dialogs()` records requests and
  answers. Interception verifies the application's handling of an answer, not the native dialog UI.
- Keep tests portable across macOS, Windows, and Linux. Create files under
  `test.info().outputPath()` (including dialog destinations), use `path` for paths, and press
  `ControlOrMeta` for shortcuts. Avoid screenshot comparisons, exact window sizes, and OS-specific
  text. Keep test-owned files and state independent of other tests and the user's environment.
- A test can't click native menu items, so a window or command that is reachable only from the
  menu needs a trigger the page can reach: a shortcut the renderer handles, a button, or an IPC
  call.

- Name tests after the behavior they protect (`keeps the draft after a reload`) and files after
  their feature area. Add a short reason or issue link when the rule is not obvious; a future
  agent sees only the failing test.
- Derive role/name or other user-facing locators from the observed UI; snapshot refs such as `e12`
  do not belong in tests. If an element lacks an accessible role or name, fix that in the UI (for
  example, with `aria-label`) instead of adding a test-only attribute.
- Assert the consequential outcome: the resulting text, control state, or saved file contents,
  not merely that something appeared. Derive expected results from the requirement, established
  behavior, or independent fixtures, not from what the app currently shows, the implementation's
  helpers, or a copy of its calculation; if the app shows something else, that is a defect to fix
  or report.
- Use retrying assertions and observable completion signals instead of fixed sleeps. Before a
  negative assertion, wait until the app has handled the action, then check where the unwanted
  effect would show, such as the file a canceled action must not write. A missing-file or
  empty-status check made right after the action passes even before the app reacts.
- For persistence, read the value back through the app after the relevant lifecycle transition.
  `page.reload()` proves restoration after a renderer reload, not durability on disk or across
  app restarts. The fixture cannot restart the app with the same profile. Avoid assertions about
  undocumented storage formats.
- The fixture cannot control the main process's clock or randomness. Do not predict their exact
  outputs; assert deterministic properties or relationships that protect useful behavior.

## Run and diagnose

- `npm run test:e2e` builds the app and runs the suite with hidden windows and a 30-second default
  test timeout. Append `-- -g "scenario name"` or a file path to focus it, and `-- --show-window`
  to watch.
- Run relevant tests while iterating, then the whole suite before finishing application
  changes. Confirm the intended tests actually executed: skipped scenarios do not verify
  behavior.

A failing test for behavior the request did not change is a regression: fix the code, not the
test. When a requested change moves or renames what a test interacts with, update its locators and
waits but keep what it asserts; remove obsolete cases and replaced template examples once they no
longer protect required behavior. If an existing test already failed before your change, looks
wrong, or you can't tell whether the request changes what it checks, leave it unchanged and ask
the user or report it rather than working around it. Never skip, delete, or loosen a test (a
broader matcher or locator, a removed assertion) just to get a passing run. Fix flakiness at its
cause instead of adding retries or longer timeouts.

Failed tests' artifacts are under `build/test-results/e2e/<test>/`; the output lists their paths,
and each run replaces them. For crashes/exits, start with `app.log`. Otherwise inspect
`error-context.md` and `test-failed-<n>.png`, then `trace.zip` for actions, console, network, and
page screencasts. Use `npx playwright trace open <trace.zip>`, followed by
`npx playwright trace console`, `requests`, `actions`, `errors`, or
`screenshot <action> -o build/<file>.png`; finish with `npx playwright trace close`.
`npm run test:e2e -- --verbose` adds Chromium logs to `app.log`.

On GitHub Actions, start with `gh run view <run-id> --log-failed`; download artifacts with
`gh run download <run-id> -n test-results-Linux -D build/test-results/ci-Linux`
(substitute `macOS` or `Windows`).
