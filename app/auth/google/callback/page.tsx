"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import axios from "axios"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

export default function GoogleCallbackPage() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code")
      const error = searchParams.get("error")

      if (error) {
        // Send error message to parent window
        window.opener?.postMessage({ type: "GOOGLE_AUTH_ERROR", error }, window.location.origin)
        window.close()
        return
      }

      if (code) {
        try {
          const token = localStorage.getItem("token")
          await axios.post(
            `${API_BASE_URL}/auth/google/callback`,
            { code },
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          )

          // Send success message to parent window
          window.opener?.postMessage({ type: "GOOGLE_AUTH_SUCCESS" }, window.location.origin)
          window.close()
        } catch (error) {
          // Send error message to parent window
          window.opener?.postMessage({ type: "GOOGLE_AUTH_ERROR", error }, window.location.origin)
          window.close()
        }
      }
    }

    handleCallback()
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-xl font-semibold mb-2">Connecting to Google Calendar...</h1>
        <p className="text-gray-600">Please wait while we complete the setup.</p>
      </div>
    </div>
  )
}
