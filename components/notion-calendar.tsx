"use client"

import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import { Task } from "@/types/Task"
import { statusColors } from "@/lib/utils"

interface NotionCalendarProps {
  tasks: Task[]
  onTaskClick: (task: Task) => void
  setSelectedDate: (date: Date) => void
}

export default function NotionCalendar({ tasks, onTaskClick, setSelectedDate }: NotionCalendarProps) {
  const events = tasks.map((task) => {    
      return ({
      id: task._id,
      title: task.title,
      date: task.scheduledTime,
      extendedProps: task,
      color: statusColors[task.status],
    })
  })

  return (
    <FullCalendar
      plugins={[dayGridPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      events={events}
      dateClick={(info) => setSelectedDate(new Date(info.dateStr))}
      eventClick={(info) => {
        const task = info.event.extendedProps as Task
        onTaskClick(task)
      }}
      height="auto"
      headerToolbar={{
        left: "prev,next today",
        center: "title",
        right: "",
      }}
    />
  )
}
