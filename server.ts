// ============================================================
// TightSpotHelper — Custom Next.js server with Socket.io
// Replaces `next start` — handles HTTP + WebSocket in one process.
// ============================================================

import { createServer } from 'node:http'
import { Server as SocketServer } from 'socket.io'
import next from 'next'
import { prisma } from './lib/db'

const dev  = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT ?? '3000', 10)

const app    = next({ dev })
const handle = app.getRequestHandler()

interface ChatMessage {
  id:        string
  sessionId: string
  userId:    string
  text:      string
  createdAt: string
}

declare module 'socket.io' {
  interface SocketData {
    userId: string
    role:   string
  }
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

  // ── Auth middleware ───────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie ?? ''
      const match = cookieHeader.match(/better-auth\.session_token=([^;]+)/)
      const token = match ? decodeURIComponent(match[1]) : null
      if (!token) return next(new Error('Unauthorized'))

      const authSession = await prisma.authSession.findUnique({
        where:   { token },
        include: { user: { select: { id: true, role: true } } },
      })

      if (!authSession || authSession.expiresAt < new Date()) {
        return next(new Error('Unauthorized'))
      }

      socket.data.userId = authSession.user.id
      socket.data.role   = authSession.user.role
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', socket => {
    const { userId, role } = socket.data

    // Auto-join personal notification room
    socket.join(`user:${userId}`)

    // Join a session room — verify the user is a participant or admin
    socket.on('session:join', async (sessionId: string) => {
      try {
        const session = await prisma.session.findUnique({
          where:  { id: sessionId },
          select: { customerId: true, expertId: true },
        })
        if (!session) return socket.emit('error', { message: 'Session not found' })

        const isParticipant = session.customerId === userId || session.expertId === userId
        if (!isParticipant && role !== 'admin') {
          return socket.emit('error', { message: 'Forbidden' })
        }

        socket.join(`session:${sessionId}`)
      } catch {
        socket.emit('error', { message: 'Failed to join session' })
      }
    })

    // Chat — userId comes from verified auth, never from client payload
    socket.on('chat:send', (data: { sessionId: string; text: string }) => {
      const msg: ChatMessage = {
        id:        crypto.randomUUID(),
        sessionId: data.sessionId,
        userId,
        text:      data.text,
        createdAt: new Date().toISOString(),
      }
      io.to(`session:${data.sessionId}`).emit('chat:message', msg)
    })

    // Photo added — broadcast to session room (emitted by API route after DB insert)
    socket.on('photo:added', (data: { sessionId: string; photo: object }) => {
      io.to(`session:${data.sessionId}`).emit('photo:added', data.photo)
    })

    // Session status change
    socket.on('session:status', (data: { sessionId: string; status: string }) => {
      io.to(`session:${data.sessionId}`).emit('session:status', data)
    })
  })

  // Expose io for API routes to emit notification:new to user rooms
  ;(globalThis as Record<string, unknown>).__io = io

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
