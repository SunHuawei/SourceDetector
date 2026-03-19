import { MESSAGE_TYPES } from '@/background/constants';
import { formatBytes } from '@/background/utils';
import { Toast } from '@/components/Toast';
import { SourceDetectorDB } from '@/storage/database';
import {
  CrxFile,
  PageData,
  ParsedCrxFile,
  SourceMapFile,
  SourceMapFileSummary,
  StorageStats,
} from '@/types';
import { isExtensionPage } from '@/utils/isExtensionPage';
import { parsedCrxFileFromCrxFile } from '@/utils/parseCrxFile';
import { SourceMapDownloader } from '@/utils/sourceMapDownloader';
import { GITHUB_FEEDBACK_URL } from '@/constants/links';
import { groupSourceMapFiles } from '@/utils/sourceMapUtils';
import {
  CloudDownload as CloudDownloadIcon,
  GitHub as GitHubIcon,
  OpenInNew as OpenInNewIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import JSZip from 'jszip';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CrxFileTree } from './components/CrxFileTree';
import { SourceMapTable } from './components/SourceMapTable';
import { browserAPI } from '@/utils/browser-polyfill';
import { trackEvent, trackEventOnce, trackProductEvent } from '@/utils/analytics';
import { openSourceExplorer } from '@/utils/sourceExplorerNavigation';

function normalizePageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url.split('#')[0] || url;
  }
}

function isBlobLike(value: unknown): value is Blob {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === 'function' &&
    typeof (value as Blob).size === 'number'
  );
}

function hasCrxPayload(crxFile: CrxFile | null | undefined): crxFile is CrxFile {
  return Boolean(crxFile && isBlobLike(crxFile.blob) && crxFile.blob.size > 0);
}

function isSameCrxPayload(left: CrxFile, right: CrxFile): boolean {
  const leftBlobSize = isBlobLike(left.blob) ? left.blob.size : 0;
  const rightBlobSize = isBlobLike(right.blob) ? right.blob.size : 0;
  return (
    left.id === right.id &&
    left.contentHash === right.contentHash &&
    left.count === right.count &&
    left.size === right.size &&
    leftBlobSize === rightBlobSize
  );
}

// Helper function to format bundle size
function getBundleSize(files: Array<Pick<SourceMapFileSummary, 'size'>>): string {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  return formatBytes(totalSize);
}

function getErrorType(error: unknown): string {
  if (error instanceof Error && error.name.trim().length > 0) {
    return error.name;
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }
  return 'unknown_error';
}

const SOURCE_MAP_POPUP_DISPLAY_LIMIT = 50;
const CRX_POPUP_PARSE_WARNING_THRESHOLD = 1000;
const CRX_POPUP_REFRESH_INTERVAL_MS = 1200;

interface MessageResponse<T> {
  success: boolean;
  data?: T;
  reason?: string;
}

export default function App() {
  const db = useMemo(() => new SourceDetectorDB(), []);
  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [crxFile, setCrxFile] = useState<CrxFile | null>(null);
  const [parsed, setParsed] = useState<ParsedCrxFile | null>(null);
  const [parsingCrx, setParsingCrx] = useState(false);
  const [crxTreeLoadFailed, setCrxTreeLoadFailed] = useState(false);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [downloading, setDownloading] = useState<{ [key: string]: boolean }>({});
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  const requestCrxFile = useCallback(async (url: string): Promise<MessageResponse<CrxFile>> => {
    const normalizedUrl = normalizePageUrl(url);

    try {
      const directRecord = await db.getCrxFileByPageUrl(normalizedUrl);
      if (directRecord && hasCrxPayload(directRecord)) {
        return { success: true, data: directRecord };
      }

      const response = (await browserAPI.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_CRX_FILE,
        data: { url: normalizedUrl },
      })) as MessageResponse<CrxFile>;

      if (response.success && response.data && hasCrxPayload(response.data)) {
        return response;
      }

      const hydratedRecord = await db.getCrxFileByPageUrl(normalizedUrl);
      if (hydratedRecord && hasCrxPayload(hydratedRecord)) {
        return { success: true, data: hydratedRecord };
      }

      return response;
    } catch (error) {
      console.error('Error requesting CRX file for popup:', error);
      return { success: false, reason: String(error) };
    }
  }, [db]);

  useEffect(() => {
    loadData();
    void trackEvent('popup_viewed');
    void trackEventOnce('onboarding_started', 'popup_first_open', {
      surface: 'popup',
      entry_point: 'popup_icon',
    });
  }, []);

  const loadData = async () => {
    try {
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) {
        void trackProductEvent('scan_failed', {
          surface: 'popup',
          scan_stage: 'resolve_active_tab',
          error_type: 'active_tab_url_missing',
        });
        return;
      }
      const normalizedUrl = normalizePageUrl(tab.url);
      if (isExtensionPage(tab.url)) {
        const response = await requestCrxFile(normalizedUrl);

        const responseReason = typeof response?.reason === 'string' ? response.reason : undefined;
        if (response.success && response.data) {
          setCrxFile(response.data);
          void trackProductEvent('result_viewed', {
            surface: 'popup',
            result_tab: 'crx_files',
            result_count: response.data.count,
            has_results: response.data.count > 0,
          });

          if (response.data.count > 0) {
            void trackEventOnce('onboarding_completed', 'popup_first_result_viewed', {
              surface: 'popup',
              completion_step: 'result_viewed',
              result_tab: 'crx_files',
            });
          }
        } else {
          void trackProductEvent('scan_failed', {
            surface: 'popup',
            scan_stage: 'fetch_crx_file',
            error_type: 'crx_lookup_failed',
            error_reason: responseReason,
          });
        }
      } else {
        const response = (await browserAPI.runtime.sendMessage({
          type: MESSAGE_TYPES.GET_PAGE_DATA,
          data: { url: normalizedUrl },
        })) as MessageResponse<PageData>;

        const responseReason = typeof response?.reason === 'string' ? response.reason : undefined;
        if (response.success && response.data) {
          setPageData(response.data);
          const files: SourceMapFileSummary[] = Array.isArray(response.data.files)
            ? response.data.files
            : [];
          const findingsCount = files.reduce(
            (total, file) => total + (file.findings?.length ?? 0),
            0
          );

          void trackProductEvent('result_viewed', {
            surface: 'popup',
            result_tab: 'source_maps',
            result_count: files.length,
            findings_count: findingsCount,
            has_findings: findingsCount > 0,
          });

          if (files.length > 0) {
            void trackEventOnce('onboarding_completed', 'popup_first_result_viewed', {
              surface: 'popup',
              completion_step: 'result_viewed',
              result_tab: 'source_maps',
            });
          }
        } else {
          void trackProductEvent('scan_failed', {
            surface: 'popup',
            scan_stage: 'fetch_page_data',
            error_type: 'page_data_lookup_failed',
            error_reason: responseReason,
          });
        }
      }
      const statsResponse = await browserAPI.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_STORAGE_STATS,
      });
      const typedStatsResponse = statsResponse as MessageResponse<StorageStats>;
      if (typedStatsResponse.success && typedStatsResponse.data) {
        setStats(typedStatsResponse.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      void trackProductEvent('scan_failed', {
        surface: 'popup',
        scan_stage: 'load_data',
        error_type: getErrorType(error),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!crxFile) {
      setParsed(null);
      setCrxTreeLoadFailed(false);
      return;
    }

    setParsed(null);
    setCrxTreeLoadFailed(false);
  }, [crxFile]);

  useEffect(() => {
    if (!crxFile || hasCrxPayload(crxFile) || parsingCrx || parsed) {
      return;
    }

    let cancelled = false;

    const refreshCrxFile = async () => {
      try {
        const directRecord = await db.getCrxFileByPageUrl(normalizePageUrl(crxFile.pageUrl));
        if (cancelled) {
          return;
        }

        if (directRecord && hasCrxPayload(directRecord)) {
          setCrxFile(previousCrxFile => {
            if (!previousCrxFile) {
              return directRecord;
            }
            return isSameCrxPayload(previousCrxFile, directRecord)
              ? previousCrxFile
              : directRecord;
          });
          return;
        }

        const response = await requestCrxFile(normalizePageUrl(crxFile.pageUrl));
        if (!response.success || !response.data || cancelled) {
          return;
        }

        setCrxFile(previousCrxFile => {
          if (!previousCrxFile) {
            return response.data;
          }
          return isSameCrxPayload(previousCrxFile, response.data)
            ? previousCrxFile
            : response.data;
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Error refreshing CRX payload for popup:', error);
        }
      }
    };

    void refreshCrxFile();
    const interval = window.setInterval(() => {
      void refreshCrxFile();
    }, CRX_POPUP_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [crxFile, db, parsed, parsingCrx, requestCrxFile]);

  const getFullSourceMapFile = async (file: SourceMapFileSummary): Promise<SourceMapFile> => {
    const response = (await browserAPI.runtime.sendMessage({
      type: MESSAGE_TYPES.GET_FILE_DATA,
      data: { id: file.id, url: file.url },
    })) as MessageResponse<SourceMapFile>;

    if (!response.success || !response.data) {
      throw new Error(response.reason || 'Failed to load source map details');
    }

    return response.data;
  };

  const handleDownload = async (file: SourceMapFileSummary) => {
    try {
      setDownloading(prev => ({ ...prev, [file.id]: true }));
      const fullFile = await getFullSourceMapFile(file);
      await SourceMapDownloader.downloadSingle(fullFile, {
        onError: error => {
          showToast(error.message, 'error');
        },
      });
      void trackEvent('popup_download_single', {
        source_map_file_id: file.id,
        file_url: file.url,
      });
      showToast('Download completed successfully', 'success');
    } catch (error) {
      showToast('Failed to download file', 'error');
    } finally {
      setDownloading(prev => ({ ...prev, [file.id]: false }));
    }
  };

  const handleOpenVersionHistory = (groupUrl: string) => {
    void openSourceExplorer({
      tab: 'source-maps',
      pageUrl: pageData?.url,
      sourceUrl: groupUrl,
    });
  };

  const handleOpenLeakReport = (file: SourceMapFileSummary) => {
    const firstFindingType = file.findings?.[0]?.ruleName?.trim();
    void trackEvent('popup_open_leak_report', {
      source_map_file_id: file.id,
      file_url: file.url,
      findings_count: file.findings?.length ?? 0,
    });
    void trackProductEvent('finding_detail_opened', {
      surface: 'popup',
      placement: 'source_map_table',
      source_map_file_id: file.id,
      finding_type:
        firstFindingType && firstFindingType.length > 0 ? firstFindingType : 'unknown_rule',
      findings_count: file.findings?.length ?? 0,
    });
    void openSourceExplorer({
      tab: 'source-maps',
      pageUrl: pageData?.url ?? file.url,
      sourceUrl: file.url,
      sourceMapFileId: file.id,
      view: 'leak-findings',
    });
  };

  const handleDownloadAll = async () => {
    if (crxFile && parsed) {
      try {
        setDownloadingAll(true);
        const newZip = new JSZip();

        newZip.file('extension.crx', parsed.blob);

        const parsedFolder = newZip.folder('parsed');
        if (!parsedFolder) {
          throw new Error('Failed to create parsed folder');
        }

        const zip = parsed.zip;
        await Promise.all(
          Object.keys(zip.files).map(async path => {
            const zipObject = zip.files[path];
            if (!zipObject.dir) {
              const content = await zipObject.async('uint8array');
              parsedFolder.file(path, content);
            }
          })
        );

        const blob = await newZip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeTitle =
          crxFile.pageTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'extension-files';
        a.download = `${safeTitle}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        void trackEvent('popup_download_all_crx');
        showToast('All files downloaded successfully', 'success');
      } catch (error) {
        console.error('Error downloading files:', error);
        showToast('Failed to download files', 'error');
      } finally {
        setDownloadingAll(false);
      }
    } else if (pageData?.files.length) {
      try {
        setDownloadingAll(true);
        const latestVersionSummaries = groupedFiles.map(group => group.versions[0]);
        const latestVersions = await Promise.all(
          latestVersionSummaries.map(file => getFullSourceMapFile(file))
        );
        await SourceMapDownloader.downloadAllLatest(latestVersions, pageData.url, {
          onError: error => {
            showToast(error.message, 'error');
          },
        });
        void trackEvent('popup_download_all_latest', {
          files_count: latestVersions.length,
          page_url: pageData.url,
        });
        showToast('All files downloaded successfully', 'success');
      } catch (error) {
        console.error('Error downloading files:', error);
        showToast('Failed to download files', 'error');
      } finally {
        setDownloadingAll(false);
      }
    }
  };

  const handleLoadCrxTree = useCallback(
    async (targetCrxFile?: CrxFile | null) => {
      const activeCrxFile = targetCrxFile ?? crxFile;

      if (!activeCrxFile || parsingCrx || parsed || !hasCrxPayload(activeCrxFile)) {
        return;
      }

      try {
        setParsingCrx(true);
        setCrxTreeLoadFailed(false);
        const result = await parsedCrxFileFromCrxFile(activeCrxFile);
        if (!result) {
          throw new Error('CRX popup parse returned empty result');
        }
        setParsed(result);
        void trackEvent('popup_load_crx_tree', {
          crx_file_id: activeCrxFile.id,
          file_count: result.count,
        });
      } catch (parseError) {
        console.error('Error parsing CRX file in popup:', parseError);
        setCrxTreeLoadFailed(true);
        void trackProductEvent('scan_failed', {
          surface: 'popup',
          scan_stage: 'parse_crx_file',
          error_type: getErrorType(parseError),
        });
        showToast('Failed to load extension files', 'error');
      } finally {
        setParsingCrx(false);
      }
    },
    [crxFile, parsed, parsingCrx]
  );

  useEffect(() => {
    if (!crxFile || !hasCrxPayload(crxFile) || parsed || parsingCrx) {
      return;
    }

    const timer = window.setTimeout(() => {
      void handleLoadCrxTree(crxFile);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [crxFile, handleLoadCrxTree, parsed, parsingCrx]);

  const showToast = (
    message: string,
    severity: 'success' | 'error' | 'info' | 'warning' = 'info'
  ) => {
    setToast({
      open: true,
      message,
      severity,
    });
  };

  const handleCloseToast = () => {
    setToast(prev => ({ ...prev, open: false }));
  };

  const handleCrxFileDownload = async (path: string) => {
    if (!parsed) return;
    try {
      setDownloading(prev => ({ ...prev, [path]: true }));
      const file = parsed.zip.files[path];
      if (!file) {
        throw new Error('File not found');
      }
      const content = await file.async('blob');
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = path.split('/').pop() || path;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('File downloaded successfully', 'success');
    } catch (error) {
      console.error('Error downloading file:', error);
      showToast('Failed to download file', 'error');
    } finally {
      setDownloading(prev => ({ ...prev, [path]: false }));
    }
  };

  const groupedFiles = useMemo(() => {
    if (!pageData?.files) return [];
    return groupSourceMapFiles(pageData.files).sort((a, b) => {
      const aFilename = a.url.split('/').pop() || '';
      const bFilename = b.url.split('/').pop() || '';
      return aFilename.localeCompare(bFilename);
    });
  }, [pageData?.files]);

  const visibleGroupedFiles = useMemo(
    () => groupedFiles.slice(0, SOURCE_MAP_POPUP_DISPLAY_LIMIT),
    [groupedFiles]
  );

  const hiddenSourceMapCount = groupedFiles.length - visibleGroupedFiles.length;
  const shouldWarnAboutLargeCrx = (crxFile?.count ?? 0) >= CRX_POPUP_PARSE_WARNING_THRESHOLD;

  const handleOpenSourceExplorer = () => {
    const entryContext = crxFile ? 'crx-packages' : pageData ? 'source-maps' : 'overview';
    const targetTab = crxFile ? 'crx-packages' : pageData ? 'source-maps' : 'overview';
    void trackEvent('popup_open_source_explorer', {
      resource_type: entryContext,
      page_url: crxFile ? crxFile.pageUrl : pageData?.url,
    });
    void openSourceExplorer({
      tab: targetTab,
      pageUrl: crxFile ? crxFile.pageUrl : pageData?.url,
    });
  };

  const handleOpenCrxSourceExplorer = () => {
    if (!crxFile) {
      handleOpenSourceExplorer();
      return;
    }

    void trackEvent('popup_open_source_explorer', {
      resource_type: 'crx-packages',
      page_url: crxFile.pageUrl,
    });
    void openSourceExplorer({
      tab: 'crx-packages',
      pageUrl: crxFile.pageUrl,
    });
  };

  const handleOpenSourceMapSourceExplorer = () => {
    void trackEvent('popup_open_source_explorer', {
      resource_type: 'source-maps',
      page_url: pageData?.url,
    });
    void openSourceExplorer({
      tab: 'source-maps',
      pageUrl: pageData?.url,
    });
  };

  const handleOpenGithubFeedback = async () => {
    void trackEvent('popup_open_github_feedback');
    void trackProductEvent('feedback_submitted', {
      surface: 'popup',
      placement: 'header_feedback_icon',
      feedback_channel: 'github_issues',
      submission_state: 'intent',
    });
    void trackProductEvent('share_clicked', {
      surface: 'popup',
      placement: 'header_feedback_icon',
      share_target: 'github_issues',
      share_channel: 'github',
    });
    await browserAPI.tabs.create({ url: GITHUB_FEEDBACK_URL });
  };

  const handleOpenSettings = async () => {
    void trackEvent('popup_open_settings');
    await browserAPI.runtime.openOptionsPage();
  };

  if (loading) {
    return (
      <Box p={2} width={720}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={600}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: 720,
        height: '600px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Fixed Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        <Box display="flex" justifyContent="space-between" alignItems="center" gap={2}>
          <Typography variant="h6" sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            {crxFile ? 'Extension Files' : 'Source Maps'} (v1.4.1)
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              flexWrap: 'nowrap',
              minWidth: 0,
            }}
          >
            {((groupedFiles.length > 0 &&
              groupedFiles.map(g => g.versions[0]).reduce((sum, file) => sum + file.size, 0) > 0) ||
              (crxFile && parsed && (parsed?.size || 0 + crxFile.size) > 0)) && (
              <Tooltip
                title={
                  crxFile
                    ? `Download all files (${formatBytes(parsed?.size || 0 + crxFile.size)})`
                    : `Download latest versions of all source maps (${getBundleSize(groupedFiles.map(g => g.versions[0]))})`
                }
              >
                <span>
                  <Button
                    startIcon={
                      downloadingAll ? <CircularProgress size={16} /> : <CloudDownloadIcon />
                    }
                    onClick={handleDownloadAll}
                    disabled={downloadingAll}
                    size="small"
                    variant="outlined"
                    sx={{ mr: 1, flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    {downloadingAll
                      ? 'Downloading...'
                      : crxFile
                        ? `Download All (${formatBytes(parsed?.size || 0 + crxFile.size)})`
                        : `Download Latest (${getBundleSize(groupedFiles.map(g => g.versions[0]))})`}
                  </Button>
                </span>
              </Tooltip>
            )}
            <Tooltip title="Open in Source Explorer">
              <IconButton
                size="small"
                sx={{ mr: 1, flexShrink: 0 }}
                onClick={handleOpenSourceExplorer}
              >
                <OpenInNewIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Feedback on GitHub">
              <IconButton
                size="small"
                sx={{ mr: 1, flexShrink: 0 }}
                onClick={handleOpenGithubFeedback}
              >
                <GitHubIcon />
              </IconButton>
            </Tooltip>
            <IconButton onClick={handleOpenSettings} sx={{ flexShrink: 0 }}>
              <SettingsIcon />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* Scrollable Content */}
      <Box sx={{ flexGrow: 1, minHeight: 0, overflow: 'hidden', px: 2 }}>
        {crxFile ? (
          parsed ? (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1, py: 2 }}>
              {shouldWarnAboutLargeCrx && (
                <Alert
                  severity="warning"
                  action={
                    <Button color="inherit" size="small" onClick={handleOpenCrxSourceExplorer}>
                      Open full package
                    </Button>
                  }
                >
                  Showing the inline tree for quick inspection. Use Source Explorer for deeper
                  browsing on large extensions.
                </Alert>
              )}
              <Box sx={{ minHeight: 0, flexGrow: 1 }}>
                <CrxFileTree parsed={parsed} onDownload={handleCrxFileDownload} />
              </Box>
            </Box>
          ) : (
            <Box display="flex" flexDirection="column" gap={2} py={2}>
              <Alert
                severity={
                  crxTreeLoadFailed ? 'error' : shouldWarnAboutLargeCrx ? 'warning' : 'info'
                }
                action={
                  <Button color="inherit" size="small" onClick={handleOpenCrxSourceExplorer}>
                    Open Source Explorer
                  </Button>
                }
              >
                {crxTreeLoadFailed
                  ? 'Failed to build the inline CRX tree.'
                  : shouldWarnAboutLargeCrx
                    ? `Large extension detected (${crxFile.count} files).`
                    : 'Preparing extension files...'}
              </Alert>
              <Box
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                <Typography variant="subtitle1">
                  {crxFile.pageTitle || 'Stored extension package'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {crxFile.count} files indexed, {formatBytes(crxFile.size)} stored locally.
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    pt: 0.5,
                  }}
                >
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">
                    {parsingCrx ? 'Loading file tree...' : 'Preparing extension files...'}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )
        ) : groupedFiles.length > 0 ? (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 1, py: 2 }}>
            {hiddenSourceMapCount > 0 && (
              <Alert
                severity="info"
                action={
                  <Button color="inherit" size="small" onClick={handleOpenSourceMapSourceExplorer}>
                    Open full list
                  </Button>
                }
              >
                Showing the first {SOURCE_MAP_POPUP_DISPLAY_LIMIT} of {groupedFiles.length} source
                maps to keep the popup fast.
              </Alert>
            )}
            <Box sx={{ minHeight: 0, flexGrow: 1 }}>
              <SourceMapTable
                groupedFiles={visibleGroupedFiles}
                pageUrl={pageData?.url ?? ''}
                pageTitle={pageData?.title}
                onDownload={handleDownload}
                onOpenLeakReport={handleOpenLeakReport}
                onOpenVersionHistory={handleOpenVersionHistory}
                downloading={downloading}
              />
            </Box>
          </Box>
        ) : (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
            <Typography variant="body1" color="text.secondary">
              No {crxFile ? 'files' : 'source maps'} found on this page
            </Typography>
          </Box>
        )}
      </Box>

      {/* Fixed Footer */}
      {stats && (
        <Box
          sx={{
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            position: 'sticky',
            bottom: 0,
          }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {`Storage Used: ${formatBytes(stats.usedSpace)}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {stats.fileCount} Source Maps Found on {stats.uniqueSiteCount}{' '}
              {stats.uniqueSiteCount === 1 ? 'Site' : 'Sites'}
            </Typography>
          </Box>
        </Box>
      )}

      <Toast
        open={toast.open}
        message={toast.message}
        severity={toast.severity}
        onClose={handleCloseToast}
      />
    </Box>
  );
}
