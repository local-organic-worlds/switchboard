const io = require('socket.io')(process.env.PORT || 3000, {
    cors: {
      origin: ["http://localhost:7788", "https://local-organic-worlds.github.io"],
      methods: ["GET", "POST"]
    }
  });
  
  const cooldowns = new Map();

  io.on('connection', (socket) => {
    // Get the Public IP (handles proxies like Railway/Render)
    const clientIP = socket.handshake.headers['x-forwarded-for']?.split(',')[0] 
                     || socket.handshake.address;
  
    // Automatically join a "World" based on that IP
    const worldID = `world-${clientIP}`;
    socket.join(worldID);

    console.log(`📡 New Signal: ${socket.id} | IP: ${clientIP} | Assigned to: ${worldID}`);
  
    console.log(`User connected to ${worldID}`);

    const occupancy = io.sockets.adapter.rooms.get(worldID)?.size || 0;
    console.log(`🌍 World ${worldID} now has ${occupancy} active keys.`);
  
    socket.on('broadcast-thought', (data) => {
        if (checkRateLimit(socket)) { // only proceed if under rate limit
            // Only send the thought to people in the same "World" (same IP)
            io.to(worldID).emit('new-thought', { id: socket.id, ...data });
        }
    });
  
    socket.on('disconnect', () => {
      io.to(worldID).emit('user-left', socket.id);
      cooldowns.delete(socket.id); // Clean up memory
    });

  });

  function checkRateLimit(socket) {
    let underRateLimit = true
    const now = Date.now();
    const userHistory = cooldowns.get(socket.id) || [];

    // Filter out timestamps older than 10 seconds
    const recentMessages = userHistory.filter(time => now - time < 10000);

    if (recentMessages.length >= 5) {
        // Rate limit triggered
        socket.emit('error-msg', "Too many thoughts. Slow down and breathe.");
        underRateLimit = false
    }

    // Add current timestamp and update map
    recentMessages.push(now);
    cooldowns.set(socket.id, recentMessages);

    return underRateLimit
  }