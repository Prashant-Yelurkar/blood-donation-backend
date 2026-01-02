import { Server } from "socket.io";
import { onlineUsers } from "./socketStore.js";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // adjust for production
    },
  });

  io.on("connection", (socket) => {
    console.log("⚡ New socket connected:", socket.id);

    // Register user
    socket.on("register-user", (userId) => {
      onlineUsers.set(userId, socket.id);
      socket.userId = userId; // attach userId to socket
      console.log("✅ User registered on socket:", userId);
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        console.log("⚠️ User disconnected:", socket.userId);
      }
    });
  });

  return io;
};

// Helper to get io instance
export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};
