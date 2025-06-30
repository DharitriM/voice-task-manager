"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Mic, MicOff } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import axios from "axios"
import { toISTDatetimeLocal } from "@/lib/utils"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL
interface Task {
  _id: string
  title: string
  description: string
  status: "todo" | "inprogress" | "done" | "blocked"
  scheduledTime?: string
  createdAt: string
  updatedAt: string
}

interface TaskModalProps {
  isOpen: boolean
  onClose: () => void
  onTaskCreated: () => void
  editingTask?: Task | null
  setEditingTask?: ((task: Task | null) => void) | any
}

declare global {
  interface Window {
    webkitSpeechRecognition: any
    SpeechRecognition: any
  }
}

export function TaskModal({ isOpen, onClose, onTaskCreated, editingTask, setEditingTask }: TaskModalProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [scheduledTime, setScheduledTime] = useState("")
  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState< SpeechRecognition | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title)
      setDescription(editingTask.description)
      setScheduledTime(editingTask.scheduledTime ? toISTDatetimeLocal(editingTask.scheduledTime) : "")
    } else {
      setTitle("")
      setDescription("")
      setScheduledTime("")
    }
  }, [editingTask])

  useEffect(() => {
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
      const recognitionInstance = new SpeechRecognition()
      recognitionInstance.continuous = false
      recognitionInstance.interimResults = false
      recognitionInstance.lang = "en-US"

      recognitionInstance.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        processVoiceInput(transcript)
        setIsListening(false)
      }

      recognitionInstance.onerror = () => {
        setIsListening(false)
        toast({
          title: "Error",
          description: "Speech recognition failed. Please try again.",
          variant: "destructive",
        })
      }

      recognitionInstance.onend = () => {
        setIsListening(false)
      }

      setRecognition(recognitionInstance)
    }
  }, [])

  const processVoiceInput = (transcript: string) => {
    const lowerTranscript = transcript.toLowerCase()
    let taskTitle = ""

    if (lowerTranscript.includes("remind me to")) {
      taskTitle = transcript.replace(/remind me to/i, "").trim()
    } else if (lowerTranscript.includes("add task")) {
      taskTitle = transcript.replace(/add task/i, "").trim()
    } else if (lowerTranscript.includes("create task")) {
      taskTitle = transcript.replace(/create task/i, "").trim()
    } else {
      const words = transcript.split(" ")
      taskTitle = words.slice(0, 5).join(" ")
    }

    setTitle(taskTitle)
    setDescription(transcript)

    toast({
      title: "Voice Input Processed",
      description: "Task details have been filled from your voice input",
    })
  }

  const startListening = () => {
    if (recognition) {
      setIsListening(true)
      recognition.start()
    } else {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in your browser",
        variant: "destructive",
      })
    }
  }

  const stopListening = () => {
    if (recognition) {
      recognition.stop()
    }
    setIsListening(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const token = localStorage.getItem("token")
      const taskData = {
        title,
        description,
        scheduledTime: scheduledTime,
      }

      if (editingTask) {
        await axios.put(`${API_BASE_URL}/tasks/${editingTask._id}`, taskData, {
          headers: { Authorization: `Bearer ${token}` },
        })
      } else {
        await axios.post(`${API_BASE_URL}/tasks`, taskData, {
          headers: { Authorization: `Bearer ${token}` },
        })
      }

      toast({
        title: "Success",
        description: editingTask ? "Task updated successfully" : "Task created successfully",
      })

      onTaskCreated()
      onClose()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to save task",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      handleClose()
    }
  }

  const handleClose = () =>{
    onClose()
    setEditingTask(null)
    setTitle("")
    setDescription("")
    setScheduledTime("")
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingTask ? "Edit Task" : "Create New Task"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <div className="flex space-x-2">
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter task title"
                required
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={isListening ? stopListening : startListening}
                className={isListening ? "bg-red-100" : ""}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
            </div>
            {isListening && <p className="text-sm text-blue-600">Listening... Speak now!</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduledTime">Scheduled Time (Optional)</Label>
            <Input
              id="scheduledTime"
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : editingTask ? "Update Task" : "Create Task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
