const GA_MEASUREMENT_ID = 'G-WWC3Y9LB5J';
const GA_API_SECRET = 'eYRSCWKeR7aG5bEpp-REFw';

const CLIENT_ID_STORAGE_KEY = 'sd_ga_client_id';
const SESSION_DATA_STORAGE_KEY = 'sd_ga_session_data';
const SESSION_EXPIRATION_MS = 30 * 60 * 1000;
const DEFAULT_ENGAGEMENT_TIME_MSEC = 100;

declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void;
    }
}

function getClientId(): string {
    try {
        const existing = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
        if (existing) return existing;
        const clientId = `${Date.now()}.${Math.floor(Math.random() * 1_000_000_000)}`;
        localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
        return clientId;
    } catch {
        return `${Date.now()}.${Math.floor(Math.random() * 1_000_000_000)}`;
    }
}

function getOrCreateSessionId(): string {
    const now = Date.now();

    try {
        const raw = localStorage.getItem(SESSION_DATA_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as { session_id?: string; timestamp?: number };
            if (parsed?.session_id && parsed?.timestamp && now - parsed.timestamp <= SESSION_EXPIRATION_MS) {
                localStorage.setItem(
                    SESSION_DATA_STORAGE_KEY,
                    JSON.stringify({ session_id: parsed.session_id, timestamp: now })
                );
                return parsed.session_id;
            }
        }

        const sessionId = now.toString();
        localStorage.setItem(
            SESSION_DATA_STORAGE_KEY,
            JSON.stringify({ session_id: sessionId, timestamp: now })
        );
        return sessionId;
    } catch {
        return now.toString();
    }
}

export async function trackEvent(eventName: string, params: Record<string, unknown> = {}) {
    try {
        if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
            window.gtag('event', eventName, params);
        }

        if (!GA_MEASUREMENT_ID || !GA_API_SECRET) return;

        const clientId = getClientId();
        const sessionId = getOrCreateSessionId();

        await fetch(
            `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: clientId,
                    events: [
                        {
                            name: eventName,
                            params: {
                                ...params,
                                session_id: sessionId,
                                engagement_time_msec: DEFAULT_ENGAGEMENT_TIME_MSEC,
                                app_name: 'source_detector',
                                app_version: '1.3.0'
                            }
                        }
                    ]
                })
            }
        );
    } catch (error) {
        console.debug('analytics.trackEvent failed', error);
    }
}
