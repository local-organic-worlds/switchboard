const io = require('socket.io')(process.env.PORT || 3000, {
    cors: {
      origin: ["http://localhost:7788", "https://local-organic-worlds.github.io"],
      methods: ["GET", "POST"]
    }
  });
  
  io.on('connection', (socket) => {
    // Get the Public IP (handles proxies like Railway/Render)
    const clientIP = socket.handshake.headers['x-forwarded-for']?.split(',')[0] 
                     || socket.handshake.address;
  
    // Automatically join a "World" based on that IP
    const worldID = `world-${clientIP}`;
    socket.join(worldID);
  
    console.log(`User connected to ${worldID}`);
  
    socket.on('broadcast-thought', (data) => {
      // Only send the thought to people in the same "World" (same IP)
      io.to(worldID).emit('new-thought', { id: socket.id, ...data });
    });
  
    socket.on('disconnect', () => {
      io.to(worldID).emit('user-left', socket.id);
    });
  });