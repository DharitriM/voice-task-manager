import { type NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"

// Mock database - In production, use MongoDB
const tasks: any[] = []

function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null
  }

  const token = authHeader.substring(7)
  try {
    return jwt.verify(token, process.env.JWT_SECRET || "your-secret-key") as any
  } catch {
    return null
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(request)
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = params
    const updates = await request.json()

    const taskIndex = tasks.findIndex((task) => task._id === id && task.userId === user.userId)

    if (taskIndex === -1) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 })
    }

    // If updating status from blocked to something else, add scheduledTime if not present
    if (updates.status && tasks[taskIndex].status === "blocked" && updates.status !== "blocked") {
      if (!tasks[taskIndex].scheduledTime && !updates.scheduledTime) {
        updates.scheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Default to tomorrow
      }
    }

    // Check for scheduling conflicts if updating scheduledTime
    if (updates.scheduledTime) {
      const conflictingTask = tasks.find(
        (task) =>
          task.userId === user.userId &&
          task._id !== id &&
          task.scheduledTime &&
          new Date(task.scheduledTime).getTime() === new Date(updates.scheduledTime).getTime() &&
          task.status !== "blocked",
      )

      if (conflictingTask) {
        return NextResponse.json({ message: "Another task is already scheduled at this time" }, { status: 400 })
      }
    }

    tasks[taskIndex] = {
      ...tasks[taskIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    return NextResponse.json({
      message: "Task updated successfully",
      task: tasks[taskIndex],
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = verifyToken(request)
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = params

    const taskIndex = tasks.findIndex((task) => task._id === id && task.userId === user.userId)

    if (taskIndex === -1) {
      return NextResponse.json({ message: "Task not found" }, { status: 404 })
    }

    tasks.splice(taskIndex, 1)

    return NextResponse.json({ message: "Task deleted successfully" })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
