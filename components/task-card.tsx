"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Edit,
  Trash2,
  GripVertical,
  Share2,
  Copy,
  Calendar as CalendarIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import QRCode from "react-qr-code";
import { Separator } from "@/components/ui/separator";
import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
interface Task {
  _id: string;
  title: string;
  description: string;
  status: "todo" | "inprogress" | "done" | "blocked";
  scheduledTime?: string;
  createdAt: string;
  updatedAt: string;
  googleEventId: string;
}

interface TaskCardProps {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  isDragging?: boolean;
}

export function TaskCard({
  task,
  onEdit,
  onDelete,
  isDragging = false,
}: TaskCardProps) {
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [showQRCode, setShowQRCode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "todo":
        return "bg-blue-100 text-blue-800";
      case "inprogress":
        return "bg-yellow-100 text-yellow-800";
      case "done":
        return "bg-green-100 text-green-800";
      case "blocked":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleShareClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${API_BASE_URL}/tasks/${task._id}/share-link`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setShareLink(response.data.shareLink);
      setIsShareDialogOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate share link",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    toast({
      title: "Copied!",
      description: "Google Calendar link copied to clipboard",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <TooltipProvider>
      <>
        <Card
          ref={setNodeRef}
          style={style}
          className={`hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${
            isDragging ? "shadow-lg rotate-3" : ""
          }`}
          {...attributes}
          {...listeners}
        >
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-2 flex-1">
                <GripVertical className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                <CardTitle className="text-sm font-medium leading-tight">
                  {task.title}
                </CardTitle>
              </div>
              <div className="flex space-x-1 flex-shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                      }}
                      className="h-6 w-6 p-0"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit task</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                      }}
                      className="h-6 w-6 p-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Delete task</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleShareClick}
                      className="h-6 w-6 p-0"
                      disabled={isLoading}
                    >
                      <Share2 className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Share via Google Calendar</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-gray-600 mb-3 line-clamp-2">
              {task.description}
            </p>
            {task.scheduledTime && (
              <p className="text-xs text-blue-600 mb-3">
                Scheduled: {formatDate(task.scheduledTime)}
              </p>
            )}
            <div className="flex items-center justify-between">
              <Badge className={getStatusColor(task.status)}>
                {task.status}
              </Badge>
              <span className="text-xs text-gray-400">
                {new Date(task.createdAt).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Share Dialog */}
        <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-500" />
                <DialogTitle>Share via Google Calendar</DialogTitle>
              </div>
              <DialogDescription>
                Share this link with others. They will be able to view the event
                and respond.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  value={shareLink}
                  readOnly
                  className="flex-1"
                  onClick={(e) => e.currentTarget.select()}
                />
                <Button variant="outline" onClick={copyToClipboard}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
              </div>

              <div className="flex justify-center">
                <Button
                  variant="link"
                  className="text-blue-600"
                  onClick={() => setShowQRCode(!showQRCode)}
                >
                  {showQRCode ? "Hide QR Code" : "Show QR Code"}
                </Button>
              </div>

              {showQRCode && (
                <div className="flex flex-col items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <QRCode
                    title="Google Calendar Event"
                    value={shareLink}
                    size={128}
                    level="H"
                  />
                  <p className="text-xs text-gray-500 text-center">
                    Scan this QR code to open the event in Google Calendar
                  </p>
                </div>
              )}

              <Separator />

              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium mb-2">[Task] {task.title}</h4>
                {task.scheduledTime && (
                  <p className="text-sm text-gray-600 mb-2">
                    {formatDate(task.scheduledTime)}
                  </p>
                )}
                <p className="text-xs text-gray-500 mb-4">{task.description}</p>

                <div className="flex justify-between items-center">
                  <Badge className={getStatusColor(task.status)}>
                    {task.status}
                  </Badge>
                  <a
                    href={shareLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm flex items-center gap-1"
                  >
                    <CalendarIcon className="w-4 h-4" />
                    View in Google Calendar
                  </a>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    </TooltipProvider>
  );
}
