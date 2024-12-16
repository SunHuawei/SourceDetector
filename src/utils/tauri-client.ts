interface SourceMap {
    url: string;
    source_map_url: string;
    content: string;
    original_content: string;
    file_type: string;
    size: number;
    hash: string;
}

/**
 * Client for communicating with the Tauri desktop app
 */
class TauriClient {
    private static instance: TauriClient;
    private tauriPort = 3000; // Default port, should match Tauri app settings

    private constructor() {
        // Initialize with settings from storage
        chrome.storage.local.get(['tauriPort'], (result) => {
            if (result.tauriPort) {
                this.tauriPort = result.tauriPort;
            }
        });
    }

    static getInstance(): TauriClient {
        if (!TauriClient.instance) {
            TauriClient.instance = new TauriClient();
        }
        return TauriClient.instance;
    }


    async sendSourceMap(pageUrl: string, pageTitle: string, sourceMap: SourceMap): Promise<boolean> {
        try {
            const payload = {
                page_url: pageUrl,
                page_title: pageTitle,
                source_map: sourceMap
            };

            const response = await fetch(`http://localhost:${this.tauriPort}/api/sourcemap`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Server error:', errorData);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return true;
        } catch (error) {
            console.error('Failed to send source map to Tauri app:', error);
            return false;
        }
    }

    setPort(port: number) {
        this.tauriPort = port;
        chrome.storage.local.set({ tauriPort: port });
    }
}

export const tauriClient = TauriClient.getInstance(); 