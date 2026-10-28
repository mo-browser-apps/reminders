# App data: documents and records

How the app keeps its **own** data: notes, tasks, records, anything the user creates. Two other
kinds of state have their own homes:

- **Settings** (theme, launch at login, toggles) belong to the main process — see
  [settings-window.md](./settings-window.md#where-each-setting-lives).
- **UI conveniences** (a sidebar width, a collapsed section) may use the renderer's
  `localStorage`, which both windows share. Never put app data there: the main process can't read
  it, and it lives inside the browser profile with the cache.

## Contents

- The facts
- Two different Node.js versions
- The main process owns the data
- Pick the format
- Write atomically, keep a backup
- Reject stale saves with a revision
- Optimistic updates: send one at a time
- Version the format
- Probe

---

## The facts

Established from this SDK's source, so don't re-derive them:

- **The folder is `app.getPath('userData')`.** It is per user and created on the first launch:
  `~/Library/Application Support/<BUNDLE_ID>.<APP_EXECUTABLE_NAME>` on macOS,
  `%LOCALAPPDATA%/<…>/User Data` on Windows, and `~/.config/<APP_EXECUTABLE_NAME>` on Linux. The
  browser profile (cache, cookies, `localStorage`) and `prefs.json` live there too, so keep the
  app's files in **their own subfolder**, such as `data/`.
- **That path is permanent once the app ships.** It follows `executableName` (or `app.name`), so
  renaming the app later moves the folder and orphans every user's data. Settle the name before the
  first release.
- **The main process runs the Node.js embedded in the MōBrowser runtime**, not the one on the
  developer's machine (see below). Its runtime is built with `node:sqlite` enabled, so `DatabaseSync`,
  transactions, and `sqlite.backup()` work there without a flag or a dependency. The API is still a
  release candidate.
- A database package with a native addon (`better-sqlite3`, `sqlite3`) has to match the embedded
  runtime's ABI. Don't add one: `node:sqlite` needs no dependency. Ask the user before adding any
  storage dependency.

## Two different Node.js versions

A project meets two Node.js versions, and they are not the same:

| Node.js | Version | Runs |
| --- | --- | --- |
| Embedded in the MōBrowser runtime | set by the SDK version, and changes when the SDK is upgraded | the main process: `src/main`, your store, IPC services |
| On the developer's or CI machine | any version in `package.json`'s `engines.node` range (20, 22, or 24); CI runs several | the `mobrowser` CLI, Vite, `vite.config.ts`, `playwright.config.ts`, and the e2e tests in `test/` |

What follows from that:

- **Don't write a Node.js version into code or comments.** When it matters, read it where the code
  runs: `process.versions.node` (and `process.versions.sqlite`) in the main process reports the
  embedded runtime.
- **Use `node:sqlite` only in main-process code.** Node.js 20 has no `node:sqlite` at all, so a
  test, a build script, or `vite.config.ts` that opens the database fails on the CI machines that
  run Node.js 20. An e2e test reads data back **through the app** (its UI or IPC), never by
  opening the data file itself.
- **`@types/node` follows the embedded runtime's major**, so main-process code type-checks against
  what really runs it. The types can't tell you what an older developer or CI Node.js lacks: in
  `test/`, `vite.config.ts`, and `playwright.config.ts`, stay with APIs that Node.js 20 already has.

## The main process owns the data

Read and write files only in the main process. One module, such as `src/main/store.ts`, loads the
data at startup, applies every change, and saves. The data is described by proto messages, and the
renderer reaches it through a proto service
([structure.md](../../shadcn/rules/structure.md#the-proto-files-are-the-domain-model)): it sends
changes, and every mutating RPC returns the new state, so each window re-renders from the source of
truth. That
is the same pattern as the Settings service. The Settings window doesn't load the store itself;
actions that need the data run in the main window
([settings-window.md](./settings-window.md#actions-that-need-the-main-windows-data)).

**Incorrect:** the renderer keeps the records and writes them where it can.

```tsx
localStorage.setItem("tasks", JSON.stringify(tasks))   // invisible to the main process
```

**Correct:** the renderer sends the change; the main process validates it, applies it, saves, and
answers.

```tsx
const { tasks, revision: next } = await ipc.task.Apply({ baseRevision: revision, changes: [{ updated: task }] })
```

## Pick the format

| Data | Format |
| --- | --- |
| Up to a few thousand records, loaded whole, saved as a whole | one file holding a proto message, written with its generated `encode` |
| More than that, queried or filtered on disk, or edited in many small pieces | `node:sqlite`, with rows read into and written from the same proto messages |

Either way the saved data is defined by the `.proto` files, like everything else, and the store
module converts at its edge only. Choose at the start: moving from a file to SQLite later is a
migration with a user's data at stake.

```proto
// task.proto — the saved file is a message too.
message TaskStore {
  int32 format_version = 1;
  int64 revision = 2;
  repeated Task tasks = 3;
}
```

## Write atomically, keep a backup

A crash or power loss in the middle of a write must leave the previous file intact.

**Incorrect:** writing in place. An interrupted write leaves a truncated file, and the next launch
can't parse it.

```ts
fs.writeFileSync(file, TaskStore.encode(data).finish())
```

**Correct:** write a temporary file in the same folder, keep the current file as the backup, then
rename. A rename within one folder replaces the target in one step on macOS, Linux, and Windows.

```ts
import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from '@mobrowser/api'
import { TaskStore } from './gen/task'

const dir = path.join(app.getPath('userData'), 'data')
const file = path.join(dir, 'tasks.pb')

export function save(data: TaskStore) {
  fs.mkdirSync(dir, { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, TaskStore.encode(data).finish()) // probe-ok: temp file, renamed below
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`)
  fs.renameSync(tmp, file)
}

export function load(): TaskStore {
  for (const candidate of [file, `${file}.bak`]) {
    try {
      return migrate(TaskStore.decode(fs.readFileSync(candidate)))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') console.error(`Can't read ${candidate}`, error)
    }
  }
  return TaskStore.create({ formatVersion: CURRENT_FORMAT })
}
```

- **Save after every mutation, synchronously, in the RPC that made it.** Then a quit never loses a
  change, and there's no in-flight write to flush.
- **One writer.** Only the store module calls `save`. Two windows never write the file themselves.
- **Tell the user when the backup was used.** Loading from `.bak` means the last save was lost:
  show it, don't hide it.
- **With SQLite**, open the database once with `new DatabaseSync(path.join(dir, 'app.db'))`, run
  `PRAGMA journal_mode = WAL`, and wrap every multi-row change in `BEGIN`/`COMMIT`. SQLite is
  atomic by itself; for the backup copy, call `sqlite.backup(db, …)` at startup instead of copying
  the file. Read rows into the proto messages (`Task.create({ … })`) in the store module, so nothing
  outside it sees a row.

## Reject stale saves with a revision

Two windows, or one window whose data is old, can each send a change based on what they last saw.
Without a check, the later save silently overwrites the earlier one.

- Keep a `revision` number in the store and increase it on every change.
- Each mutating RPC carries the `baseRevision` the renderer last received.
- When `baseRevision` isn't the current revision, the main process changes nothing and returns
  the current state with a conflict flag. The renderer shows the fresh data and tells the user
  that their change wasn't applied.
- With SQLite, put the check in the statement:
  `UPDATE tasks SET … , revision = revision + 1 WHERE id = ? AND revision = ?`, then treat
  `changes === 0` as a conflict.

## Optimistic updates: send one at a time

A UI that saves in the background can send a second change before the first has answered. Both
then carry the revision the renderer last *received*, so the main process applies the first, bumps
the revision, and rejects the second as a conflict that never happened.

**Incorrect:** every change goes out on its own with the same base revision.

```ts
function apply(change: TaskChange) {
  void ipc.task.Apply({ baseRevision: revision, changes: [change] })
}
```

**Correct:** a serial send queue. The next request leaves only when the previous one has answered,
and carries the revision that answer returned. The list renders the main process's result.

```ts
let revision = 0
let queue: Promise<void> = Promise.resolve()

export function apply(change: TaskChange) {
  queue = queue
    .then(async () => {
      const reply = await ipc.task.Apply({ baseRevision: revision, changes: [change] })
      revision = reply.revision
      setTasks(reply.tasks) // the main process's result, applied or not
      if (reply.conflict) toast.error("Another window changed this list, so your change wasn't applied.")
    })
    .catch((error: unknown) => toast.error(`Couldn't save the change: ${String(error)}`))
}
```

- **Create and continue without waiting.** The renderer gives a new record its id
  ([structure.md](../../shadcn/rules/structure.md#the-proto-files-are-the-domain-model)), so the
  next change can name it right away: `apply({ created: { id, title, parentId } })`, then
  `apply({ moved: { id, parentId: aboveId } })` on Tab. The queue sends them in order, and the
  second one carries the revision the first reply returned. Don't wait for the reply to learn the
  id, and don't keep a second promise chain for "the last created row".
- **Don't recompute the result in the renderer.** The rules that decide the data run in the main
  process only ([structure.md](../../shadcn/rules/structure.md#the-proto-files-are-the-domain-model)),
  and a local copy of them drifts. The answer from the same machine takes milliseconds.
- **Show the user's input while it is queued, not a predicted result.** A text field keeps its
  draft, and a checkbox shows its new state, until the reply arrives; the list then renders from
  the reply.
- A conflict means **another** window changed the data. Show the fresh state and say that the change
  wasn't applied; don't retry it silently.
- Keep the queue in the module that owns the store connection, not in a component, so a re-render
  doesn't start a second one. The `.catch` keeps one failed call from stopping every later one.

## Version the format

The proto rules keep old files readable: add fields with new numbers, never change or reuse a
number, and list removed ones under `reserved`
([structure.md](../../shadcn/rules/structure.md#the-proto-files-are-the-domain-model)). A change of
*meaning* (a field split in two, a unit changed) also needs `format_version` (or
`PRAGMA user_version` in SQLite) from the first release: on load, `migrate()` upgrades older
versions step by step, and refuses a newer version than it knows. Generated `decode` drops fields
it doesn't know, so an older build that saved a newer file would delete them.

## Probe

Static checks first. Each command must print nothing:

```bash
# Files are written only by the store, and only through a temp file + rename.
grep -rnE "writeFileSync|writeFile\(|appendFile" src/main | grep -v 'probe-ok:'
# No app data in the renderer's web storage.
grep -rnE "localStorage|indexedDB" src/renderer --include='*.ts' --include='*.tsx' | grep -v 'components/ui/' | grep -v 'probe-ok:'
# No native database addon.
grep -nE '"(better-sqlite3|sqlite3|lowdb|nedb)"' package.json
```

A `localStorage` hit for a UI convenience is fine with a `probe-ok:` reason. Then, in the running
app (driven as `AGENTS.md` describes):

- Make a change, `location.reload()`, and read it back with `agent eval`. That proves the main
  process returned it, not that it reached the disk, so also list the data folder and confirm the
  file's modification time moved: `ls -l "<userData>/data"` (the folder is in "The facts" above).
- If the app can open a second window on the same data, change a record in one, then save an edit
  to it from the other: the second save must be rejected and the fresh data shown.

The e2e suite runs on a fresh profile and can't restart the app on the same profile, so it can't
prove durability across launches. Test what it can see: a change survives a reload, and a conflict
is reported.
