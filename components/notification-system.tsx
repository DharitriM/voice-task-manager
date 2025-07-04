"use client"

import { useEffect } from "react"
import { toast } from "@/hooks/use-toast"

interface Task {
  _id: string
  title: string
  description: string
  status: string
  scheduledTime?: string
}

interface NotificationSystemProps {
  tasks: Task[]
}

export function NotificationSystem({ tasks }: NotificationSystemProps) {
  useEffect(() => {
    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }

    const checkReminders = () => {
      const now = new Date()
      const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000)

      tasks.forEach((task) => {
        if (task.scheduledTime && task.status !== "done") {
          const taskTime = new Date(task.scheduledTime)
          const reminderTime = new Date(taskTime.getTime() - 30 * 60 * 1000)

          // Check if we should show reminder (within 1 minute of reminder time)
          if (now >= reminderTime && now <= new Date(reminderTime.getTime() + 60 * 1000) && taskTime > now) {
            showReminder(task)
          }
        }
      })
    }

    // Check every minute
    const interval = setInterval(checkReminders, 60000)

    // Check immediately
    checkReminders()

    return () => clearInterval(interval)
  }, [tasks])

  const showReminder = (task: Task) => {
    // Browser notification
    if (Notification.permission === "granted") {
      new Notification(`Task Reminder: ${task.title}`, {
        body: `Your task "${task.title}" is scheduled to start in 30 minutes`,
        icon: "/favicon.ico",
        tag: task._id,
      })
    }

    // Toast notification
    toast({
      title: "Task Reminder",
      description: `"${task.title}" starts in 30 minutes`,
      duration: 10000,
    })
  }

  return null // This component doesn't render anything
}
