import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { env, getAllowedOrigins } from './config/env.js';
import { initializeSocket } from './lib/socket.js';
import { startReminderSchedulers } from './modules/notifications/reminder.scheduler.js';
import { app } from './app.js';

const httpServer = createServer(app);

const allowedOrigins = getAllowedOrigins();

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
});

initializeSocket(io);

httpServer.listen(env.PORT, () => {
  startReminderSchedulers();
  console.log(`StudySync backend running on http://localhost:${env.PORT}`);
});
