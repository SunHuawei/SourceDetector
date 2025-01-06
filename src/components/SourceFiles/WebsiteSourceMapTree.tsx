import { Article, Code, Language } from '@mui/icons-material';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { useEffect, useState, useRef } from 'react';

interface Domain {
    id: number;
    domain: string;
}

interface Page {
    id: number;
    url: string;
}

interface SourceMap {
    id: number;
    url: string;
}

interface FolderTreeProps {
    onSourceMapSelect: (sourceMapId: number) => void;
    onPageSelect: (pageId: number) => void;
}

type DomainMap = Map<number, Domain>;
type PageMap = Map<number, Map<number, Page>>;
type SourceMapMap = Map<number, Map<number, SourceMap>>;
type LoadingMap = Map<string, boolean>;
type HasMoreMap = Map<string, boolean>;
type PageNumberMap = Map<string, number>;

const PAGE_SIZE = 20;

const WebsiteSourceMapTree = ({ onSourceMapSelect, onPageSelect }: FolderTreeProps) => {
    const [domains, setDomains] = useState<DomainMap>(new Map());
    const [pages, setPages] = useState<PageMap>(new Map());
    const [sourceMaps, setSourceMaps] = useState<SourceMapMap>(new Map());
    const [loading, setLoading] = useState<LoadingMap>(new Map());
    const [hasMore, setHasMore] = useState<HasMoreMap>(new Map());
    const [pageNumbers, setPageNumbers] = useState<PageNumberMap>(new Map());
    const [isInitialized, setIsInitialized] = useState(false);
    const [defaultExpandedItems, setDefaultExpandedItems] = useState<string[]>([]);

    const loadDomains = async (offset: number = 0) => {
        if (loading.get('domains')) return;

        setLoading(prev => new Map(prev).set('domains', true));
        try {
            const response = await window.database.getDomains(offset, PAGE_SIZE);
            if (response.success && response.data?.domains) {
                const { domains: newDomains, hasMore } = response.data;
                await Promise.all(newDomains.map(domain => loadPages(domain.id, 0)));

                setDomains(prev => {
                    const next = offset === 0 ? new Map() : new Map(prev);
                    newDomains.forEach(domain => next.set(domain.id, domain));
                    return next;
                });

                setHasMore(prev => new Map(prev).set('domains', hasMore));
                setPageNumbers(prev => new Map(prev).set('domains', (prev.get('domains') || 0) + 1));
                return newDomains;
            } else if (response.error) {
                console.error('Error loading domains:', response.error);
            }
        } catch (error) {
            console.error('Error loading domains:', error);
        } finally {
            setLoading(prev => new Map(prev).set('domains', false));
        }
    };

    const loadPages = async (domainId: number, offset: number = 0) => {
        const loadingKey = `pages-${domainId}`;
        setLoading(prev => new Map(prev).set(loadingKey, true));
        try {
            const response = await window.database.getPages(domainId, offset, PAGE_SIZE);
            if (response.success && response.data?.pages && response.data?.hasMore !== undefined) {
                const { pages: newPages, hasMore } = response.data;

                setPages(prev => {
                    const next = new Map(prev);
                    const domainPages = new Map(next.get(domainId) || new Map());
                    newPages.forEach(page => domainPages.set(page.id, page));
                    next.set(domainId, domainPages);
                    return next;
                });

                setHasMore(prev => new Map(prev).set(loadingKey, hasMore));
                setPageNumbers(prev => new Map(prev).set(loadingKey, (prev.get(loadingKey) || 0) + 1));
                return newPages;
            } else if (response.error) {
                console.error('Error loading pages:', response.error);
            }
        } catch (error) {
            console.error('Error loading pages:', error);
        } finally {
            setLoading(prev => new Map(prev).set(loadingKey, false));
        }
    };

    const loadSourceMaps = async (pageId: number, offset: number = 0) => {
        const loadingKey = `sourcemaps-${pageId}`;
        setLoading(prev => new Map(prev).set(loadingKey, true));
        try {
            const response = await window.database.getSourceMaps(pageId, offset, PAGE_SIZE);
            if (response.success && response.data?.sourceMaps && response.data?.hasMore !== undefined) {
                const { sourceMaps: newSourceMaps, hasMore } = response.data;

                setSourceMaps(prev => {
                    const next = new Map(prev);
                    const pageSourceMaps = new Map(next.get(pageId) || new Map());
                    newSourceMaps.forEach(sourceMap => pageSourceMaps.set(sourceMap.id, sourceMap));
                    next.set(pageId, pageSourceMaps);
                    return next;
                });

                setHasMore(prev => new Map(prev).set(loadingKey, hasMore));
                setPageNumbers(prev => new Map(prev).set(loadingKey, (prev.get(loadingKey) || 0) + 1));
                return newSourceMaps;
            } else if (response.error) {
                console.error('Error loading source maps:', response.error);
            }
        } catch (error) {
            console.error('Error loading source maps:', error);
        } finally {
            setLoading(prev => new Map(prev).set(loadingKey, false));
        }
    };

    const loadAll = async () => {
        const domains = await loadDomains();
        if (domains && domains.length > 0) {
            const pages = await loadPages(domains[0].id, 0);
            if (pages && pages.length > 0) {
                const sourceMaps = await loadSourceMaps(pages[0].id, 0);
                if (sourceMaps && sourceMaps.length > 0) {
                    const sourceMap = sourceMaps[0];
                    onSourceMapSelect(sourceMap.id);
                    setDefaultExpandedItems([`domain-${domains[0].id}`, `page-${pages[0].id}`, `sourcemap-${sourceMaps[0].id}:${pages[0].id}`]);
                    setIsInitialized(true);
                }
            }
        } else {
            setIsInitialized(true);
        }
    }

    useEffect(() => {
        if (!isInitialized) {
            loadAll();
        }
    }, [isInitialized]);

    const renderLoadMoreButton = (key: string, loadMore: () => void) => {
        if (!hasMore.get(key)) return null;

        return (
            <Button
                disabled={loading.get(key)}
                onClick={loadMore}
                sx={{ mt: 1, ml: 3 }}
                size="small"
                startIcon={loading.get(key) ? <CircularProgress size={16} /> : null}
            >
                {loading.get(key) ? 'Loading...' : 'Load More'}
            </Button>
        );
    };

    const handleSourceMapClick = (sourceMapId: number) => {
        onSourceMapSelect(sourceMapId);
    };

    const handlePageClick = (pageId: number, event: React.MouseEvent) => {
        event.stopPropagation();
        onPageSelect(pageId);
    };

    if (!isInitialized) {
        return 'loading...'
    }

    return (
        <Box sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}>
            <SimpleTreeView
                expansionTrigger="iconContainer"
                defaultExpandedItems={defaultExpandedItems}
                defaultSelectedItems={defaultExpandedItems[defaultExpandedItems.length - 1]}
                onItemExpansionToggle={(event, itemId, isExpanded) => {
                    if (isExpanded && itemId.startsWith('page-')) {
                        const pageId = parseInt(itemId.replace('page-', ''), 10);
                        if (!sourceMaps.has(pageId)) {
                            loadSourceMaps(pageId, 0);
                        }
                    }
                }}
            >
                {Array.from(domains.values()).map(domain => (
                    <TreeItem
                        key={`domain-${domain.id}`}
                        itemId={`domain-${domain.id}`}
                        label={
                            <Box component="div" sx={{ display: 'flex', alignItems: 'center', py: 0.5 }}>
                                <Language sx={{ mr: 1 }} />
                                <Typography variant="body2">{domain.domain}</Typography>
                            </Box>
                        }
                    >
                        {Array.from(pages.get(domain.id)?.values() || []).map(page => (
                            <TreeItem
                                key={`page-${page.id}`}
                                itemId={`page-${page.id}`}
                                label={
                                    <Box
                                        component="div"
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            py: 0.5,
                                            cursor: 'pointer',
                                            '&:hover': {
                                                bgcolor: 'action.hover'
                                            }
                                        }}
                                        onClick={(e) => handlePageClick(page.id, e)}
                                    >
                                        <Article sx={{ mr: 1 }} />
                                        <Typography variant="body2">{page.url}</Typography>
                                    </Box>
                                }
                            >
                                {loading.get(`sourcemaps-${page.id}`) ? (
                                    <TreeItem
                                        itemId={`loading-${page.id}`}
                                        label={
                                            <Box component="div" sx={{ display: 'flex', alignItems: 'center', py: 0.5 }}>
                                                <CircularProgress size={16} sx={{ mr: 1 }} />
                                                <Typography variant="body2">Loading...</Typography>
                                            </Box>
                                        }
                                    />
                                ) : (
                                    <>
                                        {Array.from(sourceMaps.get(page.id)?.values() || []).map(sourceMap => (
                                            <TreeItem
                                                key={`sourcemap-${sourceMap.id}:${page.id}`}
                                                itemId={`sourcemap-${sourceMap.id}:${page.id}`}
                                                label={
                                                    <Box
                                                        component="div"
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            py: 0.5,
                                                            cursor: 'pointer',
                                                            '&:hover': {
                                                                bgcolor: 'action.hover'
                                                            }
                                                        }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSourceMapClick(sourceMap.id);
                                                        }}
                                                    >
                                                        <Code sx={{ mr: 1 }} />
                                                        <Typography variant="body2">{sourceMap.url}</Typography>
                                                    </Box>
                                                }
                                            />
                                        ))}
                                        {renderLoadMoreButton(
                                            `sourcemaps-${page.id}`,
                                            () => loadSourceMaps(page.id, (pageNumbers.get(`sourcemaps-${page.id}`) || 0) * PAGE_SIZE)
                                        )}
                                    </>
                                )}
                            </TreeItem>
                        ))}
                        {renderLoadMoreButton(
                            `pages-${domain.id}`,
                            () => loadPages(domain.id, (pageNumbers.get(`pages-${domain.id}`) || 0) * PAGE_SIZE)
                        )}
                    </TreeItem>
                ))}
            </SimpleTreeView>
            {renderLoadMoreButton(
                'domains',
                () => loadDomains((pageNumbers.get('domains') || 0) * PAGE_SIZE)
            )}
        </Box>
    );
};

export default WebsiteSourceMapTree; 