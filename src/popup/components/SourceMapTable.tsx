import { getFileIcon } from '@/components/fileIcon';
import { SourceMapFileSummary } from '@/types';
import { formatBytes } from '@/utils/format';
import {
  GroupedSourceMapFile,
  SourceMapTreeDirectoryNode,
  buildSourceMapDirectoryTree,
} from '@/utils/sourceMapUtils';
import {
  ChevronRight as ChevronRightIcon,
  CloudDownload as CloudDownloadIcon,
  ExpandMore as ExpandMoreIcon,
  Folder as FolderIcon,
  History as HistoryIcon,
  WarningAmberRounded as WarningAmberRoundedIcon,
} from '@mui/icons-material';
import {
  Box,
  CircularProgress,
  Collapse,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';

interface Props {
  groupedFiles: GroupedSourceMapFile[];
  pageUrl: string;
  pageTitle?: string;
  onDownload: (file: SourceMapFileSummary) => void;
  onOpenLeakReport: (file: SourceMapFileSummary) => void;
  onOpenVersionHistory: (groupUrl: string) => void;
  downloading: { [key: string]: boolean };
}

function getLeakSummary(findings: SourceMapFileSummary['findings']) {
  const normalizedFindings = findings ?? [];
  const findingCount = normalizedFindings.length;
  const leakTypes = Array.from(
    new Set(
      normalizedFindings
        .map(finding => finding.ruleName.trim())
        .filter(ruleName => ruleName.length > 0)
    )
  );

  return {
    findingCount,
    leakTypes,
  };
}

function getLeakTypeTooltipContent(findings: SourceMapFileSummary['findings']) {
  const { findingCount, leakTypes } = getLeakSummary(findings);
  const maxLeakTypesInTooltip = 3;
  const visibleLeakTypes = leakTypes.slice(0, maxLeakTypesInTooltip);
  const hiddenLeakTypeCount = leakTypes.length - visibleLeakTypes.length;
  const leakTypeSummary =
    hiddenLeakTypeCount > 0
      ? `${visibleLeakTypes.join(', ')} +${hiddenLeakTypeCount} more`
      : visibleLeakTypes.join(', ');

  return (
    <Box sx={{ py: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {findingCount} finding{findingCount === 1 ? '' : 's'} detected
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.25 }}>
        {leakTypes.length === 0 ? 'Leak type summary unavailable' : `Types: ${leakTypeSummary}`}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          mt: 0.75,
          pt: 0.75,
          borderTop: 1,
          borderColor: 'divider',
          color: 'primary.main',
        }}
      >
        Click to view full report
      </Typography>
    </Box>
  );
}

function countDirectoryFiles(nodes: SourceMapTreeDirectoryNode[]): number {
  return nodes.reduce(
    (total, node) => total + node.files.length + countDirectoryFiles(node.directories),
    0
  );
}

export function SourceMapTable({
  groupedFiles,
  pageUrl,
  pageTitle,
  onDownload,
  onOpenLeakReport,
  onOpenVersionHistory,
  downloading,
}: Props) {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const directoryTree = useMemo(
    () => buildSourceMapDirectoryTree(groupedFiles, { idPrefix: 'popup:' }),
    [groupedFiles]
  );

  useEffect(() => {
    const defaultExpanded: Record<string, boolean> = {};
    const walk = (nodes: SourceMapTreeDirectoryNode[]) => {
      for (const node of nodes) {
        defaultExpanded[node.id] = true;
        walk(node.directories);
      }
    };
    walk(directoryTree);
    setExpandedNodes(previousState => ({ ...defaultExpanded, ...previousState }));
  }, [directoryTree]);

  const isExpanded = (nodeId: string, fallbackExpanded = false): boolean =>
    expandedNodes[nodeId] ?? fallbackExpanded;

  const toggleNode = (nodeId: string, fallbackExpanded = false) => {
    setExpandedNodes(previousState => ({
      ...previousState,
      [nodeId]: !(previousState[nodeId] ?? fallbackExpanded),
    }));
  };

  const renderDirectoryNodes = (
    directories: SourceMapTreeDirectoryNode[],
    depth: number
  ): JSX.Element[] =>
    directories.flatMap(directory => {
      const directoryExpanded = isExpanded(directory.id, false);
      const fileCount = countDirectoryFiles([directory]);

      const directoryRow = (
        <ListItemButton
          key={directory.id}
          onClick={() => toggleNode(directory.id, true)}
          sx={{ pl: 1 + depth * 1.5, py: 0.45 }}
        >
          <Box sx={{ mr: 0.75, display: 'flex', alignItems: 'center' }}>
            {directoryExpanded ? (
              <ExpandMoreIcon fontSize="small" />
            ) : (
              <ChevronRightIcon fontSize="small" />
            )}
          </Box>
          <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
            <FolderIcon fontSize="small" />
          </Box>
          <ListItemText primary={directory.name} secondary={`${fileCount} files`} />
        </ListItemButton>
      );

      const fileRows = directory.files.map(fileNode => {
        const latestVersion = fileNode.group.versions[0];
        const latestFindings = latestVersion.findings ?? [];
        const hasFindings = latestFindings.length > 0;

        return (
          <Box
            key={fileNode.id}
            sx={{
              pl: 1 + (depth + 1) * 1.5,
              py: 0.35,
              pr: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
            }}
          >
            <Box sx={{ width: 20, mr: 0.5 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', mr: 0.75 }}>
              {getFileIcon(fileNode.name)}
            </Box>
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography
                variant="body2"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {fileNode.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatBytes(latestVersion.size)} · {fileNode.group.versions.length} versions
              </Typography>
            </Box>

            {hasFindings && (
              <Tooltip
                title={getLeakTypeTooltipContent(latestFindings)}
                arrow
                placement="top-start"
                describeChild
                enterDelay={120}
              >
                <IconButton
                  size="small"
                  aria-label="Open leak findings report"
                  onClick={event => {
                    event.stopPropagation();
                    onOpenLeakReport(latestVersion);
                  }}
                  sx={{ p: 0.25 }}
                >
                  <WarningAmberRoundedIcon sx={{ color: 'error.main', fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title={`Download latest version (${formatBytes(latestVersion.size)})`} arrow>
              <span>
                <IconButton
                  size="small"
                  onClick={() => onDownload(latestVersion)}
                  disabled={downloading[latestVersion.id]}
                >
                  {downloading[latestVersion.id] ? (
                    <CircularProgress size={18} />
                  ) : (
                    <CloudDownloadIcon fontSize="small" />
                  )}
                </IconButton>
              </span>
            </Tooltip>

            {fileNode.group.versions.length > 1 && (
              <Tooltip title="Open version history in Source Explorer" arrow>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => onOpenVersionHistory(fileNode.group.url)}
                    sx={{ ml: 0.25 }}
                  >
                    <HistoryIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Box>
        );
      });

      const childDirectories = renderDirectoryNodes(directory.directories, depth + 1);

      return [
        directoryRow,
        <Collapse key={`${directory.id}:children`} in={directoryExpanded} timeout={160} unmountOnExit={false}>
          <Box sx={{ minHeight: 0 }}>
            {fileRows}
            {childDirectories}
          </Box>
        </Collapse>,
      ];
    });

  return (
    <Paper
      variant="outlined"
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2">Source Map Tree</Typography>
        <Typography variant="caption" color="text.secondary">
          Directory - File
        </Typography>
      </Box>

      <List disablePadding sx={{ overflowY: 'auto', overflowX: 'hidden', flexGrow: 1, minHeight: 0, px: 1, py: 1 }}>
        {directoryTree.length === 0 ? (
          <ListItemText
            primary="No source maps captured for this page."
            sx={{ px: 2, py: 1.25 }}
          />
        ) : (
          renderDirectoryNodes(directoryTree, 0)
        )}
      </List>
    </Paper>
  );
}
