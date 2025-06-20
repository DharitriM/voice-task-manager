"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, CheckCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import axios from "axios"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

interface GoogleCalendarIntegrationProps {
  isConnected: boolean
  onConnectionChange: (connected: boolean) => void
}

export function GoogleCalendarIntegration({ isConnected, onConnectionChange }: GoogleCalendarIntegrationProps) {
  const [loading, setLoading] = useState(false)

  const connectGoogleCalendar = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("token")

      // Get Google OAuth URL
      const response = await axios.get(`${API_BASE_URL}/auth/google`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      // Open Google OAuth in new window
      const authWindow = window.open(
        response.data.authUrl,
        "google-auth",
        "width=500,height=600,scrollbars=yes,resizable=yes",
      )

      // Listen for messages from the auth window
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return

        if (event.data.type === "GOOGLE_AUTH_SUCCESS") {
          authWindow?.close()
          onConnectionChange(true)
          toast({
            title: "Success",
            description: "Google Calendar connected successfully!",
          })
          window.removeEventListener("message", handleMessage)
        } else if (event.data.type === "GOOGLE_AUTH_ERROR") {
          authWindow?.close()
          toast({
            title: "Error",
            description: "Failed to connect Google Calendar",
            variant: "destructive",
          })
          window.removeEventListener("message", handleMessage)
        }
      }

      window.addEventListener("message", handleMessage)

      // Fallback: Check if window is closed
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkClosed)
          window.removeEventListener("message", handleMessage)
          // Don't automatically assume success here
        }
      }, 1000)
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to connect Google Calendar",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calendar className="w-5 h-5" />
          <span>Google Calendar Integration</span>
        </CardTitle>
        <CardDescription>Sync your tasks with Google Calendar and get reminders</CardDescription>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <div className="flex items-center space-x-2 text-green-600">
            <CheckCircle className="w-5 h-5" />
            <span>Connected to Google Calendar</span>
          </div>
        ) : (
          <Button onClick={connectGoogleCalendar} disabled={loading}>
            {loading ? "Connecting..." : "Connect Google Calendar"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
