"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import axios from "axios"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

export default function GoogleCallbackPage() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code")
      const error = searchParams.get("error")

      if (error) {
        // Send error message to parent window
        // window.opener?.postMessage({ type: "GOOGLE_AUTH_ERROR", error }, window.location.origin)
        window.opener?.postMessage({ type: "GOOGLE_AUTH_ERROR", error }, "*")
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
          // window.opener?.postMessage({ type: "GOOGLE_AUTH_SUCCESS" }, window.location.origin)
          window.opener?.postMessage({ type: "GOOGLE_AUTH_SUCCESS" }, "*")

          window.close()
        } catch (error: any) {
          console.error("Google OAuth callback error:", error?.response?.data || error.message)
          // window.opener?.postMessage(
          //   { type: "GOOGLE_AUTH_ERROR", error: error?.response?.data?.message || error.message },
          //   window.location.origin
          // )
          window.opener?.postMessage(
            { type: "GOOGLE_AUTH_ERROR", error: error?.response?.data?.message || error.message },
            "*"
          )
          window.close()
        }
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-xl font-semibold mb-2">Connecting to Google Calendar...</h1>
        <p className="text-gray-600">Please wait while we complete the setup.</p>
      </div>
    </div>
  )
}
