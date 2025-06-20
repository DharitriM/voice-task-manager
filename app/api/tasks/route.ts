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

export async function GET(request: NextRequest) {
  const user = verifyToken(request)
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const userTasks = tasks.filter((task) => task.userId === user.userId)
  return NextResponse.json({ tasks: userTasks })
}

export async function POST(request: NextRequest) {
  const user = verifyToken(request)
  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { title, description, scheduledTime } = await request.json()

    // Check for scheduling conflicts
    if (scheduledTime) {
      const conflictingTask = tasks.find(
        (task) =>
          task.userId === user.userId &&
          task.scheduledTime &&
          new Date(task.scheduledTime).getTime() === new Date(scheduledTime).getTime() &&
          task.status !== "blocked",
      )

      if (conflictingTask) {
        return NextResponse.json({ message: "Another task is already scheduled at this time" }, { status: 400 })
      }
    }

    const task = {
      _id: Date.now().toString(),
      userId: user.userId,
      title,
      description,
      status: "todo",
      scheduledTime: scheduledTime || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    tasks.push(task)

    return NextResponse.json({
      message: "Task created successfully",
      task,
    })
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
