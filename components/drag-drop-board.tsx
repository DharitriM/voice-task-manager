"use client"

import type React from "react"
import { useState } from "react"
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TaskCard } from "./task-card"
import {  statusColorsClassname } from "@/lib/utils"

interface Task {
  _id: string
  title: string
  description: string
  status: "todo" | "inprogress" | "done" | "blocked"
  scheduledTime?: string
  createdAt: string
  updatedAt: string
}

interface DragDropBoardProps {
  tasks: Task[]
  onStatusChange: (taskId: string, newStatus: Task["status"]) => void
  onEditTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
}

export function DragDropBoard({ tasks, onStatusChange, onEditTask, onDeleteTask }: DragDropBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )

  const groupedTasks = {
    todo: tasks.filter((task) => task.status === "todo"),
    inprogress: tasks.filter((task) => task.status === "inprogress"),
    done: tasks.filter((task) => task.status === "done"),
    blocked: tasks.filter((task) => task.status === "blocked"),
  }

  const statusLabels = {
    todo: "To Do",
    inprogress: "In Progress",
    done: "Done",
    blocked: "Blocked",
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    const task = tasks.find((task) => task._id === active.id)
    setActiveTask(task || null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (!over) {
      setActiveTask(null)
      return
    }

    const taskId = active.id as string
    const newStatus = over.id as Task["status"]

    const task = tasks.find((t) => t._id === taskId)
    if (task && task.status !== newStatus) {
      // Only call API if status actually changed and dropped on a valid status block
      onStatusChange(taskId, newStatus)
    }

    setActiveTask(null)
  }

  // Add this component for each status column
  function DroppableStatusColumn({
    status,
    children,
    className,
  }: {
    status: string
    children: React.ReactNode
    className: string
  }) {
    const { setNodeRef, isOver } = useDroppable({
      id: status,
    })

    return (
      <div
        ref={setNodeRef}
        className={`${className} ${isOver ? "ring-2 ring-blue-400 ring-opacity-50" : ""} transition-all`}
      >
        {children}
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(groupedTasks).map(([status, statusTasks]) => (
          <div key={status} className="space-y-4">
            <DroppableStatusColumn
              status={status}
              className={`${statusColorsClassname[status as keyof typeof statusColorsClassname]} border-2 border-dashed min-h-[600px] rounded-lg`}
            >
              <Card className="h-[calc(100vh-9.5rem)] bg-transparent border-none shadow-none">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-semibold text-gray-900">
                      {statusLabels[status as keyof typeof statusLabels]}
                    </CardTitle>
                    <Badge variant="secondary">{statusTasks.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <SortableContext items={statusTasks.map((task) => task._id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {statusTasks.map((task) => (
                        <TaskCard
                          key={task._id}
                          task={task}
                          onEdit={() => onEditTask(task)}
                          onDelete={() => onDeleteTask(task._id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </CardContent>
              </Card>
            </DroppableStatusColumn>
          </div>
        ))}
      </div>

      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} onEdit={() => {}} onDelete={() => {}} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  )
}
