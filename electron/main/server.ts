import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import 'dotenv/config'

// Default values in case env variables are not set
const DEFAULT_PORT = 63798
const DEFAULT_HOST = '127.0.0.1'

export async function createServer(): Promise<FastifyInstance> {
    const fastify = Fastify({
        logger: true
    })

    // Register CORS
    await fastify.register(cors, {
        origin: true,
        methods: ['GET']
    })

    // Health check endpoint
    fastify.get('/health', async () => {
        return { status: 'ok' }
    })

    // Current time endpoint
    fastify.get('/time', async () => {
        return {
            timestamp: Date.now(),
            iso: new Date().toISOString(),
            local: new Date().toLocaleString()
        }
    })

    try {
        const port = parseInt(process.env.SERVER_PORT || DEFAULT_PORT.toString(), 10)
        const host = process.env.SERVER_HOST || DEFAULT_HOST

        await fastify.listen({
            port,
            host
        })
        console.log(`Server is running on http://${host}:${port}`)
        return fastify
    } catch (err) {
        console.error('Error starting server:', err)
        throw err
    }
}

export async function closeServer(server: FastifyInstance | null): Promise<void> {
    if (server) {
        await server.close()
        console.log('Server closed')
    }
} 