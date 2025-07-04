const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { google } = require("googleapis");
const { v4: uuidv4 } = require("uuid");
const { Server } = require("socket.io");
const http = require("http");
require("dotenv").config();

const app = express();

// Middleware
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow non-browser requests (like Postman)
      if (
        origin.startsWith("http://localhost:") ||
        origin === "https://vtm-kpho.onrender.com"
      ) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  path: "/socket.io", // Explicit path helps with connection issues
});

// Attach io to req so you can use it in routes
app.set("io", io);

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    tls: true,
    tlsAllowInvalidCertificates: false, // only set to true if using self-signed certs (not for Atlas)
  })
  .then(() => {
    console.log("Connected to MongoDB Atlas");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
  });

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  googleAccessToken: { type: String }, // Access token for Google API
  googleRefreshToken: { type: String }, // Used to refresh access token
  googleChannelId: { type: String }, // Channel ID from Google Watch API
  googleResourceId: { type: String }, // Resource ID to stop or track later
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);

// Task Schema
const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: {
    type: String,
    enum: ["todo", "inprogress", "done", "blocked"],
    default: "todo",
  },
  scheduledTime: { type: Date },
  // googleTaskId: { type: String },
  googleEventId: { type: String }, // Store Google Calendar event ID
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Task = mongoose.model("Task", taskSchema);

// Google Calendar Setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Auth Middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    );
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ message: "Invalid token" });
  }
};
// console.log("Auth URL generated:", oauth2Client.generateAuthUrl({
//   access_type: "offline",
//   scope: ["https://www.googleapis.com/auth/calendar"],
// }))
// Google Calendar Helper Functions
const createGoogleCalendarEvent = async (user, task) => {
  try {
    if (!user.googleAccessToken || !task.scheduledTime) return null;

    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const startTime = new Date(task.scheduledTime);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

    const event = {
      summary: `[Task] ${task.title}`,
      description: `${task.description}\n\nStatus: ${task.status}\nCreated via Voice Task Manager`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 30 },
          { method: "email", minutes: 30 },
        ],
      },
      colorId: getTaskColorId(task.status),
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
    });

    return response.data.id;
  } catch (error) {
    console.error(
      "Error creating Google Calendar event:",
      error.response?.data || error.message
    );
    return null;
  }
};

const createGoogleTask = async (user, task) => {
  try {
    if (!user.googleAccessToken) return null;

    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });

    const tasks = google.tasks({ version: "v1", auth: oauth2Client });

    const response = await tasks.tasks.insert({
      tasklist: "@default",
      requestBody: {
        title: task.title,
        notes: task.description,
        due: task.scheduledTime
          ? new Date(task.scheduledTime).toISOString()
          : undefined,
      },
    });

    return response.data.id;
  } catch (error) {
    console.error(
      "Error creating Google Task:",
      error.response?.data || error.message
    );
    return null;
  }
};

// Add helper function for task colors
const getTaskColorId = (status) => {
  switch (status) {
    case "todo":
      return "1"; // Blue
    case "inprogress":
      return "5"; // Yellow
    case "done":
      return "10"; // Green
    case "blocked":
      return "11"; // Red
    default:
      return "1";
  }
};

const updateGoogleCalendarEvent = async (user, task) => {
  try {
    if (!user.googleAccessToken || !task.googleEventId || !task.scheduledTime)
      return;

    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // const startTime = new Date(task.scheduledTime)
    // const endTime = new Date(startTime.getTime() + 60 * 60 * 1000)
    const startTime = task.scheduledTime
      ? new Date(task.scheduledTime)
      : new Date(Date.now() + 5.5 * 60 * 60 * 1000);

    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    const event = {
      summary: `[Task] ${task.title}`,
      description: `${task.description}\n\nStatus: ${task.status}\nUpdated via Voice Task Manager`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      colorId: getTaskColorId(task.status),
    };

    await calendar.events.update({
      calendarId: "primary",
      eventId: task.googleEventId,
      resource: event,
    });
  } catch (error) {
    console.error(
      "Error updating Google Calendar event:",
      error.response?.data || error.message
    );
  }
};

const updateGoogleTask = async (user, task) => {
  try {
    if (!user.googleAccessToken || !task.googleTaskId) return;

    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });

    const tasks = google.tasks({ version: "v1", auth: oauth2Client });

    const updates = {
      title: task.title,
      notes: `${task.description}\n\nStatus: ${task.status}\nUpdated via Voice Task Manager`,
    };

    // Optional due date (Tasks API uses RFC 3339 format)
    if (task.scheduledTime) {
      updates.due = new Date(task.scheduledTime).toISOString();
    }

    const response = await tasks.tasks.update({
      tasklist: "@default",
      task: task.googleTaskId,
      requestBody: updates,
    });
  } catch (error) {
    console.error(
      "Error updating Google Task:",
      error.response?.data || error.message
    );
  }
};

const deleteGoogleCalendarEvent = async (user, eventId) => {
  try {
    if (!user.googleAccessToken || !eventId) return;

    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    await calendar.events.delete({
      calendarId: "primary",
      eventId: eventId,
    });
  } catch (error) {
    if (error.code === 410 || error?.errors?.[0]?.reason === "deleted") {
      console.warn("⚠️ Google Calendar event already deleted:", eventId);
      return;
    }

    console.error("Error deleting Google Calendar event:", error);
  }
};

const deleteGoogleTask = async (user, taskId) => {
  try {
    if (!user.googleAccessToken || !taskId) return;

    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });

    const tasks = google.tasks({ version: "v1", auth: oauth2Client });

    await tasks.tasks.delete({
      tasklist: "@default",
      task: taskId,
    });
  } catch (error) {
    console.error(
      "Error deleting Google Task:",
      error.response?.data || error.message
    );
  }
};

io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);
  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined socket room`);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});
// Auth Routes
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
    });

    await user.save();

    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || "your-secret-key",
      {
        expiresIn: "7d",
      }
    );

    res.status(201).json({
      message: "User created successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        googleAccessToken: user.googleAccessToken || "",
        googleRefreshToken: user.googleRefreshToken || "",
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || "your-secret-key",
      {
        expiresIn: "7d",
      }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        googleAccessToken: user.googleAccessToken || "",
        googleRefreshToken: user.googleRefreshToken || "",
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.get("/api/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password"); // remove password
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Google OAuth Routes
app.get("/api/auth/google", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar"],
    // scope: ["https://www.googleapis.com/auth/tasks"],
  });
  res.json({ authUrl });
});

app.get("/api/auth/google/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("No code provided");

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Optional: Redirect to frontend with tokens or store them somewhere
    // In production, you'd set a session or JWT

    // Example: Just display success
    res.send(
      "Google Calendar connected successfully. You may close this window."
    );
  } catch (error) {
    console.error("Google callback error:", error);
    res.status(500).send("Authentication failed");
  }
});

app.post("/api/auth/google/callback", authenticateToken, async (req, res) => {
  try {
    const { code } = req.body;
    const { tokens } = await oauth2Client.getToken(code);

    // Save tokens to user
    await User.findByIdAndUpdate(req.user.userId, {
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token,
    });

    res.json({ message: "Google Calendar connected successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to connect Google Calendar",
      error: error.message,
    });
  }
});

// Task Routes
app.get("/api/tasks", authenticateToken, async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user.userId }).sort({
      createdAt: -1,
    });
    res.json({ tasks });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.post("/api/tasks", authenticateToken, async (req, res) => {
  try {
    const { title, description, scheduledTime } = req.body;

    // Check for scheduling conflicts
    if (scheduledTime) {
      const conflictingTask = await Task.findOne({
        userId: req.user.userId,
        scheduledTime: new Date(scheduledTime),
        status: { $ne: "blocked" },
      });

      if (conflictingTask) {
        return res.status(400).json({
          message: "Another task is already scheduled at this time",
        });
      }
    }

    const task = new Task({
      userId: req.user.userId,
      title,
      description,
      scheduledTime:
        scheduledTime !== "" ? new Date(scheduledTime) : new Date(),
    });

    await task.save();

    // Create Google Calendar event
    const user = await User.findById(req.user.userId);
    // if (user && scheduledTime) {
    //   const googleEventId = await createGoogleCalendarEvent(user, task);
    //   if (googleEventId) {
    //     task.googleEventId = googleEventId;
    //     await task.save();
    //   }
    // }

    // 👇 If calendar is connected
    if (
      user &&
      user.googleAccessToken &&
      user.googleRefreshToken &&
      scheduledTime
    ) {
      const googleEventId = await createGoogleCalendarEvent(user, task);
      if (googleEventId) {
        task.googleEventId = googleEventId;
        await task.save();
      }

      // 👇 If not already watching calendar
      if (!user.googleChannelId) {
        oauth2Client.setCredentials({
          access_token: user.googleAccessToken,
          refresh_token: user.googleRefreshToken,
        });

        const calendar = google.calendar({ version: "v3", auth: oauth2Client });

        const watchResponse = await calendar.events.watch({
          calendarId: "primary",
          requestBody: {
            id: uuidv4(), // Unique per user
            type: "web_hook",
            // address: "http://localhost:5000/api/google/calendar/notifications",
            address:
              "https://810d-120-72-93-46.ngrok-free.app/api/google/calendar/notifications", // Update to your domain
          },
        });

        // Save channel & resource IDs to user
        user.googleChannelId = watchResponse.data.id;
        user.googleResourceId = watchResponse.data.resourceId;
        await user.save();
      }
    }

    // if (user) {
    //   const googleTaskId = await createGoogleTask(user, task)
    //   if (googleTaskId) {
    //     task.googleTaskId = googleTaskId;
    //     await task.save()
    //   }
    // }

    res.status(201).json({ message: "Task created successfully", task });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.put("/api/tasks/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const task = await Task.findOne({ _id: id, userId: req.user.userId });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // If updating status from blocked to something else, add scheduledTime if not present
    if (
      updates.status &&
      task.status === "blocked" &&
      updates.status !== "blocked"
    ) {
      if (!task.scheduledTime && !updates.scheduledTime) {
        updates.scheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // Default to tomorrow
      }
    }

    // If moving from todo to inprogress, update time to current time
    if (task.status === "todo" && updates.status === "inprogress") {
      updates.scheduledTime = new Date();
    }

    // Check for scheduling conflicts if updating scheduledTime
    if (updates.scheduledTime) {
      const conflictingTask = await Task.findOne({
        userId: req.user.userId,
        _id: { $ne: id },
        scheduledTime: new Date(updates.scheduledTime),
        status: { $ne: "blocked" },
      });

      if (conflictingTask) {
        return res.status(400).json({
          message: "Another task is already scheduled at this time",
        });
      }
    }

    updates.updatedAt = new Date();
    const updatedTask = await Task.findByIdAndUpdate(id, updates, {
      new: true,
    });

    // Update Google Calendar event
    const user = await User.findById(req.user.userId);
    if (user && updatedTask.scheduledTime) {
      if (updatedTask.googleEventId) {
        await updateGoogleCalendarEvent(user, updatedTask);
      } else {
        const googleEventId = await createGoogleCalendarEvent(
          user,
          updatedTask
        );
        if (googleEventId) {
          updatedTask.googleEventId = googleEventId;
          await updatedTask.save();
        }
      }
    }

    // if (user) {
    //   if (updatedTask.googleTaskId) {
    //     await updateGoogleTask(user, updatedTask)
    //   } else {
    //     const googleTaskId = await createGoogleTask(user, updatedTask)
    //     if (googleTaskId) {
    //       updatedTask.googleTaskId = googleTaskId
    //       await updatedTask.save()
    //     }
    //   }
    // }

    res.json({ message: "Task updated successfully", task: updatedTask });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.delete("/api/tasks/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const task = await Task.findOne({ _id: id, userId: req.user.userId });
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    const user = await User.findById(req.user.userId);

    // Patch event before deleting (for immediate visual update)
    if (task.googleEventId && user?.googleAccessToken) {
      await deleteGoogleCalendarEvent(user, task.googleEventId);
      // oauth2Client.setCredentials({
      //   access_token: user.googleAccessToken,
      //   refresh_token: user.googleRefreshToken,
      // });

      // const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      // // Patch the event to indicate it will be deleted
      // await calendar.events.patch({
      //   calendarId: "primary",
      //   eventId: task.googleEventId,
      //   requestBody: {
      //     description: `${task.description}\n\n[This task has been deleted]`,
      //   },
      // });

      // // Short delay to allow UI to reflect the patch
      // await new Promise((resolve) => setTimeout(resolve, 200));

      // // Delete Google Calendar event
      // if (task.googleEventId) {
      //   const user = await User.findById(req.user.userId);
      //   if (user) {
      //     await deleteGoogleCalendarEvent(user, task.googleEventId);
      //   }
      // }
    }

    await Task.findByIdAndDelete({ _id: id });
    // Emit deletion event to all connected clients
    io.to(req.user.userId).emit("task-deleted", id);
    
    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Calendar sync route
app.post("/api/calendar/sync", authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.body;
    const task = await Task.findOne({ _id: taskId, userId: req.user.userId });
    const user = await User.findById(req.user.userId);

    if (!task || !user) {
      return res.status(404).json({ message: "Task or user not found" });
    }

    if (task.scheduledTime && !task.googleEventId) {
      const googleEventId = await createGoogleCalendarEvent(user, task);
      if (googleEventId) {
        task.googleEventId = googleEventId;
        await task.save();
      }
    }

    res.json({ message: "Task synced with Google Calendar" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.get("/api/calendar/test", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user.googleAccessToken) {
      return res.status(400).json({ message: "Google Calendar not connected" });
    }

    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    // Test by listing calendars
    const calendars = await calendar.calendarList.list();

    res.json({
      message: "Google Calendar connection successful",
      calendars: calendars.data.items?.map((cal) => ({
        id: cal.id,
        summary: cal.summary,
      })),
    });
  } catch (error) {
    res.status(500).json({
      message: "Google Calendar connection failed",
      error: error.message,
    });
  }
});

app.post("/api/google-tasks", authenticateToken, async (req, res) => {
  try {
    const { title, description, scheduledTime } = req.body;

    if (!title || !description) {
      return res
        .status(400)
        .json({ message: "Title and description are required" });
    }

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const taskId = await createGoogleTask(user, {
      title,
      description,
      scheduledTime,
    });
    if (!taskId)
      return res.status(500).json({ message: "Failed to create Google Task" });

    res
      .status(201)
      .json({ message: "Google Task created successfully", taskId });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

app.put("/api/google-tasks/:taskId", authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { title, description, scheduledTime } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user?.googleAccessToken)
      return res.status(400).json({ message: "Google account not connected" });

    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });

    const tasks = google.tasks({ version: "v1", auth: oauth2Client });
    const updates = {
      title,
      notes: description,
      due: scheduledTime ? new Date(scheduledTime).toISOString() : undefined,
    };

    const response = await tasks.tasks.update({
      tasklist: "@default",
      task: taskId,
      requestBody: updates,
    });

    res.json({
      message: "Google Task updated successfully",
      updatedTask: response.data,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update Google Task", error: error.message });
  }
});

app.delete("/api/google-tasks/:taskId", authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;

    const user = await User.findById(req.user.userId);
    if (!user?.googleAccessToken)
      return res.status(400).json({ message: "Google account not connected" });

    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });

    const tasks = google.tasks({ version: "v1", auth: oauth2Client });
    await tasks.tasks.delete({ tasklist: "@default", task: taskId });

    res.json({ message: "Google Task deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete Google Task", error: error.message });
  }
});

async function syncUserGoogleCalendar(user) {
  if (!user || !user.googleAccessToken || !user.googleRefreshToken) {
    console.error(`❌ Missing token(s) or user is undefined`);
    return;
  }

  const oauth2Client = new google.auth.OAuth2({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  });

  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: "startTime",
  });

  const googleEvents = res.data.items || [];
  const googleEventIds = googleEvents.map((e) => e.id);

  console.log("📅 Fetched Google events:", googleEventIds.length);

  // 🧠 Return list of current Google Calendar event IDs
  return googleEventIds;
}

app.post("/api/google/calendar/notifications", async (req, res) => {
  const channelId = req.header("x-goog-channel-id")?.trim();
  const resourceId = req.header("x-goog-resource-id")?.trim();
  const resourceState = req.header("x-goog-resource-state");

  console.log("🔔 Google Calendar notification received:", {
    channelId,
    resourceState,
    resourceId,
  });

  try {
    const user = await User.findOne({
      googleResourceId: resourceId.trim(),
    });

    if (!user) {
      console.warn("❌ No user matched resourceId:", resourceId);
      return res.sendStatus(200);
    }

    // Update channelId if it's new
    if (channelId && user.googleChannelId !== channelId) {
      console.log(`Updating channelId for user ${user.email}`);
      user.googleChannelId = channelId;
      await user.save();
    }

    // Handle different notification types
    if (resourceState === "sync") {
      console.log("Initial sync notification for user:", user.email);
      return res.sendStatus(200);
    }

    if (resourceState === "exists") {
      console.log(
        "📅 Event created/updated. Syncing calendar for user:",
        user.email
      );

      const googleEventIds = await syncUserGoogleCalendar(user);
      // Emit update to frontend
      io.to(user._id.toString()).emit("calendar-updated", { googleEventIds });
      // 💾 Get all synced events from your DB for this user
      const appEvents = await Task.find({ userId: user._id }); // Adjust collection/model name

      // 🧹 Remove tasks that no longer exist in Google Calendar
      const tasksToDelete = appEvents.filter(
        (task) => !googleEventIds.includes(task.googleEventId) // assuming you store the `googleEventId`
      );

      if (tasksToDelete.length > 0) {
        const idsToRemove = tasksToDelete.map((t) => t._id);
        await Task.deleteMany({ _id: { $in: idsToRemove } });

        console.log(`🧽 Removed ${idsToRemove.length} stale tasks from DB`);
      }
    } else if (resourceState === "not_exists") {
      const task = await Task.findOne({
        userId: user._id,
        googleEventId: resourceId,
      });
      if (task) {
        const deletedId = task._id.toString();
        await Task.deleteOne();

        console.log(`🗑️ Task deleted from DB: ${deletedId}`);
        // Emit update to frontend
        io.to(user._id.toString()).emit("calendar-task-deleted", { deletedId });
      } else {
        console.warn("⚠️ No matching task found for deleted Google event.");
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Error handling Google Calendar notification:", err);
    res.sendStatus(500);
  }
});

// Add to your task routes
app.get('/api/tasks/:id/share-link', authenticateToken, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user.userId });
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (!task.googleEventId) {
      return res.status(400).json({ message: 'Task not synced with Google Calendar' });
    }

    // Get the user's timezone
    const user = await User.findById(req.user.userId);
    const timeZone = user?.timeZone || 'UTC';

    // Format dates for Google Calendar
    const startDate = task.scheduledTime ? new Date(task.scheduledTime) : new Date();
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration

    // Generate Google Calendar share link
    const shareLink = `https://calendar.google.com/calendar/u/0/r/eventedit` +
      `?text=${encodeURIComponent(task.title)}` +
      `&dates=${formatGoogleCalendarDate(startDate)}/${formatGoogleCalendarDate(endDate)}` +
      `&details=${encodeURIComponent(task.description)}` +
      `&location=${encodeURIComponent('')}` + // Add location if needed
      `&ctz=${encodeURIComponent(timeZone)}` +
      `&slt=1AQOvs_Xbddk81Gskw1lSnwXWOUxBnBeUcstIpc4zEr0_kF-xSwVw4LPBEkCK1sMQVPi7oaarhV5gAg`;

    res.json({ shareLink });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate share link', error: error.message });
  }
});

// Helper function to format dates for Google Calendar
function formatGoogleCalendarDate(date) {
  return date.toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z/, 'Z');
}

const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
