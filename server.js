import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const rooms = {}; 

io.on("connection", (socket) => {
    console.log("A user connected");
    socket.on("join-room", ({ roomId, username }) => {
        socket.join(roomId);
        if (!rooms[roomId]) {
            rooms[roomId] = { nodes: [], users: [] };
        }
        rooms[roomId].users.push(username);
        console.log(`${username} joined room ${roomId}`);
        io.to(roomId).emit("update-users", rooms[roomId].users);
        socket.emit("update-nodes", rooms[roomId].nodes);
        socket.to(roomId).emit("user-joined", username);
        socket.username = username;
        socket.roomId = roomId;
    });
    socket.on("node-update", ({ roomId, nodes }) => {
        if (rooms[roomId]) {
            rooms[roomId].nodes = nodes;
            socket.to(roomId).emit("update-nodes", nodes);
            console.log("Updated nodes for room", roomId, nodes);
        }
    });
    socket.on("node-rename", ({ roomId, nodeId, newLabel }) => {
        if (rooms[roomId]) {
            rooms[roomId].nodes = rooms[roomId].nodes.map((n) =>
                n.id === nodeId ? { ...n, data: { label: newLabel } } : n
            );
            io.to(roomId).emit("update-nodes", rooms[roomId].nodes);
        }
    });
    socket.on("node-delete", ({ roomId, nodeId }) => {
        if (rooms[roomId]) {
            rooms[roomId].nodes = rooms[roomId].nodes.filter((n) => n.id !== nodeId);
            io.to(roomId).emit("update-nodes", rooms[roomId].nodes);
        }
    });
    socket.on("disconnect", () => {
        const { roomId, username } = socket;
        if (roomId && rooms[roomId]) {
            rooms[roomId].users = rooms[roomId].users.filter((u) => u !== username);
            io.to(roomId).emit("update-users", rooms[roomId].users);
            socket.to(roomId).emit("user-left", username);
        }
        console.log("User disconnected");
    });
});
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));