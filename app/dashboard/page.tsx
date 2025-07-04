"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, LogOut, Calendar, CheckCircle } from "lucide-react";
import { TaskModal } from "@/components/task-modal";
import { DragDropBoard } from "@/components/drag-drop-board";
import { toast } from "@/hooks/use-toast";
import axios from "axios";
import { VoiceCommands } from "@/components/voice-commands";
import { NotificationSystem } from "@/components/notification-system";
import { io } from "socket.io-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "";

interface Task {
  _id: string;
  title: string;
  description: string;
  status: "todo" | "inprogress" | "done" | "blocked";
  scheduledTime?: string;
  createdAt: string;
  updatedAt: string;
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isGoogleCalendarConnected, setIsGoogleCalendarConnected] =
    useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (!token) {
      router.push("/");
      return;
    }

    // Add this flag to prevent multiple initializations
    let isMounted = true;
    let socketInitialized = false;

    const initializeSocket = (userId: string) => {
      if (socketInitialized) return;
      socketInitialized = true;

      const socket = io(SOCKET_URL, {
        path: "/socket.io",
        transports: ["websocket"],
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socket.on("connect", () => {
        if (!isMounted) return;
        console.log("Socket connected");
        socket.emit("join", userId);
      });

      socket.on("disconnect", () => {
        console.log("Socket disconnected");
      });

      socket.on("connect_error", (err) => {
        console.error("Socket connection error:", err);
      });

      socket.on("task-created", (newTask: Task) => {
        console.log("New task received:", newTask._id);
        setTasks((prev) => [newTask, ...prev]);
        toast({
          title: "New Task",
          description: "A task was added from Google Calendar",
        });
      });

      socket.on("task-updated", (updatedTask: Task) => {
        console.log("Task updated:", updatedTask._id);
        setTasks((prev) =>
          prev.map((task) =>
            task._id === updatedTask._id ? updatedTask : task
          )
        );
      });

      socket.on("task-deleted", (taskId: string) => {
        console.log("Task deleted:", taskId);
        setTasks((prev) => prev.filter((task) => task._id !== taskId));
        toast({
          title: "Task Deleted",
          description: "A task was removed",
        });
      });

      socket.on("calendar-updated", () => {
        console.log("Calendar updated - refetching tasks");
        fetchTasks();
      });

      return () => {
        isMounted = false;
        socket.disconnect();
      };
    };

    const fetchTasksOnce = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API_BASE_URL}/tasks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isMounted) {
          setTasks(response.data.tasks);
        }
      } catch (error: any) {
        if (isMounted) {
          toast({
            title: "Error",
            description: "Failed to fetch tasks",
            variant: "destructive",
          });
        }
      }
    };

    if (userData) {
      const parsedUser = JSON.parse(userData);
      if (isMounted) {
        setUser(parsedUser);
        setIsGoogleCalendarConnected(
          !!parsedUser.googleAccessToken || !!parsedUser.googleRefreshToken
        );
      }
      if (parsedUser._id) {
        initializeSocket(parsedUser._id);
        fetchTasksOnce(); // Call this once after socket initialization
      }
    }

    return () => {
      isMounted = false;
    };
  }, [router]);

  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTasks(response.data.tasks);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch tasks",
        variant: "destructive",
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/");
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setTasks(tasks.filter((task) => task._id !== taskId));
      await fetchTasks();
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (
    taskId: string,
    newStatus: Task["status"]
  ) => {
    try {
      const token = localStorage.getItem("token");
      const task = tasks.find((t) => t._id === taskId);

      // Prepare update data
      const updateData: any = { status: newStatus };

      // If moving from todo to inprogress, update time to current time
      if (task?.status === "todo" && newStatus === "inprogress") {
        updateData.scheduledTime = new Date().toISOString();
      }

      const response = await axios.put(
        `${API_BASE_URL}/tasks/${taskId}`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setTasks(
        tasks.map((task) => (task._id === taskId ? response.data.task : task))
      );

      // Sync with Google Calendar
      await syncTaskWithGoogleCalendar(response.data.task);

      toast({
        title: "Success",
        description: `Task moved to ${newStatus}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to update task",
        variant: "destructive",
      });
    }
  };

  // Add this function after handleStatusChange
  const handleVoiceCreateTask = async (taskData: any) => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(`${API_BASE_URL}/tasks`, taskData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      await syncTaskWithGoogleCalendar(response.data.task);
      await fetchTasks();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to create task via voice",
        variant: "destructive",
      });
    }
  };

  // Add Google Calendar sync function
  const syncTaskWithGoogleCalendar = async (task: Task) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_BASE_URL}/calendar/sync`,
        { taskId: task._id },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (error) {
      console.error("Failed to sync with Google Calendar:", error);
    }
  };

  const connectGoogleCalendar = async () => {
    try {
      setIsConnecting(true);
      const token = localStorage.getItem("token");

      // Get Google OAuth URL
      const response = await axios.get(`${API_BASE_URL}/auth/google`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Open Google OAuth in new window
      const authWindow = window.open(
        response.data.authUrl,
        "google-auth",
        "width=500,height=600,scrollbars=yes,resizable=yes"
      );

      // Listen for messages from the auth window
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === "GOOGLE_AUTH_SUCCESS") {
          setIsGoogleCalendarConnected(true);
          toast({
            title: "Success",
            description: "Google Calendar connected successfully!",
          });

          const token = localStorage.getItem("token");
          const userResponse = await axios.get(`${API_BASE_URL}/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          localStorage.setItem("user", JSON.stringify(userResponse.data.user));
          window.removeEventListener("message", handleMessage);
        }
      };

      window.addEventListener("message", handleMessage);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to connect Google Calendar",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div>
      <header className="bg-gray-100 shadow-sm border-b">
        <div className="max-w-9xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">
              Voice Task Manager
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-md text-gray-700">
                Welcome, {user?.name}
              </span>
              {isGoogleCalendarConnected ? (
                <div className="flex items-center space-x-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span>Connected to Google Calendar</span>
                </div>
              ) : (
                <Button
                  className="hover:bg-black hover:text-white"
                  variant="outline"
                  onClick={connectGoogleCalendar}
                  disabled={isConnecting}
                >
                  {isConnecting ? "Connecting..." : "Connect Google Calendar"}
                </Button>
              )}
              <Button
                className="hover:bg-black hover:text-white"
                variant="outline"
                onClick={() => router.push("/calendar")}
              >
                <Calendar className="w-4 h-4" />
                Calendar
              </Button>
              <Button
                className="hover:bg-black hover:text-white"
                variant="outline"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* <div className="mb-4 flex gap-6">
          <GoogleCalendarIntegration
            isConnected={isGoogleCalendarConnected}
            onConnectionChange={setIsGoogleCalendarConnected}
          />
          <GoogleCalendarDebug />
        </div> */}

        <DragDropBoard
          tasks={tasks}
          onStatusChange={handleStatusChange}
          onEditTask={(task) => {
            setEditingTask(task);
            setIsModalOpen(true);
          }}
          onDeleteTask={handleDeleteTask}
        />

        <Button
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
          onClick={() => {
            setEditingTask(null);
            setIsModalOpen(true);
          }}
        >
          <Plus className="w-6 h-6" />
        </Button>

        <TaskModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTask(null);
          }}
          onTaskCreated={fetchTasks}
          editingTask={editingTask}
          setEditingTask={setEditingTask}
        />
        <VoiceCommands
          tasks={tasks}
          onDeleteTask={handleDeleteTask}
          onCreateTask={handleVoiceCreateTask}
        />
        <NotificationSystem tasks={tasks} />
      </main>
    </div>
  );
}
