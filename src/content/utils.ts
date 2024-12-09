/**
 * Check if a URL is from the same origin as the current page
 */
export function isSameOrigin(url: string): boolean {
    try {
        const currentOrigin = window.location.origin;
        const targetOrigin = new URL(url).origin;
        return currentOrigin === targetOrigin;
    } catch {
        return false;
    }
}

/**
 * Format error object to string
 */
export function formatError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

/**
 * Fetch with retry functionality
 */
export async function fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retries = 3
): Promise<Response> {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
    } catch (error) {
        if (retries === 0) {
            throw error;
        }

        const delay = Math.min(1000 * (4 - retries), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, retries - 1);
    }
}

/**
 * Check if a URL is accessible via CORS
 */
export async function checkCorsAccess(url: string): Promise<boolean> {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Get file type from URL
 */
export function getFileTypeFromUrl(url: string): 'js' | 'css' | null {
    const extension = url.split('.').pop()?.toLowerCase();
    if (extension === 'js' || extension === 'jsx' || extension === 'ts' || extension === 'tsx') {
        return 'js';
    }
    if (extension === 'css' || extension === 'scss' || extension === 'less') {
        return 'css';
    }
    return null;
} 