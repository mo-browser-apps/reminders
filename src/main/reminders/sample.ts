import { Priority, type Task, type TaskList } from '../gen/reminders'
import { newId, type Data } from './model'

/** "yyyy-MM-dd" for the local day `offset` days from today. */
function day(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

interface SampleTask {
  title: string
  notes?: string
  completed?: boolean
  due?: number
  time?: string
  priority?: Priority
  subtasks?: SampleTask[]
}

const SAMPLE: { name: string; color: string; tasks: SampleTask[] }[] = [
  {
    name: 'Personal',
    color: 'blue',
    tasks: [
      {
        title: 'Plan weekend trip',
        notes: 'Somewhere within three hours by train.',
        due: 3,
        priority: Priority.PRIORITY_HIGH,
        subtasks: [
          { title: 'Choose destination', completed: true },
          { title: 'Book accommodation', due: 1 },
          {
            title: 'Prepare packing list',
            subtasks: [{ title: 'Pack clothes' }, { title: 'Pack electronics' }],
          },
        ],
      },
      { title: 'Read a book', priority: Priority.PRIORITY_LOW },
      { title: 'Pay the electricity bill', due: -1 },
    ],
  },
  {
    name: 'Work',
    color: 'orange',
    tasks: [
      {
        title: 'Prepare product release',
        due: 0,
        time: '16:00',
        priority: Priority.PRIORITY_HIGH,
        subtasks: [
          { title: 'Review open issues', completed: true },
          { title: 'Update release notes', due: 0 },
          { title: 'Prepare announcement' },
        ],
      },
      { title: 'Send weekly report', due: 4 },
    ],
  },
  {
    name: 'Shopping',
    color: 'green',
    tasks: [
      {
        title: 'Buy groceries',
        due: 0,
        subtasks: [{ title: 'Vegetables' }, { title: 'Milk', completed: true }, { title: 'Bread' }],
      },
    ],
  },
]

/** The demonstration data a first launch starts with (File ▸ Remove Sample Data… clears it). */
export function sampleData(): Data {
  const lists: TaskList[] = []
  const tasks: Task[] = []
  // Stagger creation times so "Sort by creation date" has an order to show.
  let clock = Date.now() - 60 * 60 * 1000
  const stamp = () => new Date((clock += 1000)).toISOString()

  const add = (listId: string, parentId: string, items: SampleTask[]) => {
    items.forEach((item, position) => {
      const createdAt = stamp()
      const task: Task = {
        id: newId(),
        listId,
        parentId,
        title: item.title,
        notes: item.notes ?? '',
        completed: item.completed ?? false,
        completedAt: item.completed ? createdAt : '',
        dueDate: item.due === undefined ? '' : day(item.due),
        dueTime: item.due === undefined ? '' : (item.time ?? ''),
        priority: item.priority ?? Priority.PRIORITY_NORMAL,
        position,
        createdAt,
        updatedAt: createdAt,
        sample: true,
      }
      tasks.push(task)
      add(listId, task.id, item.subtasks ?? [])
    })
  }

  SAMPLE.forEach((sample, position) => {
    const list: TaskList = {
      id: newId(),
      name: sample.name,
      color: sample.color,
      position,
      createdAt: stamp(),
      sample: true,
    }
    lists.push(list)
    add(list.id, '', sample.tasks)
  })
  return { lists, tasks, views: [] }
}
