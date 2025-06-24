"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface VoiceCommandsProps {
  tasks: any[]
  onDeleteTask: (taskId: string) => void
  onCreateTask: (taskData: any) => void
}

declare global {
  interface Window {
    webkitSpeechRecognition: any
    SpeechRecognition: any
  }
}

export function VoiceCommands({ tasks, onDeleteTask, onCreateTask }: VoiceCommandsProps) {
  const tasksRef = useRef(tasks);
  const [isListening, setIsListening] = useState(false)
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null)

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
      const recognitionInstance = new SpeechRecognition()
      recognitionInstance.continuous = true
      recognitionInstance.interimResults = false
      recognitionInstance.lang = "en-US"

      recognitionInstance.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase()
        processVoiceCommand(transcript)
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

  const processVoiceCommand = (transcript: string) => {
    console.log("Voice command:", transcript)

    // Delete commands
    if (transcript.includes("delete task") || transcript.includes("remove task")) {
      handleDeleteCommand(transcript)
    }
    // Create commands
    else if (transcript.includes("create task") || transcript.includes("add task") || transcript.includes("new task")) {
      handleCreateCommand(transcript)
    }
    // List commands
    else if (transcript.includes("list tasks") || transcript.includes("show tasks")) {
      handleListCommand()
    } else {
      toast({
        title: "Command not recognized",
        description: "Try saying 'delete task [task name]' or 'create task [task description]'",
      })
    }
  }

  const handleDeleteCommand = async (transcript: string) => {
    console.log("on command delete", tasks)
    // debugger
    // Extract task name from command
    let taskName = ""

    if (transcript.includes("delete task")) {
      taskName = transcript.split("delete task")[1]?.trim()
    } else if (transcript.includes("remove task")) {
      taskName = transcript.split("remove task")[1]?.trim()
    }

    if (!taskName) {
      toast({
        title: "Task name required",
        description: "Please specify which task to delete",
        variant: "destructive",
      })
      return
    }

    // Find matching task
    const matchingTask = tasksRef.current.find(
      (task) => task.title.toLowerCase().includes(taskName) || taskName.includes(task.title.toLowerCase()),
    )

    if (matchingTask) {
      await onDeleteTask(matchingTask._id)
      toast({
        title: "Task deleted",
        description: `Deleted task: ${matchingTask.title}`,
      })
    } else {
      toast({
        title: "Task not found",
        description: `Could not find task containing: ${taskName}`,
        variant: "destructive",
      })
    }
    await stopListening()
  }

  const handleCreateCommand = async (transcript: string) => {
    let taskDescription = ""

    if (transcript.includes("create task")) {
      taskDescription = transcript.split("create task")[1]?.trim()
    } else if (transcript.includes("add task")) {
      taskDescription = transcript.split("add task")[1]?.trim()
    } else if (transcript.includes("new task")) {
      taskDescription = transcript.split("new task")[1]?.trim()
    }

    if (taskDescription) {
      const words = taskDescription.split(" ")
      const title = words.slice(0, 5).join(" ")

      await onCreateTask({
        title,
        description: taskDescription,
        status: "todo",
        scheduledTime: new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 16) ?? "",
      })

      await stopListening()

      toast({
        title: "Task created",
        description: `Created task: ${title}`,
      })
    }
  }

  const handleListCommand = () => {
    const taskList = tasks.map((task) => `${task.title} (${task.status})`).join(", ")
    toast({
      title: "Your tasks",
      description: taskList || "No tasks found",
    })
  }

  const startListening = () => {
    if (recognition) {
      setIsListening(true)
      recognition.start()
      toast({
        title: "Voice commands active",
        description: "Say 'delete task [name]' or 'create task [description]'",
      })
    }
  }

  const stopListening = () => {
    if (recognition) {
      recognition.stop()
    }
    setIsListening(false)
  }

  return (
    <div className="fixed bottom-6 left-6">
      <Button
        variant={isListening ? "destructive" : "secondary"}
        size="lg"
        onClick={isListening ? stopListening : startListening}
        className="h-14 w-14 rounded-full shadow-lg"
      >
        {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
      </Button>
      {isListening && (
        <div className="absolute bottom-16 left-0 bg-black text-white px-3 py-1 rounded text-sm whitespace-nowrap">
          Listening for commands...
        </div>
      )}
    </div>
  )
}
