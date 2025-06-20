"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns"
import axios from "axios"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

interface Task {
  _id: string
  title: string
  description: string
  status: "todo" | "inprogress" | "done" | "blocked"
  scheduledTime?: string
  createdAt: string
  updatedAt: string
}

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const router = useRouter()

  // Date range: 3 years back and forth
  const minDate = subMonths(new Date(), 36)
  const maxDate = addMonths(new Date(), 36)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/")
      return
    }
    fetchTasks()
  }, [router])

  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await axios.get(`${API_BASE_URL}/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setTasks(response.data.tasks.filter((task: Task) => task.scheduledTime))
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch tasks",
        variant: "destructive",
      })
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    try {
      const token = localStorage.getItem("token")
      await axios.delete(`${API_BASE_URL}/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setTasks(tasks.filter((task) => task._id !== taskId))
      toast({
        title: "Success",
        description: "Task removed from calendar",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      })
    }
  }

  const getTasksForDate = (date: Date) => {
    return tasks.filter((task) => {
      if (!task.scheduledTime) return false
      return isSameDay(new Date(task.scheduledTime), date)
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "todo":
        return "bg-blue-100 text-blue-800"
      case "inprogress":
        return "bg-yellow-100 text-yellow-800"
      case "done":
        return "bg-green-100 text-green-800"
      case "blocked":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1)

    // Check bounds
    if (newDate >= minDate && newDate <= maxDate) {
      setCurrentDate(newDate)
    }
  }

  const generateCalendarDays = () => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const startDate = new Date(monthStart)
    startDate.setDate(startDate.getDate() - monthStart.getDay())

    const endDate = new Date(monthEnd)
    endDate.setDate(endDate.getDate() + (6 - monthEnd.getDay()))

    return eachDayOfInterval({ start: startDate, end: endDate })
  }

  const calendarDays = generateCalendarDays()
  const selectedDateTasks = getTasksForDate(selectedDate)
  const today = new Date()

  const canNavigatePrev = subMonths(currentDate, 1) >= minDate
  const canNavigateNext = addMonths(currentDate, 1) <= maxDate

  return (
    <div className="bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={() => router.push("/dashboard")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">Task Calendar</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Calendar Grid */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{format(currentDate, "MMMM yyyy")}</CardTitle>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateMonth("prev")}
                      disabled={!canNavigatePrev}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigateMonth("next")}
                      disabled={!canNavigateNext}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="text-center font-medium text-gray-500 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day, index) => {
                    const dayTasks = getTasksForDate(day)
                    const isSelected = isSameDay(day, selectedDate)
                    const isToday = isSameDay(day, today)
                    const isCurrentMonth = day.getMonth() === currentDate.getMonth()

                    return (
                      <div
                        key={index}
                        className={`h-20 border rounded-lg p-2 cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-blue-100 border-blue-300"
                            : isToday
                              ? "bg-green-50 border-green-200"
                              : isCurrentMonth
                                ? "bg-white hover:bg-gray-50"
                                : "bg-gray-50 text-gray-400"
                        }`}
                        onClick={() => setSelectedDate(day)}
                      >
                        <div className={`text-sm font-medium ${isCurrentMonth ? "" : "text-gray-400"}`}>
                          {day.getDate()}
                        </div>
                        {dayTasks.length > 0 && (
                          <div className="mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {dayTasks.length}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Selected Date Tasks */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Tasks for {format(selectedDate, "MMM d, yyyy")}</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDateTasks.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No tasks scheduled for this date</p>
                ) : (
                  <div className="space-y-3">
                    {selectedDateTasks.map((task) => (
                      <div key={task._id} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-sm">{task.title}</h4>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteTask(task._id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-gray-600 mb-2">{task.description}</p>
                        <div className="flex items-center justify-between">
                          <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
                          <span className="text-xs text-gray-500">
                            {format(new Date(task.scheduledTime!), "h:mm a")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
