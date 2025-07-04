// "use client";

// import { useState } from "react";
// import { Button } from "@/components/ui/button";
// import { toast } from "@/hooks/use-toast";
// import axios from "axios";
// import {
//   Dialog,
//   DialogContent,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import { useRouter } from "next/navigation";

// const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// export default function GoogleCalendarIntegration() {
//   const router = useRouter();
//   const [loading, setLoading] = useState(false);
//   const [isOpen, setIsOpen] = useState(true);

// const connectGoogleCalendar = async () => {
//   try {
//     setLoading(true);
//     const token = localStorage.getItem("token");

//     const response = await axios.get(`${API_BASE_URL}/auth/google`, {
//       headers: { Authorization: `Bearer ${token}` },
//     });

//     const authWindow = window.open(
//       response.data.authUrl,
//       "_blank",
//       "width=500,height=600,scrollbars=yes,resizable=yes,noopener,noreferrer"
//     );

//     if (!authWindow) {
//       throw new Error("Popup blocked. Please allow popups and try again.");
//     }

//     // Use a closure-scoped variable to ensure only first event is handled
//     let hasHandled = false;

//     const handleMessage = async (event: MessageEvent) => {
//       if (event.origin !== window.location.origin) return;

//       if (hasHandled) return; // ❌ Already handled, ignore
//       hasHandled = true; // ✅ Block further messages

//       const { type } = event.data || {};

//       if (type === "GOOGLE_AUTH_SUCCESS") {
//         toast({
//           title: "Success",
//           description: "Google Calendar connected successfully!",
//         });

//         const userResponse = await axios.get(`${API_BASE_URL}/me`, {
//           headers: { Authorization: `Bearer ${token}` },
//         });

//         localStorage.setItem("user", JSON.stringify(userResponse.data.user));
//         window.removeEventListener("message", handleMessage);
//         authWindow?.close();
//         router.push("/dashboard");
//       } else if (type === "GOOGLE_AUTH_ERROR") {
//         toast({
//           title: "Error",
//           description: "Failed to connect Google Calendar",
//           variant: "destructive",
//         });
//         window.removeEventListener("message", handleMessage);
//         authWindow?.close();
//       }
//     };

//     // Add listener
//     window.addEventListener("message", handleMessage);

//     // Optional cleanup if user closes popup
//     const pollTimer = setInterval(() => {
//       if (authWindow.closed) {
//         clearInterval(pollTimer);
//         window.removeEventListener("message", handleMessage);
//       }
//     }, 500);
//   } catch (error: any) {
//     toast({
//       title: "Error",
//       description: error?.message || "Google Calendar connection failed",
//       variant: "destructive",
//     });
//   } finally {
//     setLoading(false);
//   }
// };

//   const handleClose = () => {
//     setIsOpen(false);
//     router.push("/dashboard");
//   };

//   return (
//     <Dialog open={isOpen} onOpenChange={handleClose}>
//       <DialogContent className="sm:max-w-md">
//         <DialogHeader>
//           <DialogTitle>Google Calendar Integration</DialogTitle>
//         </DialogHeader>

//         <div>
//           <p className="text-sm text-muted-foreground">
//             Sync your tasks with Google Calendar and get reminders
//           </p>
//         </div>

//         <div className="flex justify-end space-x-2">
//           <Button onClick={connectGoogleCalendar} disabled={loading}>
//             {loading ? "Connecting..." : "Connect Google Calendar"}
//           </Button>
//           <Button type="button" variant="outline" onClick={handleClose}>
//             Cancel
//           </Button>
//         </div>
//       </DialogContent>
//     </Dialog>
//   );
// }

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRouter } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export default function GoogleCalendarIntegration() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [messageHandler, setMessageHandler] = useState<((event: MessageEvent) => void) | null>(null);

  useEffect(() => {
    return () => {
      if (messageHandler) {
        window.removeEventListener("message", messageHandler);
      }
    };
  }, [messageHandler]);

  const connectGoogleCalendar = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      
      if (!token) {
        throw new Error("Authentication token not found. Please login again.");
      }

      // Add timestamp to prevent caching issues
      const timestamp = Date.now();
      const response = await axios.get(`${API_BASE_URL}/auth/google?ts=${timestamp}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Open auth URL in a centered popup
      const width = 500;
      const height = 600;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;
      
      const authWindow = window.open(
        response.data.authUrl,
        "google_auth",
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );

      if (!authWindow) {
        // Fallback to same window if popup blocked
        window.location.href = response.data.authUrl;
        return;
      }

      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        const { type, data } = event.data || {};
        
        if (type === "GOOGLE_AUTH_SUCCESS") {
          try {
            // Verify the connection by fetching user data
            const userResponse = await axios.get(`${API_BASE_URL}/me`, {
              headers: { Authorization: `Bearer ${token}` },
            });

            localStorage.setItem("user", JSON.stringify(userResponse.data.user));
            toast({
              title: "Success",
              description: "Google Calendar connected successfully!",
            });
            
            authWindow?.close();
            setIsOpen(false);
            router.push("/dashboard");
          } catch (error) {
            toast({
              title: "Verification Error",
              description: "Connected but failed to verify the connection",
              variant: "destructive",
            });
          }
        } else if (type === "GOOGLE_AUTH_ERROR") {
          toast({
            title: "Error",
            description: data?.message || "Failed to connect Google Calendar",
            variant: "destructive",
          });
          
          // Special handling for invalid_grant error
          if (data?.error === "invalid_grant") {
            toast({
              title: "Authentication Expired",
              description: "Your session may have expired. Please try again.",
              variant: "destructive",
            });
          }
        }
        
        window.removeEventListener("message", handleMessage);
      };

      setMessageHandler(() => handleMessage);
      window.addEventListener("message", handleMessage);

      // Check if popup is closed
      const popupCheckInterval = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(popupCheckInterval);
          window.removeEventListener("message", handleMessage);
        }
      }, 1000);

    } catch (error: any) {
      console.error("Google Auth Error:", error);
      toast({
        title: "Connection Error",
        description: error?.response?.data?.message || 
                   error?.message || 
                   "Failed to initiate Google Calendar connection",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setIsOpen(false);
      router.push("/dashboard");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Google Calendar</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Connect your Google Calendar to sync and manage your events.
          </p>
          
          <div className="text-xs text-amber-500">
            Note: Make sure to allow popups for this site if the connection window doesn't appear.
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button 
            onClick={connectGoogleCalendar} 
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? "Connecting..." : "Continue with Google"}
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            onClick={handleClose}
            disabled={loading}
          >
            Skip for now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}