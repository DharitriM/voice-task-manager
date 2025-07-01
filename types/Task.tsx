export interface Task {
  _id: string
  title: string
  description: string
  status: "todo" | "inprogress" | "done" | "blocked"
  scheduledTime?: string
  createdAt: string
  updatedAt: string
}