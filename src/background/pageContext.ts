import { isExtensionPage } from '@/utils/isExtensionPage';

export function normalizePageUrl(url: string): string {
    if (!url) return '';

    try {
        const parsed = new URL(url);
        parsed.hash = '';
        return parsed.toString();
    } catch {
        return url.split('#')[0] || url;
    }
}

export function extractSourceMapUrlFromContent(content: string): string | null {
    const trailer = content.slice(Math.max(0, content.length - 4096));
    const matches = Array.from(trailer.matchAll(/[#@]\s*sourceMappingURL=([^\s\*]+)/g));
    if (matches.length === 0) {
        return null;
    }
    return matches[matches.length - 1][1];
}

export function isPageUrlCandidate(url: string): boolean {
    if (!url || isExtensionPage(url)) {
        return false;
    }
    return /^https?:\/\//.test(url) || url.startsWith('file://');
}

export function getFileTypeFromUrl(url: string): 'js' | 'css' {
    return /\.css(?:[\?#].*)?$/i.test(url) ? 'css' : 'js';
}

export interface CandidatePageContext {
    pageUrl?: string;
    pageTitle?: string;
    tabId?: number;
}

export function pickResolvedPageContext(
    tabContext?: CandidatePageContext | null,
    documentContext?: CandidatePageContext | null,
    initiatorContext?: CandidatePageContext | null
): CandidatePageContext | null {
    const candidates = [tabContext, documentContext, initiatorContext];

    for (const candidate of candidates) {
        if (candidate?.pageUrl && isPageUrlCandidate(candidate.pageUrl)) {
            return {
                pageUrl: normalizePageUrl(candidate.pageUrl),
                pageTitle: candidate.pageTitle ?? '',
                tabId: candidate.tabId
            };
        }
    }

    return null;
}
