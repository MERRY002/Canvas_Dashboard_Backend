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
    methods: ["GET", "POST"],
  },
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
      rooms[roomId] = { nodes: [], edges: [], users: [] };
    }

    // Add user to the room's user list
    rooms[roomId].users.push(username);
    socket.username = username;
    socket.roomId = roomId;

    // Send current nodes and edges to the new user
    socket.emit("syncNodes", rooms[roomId].nodes);
    socket.emit("syncEdges", rooms[roomId].edges);

    // Notify everyone in the room of the updated user list
    io.to(roomId).emit("update-users", rooms[roomId].users);
    socket.to(roomId).emit("user-joined", username);
  });
  socket.on("addNode",({node, roomId})=>{
        if(rooms[roomId]){
            rooms[roomId].nodes.push(node);

            socket.to(roomId).emit("nodeAdded",{node});
                
        }
    });

    socket.on("addEdge", ({edge,roomId})=>{
        if(rooms[roomId]){
            rooms[roomId].edges.push(edge);

            socket.to(roomId).emit("edgeAdded", {edge});
        }
    });

  // Handle node updates from a user
  socket.on("node-update", ({ roomId, nodes }) => {
    if (rooms[roomId]) {
      rooms[roomId].nodes = nodes;
      socket.to(roomId).emit("update-nodes", nodes);
    }
  });

  // Handle edge updates from a user
  socket.on("edge-update", ({ roomId, edges }) => {
    if (rooms[roomId]) {
      rooms[roomId].edges = edges;
      socket.to(roomId).emit("update-edges", edges);
    }
  });
  socket.on("deleteNode", ({ nodeId, roomId }) => {
  if (rooms[roomId]) {
    rooms[roomId].nodes = rooms[roomId].nodes.filter((n) => n.id !== nodeId);
    rooms[roomId].edges = rooms[roomId].edges.filter(
      (e) => e.source !== nodeId && e.target !== nodeId
    );
    socket.to(roomId).emit("nodeDeleted", { nodeId });
  }
});

socket.on("updateNodes", ({ nodes, roomId }) => {
  if (rooms[roomId]) {
    rooms[roomId].nodes = nodes;
    socket.to(roomId).emit("syncNodes", nodes);
  }
});

socket.on("updateEdges", ({ edges, roomId }) => {
  if (rooms[roomId]) {
    rooms[roomId].edges = edges;
    socket.to(roomId).emit("syncEdges", edges);
  }
});

  // Handle user disconnect
  socket.on("disconnect", () => {
    const { roomId, username } = socket;
    if (roomId && rooms[roomId]) {
      rooms[roomId].users = rooms[roomId].users.filter((u) => u !== username);
      io.to(roomId).emit("update-users", rooms[roomId].users);
      socket.to(roomId).emit("user-left", username);

      if(rooms[roomId].users.length===0){
        delete rooms[roomId];
      }
    }
    console.log("❌ User disconnected");
  });
});

server.listen(process.env.PORT || 5000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 5000}`);
});