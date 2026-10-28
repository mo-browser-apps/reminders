import { randomUUID } from 'node:crypto'
import {
  Priority,
  SortOrder,
  type Change,
  type CreateList,
  type CreateTask,
  type MoveTask,
  type Placement,
  type RestoreList,
  type Task,
  type TaskList,
  type UpdateList,
  type UpdateTask,
  type ViewPrefs,
} from '../gen/reminders'

/**
 * The rules that decide the data: every change the renderer sends is validated and applied here,
 * on plain arrays, with no I/O. `store.ts` owns loading, saving and the revision.
 *
 * Invariants kept by every operation:
 * - ids are unique; every task's list exists; a task's parent exists, is in the same list, and
 *   is never the task itself or one of its subtasks;
 * - positions are 0-based and contiguous among siblings (same list and parent), and among lists.
 *
 * Deleting a task deletes its subtasks with it (the renderer offers Undo, which restores them).
 */

export interface Data {
  lists: TaskList[]
  tasks: Task[]
  views: ViewPrefs[]
}

/** A change the renderer sent that would break the data; nothing of its batch is applied. */
export class ValidationError extends Error {}

export const LIST_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink', 'brown', 'gray']

const MAX_TITLE = 1000
const MAX_NOTES = 20000
const MAX_LIST_NAME = 200
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/
const SMART_VIEWS = new Set(['today', 'scheduled', 'all', 'completed'])

function fail(message: string): never {
  throw new ValidationError(message)
}

// ---------------------------------------------------------------------------------------------
// Queries

export function findTask(data: Data, id: string): Task | undefined {
  return data.tasks.find((task) => task.id === id)
}

function requireTask(data: Data, id: string): Task {
  return findTask(data, id) ?? fail(`There is no task ${id}.`)
}

function requireList(data: Data, id: string): TaskList {
  return data.lists.find((list) => list.id === id) ?? fail(`There is no list ${id}.`)
}

/** The tasks directly under `parentId` ("" for the top level) in a list, in order. */
export function childrenOf(data: Data, listId: string, parentId: string): Task[] {
  return data.tasks
    .filter((task) => task.listId === listId && task.parentId === parentId)
    .sort((a, b) => a.position - b.position)
}

/** Every task below `id`, at any depth. */
export function descendantIds(data: Data, id: string): string[] {
  const byParent = new Map<string, string[]>()
  for (const task of data.tasks) {
    if (!task.parentId) continue
    const siblings = byParent.get(task.parentId)
    if (siblings) siblings.push(task.id)
    else byParent.set(task.parentId, [task.id])
  }
  const out: string[] = []
  const stack = [...(byParent.get(id) ?? [])]
  while (stack.length > 0) {
    const next = stack.pop()!
    out.push(next)
    stack.push(...(byParent.get(next) ?? []))
  }
  return out
}

/** The task's parent, its parent's parent, and so on up to the top level. */
export function ancestorIds(data: Data, id: string): string[] {
  const out: string[] = []
  const seen = new Set([id])
  for (let at = findTask(data, id)?.parentId; at; at = findTask(data, at)?.parentId) {
    if (seen.has(at)) break // never happens while the invariants hold
    seen.add(at)
    out.push(at)
  }
  return out
}

/** Whether `id` is `ancestorId` or lies anywhere below it. */
export function isInSubtree(data: Data, id: string, ancestorId: string): boolean {
  return id === ancestorId || ancestorIds(data, id).includes(ancestorId)
}

/** How many of the task's direct subtasks are completed. */
export function subtaskProgress(data: Data, id: string): { completed: number; total: number } {
  const children = data.tasks.filter((task) => task.parentId === id)
  return { completed: children.filter((task) => task.completed).length, total: children.length }
}

// ---------------------------------------------------------------------------------------------
// Field validation

function cleanTitle(title: string): string {
  const clean = title.replace(/\s+/g, ' ').trim()
  if (!clean) fail('A task needs a title.')
  if (clean.length > MAX_TITLE) fail(`A title can be at most ${MAX_TITLE} characters long.`)
  return clean
}

function cleanNotes(notes: string): string {
  if (notes.length > MAX_NOTES) fail(`Notes can be at most ${MAX_NOTES} characters long.`)
  return notes.replace(/\s+$/, '')
}

function cleanListName(name: string): string {
  const clean = name.replace(/\s+/g, ' ').trim()
  if (!clean) fail('A list needs a name.')
  if (clean.length > MAX_LIST_NAME) fail(`A list name can be at most ${MAX_LIST_NAME} characters long.`)
  return clean
}

function cleanColor(color: string): string {
  if (!LIST_COLORS.includes(color)) fail(`"${color}" isn't a list color.`)
  return color
}

/** "" or a real calendar day as "yyyy-MM-dd". */
function cleanDay(day: string): string {
  if (day === '') return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) fail(`"${day}" isn't a date.`)
  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const check = new Date(year, month - 1, date)
  if (year < 1900 || year > 9999 || check.getMonth() !== month - 1 || check.getDate() !== date) {
    fail(`"${day}" isn't a date.`)
  }
  return day
}

function cleanTime(time: string): string {
  if (time !== '' && !TIME.test(time)) fail(`"${time}" isn't a time of day.`)
  return time
}

function cleanPriority(priority: Priority): Priority {
  if (priority === Priority.PRIORITY_UNSPECIFIED) return Priority.PRIORITY_NORMAL
  if (![Priority.PRIORITY_LOW, Priority.PRIORITY_NORMAL, Priority.PRIORITY_HIGH].includes(priority)) {
    fail('Unknown priority.')
  }
  return priority
}

function requireNewId(data: Data, id: string) {
  if (!UUID.test(id)) fail(`"${id}" isn't a valid id.`)
  if (data.tasks.some((task) => task.id === id) || data.lists.some((list) => list.id === id)) {
    fail(`The id ${id} is already in use.`)
  }
}

// ---------------------------------------------------------------------------------------------
// Ordering

function renumber(items: { position: number }[]) {
  items.forEach((item, index) => {
    item.position = index
  })
}

/**
 * Puts `task` (already in `data.tasks`) under `parentId` in `listId` at `placement`, and
 * renumbers both its old and its new siblings.
 */
function place(data: Data, task: Task, listId: string, parentId: string, placement: Placement | undefined) {
  const oldListId = task.listId
  const oldParentId = task.parentId
  task.listId = listId
  task.parentId = parentId
  const siblings = data.tasks
    .filter((other) => other !== task && other.listId === listId && other.parentId === parentId)
    .sort((a, b) => a.position - b.position)
  let index = siblings.length
  const anchorId = placement?.beforeId ?? placement?.afterId
  if (anchorId) {
    const at = siblings.findIndex((other) => other.id === anchorId)
    if (at === -1) fail('The task to place it next to is not in the same group.')
    index = placement?.beforeId ? at : at + 1
  }
  siblings.splice(index, 0, task)
  renumber(siblings)
  if (oldListId !== listId || oldParentId !== parentId) renumber(childrenOf(data, oldListId, oldParentId))
}

/** Checks that `parentId` can hold a task of `listId` ("" always can). */
function requireParent(data: Data, listId: string, parentId: string): void {
  if (!parentId) return
  const parent = requireTask(data, parentId)
  if (parent.listId !== listId) fail('A subtask must be in the same list as its parent.')
}

// ---------------------------------------------------------------------------------------------
// Lists

function createList(data: Data, change: CreateList, now: string) {
  requireNewId(data, change.id)
  data.lists.push({
    id: change.id,
    name: cleanListName(change.name),
    color: cleanColor(change.color || 'blue'),
    position: data.lists.length,
    createdAt: now,
    sample: false,
  })
}

function updateList(data: Data, change: UpdateList) {
  const list = requireList(data, change.id)
  if (change.name !== undefined) list.name = cleanListName(change.name)
  if (change.color !== undefined) list.color = cleanColor(change.color)
}

function deleteList(data: Data, id: string) {
  requireList(data, id)
  data.lists = data.lists.filter((list) => list.id !== id)
  data.tasks = data.tasks.filter((task) => task.listId !== id)
  data.views = data.views.filter((view) => view.viewId !== id)
  renumber(data.lists.sort((a, b) => a.position - b.position))
}

function restoreList(data: Data, change: RestoreList) {
  const list = change.list ?? fail('Nothing to restore.')
  requireNewId(data, list.id)
  const lists = [...data.lists].sort((a, b) => a.position - b.position)
  lists.splice(Math.min(Math.max(list.position, 0), lists.length), 0, {
    ...list,
    name: cleanListName(list.name),
    color: cleanColor(list.color),
  })
  renumber(lists)
  data.lists = lists
  restoreTasks(data, change.tasks)
}

// ---------------------------------------------------------------------------------------------
// Tasks

function createTask(data: Data, change: CreateTask, now: string) {
  requireNewId(data, change.id)
  requireList(data, change.listId)
  requireParent(data, change.listId, change.parentId)
  const task: Task = {
    id: change.id,
    listId: change.listId,
    parentId: change.parentId,
    title: cleanTitle(change.title),
    notes: '',
    completed: false,
    completedAt: '',
    dueDate: cleanDay(change.dueDate),
    dueTime: '',
    priority: cleanPriority(change.priority),
    position: 0,
    createdAt: now,
    updatedAt: now,
    sample: false,
  }
  data.tasks.push(task)
  place(data, task, change.listId, change.parentId, change.placement)
}

function updateTask(data: Data, change: UpdateTask, now: string) {
  const task = requireTask(data, change.id)
  if (change.title !== undefined) task.title = cleanTitle(change.title)
  if (change.notes !== undefined) task.notes = cleanNotes(change.notes)
  if (change.dueDate !== undefined) {
    task.dueDate = cleanDay(change.dueDate)
    if (!task.dueDate) task.dueTime = ''
  }
  if (change.dueTime !== undefined) {
    if (change.dueTime && !task.dueDate) fail('A time needs a due date.')
    task.dueTime = cleanTime(change.dueTime)
  }
  if (change.priority !== undefined) task.priority = cleanPriority(change.priority)
  task.updatedAt = now
}

function setCompleted(data: Data, id: string, completed: boolean, now: string) {
  const task = requireTask(data, id)
  if (task.completed === completed) return
  task.completed = completed
  task.completedAt = completed ? now : ''
  task.updatedAt = now
}

function moveTask(data: Data, change: MoveTask, now: string) {
  const task = requireTask(data, change.id)
  const listId = change.listId || task.listId
  requireList(data, listId)
  if (change.parentId && isInSubtree(data, change.parentId, task.id)) {
    fail("A task can't go inside itself or one of its subtasks.")
  }
  requireParent(data, listId, change.parentId)
  const anchor = change.placement?.beforeId ?? change.placement?.afterId
  if (anchor === task.id) return // next to itself: already there
  const subtree = descendantIds(data, task.id)
  place(data, task, listId, change.parentId, change.placement)
  // The subtasks travel with it: same parents, new list.
  for (const id of subtree) requireTask(data, id).listId = listId
  task.updatedAt = now
}

function deleteTasks(data: Data, ids: string[]) {
  const doomed = new Set<string>()
  for (const id of ids) {
    requireTask(data, id)
    doomed.add(id)
    for (const below of descendantIds(data, id)) doomed.add(below)
  }
  const groups = new Set(data.tasks.filter((task) => doomed.has(task.id)).map((task) => `${task.listId}\n${task.parentId}`))
  data.tasks = data.tasks.filter((task) => !doomed.has(task.id))
  for (const group of groups) {
    const [listId, parentId] = group.split('\n')
    renumber(childrenOf(data, listId, parentId))
  }
}

/** Puts deleted tasks back where they were, parents before their subtasks. */
function restoreTasks(data: Data, tasks: Task[]) {
  const incoming = new Map<string, Task>()
  for (const task of tasks) {
    if (incoming.has(task.id)) fail(`The id ${task.id} appears twice.`)
    requireNewId(data, task.id)
    incoming.set(task.id, task)
  }
  // Each task's parent is either already there or restored in this batch, in the same list, and
  // the chain ends (no loop among the restored tasks).
  const depth = new Map<string, number>()
  const depthOf = (id: string, seen: Set<string>): number => {
    const known = depth.get(id)
    if (known !== undefined) return known
    const task = incoming.get(id)!
    let result = 0
    if (task.parentId && incoming.has(task.parentId)) {
      if (seen.has(task.parentId)) fail('The restored tasks contain a loop.')
      seen.add(task.parentId)
      result = depthOf(task.parentId, seen) + 1
    }
    depth.set(id, result)
    return result
  }
  for (const task of incoming.values()) {
    requireList(data, task.listId)
    if (task.parentId && !incoming.has(task.parentId)) requireParent(data, task.listId, task.parentId)
    if (task.parentId && incoming.has(task.parentId) && incoming.get(task.parentId)!.listId !== task.listId) {
      fail('A subtask must be in the same list as its parent.')
    }
    depthOf(task.id, new Set([task.id]))
  }
  const ordered = [...incoming.values()].sort(
    (a, b) => depth.get(a.id)! - depth.get(b.id)! || a.position - b.position,
  )
  for (const original of ordered) {
    const task: Task = {
      ...original,
      title: cleanTitle(original.title),
      notes: cleanNotes(original.notes),
      dueDate: cleanDay(original.dueDate),
      dueTime: original.dueDate ? cleanTime(original.dueTime) : '',
      priority: cleanPriority(original.priority),
    }
    const siblings = childrenOf(data, task.listId, task.parentId)
    siblings.splice(Math.min(Math.max(task.position, 0), siblings.length), 0, task)
    data.tasks.push(task)
    renumber(siblings)
  }
}

// ---------------------------------------------------------------------------------------------
// Views and sample data

function setViewPrefs(data: Data, prefs: ViewPrefs | undefined) {
  if (!prefs) fail('No view preferences given.')
  if (!SMART_VIEWS.has(prefs.viewId)) requireList(data, prefs.viewId)
  if (prefs.sort < SortOrder.SORT_ORDER_UNSPECIFIED || prefs.sort > SortOrder.SORT_ORDER_PRIORITY) {
    fail('Unknown sort order.')
  }
  const clean: ViewPrefs = { viewId: prefs.viewId, sort: prefs.sort, showCompleted: prefs.showCompleted }
  const at = data.views.findIndex((view) => view.viewId === prefs.viewId)
  if (at === -1) data.views.push(clean)
  else data.views[at] = clean
}

export function hasSampleData(data: Data): boolean {
  return data.lists.some((list) => list.sample) || data.tasks.some((task) => task.sample)
}

/**
 * Deletes the sample tasks. A task of the user's under a sample task moves up to its nearest
 * surviving ancestor, and a sample list that still holds the user's tasks stays as their list.
 */
function removeSampleData(data: Data) {
  const removed = new Set(data.tasks.filter((task) => task.sample).map((task) => task.id))
  const parents = new Map(data.tasks.map((task) => [task.id, task.parentId]))
  for (const task of data.tasks) {
    if (removed.has(task.id)) continue
    let parentId = task.parentId
    while (parentId && removed.has(parentId)) parentId = parents.get(parentId) ?? ''
    task.parentId = parentId
  }
  data.tasks = data.tasks.filter((task) => !removed.has(task.id))
  const used = new Set(data.tasks.map((task) => task.listId))
  data.lists = data.lists.filter((list) => !list.sample || used.has(list.id))
  for (const list of data.lists) list.sample = false
  data.views = data.views.filter((view) => SMART_VIEWS.has(view.viewId) || data.lists.some((list) => list.id === view.viewId))
  renumber(data.lists.sort((a, b) => a.position - b.position))
  const groups = new Set(data.tasks.map((task) => `${task.listId}\n${task.parentId}`))
  for (const group of groups) {
    const [listId, parentId] = group.split('\n')
    renumber(childrenOf(data, listId, parentId))
  }
}

// ---------------------------------------------------------------------------------------------

/** Applies one change to `data` in place; throws ValidationError when it's invalid. */
export function applyChange(data: Data, change: Change, now: string): void {
  if (change.createList) createList(data, change.createList, now)
  else if (change.updateList) updateList(data, change.updateList)
  else if (change.deleteList) deleteList(data, change.deleteList.id)
  else if (change.restoreList) restoreList(data, change.restoreList)
  else if (change.createTask) createTask(data, change.createTask, now)
  else if (change.updateTask) updateTask(data, change.updateTask, now)
  else if (change.setCompleted) setCompleted(data, change.setCompleted.id, change.setCompleted.completed, now)
  else if (change.moveTask) moveTask(data, change.moveTask, now)
  else if (change.deleteTasks) deleteTasks(data, change.deleteTasks.ids)
  else if (change.restoreTasks) restoreTasks(data, change.restoreTasks.tasks)
  else if (change.setViewPrefs) setViewPrefs(data, change.setViewPrefs.prefs)
  else if (change.removeSampleData) removeSampleData(data)
  else fail('Empty change.')
}

/**
 * Repairs data read from disk so the invariants hold even if the file was edited by hand: drops
 * tasks whose list is gone, lifts tasks whose parent is missing, in another list, or part of a
 * loop to the top level, and renumbers every group.
 */
export function repair(data: Data): Data {
  const lists = new Set(data.lists.map((list) => list.id))
  const tasks = data.tasks.filter((task) => lists.has(task.listId))
  const byId = new Map(tasks.map((task) => [task.id, task]))
  for (const task of tasks) {
    const parent = task.parentId ? byId.get(task.parentId) : undefined
    if (task.parentId && (!parent || parent.listId !== task.listId)) task.parentId = ''
  }
  for (const task of tasks) {
    const seen = new Set([task.id])
    for (let at = task.parentId; at; at = byId.get(at)?.parentId ?? '') {
      if (seen.has(at)) {
        task.parentId = ''
        break
      }
      seen.add(at)
    }
  }
  const repaired = { lists: [...data.lists].sort((a, b) => a.position - b.position), tasks, views: data.views }
  renumber(repaired.lists)
  const groups = new Set(tasks.map((task) => `${task.listId}\n${task.parentId}`))
  for (const group of groups) {
    const [listId, parentId] = group.split('\n')
    renumber(childrenOf(repaired, listId, parentId))
  }
  return repaired
}

export const newId = randomUUID
