import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import compress from '@fastify/compress'
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
    lastId: number;
    data: any[];
}

interface SyncResult {
    success: boolean;
    failedRecords: any[];
    lastSuccessId: number;
}

export async function createServer(dbOps: DatabaseOperations): Promise<FastifyInstance> {
    const fastify = Fastify({
        logger: {
            level: 'error',
            file: logFile
        },
        bodyLimit: 1024 * 1024 * 1024, // 1GB limit
        maxParamLength: 1000
    })

    // Register CORS
    await fastify.register(cors, {
        origin: true,
        methods: ['GET', 'POST']
    })

    // Register compression
    await fastify.register(compress, {
        encodings: ['gzip', 'deflate']
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
    fastify.post<{ Body: SyncRequest }>('/sync', async (request, reply) => {
        const { table, lastId, data } = request.body;

        const results = {
            success: true,
            failedRecords: [] as any[],
            lastSuccessId: lastId
        };

        try {
            switch (table) {
                case 'sourceMapFiles':
                    for (const file of data) {
                        try {
                            dbOps.addSourceMapFile(file);
                            results.lastSuccessId = Math.max(results.lastSuccessId, file.id);
                        } catch (error) {
                            results.failedRecords.push({
                                id: file.id,
                                error: String(error)
                            });
                        }
                    }
                    break;

                case 'pages':
                    for (const page of data) {
                        try {
                            dbOps.addPage(page);
                            results.lastSuccessId = Math.max(results.lastSuccessId, page.id);
                        } catch (error) {
                            results.failedRecords.push({
                                id: page.id,
                                error: String(error)
                            });
                        }
                    }
                    break;

                case 'pageSourceMaps':
                    for (const relation of data) {
                        try {
                            // Check if both page and source map exist
                            const page = dbOps.getPage(relation.pageId);
                            const sourceMap = dbOps.getSourceMapFile(relation.sourceMapId);

                            if (!page || !sourceMap) {
                                throw new Error(
                                    `Dependencies not found for pageSourceMap: ` +
                                    `page ${relation.pageId} (${page ? 'found' : 'missing'}), ` +
                                    `sourceMap ${relation.sourceMapId} (${sourceMap ? 'found' : 'missing'})`
                                );
                            }

                            dbOps.addPageSourceMap(relation);
                            results.lastSuccessId = Math.max(results.lastSuccessId, relation.id);
                        } catch (error) {
                            results.failedRecords.push({
                                id: relation.id,
                                error: String(error)
                            });
                        }
                    }
                    break;

                case 'crxFiles':
                    for (const file of data) {
                        try {
                            // Convert base64 blob back to Buffer
                            const blob = Buffer.from(file.blob, 'base64');
                            dbOps.addCrxFile({
                                ...file,
                                blob
                            });
                            results.lastSuccessId = Math.max(results.lastSuccessId, file.id);
                        } catch (error) {
                            results.failedRecords.push({
                                id: file.id,
                                error: String(error)
                            });
                        }
                    }
                    break;

                default:
                    return reply.status(400).send({ success: false, error: 'Invalid table name' });
            }

            return reply.send(results);
        } catch (error) {
            console.error('Error in sync endpoint:', error);
            return reply.status(500).send({ success: false, error: String(error) });
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