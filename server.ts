import { Server, Socket } from "socket.io";
import { createServer } from "http";

class ToxicityGuard {
    private static classifier: any = null;

    static async getClassifier() {
      if (!this.classifier) { 
        const { pipeline } = await import('@huggingface/transformers');
        this.classifier = await pipeline('text-classification', 'Xenova/toxic-bert', {
          // Adding this ensures it uses the most stable version
          revision: 'main' 
        })
      }
        // This loads a model functionally equivalent to Detoxify
        // 'Xenova/toxic-bert' is a popular quantized version for JS
      return this.classifier;
    }

    static async check(text: string): Promise<boolean> {
        const pipe = await this.getClassifier();
        const results = await pipe(text);
        // Returns an array like [{ label: 'toxic', score: 0.98 }]
        const toxicResult = results.find((r: any) => r.label === 'toxic');
        return toxicResult && toxicResult.score > 0.7; // Threshold of 70%
    }
}

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:7788", "https://local-organic-worlds.github.io"],
  }
});

const crypto = require('crypto');

const cooldowns = new Map();

function getHashedIP(socket: Socket) {
  const forwarded = socket.handshake.headers['x-forwarded-for'];

  // 1. If it's an array, take the first element. 
  // 2. If it's a string, use it. 
  // 3. If it's undefined, fall back to the direct socket address.
  const rawIP = Array.isArray(forwarded) ? forwarded[0] : forwarded;

  // Get the Public IP (handles proxies like Railway/Render)
  const clientIP = rawIP?.split(',')[0].trim() 
                    || socket.handshake.address;


  // Create a short, unrecognizable version of the IP
  const hashedIP = crypto.createHash('md5').update(clientIP).digest('hex').substring(0, 8);

  return hashedIP
}

io.on('connection', (socket: Socket) => {
  
  const hashedIP = getHashedIP(socket)

  // Automatically join a "World" based on hashed IP
  const worldID = `world-${hashedIP}`;
  socket.join(worldID);

  console.log(`📡 New Signal: ${socket.id} | Hashed IP: ${hashedIP} | Assigned to: ${worldID}`);

  console.log(`User connected to ${worldID}`);

  const occupancy = io.sockets.adapter.rooms.get(worldID)?.size || 0;
  console.log(`🌍 World ${worldID} now has ${occupancy} active keys.`);

  socket.on('broadcast-thought', async (data) => {
      const isToxic = false
      // const isToxic = await ToxicityGuard.check(data.text);
      // ToxicityGuard not working yet
      if (isToxic) {
        socket.emit('error-msg', "Blocked Toxic Content. Keep it low-key and friendly.");
      }
      else {
        if (checkRateLimit(socket)) { // only proceed if under rate limit
          // Only send the thought to people in the same "World" (same IP)
          io.to(worldID).emit('new-thought', { id: socket.id, ...data });
        }
        else {
          socket.emit('error-msg', "Too many thoughts. Slow down and breathe.");
        }
      }
  });

  socket.on('disconnect', () => {
    io.to(worldID).emit('user-left', socket.id);
    cooldowns.delete(socket.id); // Clean up memory
  });

});

function checkRateLimit(socket: Socket) {
  let underRateLimit = true
  const now = Date.now();
  const userHistory = cooldowns.get(socket.id) || [];

  // Filter out timestamps older than 10 seconds
  const recentMessages = userHistory.filter((time: number) => now - time < 10000);

  if (recentMessages.length >= 5) {
      // Rate limit triggered
      underRateLimit = false
  }

  // Add current timestamp and update map
  recentMessages.push(now);
  cooldowns.set(socket.id, recentMessages);

  return underRateLimit
}

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
console.log(`🚀 Switchboard (TS) live on port ${PORT}`);
});