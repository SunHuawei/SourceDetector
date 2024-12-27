import {
    Article,
    Code,
    Language
} from '@mui/icons-material';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import {
    SimpleTreeView,
    TreeItem
} from '@mui/x-tree-view';
import { useEffect, useState } from 'react';

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
  fileName: string;
}

const PAGE_SIZE = 20;

const FolderTree = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [pages, setPages] = useState<Record<string, Page[]>>({});
  const [sourceMaps, setSourceMaps] = useState<Record<string, SourceMap[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [hasMore, setHasMore] = useState<Record<string, boolean>>({});
  const [pageNumbers, setPageNumbers] = useState<Record<string, number>>({});

  const loadDomains = async (offset: number = 0) => {
    setLoading(prev => ({ ...prev, domains: true }));
    try {
      const response = await window.database.getDomains(offset, PAGE_SIZE);
      if (response.success && response.data?.domains) {
        const { domains: newDomains, hasMore } = response.data;
        setDomains(prev => [...prev, ...newDomains]);
        setHasMore(prev => ({ ...prev, domains: hasMore }));
        setPageNumbers(prev => ({ ...prev, domains: (prev.domains || 0) + 1 }));
      } else if (response.error) {
        console.error('Error loading domains:', response.error);
      }
    } catch (error) {
      console.error('Error loading domains:', error);
    } finally {
      setLoading(prev => ({ ...prev, domains: false }));
    }
  };

  const loadPages = async (domainId: number, offset: number = 0) => {
    const loadingKey = `pages-${domainId}`;
    setLoading(prev => ({ ...prev, [loadingKey]: true }));
    try {
      const response = await window.database.getPages(domainId, offset, PAGE_SIZE);
      if (response.success && response.data?.pages && response.data?.hasMore !== undefined) {
        const { pages: newPages, hasMore } = response.data;
        setPages(prev => ({
          ...prev,
          [domainId]: [...(prev[domainId] || []), ...newPages]
        }));
        setHasMore(prev => ({ ...prev, [loadingKey]: hasMore }));
        setPageNumbers(prev => ({ ...prev, [loadingKey]: (prev[loadingKey] || 0) + 1 }));
      } else if (response.error) {
        console.error('Error loading pages:', response.error);
      }
    } catch (error) {
      console.error('Error loading pages:', error);
    } finally {
      setLoading(prev => ({ ...prev, [loadingKey]: false }));
    }
  };

  const loadSourceMaps = async (pageId: number, offset: number = 0) => {
    const loadingKey = `sourcemaps-${pageId}`;
    setLoading(prev => ({ ...prev, [loadingKey]: true }));
    try {
      const response = await window.database.getSourceMaps(pageId, offset, PAGE_SIZE);
      if (response.success && response.data?.sourceMaps && response.data?.hasMore !== undefined) {
        const { sourceMaps: newSourceMaps, hasMore } = response.data;
        setSourceMaps(prev => ({
          ...prev,
          [pageId]: [...(prev[pageId] || []), ...newSourceMaps]
        }));
        setHasMore(prev => ({ ...prev, [loadingKey]: hasMore }));
        setPageNumbers(prev => ({ ...prev, [loadingKey]: (prev[loadingKey] || 0) + 1 }));
      } else if (response.error) {
        console.error('Error loading source maps:', response.error);
      }
    } catch (error) {
      console.error('Error loading source maps:', error);
    } finally {
      setLoading(prev => ({ ...prev, [loadingKey]: false }));
    }
  };

  useEffect(() => {
    loadDomains();
  }, []);

  const renderLoadMoreButton = (key: string, loadMore: () => void) => {
    if (!hasMore[key]) return null;
    
    return (
      <Button
        disabled={loading[key]}
        onClick={loadMore}
        sx={{ mt: 1, ml: 3 }}
        size="small"
        startIcon={loading[key] ? <CircularProgress size={16} /> : null}
      >
        {loading[key] ? 'Loading...' : 'Load More'}
      </Button>
    );
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}>
      <SimpleTreeView
        aria-label="source files"
        sx={{ flexGrow: 1, overflowY: 'auto' }}
      >
        {domains.map(domain => (
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
            {pages[domain.id]?.map(page => (
              <TreeItem
                key={`page-${page.id}`}
                itemId={`page-${page.id}`}
                label={
                  <Box component="div" sx={{ display: 'flex', alignItems: 'center', py: 0.5 }}>
                    <Article sx={{ mr: 1 }} />
                    <Typography variant="body2">{page.url}</Typography>
                  </Box>
                }
              >
                {sourceMaps[page.id]?.map(sourceMap => (
                  <TreeItem
                    key={`sourcemap-${sourceMap.id}`}
                    itemId={`sourcemap-${sourceMap.id}`}
                    label={
                      <Box component="div" sx={{ display: 'flex', alignItems: 'center', py: 0.5 }}>
                        <Code sx={{ mr: 1 }} />
                        <Typography variant="body2">{sourceMap.fileName}</Typography>
                      </Box>
                    }
                  />
                ))}
                {renderLoadMoreButton(
                  `sourcemaps-${page.id}`,
                  () => loadSourceMaps(page.id, (pageNumbers[`sourcemaps-${page.id}`] || 0) * PAGE_SIZE)
                )}
              </TreeItem>
            ))}
            {renderLoadMoreButton(
              `pages-${domain.id}`,
              () => loadPages(domain.id, (pageNumbers[`pages-${domain.id}`] || 0) * PAGE_SIZE)
            )}
          </TreeItem>
        ))}
      </SimpleTreeView>
      {renderLoadMoreButton(
        'domains',
        () => loadDomains((pageNumbers.domains || 0) * PAGE_SIZE)
      )}
    </Box>
  );
};

export default FolderTree; 