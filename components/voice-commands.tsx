"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface VoiceCommandsProps {
  tasks: any[];
  onDeleteTask: (taskId: string) => void;
  onCreateTask: (taskData: any) => void;
}

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export function VoiceCommands({
  tasks,
  onDeleteTask,
  onCreateTask,
}: VoiceCommandsProps) {
  const tasksRef = useRef(tasks);
  const recognitionActiveRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  const speak = (message: string): Promise<void> => {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      const utter = new SpeechSynthesisUtterance(message);

      utter.onend = () => {
        resolve();
      };

      // In case onend doesn't fire (fallback)
      setTimeout(() => resolve(), message.length * 100); // rough estimate fallback

      synth.speak(utter);
    });
  };

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition =
        window.webkitSpeechRecognition || window.SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();

      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = "en-US";

      recognitionInstance.onresult = (event: any) => {
        const transcript =
          event.results[event.results.length - 1][0].transcript.toLowerCase();
        processVoiceCommand(transcript);
      };

      recognitionInstance.onerror = () => {
        recognitionActiveRef.current = false;
        setIsListening(false);
        toast({
          title: "Error",
          description: "Speech recognition failed. Please try again.",
          variant: "destructive",
        });
      };

      recognitionInstance.onstart = () => {
        recognitionActiveRef.current = true;
        setIsListening(true);
      };

      recognitionInstance.onend = () => {
        recognitionActiveRef.current = false;
        setIsListening(false);
      };

      setRecognition(recognitionInstance);
    }
  }, []);

  const processVoiceCommand = async (transcript: string) => {
    console.log("Voice command:", transcript);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Delete command
    if (
      transcript.includes("delete task") ||
      transcript.includes("remove task")
    ) {
      await handleDeleteCommand(transcript);
      await waitForSpeechEnd(); // wait until speak() finishes
      stopListening();
      return;
    }

    // Create command
    if (
      transcript.includes("create task") ||
      transcript.includes("add task") ||
      transcript.includes("new task")
    ) {
      await handleCreateCommand(transcript);
      await waitForSpeechEnd(); // wait until speak() finishes
      stopListening();
      return;
    }

    // List command
    if (
      transcript.includes("list tasks") ||
      transcript.includes("show tasks")
    ) {
      handleListCommand();
    } else {
      toast({
        title: "Command not recognized",
        description:
          "Try saying 'delete task [task name]' or 'create task [task description]'",
      });
    }

    timeoutRef.current = setTimeout(() => {
      toast({
        title: "Timeout",
        description: "No command received. Speech recognition stopped.",
      });
      stopListening();
    }, 10000);
  };

  const handleDeleteCommand = async (transcript: string) => {
    let taskName = "";

    if (transcript.includes("delete task")) {
      taskName = transcript.split("delete task")[1]?.trim();
    } else if (transcript.includes("remove task")) {
      taskName = transcript.split("remove task")[1]?.trim();
    }

    if (!taskName) {
      toast({
        title: "Task name required",
        description: "Please specify which task to delete",
        variant: "destructive",
      });
      return;
    }

    const matchingTask = tasksRef.current.find(
      (task) =>
        task.title.toLowerCase().includes(taskName) ||
        taskName.includes(task.title.toLowerCase())
    );

    if (matchingTask) {
      onDeleteTask(matchingTask._id);
      toast({
        title: "Task deleted",
        description: `Deleted task: ${matchingTask.title}`,
      });
      await speak(`Task ${matchingTask.title} has been deleted.`);
    } else {
      toast({
        title: "Task not found",
        description: `Could not find task containing: ${taskName}`,
        variant: "destructive",
      });
    }
  };

  const handleCreateCommand = async (transcript: string) => {
    let taskDescription = "";

    if (transcript.includes("create task")) {
      taskDescription = transcript.split("create task")[1]?.trim();
    } else if (transcript.includes("add task")) {
      taskDescription = transcript.split("add task")[1]?.trim();
    } else if (transcript.includes("new task")) {
      taskDescription = transcript.split("new task")[1]?.trim();
    }

    if (taskDescription) {
      const words = taskDescription.split(" ");
      const title = words.slice(0, 5).join(" ");

      await onCreateTask({
        title,
        description: taskDescription,
        status: "todo",
        scheduledTime:
          new Date(Date.now() + 5.5 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 16) ?? "",
      });

      toast({
        title: "Task created",
        description: `Created task: ${title}`,
      });
      await speak(`Task ${taskDescription} has been created.`);
    }
  };

  const handleListCommand = () => {
    const taskList = tasks
      .map((task) => `${task.title} (${task.status})`)
      .join(", ");
    toast({
      title: "Your tasks",
      description: taskList || "No tasks found",
    });

    speak("Here are your tasks.");
  };

  const startListening = () => {
    if (recognition && !recognitionActiveRef.current) {
      try {
        setIsListening(true);
        recognition.start();
      } catch (err: any) {
        if (err.name === "InvalidStateError") {
          console.warn("Recognition already started.");
        } else {
          console.error(err);
        }
      }
      toast({
        title: "Voice commands active",
        description: "Say 'delete task [name]' or 'create task [description]'",
      });

      // Clear existing timeout before setting new
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        toast({
          title: "Timeout",
          description: "Speech recognition timed out. Please try again.",
        });
        stopListening();
      }, 8000);
    }
  };

  const stopListening = () => {
    if (recognition && recognitionActiveRef.current) {
      setIsListening(false);
      recognition.stop();
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const waitForSpeechEnd = (): Promise<void> => {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      const interval = setInterval(() => {
        if (!synth.speaking) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  };

  return (
    <div className="fixed bottom-6 left-6">
      <Button
        variant={isListening ? "destructive" : "secondary"}
        size="lg"
        onClick={isListening ? stopListening : startListening}
        className="h-14 w-14 rounded-full shadow-lg"
      >
        {isListening ? (
          <MicOff className="w-6 h-6 animate-ping" />
        ) : (
          <Mic className="w-6 h-6" />
        )}
      </Button>
      {isListening && (
        <div className="absolute bottom-16 left-0 bg-black text-white px-3 py-1 rounded text-sm whitespace-nowrap">
          Listening for commands...
        </div>
      )}
    </div>
  );
}
