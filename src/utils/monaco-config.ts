import * as monaco from 'monaco-editor';

// Create a proxy worker loader
class WorkerLoader {
    private baseUrl: string;

    constructor() {
        this.baseUrl = chrome.runtime.getURL('pages/viewer/vs');
    }

    private getWorkerUrl(label: string): string {
        switch (label) {
            case 'typescript':
            case 'javascript':
                return `${this.baseUrl}/language/typescript/tsWorker.js`;
            case 'html':
                return `${this.baseUrl}/language/html/htmlWorker.js`;
            case 'css':
            case 'scss':
            case 'less':
                return `${this.baseUrl}/language/css/cssWorker.js`;
            case 'json':
                return `${this.baseUrl}/language/json/jsonWorker.js`;
            default:
                return `${this.baseUrl}/editor/editor.worker.js`;
        }
    }

    public getWorker(moduleId: string, label: string): Worker {
        const workerUrl = this.getWorkerUrl(label);
        // Use the worker file directly
        return new Worker(workerUrl);
    }
}

// Initialize Monaco environment with global scope
const workerLoader = new WorkerLoader();
(globalThis as any).MonacoEnvironment = {
    getWorker: (moduleId: string, label: string) => workerLoader.getWorker(moduleId, label)
}; 