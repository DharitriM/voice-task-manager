"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import axios from "axios"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useRouter } from "next/navigation"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

export default function GoogleCalendarIntegration() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

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
        //   onConnectionChange(true)
          toast({
            title: "Success",
            description: "Google Calendar connected successfully!",
          })
          window.removeEventListener("message", handleMessage)
          router.push("/dashboard")
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

  const handleClose = () => {
    setIsOpen(false)
    router.push("/dashboard")
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Google Calendar Integration</DialogTitle>
        </DialogHeader>

          <div>
            <p className="text-sm text-muted-foreground">
              Sync your tasks with Google Calendar and get reminders
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button onClick={connectGoogleCalendar} disabled={loading}>
                {loading ? "Connecting..." : "Connect Google Calendar"}
            </Button>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </div>
      </DialogContent>
    </Dialog>
  )
}
