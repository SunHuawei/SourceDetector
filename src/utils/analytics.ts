const GA_MEASUREMENT_ID = 'G-WWC3Y9LB5J';
const GA_API_SECRET = 'eYRSCWKeR7aG5bEpp-REFw';

const CLIENT_ID_STORAGE_KEY = 'sd_ga_client_id';
const SESSION_DATA_STORAGE_KEY = 'sd_ga_session_data';
const ONCE_EVENT_STORAGE_PREFIX = 'sd_analytics_once_';
const SESSION_EXPIRATION_MS = 30 * 60 * 1000;
const DEFAULT_ENGAGEMENT_TIME_MSEC = 100;

export type AnalyticsParamValue = string | number | boolean | null | undefined;
export type AnalyticsEventParams = Record<string, AnalyticsParamValue>;

export type ProductAnalyticsEventName =
    | 'result_viewed'
    | 'finding_detail_opened'
    | 'scan_failed'
    | 'settings_changed'
    | 'onboarding_started'
    | 'onboarding_completed'
    | 'feedback_submitted'
    | 'share_clicked'
    | 'rating_clicked';

declare global {
    interface Window {
        gtag?: (...args: unknown[]) => void;
    }
}

function normalizeAnalyticsParamValue(value: AnalyticsParamValue): string | number | undefined {
    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }

    return undefined;
}

export function sanitizeAnalyticsParams(params: AnalyticsEventParams = {}): Record<string, string | number> {
    const normalizedParams: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(params)) {
        const normalizedValue = normalizeAnalyticsParamValue(value);
        if (normalizedValue !== undefined) {
            normalizedParams[key] = normalizedValue;
        }
    }
    return normalizedParams;
}

export function getOnceEventStorageKey(onceKey: string): string {
    return `${ONCE_EVENT_STORAGE_PREFIX}${onceKey}`;
}

function hasTrackedEventOnce(onceKey: string): boolean {
    try {
        return localStorage.getItem(getOnceEventStorageKey(onceKey)) === '1';
    } catch {
        return false;
    }
}

function markEventTrackedOnce(onceKey: string): void {
    try {
        localStorage.setItem(getOnceEventStorageKey(onceKey), '1');
    } catch {
        // Ignore localStorage write failures and continue tracking.
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

export async function trackEvent(eventName: string, params: AnalyticsEventParams = {}) {
    try {
        const normalizedParams = sanitizeAnalyticsParams(params);

        if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
            window.gtag('event', eventName, normalizedParams);
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
                                ...normalizedParams,
                                session_id: sessionId,
                                engagement_time_msec: DEFAULT_ENGAGEMENT_TIME_MSEC,
                                app_name: 'source_detector',
                                app_version: '1.3.2'
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

export async function trackProductEvent(
    eventName: ProductAnalyticsEventName,
    params: AnalyticsEventParams = {}
) {
    await trackEvent(eventName, params);
}

export async function trackEventOnce(
    eventName: ProductAnalyticsEventName,
    onceKey: string,
    params: AnalyticsEventParams = {}
) {
    if (hasTrackedEventOnce(onceKey)) {
        return;
    }

    markEventTrackedOnce(onceKey);
    await trackProductEvent(eventName, params);
}
