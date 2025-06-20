"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bug, CheckCircle, XCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import axios from "axios"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

export function GoogleCalendarDebug() {
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)

  const testGoogleCalendarConnection = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("token")

      const response = await axios.get(`${API_BASE_URL}/calendar/test`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      setTestResult({ success: true, data: response.data })
      toast({
        title: "Success",
        description: "Google Calendar connection is working!",
      })
    } catch (error: any) {
      setTestResult({ success: false, error: error.response?.data || error.message })
      toast({
        title: "Error",
        description: "Google Calendar connection failed",
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
          <Bug className="w-5 h-5" />
          <span>Google Calendar Debug</span>
        </CardTitle>
        <CardDescription>Test your Google Calendar connection</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={testGoogleCalendarConnection} disabled={loading}>
          {loading ? "Testing..." : "Test Google Calendar Connection"}
        </Button>

        {testResult && (
          <div className="p-4 rounded-lg border">
            <div className="flex items-center space-x-2 mb-2">
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <span className={testResult.success ? "text-green-600" : "text-red-600"}>
                {testResult.success ? "Connection Successful" : "Connection Failed"}
              </span>
            </div>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">{JSON.stringify(testResult, null, 2)}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
