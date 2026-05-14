// ============================================================
// TightSpotHelper — Custom Next.js server with Socket.io
// Replaces `next start` — handles HTTP + WebSocket in one process.
// ============================================================

import { createServer } from 'node:http'
import { Server as SocketServer } from 'socket.io'
import next from 'next'

const dev  = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT ?? '3000', 10)

const app    = next({ dev })
const handle = app.getRequestHandler()

interface ChatMessage {
  id:         string
  sessionId:  string
  userId:     string
  text:       string
  createdAt:  string
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res))

  const io = new SocketServer(httpServer, {
    cors: {
      origin: [
        process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
        'http://localhost:3000',
      ],
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', socket => {
    // Join a session room
    socket.on('session:join', (sessionId: string) => {
      socket.join(`session:${sessionId}`)
    })

    // Chat message — broadcast to everyone in the session room
    socket.on('chat:send', (data: Omit<ChatMessage, 'id' | 'createdAt'>) => {
      const msg: ChatMessage = {
        id:        crypto.randomUUID(),
        sessionId: data.sessionId,
        userId:    data.userId,
        text:      data.text,
        createdAt: new Date().toISOString(),
      }
      io.to(`session:${data.sessionId}`).emit('chat:message', msg)
    })

    // Session status change — notify the other participant
    socket.on('session:status', (data: { sessionId: string; status: string }) => {
      io.to(`session:${data.sessionId}`).emit('session:status', data)
    })
  })

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
