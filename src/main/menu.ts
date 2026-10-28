import {
  app,
  BrowserWindow,
  CheckboxMenuItem,
  Menu,
  MenuItem,
  MenuOptions,
  MenuWithRole,
  type Shortcut,
} from '@mobrowser/api';
import { Command, commandToJSON, type MenuState } from './gen/menu';
import { Priority, SortOrder } from './gen/reminders';
import { openSettings } from './settings';
import { UPDATES_ENABLED } from './updates';

/**
 * The application menu.
 *
 * File (New Task, New List, Remove Sample Data…), Edit (with Find), View (sidebar, details, the
 * smart lists, Show Completed, Sort By, zoom), Task (completion, subtasks, indentation, order,
 * due date, priority, delete) and Window (on macOS it replaces MōBrowser's default,
 * browser-flavored menu). Appearance lives in Settings → General.
 *
 * Commands the renderer performs start disabled, choosing one calls `dispatch`, which streams its
 * id to the renderer over MenuService (src/main/index.ts), and `update()` enables, labels and
 * checks them from the state the renderer reports (src/renderer/components/home/app-commands.tsx
 * computes each flag with the same check its handler runs).
 *
 * Keys that also edit text (Space, Delete/Backspace, ⌘⌫) are not bound here: a native menu
 * shortcut fires before the page sees the key, even in a text field. The page handles them when
 * the task list has focus, and the menu shows the commands without a shortcut.
 *
 * Platform split (see docs/guides/guides/app-menu.md): on macOS the menu belongs to the
 * application (`app.setMenu`); on Windows and Linux each window owns its own menu bar
 * (`win.setMenu`). About and Settings… live in the app menu on macOS; on Windows and Linux,
 * Settings… is in File and About in Help. About opens Settings on its About page (the renderer
 * draws it with the app icon, which `app.showMessageDialog` can't).
 *
 * See `.agents/skills/desktop-shell/rules/menu.md` for the rules this follows.
 */

const isMac = process.platform === 'darwin';

/** Sends a menu command to the renderer (MenuService.OnCommand). */
export type MenuDispatch = (command: Command) => void;

/** The menu's renderer-driven items, updated from the state the renderer reports. */
export interface AppMenu {
  update(state: MenuState): void;
}

const SORTS: [Command, SortOrder, string][] = [
  [Command.COMMAND_SORT_MANUAL, SortOrder.SORT_ORDER_MANUAL, 'Manual'],
  [Command.COMMAND_SORT_DUE_DATE, SortOrder.SORT_ORDER_DUE_DATE, 'Due Date'],
  [Command.COMMAND_SORT_CREATED, SortOrder.SORT_ORDER_CREATED, 'Creation Date'],
  [Command.COMMAND_SORT_TITLE, SortOrder.SORT_ORDER_TITLE, 'Title'],
  [Command.COMMAND_SORT_PRIORITY, SortOrder.SORT_ORDER_PRIORITY, 'Priority'],
];

const PRIORITIES: [Command, Priority, string][] = [
  [Command.COMMAND_PRIORITY_HIGH, Priority.PRIORITY_HIGH, 'High'],
  [Command.COMMAND_PRIORITY_NORMAL, Priority.PRIORITY_NORMAL, 'Normal'],
  [Command.COMMAND_PRIORITY_LOW, Priority.PRIORITY_LOW, 'Low'],
];

export function installAppMenu(win: BrowserWindow, dispatch: MenuDispatch): AppMenu {
  // A renderer command: disabled until the renderer reports it can act.
  const command = (id: Command, label: string, shortcut?: Shortcut) =>
    new MenuItem({ id: commandToJSON(id), label, shortcut, enabled: false, action: () => dispatch(id) });
  // A checkable renderer command. A click doesn't toggle the mark; `update()` sets it.
  const check = (id: Command, label: string, shortcut?: Shortcut) =>
    new CheckboxMenuItem({ id: commandToJSON(id), label, shortcut, enabled: false, checked: false, action: () => dispatch(id) });

  // About and Settings work in every renderer state (even before the page loads): never disabled.
  const about = new MenuItem({ id: 'about', label: `About ${app.name}`, action: () => openSettings('about') });
  const settings = new MenuItem({
    id: 'settings',
    label: 'Settings…',
    shortcut: 'CommandOrControl+,',
    action: () => openSettings('general'),
  });

  // File
  const newTask = command(Command.COMMAND_NEW_TASK, 'New Task', 'CommandOrControl+N');
  const newList = command(Command.COMMAND_NEW_LIST, 'New List', 'CommandOrControl+Shift+N');
  const removeSample = command(Command.COMMAND_REMOVE_SAMPLE_DATA, 'Remove Sample Data…');
  // Edit
  const find = command(Command.COMMAND_FIND, 'Find', 'CommandOrControl+F');
  // View
  const toggleSidebar = command(Command.COMMAND_TOGGLE_SIDEBAR, 'Hide Sidebar', 'CommandOrControl+B');
  const toggleDetails = command(Command.COMMAND_TOGGLE_DETAILS, 'Hide Details', 'CommandOrControl+Alt+I');
  const views = [
    command(Command.COMMAND_SHOW_TODAY, 'Today', 'CommandOrControl+1'),
    command(Command.COMMAND_SHOW_SCHEDULED, 'Scheduled', 'CommandOrControl+2'),
    command(Command.COMMAND_SHOW_ALL, 'All Tasks', 'CommandOrControl+3'),
    command(Command.COMMAND_SHOW_COMPLETED_LIST, 'Completed', 'CommandOrControl+4'),
  ];
  const showCompleted = check(Command.COMMAND_TOGGLE_SHOW_COMPLETED, 'Show Completed', 'CommandOrControl+Shift+H');
  const sorts = SORTS.map(([id, sort, label]) => ({ sort, item: check(id, label) }));
  // Task
  const toggleCompleted = command(Command.COMMAND_TOGGLE_COMPLETED, 'Mark as Completed', 'CommandOrControl+Shift+C');
  const addSubtask = command(Command.COMMAND_ADD_SUBTASK, 'Add Subtask', 'CommandOrControl+Alt+N');
  const indent = command(Command.COMMAND_INDENT, 'Indent', 'CommandOrControl+]');
  const outdent = command(Command.COMMAND_OUTDENT, 'Outdent', 'CommandOrControl+[');
  const moveUp = command(Command.COMMAND_MOVE_UP, 'Move Up', 'CommandOrControl+Alt+Up');
  const moveDown = command(Command.COMMAND_MOVE_DOWN, 'Move Down', 'CommandOrControl+Alt+Down');
  const dueToday = command(Command.COMMAND_DUE_TODAY, 'Due Today', 'CommandOrControl+T');
  const dueTomorrow = command(Command.COMMAND_DUE_TOMORROW, 'Due Tomorrow', 'CommandOrControl+Alt+T');
  const dueNone = command(Command.COMMAND_DUE_NONE, 'Remove Due Date');
  const priorities = PRIORITIES.map(([id, priority, label]) => ({ priority, item: check(id, label) }));
  const deleteTask = command(Command.COMMAND_DELETE_TASK, 'Delete Task');

  const fileMenu = new MenuWithRole({
    role: 'fileMenu',
    items: [
      newTask,
      newList,
      'separator',
      removeSample,
      'separator',
      // Windows and Linux have no app menu, so Settings… sits in File there.
      ...(isMac ? [] : [settings, 'separator' as const]),
      'closeWindow',
    ],
  });
  // Keep the edit roles wherever there are text inputs: they wire Undo/Cut/Copy/Paste/Select All.
  const editMenu = new MenuWithRole({
    role: 'editMenu',
    items: ['undo', 'redo', 'separator', 'cut', 'copy', 'paste', 'pasteAndMatchStyle', 'delete', 'selectAll', 'separator', find],
  });
  const viewMenu = new Menu({
    label: 'View',
    items: [
      toggleSidebar,
      toggleDetails,
      'separator',
      ...views,
      'separator',
      showCompleted,
      new Menu({ label: 'Sort By', items: sorts.map(({ item }) => item) }),
      'separator',
      ...appViewItems(),
    ],
  });
  const taskMenu = new Menu({
    label: 'Task',
    items: [
      toggleCompleted,
      addSubtask,
      'separator',
      indent,
      outdent,
      moveUp,
      moveDown,
      'separator',
      dueToday,
      dueTomorrow,
      dueNone,
      new Menu({ label: 'Priority', items: priorities.map(({ item }) => item) }),
      'separator',
      deleteTask,
    ],
  });

  if (isMac) {
    app.setMenu(new Menu({ items: [macAppMenu(about, settings), fileMenu, editMenu, viewMenu, taskMenu, windowMenu()] }));
  } else {
    win.setMenu(new Menu({ items: [fileMenu, editMenu, viewMenu, taskMenu, helpMenu(about)] }));
  }

  return {
    update(state: MenuState) {
      // Nothing runs behind a dialog, and nothing before the main screen is ready.
      const live = state.ready && !state.modal;
      newTask.setEnabled(live && state.canNewTask);
      newList.setEnabled(live);
      removeSample.setEnabled(live && state.hasSampleData);
      find.setEnabled(live);
      toggleSidebar.setEnabled(live);
      toggleSidebar.setLabel(state.sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar');
      toggleDetails.setEnabled(live);
      toggleDetails.setLabel(state.detailsOpen ? 'Hide Details' : 'Show Details');
      for (const item of views) item.setEnabled(live);
      showCompleted.setEnabled(live && state.canToggleShowCompleted);
      showCompleted.setChecked(state.canToggleShowCompleted && state.showCompleted);
      for (const { sort, item } of sorts) {
        item.setEnabled(live && state.canSort);
        item.setChecked(state.canSort && state.sort === sort);
      }
      const task = live && state.taskTarget;
      toggleCompleted.setEnabled(task);
      toggleCompleted.setLabel(state.taskTarget && state.taskCompleted ? 'Mark as Not Completed' : 'Mark as Completed');
      addSubtask.setEnabled(task);
      indent.setEnabled(task && state.canIndent);
      outdent.setEnabled(task && state.canOutdent);
      moveUp.setEnabled(task && state.canMoveUp);
      moveDown.setEnabled(task && state.canMoveDown);
      dueToday.setEnabled(task);
      dueTomorrow.setEnabled(task);
      dueNone.setEnabled(task && state.taskHasDue);
      for (const { priority, item } of priorities) {
        item.setEnabled(task);
        item.setChecked(state.taskTarget && state.taskPriority === priority);
      }
      deleteTask.setEnabled(task);
    },
  };
}

/** The macOS application menu: About, Check for Updates, Settings, hide/show, quit. */
function macAppMenu(about: MenuItem, settings: MenuItem): MenuWithRole {
  return new MenuWithRole({
    role: 'macAppMenu',
    items: [
      about,
      // The built-in, user-initiated update flow; MōBrowser omits it without an update server.
      ...(UPDATES_ENABLED ? ['checkForUpdates' as const] : []),
      'separator',
      settings,
      'separator',
      'macHideApp',
      'macHideOthers',
      'macShowAll',
      'separator',
      'quit',
    ],
  });
}

/**
 * Zoom and full screen ship to users; reloading and DevTools are gated to development so end
 * users can't reload the app out from under itself.
 */
function appViewItems(): MenuOptions['items'] {
  const items: MenuOptions['items'] = ['zoomReset', 'zoomIn', 'zoomOut', 'separator', 'fullScreen'];
  if (!app.packaged) {
    items.push('separator', 'reload', 'reloadBypassCache', 'devTools');
  }
  return items;
}

/** Windows and Linux have no app menu, so About (and Check for Updates) live in Help. */
function helpMenu(about: MenuItem): Menu {
  return new Menu({ label: 'Help', items: [...(UPDATES_ENABLED ? ['checkForUpdates' as const, 'separator' as const] : []), about] });
}

function windowMenu(): MenuWithRole {
  return new MenuWithRole({ role: 'windowMenu', items: ['minimizeWindow', 'maximizeWindow'] });
}
