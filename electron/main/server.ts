import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import 'dotenv/config'
import { DatabaseOperations } from './database-operations'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

// Default values in case env variables are not set
const DEFAULT_PORT = 63798
const DEFAULT_HOST = '127.0.0.1'

// Create logs directory if it doesn't exist
const logsDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Log file path
const logFile = path.join(logsDir, 'server.log');

// Supported table names for sync
const SUPPORTED_TABLES = ['sourceMapFiles', 'pages', 'pageSourceMaps', 'crxFiles'] as const;
type TableName = typeof SUPPORTED_TABLES[number];

interface SyncRequest {
    table: TableName;
    lastSyncTimestamp: number;
    data: any[];
}

export async function createServer(dbOps: DatabaseOperations): Promise<FastifyInstance> {
    const fastify = Fastify({
        logger: {
            file: logFile
        }
    })

    // Register CORS
    await fastify.register(cors, {
        origin: true,
        methods: ['GET', 'POST']
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

    // Universal sync endpoint
    fastify.post<{ Body: SyncRequest }>('/sync', async (request) => {
        try {
            const { table, lastSyncTimestamp, data } = request.body;

            if (!SUPPORTED_TABLES.includes(table)) {
                throw new Error(`Unsupported table: ${table}`);
            }

            // Process data based on table type
            switch (table) {
                case 'sourceMapFiles':
                    for (const file of data) {
                        await dbOps.addSourceMapFile({
                            url: file.url,
                            sourceMapUrl: file.sourceMapUrl,
                            content: file.content,
                            originalContent: file.originalContent,
                            fileType: file.fileType,
                            size: file.size,
                            hash: file.hash,
                            timestamp: file.timestamp,
                            version: file.version || 1,
                            isLatest: file.isLatest || true
                        });
                    }
                    break;

                case 'pages':
                    for (const page of data) {
                        await dbOps.addPage({
                            url: page.url,
                            title: page.title,
                            timestamp: page.timestamp
                        });
                    }
                    break;

                case 'pageSourceMaps':
                    for (const relation of data) {
                        await dbOps.addPageSourceMap({
                            sourceMapId: relation.sourceMapId,
                            pageId: relation.pageId,
                            timestamp: relation.timestamp
                        });
                    }
                    break;

                case 'crxFiles':
                    for (const file of data) {
                        await dbOps.addCrxFile({
                            pageUrl: file.pageUrl,
                            pageTitle: file.pageTitle,
                            crxUrl: file.crxUrl,
                            blob: Buffer.from(file.blob, 'base64'),
                            size: file.size,
                            timestamp: file.timestamp,
                            count: file.count
                        });
                    }
                    break;
            }

            // Update sync timestamp
            await dbOps.updateSyncTimestamp(table, Date.now());

            return { success: true };
        } catch (error) {
            console.error('Error syncing data:', error);
            throw error;
        }
    });

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