import * as fs from 'node:fs'
import * as path from 'node:path'
import { app } from '@mobrowser/api'
import { LibraryFile, type ApplyResponse, type Change, type Library } from '../gen/reminders'
import { applyChange, repair, ValidationError, type Data } from './model'
import { sampleData } from './sample'

/**
 * The one owner of the app's data file. It loads `data/library.pb` at startup, applies every
 * change batch (all or nothing, checked against the revision the renderer based it on), and
 * saves after each one, synchronously, through a temp file and a rename with a backup of the
 * previous version.
 */

const FORMAT_VERSION = 1
const KIND = 'reminders.library'

// The data folder also holds files from earlier builds that shared this bundle id (reminders.db,
// tasks.pb, …). They aren't read or touched; this file name is this format's alone.
const dir = path.join(app.getPath('userData'), 'data')
const file = path.join(dir, 'library.pb')

let data: Data = { lists: [], tasks: [], views: [] }
let revision = 0
let loadWarning = ''

function decode(candidate: string): LibraryFile {
  const parsed = LibraryFile.decode(fs.readFileSync(candidate))
  if (parsed.kind !== KIND) throw new Error("it isn't a Reminders library")
  if (parsed.formatVersion > FORMAT_VERSION) {
    throw new Error(`it was saved by a newer version of the app (format ${parsed.formatVersion})`)
  }
  return parsed
}

function write(next: Data, nextRevision: number) {
  fs.mkdirSync(dir, { recursive: true })
  const bytes = LibraryFile.encode({
    formatVersion: FORMAT_VERSION,
    kind: KIND,
    revision: nextRevision,
    lists: next.lists,
    tasks: next.tasks,
    views: next.views,
  }).finish()
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, bytes) // probe-ok: temp file, renamed below
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`)
  fs.renameSync(tmp, file)
}

/** Reads the library, falling back to the backup; a first launch starts with the sample data. */
export function load(): void {
  const errors: string[] = []
  for (const candidate of [file, `${file}.bak`]) {
    try {
      const parsed = decode(candidate)
      data = repair({ lists: parsed.lists, tasks: parsed.tasks, views: parsed.views })
      revision = parsed.revision
      if (candidate !== file) {
        loadWarning = `Your latest changes couldn't be read (${errors[0] ?? 'the file was missing'}), so the previous copy was loaded.`
        console.error(loadWarning)
      }
      return
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      console.error(`Can't read ${candidate}:`, error)
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  if (fs.existsSync(file)) {
    // Neither copy is readable. Keep the file aside rather than overwrite it with a new library.
    const aside = `${file}.unreadable-${Date.now()}`
    fs.renameSync(file, aside)
    loadWarning = `Your reminders couldn't be read (${errors[0]}). The file was kept as ${path.basename(aside)}, and the app started with an empty library.`
    console.error(loadWarning)
    data = { lists: [], tasks: [], views: [] }
  } else {
    data = sampleData()
  }
  revision = 1
  write(data, revision)
}

export function library(): Library {
  return { revision, lists: data.lists, tasks: data.tasks, views: data.views, loadWarning }
}

/** Applies `changes` when `baseRevision` is current; saves before answering. */
export function apply(baseRevision: number, changes: Change[]): ApplyResponse {
  if (baseRevision !== revision) return { library: library(), conflict: true, error: '' }
  const next: Data = structuredClone(data)
  const now = new Date().toISOString()
  try {
    for (const change of changes) applyChange(next, change, now)
  } catch (error) {
    if (!(error instanceof ValidationError)) console.error('Change failed:', error)
    return { library: library(), conflict: false, error: error instanceof Error ? error.message : String(error) }
  }
  try {
    write(next, revision + 1)
  } catch (error) {
    console.error('Save failed:', error)
    return { library: library(), conflict: false, error: `The change couldn't be saved: ${String(error)}` }
  }
  data = next
  revision += 1
  return { library: library(), conflict: false, error: '' }
}
