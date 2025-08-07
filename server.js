const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

app.get("/", (req, res) => {
    res.send("🎉 Backend server is running!");
});

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: [process.env.FRONTEND_URL || "http://localhost:3000"],
        methods: ["GET", "POST"]
    }
});

// Store nodes + users per room
const rooms = {}; // { roomId: { nodes: [], edges:[], users: [] } }

io.on("connection", (socket) => {
    console.log("✅ User connected", socket.id);

    // Handle joining a room
    socket.on("join-room", ({ roomId, username }) => {
        socket.join(roomId);
        console.log(`${socket.id} joined room: ${roomId}`);

        if (!rooms[roomId]) {
            rooms[roomId] = { nodes: [], edges:[], users: [] };
        }

        socket.emit("update-nodes", rooms[roomId].nodes);
        socket.emit("update-edges",rooms[roomId].edges);

        rooms[roomId].users.push(username);
        socket.username = username;
        socket.roomId = roomId;

        // Send updated user list to room
        io.to(roomId).emit("update-users", rooms[roomId].users);

        // Send existing nodes to the user who just joined
        socket.emit("update-nodes", rooms[roomId].nodes);

        socket.emit("update-edges", rooms[roomId].edges);

        // Notify other users
        socket.to(roomId).emit("user-joined", username);
    });

    // Handle node updates from any user
    socket.on("node-update", ({ roomId, nodes }) => {
        if (rooms[roomId]) {
            rooms[roomId].nodes = nodes;
            socket.to(roomId).emit("update-nodes", nodes);
        }
    });

    socket.on("edge.update", ({roomId,edges})=>{
        if(rooms[roomId]){
            rooms[roomId].edges = edges;
            socket.to(roomId).emit("update-edges",edges);
        }
    });

    // Handle user disconnect
    socket.on("disconnect", () => {
        const { roomId, username } = socket;
        if (roomId && rooms[roomId]) {
            rooms[roomId].users = rooms[roomId].users.filter(u => u !== username);
            io.to(roomId).emit("update-users", rooms[roomId].users);
            socket.to(roomId).emit("user-left", username);
        }
        console.log("❌ User disconnected");
    });
});

server.listen(process.env.PORT || 5000, () => {
    console.log(`Server running on port ${process.env.PORT || 5000}`);
});