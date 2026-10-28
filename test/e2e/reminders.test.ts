import { expect, test } from "@mobrowser/cli/e2e"
import type { Locator, Page } from "@playwright/test"

// The journeys of the task list. Every test starts on a fresh profile, so the app has its sample
// data (Personal, Work, Shopping). Rows are tree items named by their title, followed by state
// such as ", completed" or ", due Today".

function row(page: Page, title: string): Locator {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return page.getByRole("tree").getByRole("treeitem", { name: new RegExp(`^${escaped}(,|$)`) })
}

/** The tree's rows as "level:title", in display order. */
async function outline(page: Page): Promise<string[]> {
  return page
    .getByRole("treeitem")
    .evaluateAll((items) =>
      items.map((item) => `${item.getAttribute("aria-level")}:${item.getAttribute("aria-label")?.split(",")[0]}`),
    )
}

/** Creates an empty list with ⌘⇧N and names it; the list is then shown. */
async function newList(page: Page, name: string) {
  await expect(page.getByRole("main")).toBeVisible()
  await page.keyboard.press("ControlOrMeta+Shift+KeyN")
  const field = page.getByRole("textbox", { name: "List name" })
  await expect(field).toBeFocused()
  await field.fill(name)
  await field.press("Enter")
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible()
}

test("the smart lists are tiles named with their counts, and each opens its view", async ({ page }) => {
  const tiles = page.getByRole("navigation", { name: "Smart lists" }).getByRole("link")
  // Sample data: two tasks due today, one overdue, one with a subtask due today; three completed.
  await expect(tiles).toHaveText(["4Today", "7Scheduled", "14All Tasks", "3Completed"])
  await expect(tiles.first()).toHaveAccessibleName("Today, 4 tasks")

  await page.getByRole("link", { name: "Completed, 3 tasks" }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Completed" })).toBeVisible()
  await expect(page.getByRole("treeitem")).toHaveCount(3)

  await page.getByRole("link", { name: /^Personal, / }).click()
  await expect(page.getByRole("heading", { level: 1, name: "Personal" })).toBeVisible()
  expect(await outline(page)).toEqual([
    "1:Plan weekend trip",
    "2:Book accommodation",
    "2:Prepare packing list",
    "3:Pack clothes",
    "3:Pack electronics",
    "1:Read a book",
    "1:Pay the electricity bill",
  ])
})

test("tasks and nested subtasks are created from the keyboard and kept after a reload", async ({ page }) => {
  await newList(page, "Trip")
  const add = page.getByRole("textbox", { name: "New Task" })

  // The add field keeps the focus; Tab indents the next task under the one above.
  await add.click()
  await add.fill("Prepare for vacation")
  await add.press("Enter")
  await add.press("Tab")
  await add.fill("Book flights")
  await add.press("Enter")
  await add.fill("Pack luggage")
  await add.press("Enter")
  await expect(add).toBeFocused()

  // Enter on a selected task opens a new row after it; Tab in that row indents it, and
  // Shift+Tab outdents the next one.
  await row(page, "Pack luggage").click()
  await page.keyboard.press("Enter")
  const draft = page.getByRole("textbox", { name: "Title of the new task" })
  await draft.fill("Pack clothes")
  await draft.press("Tab")
  await draft.press("Enter")
  await expect(draft).toHaveValue("")
  await draft.fill("Pack toiletries")
  await draft.press("Enter")
  await draft.fill("Reserve a hotel")
  await draft.press("Shift+Tab")
  await draft.press("Enter")
  // Escape drops the empty row and returns to the last task created.
  await draft.press("Escape")
  await expect(draft).toHaveCount(0)
  await expect(row(page, "Reserve a hotel")).toBeFocused()

  const expected = [
    "1:Prepare for vacation",
    "2:Book flights",
    "2:Pack luggage",
    "3:Pack clothes",
    "3:Pack toiletries",
    "2:Reserve a hotel",
  ]
  await expect.poll(() => outline(page)).toEqual(expected)

  await page.reload()
  await expect(page.getByRole("heading", { level: 1, name: "Trip" })).toBeVisible()
  await expect.poll(() => outline(page)).toEqual(expected)
  await expect(row(page, "Pack luggage")).toContainText("0 of 2 completed")
})

test("indenting, outdenting and moving keep subtasks with their parent, and never nest a task in itself", async ({
  page,
}) => {
  await newList(page, "Order")
  const add = page.getByRole("textbox", { name: "New Task" })
  await add.click()
  for (const title of ["One", "Two", "Three"]) {
    await add.fill(title)
    await add.press("Enter")
  }
  await add.press("Tab")
  await add.fill("Three child")
  await add.press("Enter")

  await row(page, "Three").click()
  await page.keyboard.press("ControlOrMeta+BracketRight")
  await expect.poll(() => outline(page)).toEqual(["1:One", "1:Two", "2:Three", "3:Three child"])

  await page.keyboard.press("ControlOrMeta+Alt+ArrowUp") // only child: nothing to pass
  await row(page, "Two").click()
  await page.keyboard.press("ControlOrMeta+Alt+ArrowUp")
  await expect.poll(() => outline(page)).toEqual(["1:Two", "2:Three", "3:Three child", "1:One"])

  // Dropping a task onto its own subtask is refused.
  await row(page, "Two").dragTo(row(page, "Three child"))
  await expect.poll(() => outline(page)).toEqual(["1:Two", "2:Three", "3:Three child", "1:One"])

  await row(page, "Three").click()
  await page.keyboard.press("ControlOrMeta+BracketLeft")
  await expect.poll(() => outline(page)).toEqual(["1:Two", "1:Three", "2:Three child", "1:One"])

  await page.reload()
  await expect.poll(() => outline(page)).toEqual(["1:Two", "1:Three", "2:Three child", "1:One"])
})

test("completing a parent keeps its open subtasks open, visible and findable", async ({ page }) => {
  await page.getByRole("link", { name: /^Shopping, / }).click()
  const parent = row(page, "Buy groceries")
  await parent.click()
  await page.keyboard.press("Space")
  await expect(parent).toHaveAccessibleName(/, completed/)

  // With completed tasks hidden, the completed parent stays because it still has open subtasks.
  await page.waitForTimeout(1_700) // the just-completed grace period
  await expect(parent).toBeVisible()
  await expect(row(page, "Vegetables")).toHaveAccessibleName("Vegetables")
  await expect(row(page, "Bread")).toHaveAccessibleName("Bread")
  await expect(row(page, "Milk")).toHaveCount(0)

  // All Tasks shows the open subtasks with their parent's name beside them.
  await page.getByRole("link", { name: /^All Tasks, / }).click()
  await expect(row(page, "Vegetables")).toContainText("Buy groceries")
  await expect(row(page, "Buy groceries")).toHaveCount(0)

  // Completed shows the parent, once.
  await page.getByRole("link", { name: /^Completed, / }).click()
  await expect(row(page, "Buy groceries")).toHaveCount(1)
})

test("deleting a task with subtasks asks first, and Undo puts the whole subtree back", async ({ page }) => {
  await page.getByRole("link", { name: /^Personal, / }).click()
  await row(page, "Prepare packing list").click()
  await page.keyboard.press("Backspace")

  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toContainText("Its 2 subtasks will be deleted too.")
  await dialog.getByRole("button", { name: "Cancel" }).click()
  await expect(dialog).toHaveCount(0)
  // Cancelling returns to the task, so the next key acts on it again.
  await expect(row(page, "Prepare packing list")).toBeFocused()

  await page.keyboard.press("Backspace")
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete Task" }).click()
  await expect(row(page, "Prepare packing list")).toHaveCount(0)
  await expect(row(page, "Pack clothes")).toHaveCount(0)

  await page.getByRole("button", { name: "Undo" }).click()
  await expect
    .poll(() => outline(page))
    .toEqual([
      "1:Plan weekend trip",
      "2:Book accommodation",
      "2:Prepare packing list",
      "3:Pack clothes",
      "3:Pack electronics",
      "1:Read a book",
      "1:Pay the electricity bill",
    ])
})

test("search matches subtask titles and notes, and names where each result lives", async ({ page }) => {
  const search = page.getByRole("searchbox", { name: "Search tasks" })
  await search.fill("electronics")
  await expect(page.getByRole("heading", { level: 1, name: "Search" })).toBeVisible()
  await expect(row(page, "Pack electronics")).toContainText("Plan weekend trip › Prepare packing list")
  await expect(page.getByRole("tree").getByRole("group", { name: "Personal" })).toBeVisible()

  await search.fill("three hours by train") // in the notes of "Plan weekend trip"
  await expect(row(page, "Plan weekend trip")).toBeVisible()

  await search.fill("no such task")
  await expect(page.getByText("No tasks found.")).toBeVisible()
  await search.press("Escape")
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible()
})

test("the sidebar hides and shows from the toolbar and ⌘B, and stays as it was after a reload", async ({ page }) => {
  const sidebar = page.getByRole("navigation", { name: "Smart lists" })
  await expect(sidebar).toBeVisible()
  await page.getByRole("button", { name: "Hide Sidebar" }).click()
  // Hidden means gone from the page, not only moved off screen: no tab stops left behind.
  await expect(sidebar).toHaveCount(0)
  await expect(page.getByRole("searchbox", { name: "Search tasks" })).toHaveCount(0)

  await page.reload()
  await expect(page.getByRole("button", { name: "Show Sidebar" })).toBeVisible()
  await expect(sidebar).toHaveCount(0)

  // ⌘F shows the hidden sidebar and puts the caret in search.
  await page.keyboard.press("ControlOrMeta+KeyF")
  await expect(page.getByRole("searchbox", { name: "Search tasks" })).toBeFocused()
  await page.keyboard.press("Escape")

  await page.getByRole("tree").getByRole("treeitem").first().click()
  await page.keyboard.press("ControlOrMeta+KeyB")
  await expect(sidebar).toHaveCount(0)
  await page.keyboard.press("ControlOrMeta+KeyB")
  await expect(sidebar).toBeVisible()
})

test("details edits save to the same task in every view", async ({ page }) => {
  await row(page, "Pay the electricity bill").click()
  const details = page.getByRole("complementary", { name: "Task details" })
  await details.getByRole("textbox", { name: "Notes" }).fill("Account 1234")
  await details.getByRole("textbox", { name: "Title" }).fill("Pay the power bill")
  await details.getByRole("textbox", { name: "Title" }).press("Enter")
  await expect(row(page, "Pay the power bill")).toContainText("Account 1234")

  // ⌘T makes it due today: it moves from Overdue to Today in the same view.
  await row(page, "Pay the power bill").click()
  await page.keyboard.press("ControlOrMeta+KeyT")
  await expect(page.getByRole("group", { name: "Today" }).getByRole("treeitem", { name: /^Pay the power bill/ })).toBeVisible()

  await page.getByRole("link", { name: /^Personal, / }).click()
  await expect(row(page, "Pay the power bill")).toHaveAccessibleName("Pay the power bill, due Today")
})
