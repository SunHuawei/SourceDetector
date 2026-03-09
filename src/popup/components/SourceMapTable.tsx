import { getFileIcon } from '@/components/fileIcon';
import { SourceMapFile } from '@/types';
import { formatBytes } from '@/utils/format';
import { GroupedSourceMapFile } from '@/utils/sourceMapUtils';
import {
    CloudDownload as CloudDownloadIcon,
    History as HistoryIcon,
    WarningAmberRounded as WarningAmberRoundedIcon
} from '@mui/icons-material';
import {
    Box,
    CircularProgress,
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography
} from '@mui/material';

interface Props {
    groupedFiles: GroupedSourceMapFile[];
    onDownload: (file: SourceMapFile) => void;
    onOpenLeakReport: (file: SourceMapFile) => void;
    onVersionMenuOpen: (groupUrl: string) => void;
    downloading: { [key: string]: boolean };
}

function getLeakSummary(findings: SourceMapFile['findings']) {
    const normalizedFindings = findings ?? [];
    const findingCount = normalizedFindings.length;
    const leakTypes = Array.from(
        new Set(
            normalizedFindings
                .map((finding) => finding.ruleName.trim())
                .filter((ruleName) => ruleName.length > 0)
        )
    );

    return {
        findingCount,
        leakTypes
    };
}

function getLeakTypeTooltipContent(findings: SourceMapFile['findings']) {
    const { findingCount, leakTypes } = getLeakSummary(findings);
    const maxLeakTypesInTooltip = 3;
    const visibleLeakTypes = leakTypes.slice(0, maxLeakTypesInTooltip);
    const hiddenLeakTypeCount = leakTypes.length - visibleLeakTypes.length;
    const leakTypeSummary = hiddenLeakTypeCount > 0
        ? `${visibleLeakTypes.join(', ')} +${hiddenLeakTypeCount} more`
        : visibleLeakTypes.join(', ');

    return (
        <Box sx={{ py: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {findingCount} finding{findingCount === 1 ? '' : 's'} detected
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 0.25 }}>
                {leakTypes.length === 0
                    ? 'Leak type summary unavailable'
                    : `Types: ${leakTypeSummary}`}
            </Typography>
            <Typography
                variant="caption"
                sx={{
                    display: 'block',
                    mt: 0.75,
                    pt: 0.75,
                    borderTop: 1,
                    borderColor: 'divider',
                    color: 'primary.main'
                }}
            >
                Click to view full report
            </Typography>
        </Box>
    );
}

export function SourceMapTable({ groupedFiles, onDownload, onOpenLeakReport, onVersionMenuOpen, downloading }: Props) {
    return (
        <TableContainer
            component={Paper}
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <Table
                size="small"
                sx={{
                    tableLayout: 'fixed',
                    '& th, & td': {
                        padding: '8px 16px',
                        boxSizing: 'border-box',
                        '&:first-of-type': {
                            width: '60%',
                        },
                        '&:not(:first-of-type)': {
                            width: '20%',
                        }
                    }
                }}
            >
                <TableHead
                    sx={{
                        bgcolor: 'background.paper',
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                    }}
                >
                    <TableRow>
                        <TableCell>Source File</TableCell>
                        <TableCell align="right">Latest Version</TableCell>
                        <TableCell align="right">Previous Versions</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {groupedFiles.map((group) => {
                        const latestVersion = group.versions[0];
                        const filename = group.url.split('/').pop() || group.url;
                        const latestFindings = latestVersion.findings ?? [];
                        const hasFindings = latestFindings.length > 0;

                        return (
                            <TableRow key={group.url}>
                                <TableCell sx={{
                                    overflow: 'hidden',
                                    whiteSpace: 'nowrap',
                                    textOverflow: 'ellipsis'
                                }}>
                                    <Box display="flex" alignItems="center" gap={1} sx={{
                                        minWidth: 0,
                                    }}>
                                        {getFileIcon(filename)}
                                        <Tooltip title={group.url} arrow>
                                            <Typography
                                                variant="body2"
                                                component="div"
                                                sx={{
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    flexGrow: 1,
                                                }}
                                            >
                                                {filename}
                                            </Typography>
                                        </Tooltip>
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
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        onOpenLeakReport(latestVersion);
                                                    }}
                                                    sx={{
                                                        flexShrink: 0,
                                                        p: 0.25
                                                    }}
                                                >
                                                    <WarningAmberRoundedIcon sx={{ color: 'error.main', fontSize: 16 }} />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell align="right">
                                    <Box display="flex" justifyContent="flex-end" gap={1}>
                                        <Tooltip title={`Download latest version (${formatBytes(latestVersion.size)})`} arrow>
                                            <span>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => onDownload(latestVersion)}
                                                    disabled={downloading[latestVersion.id]}
                                                >
                                                    {downloading[latestVersion.id] ? (
                                                        <CircularProgress size={20} />
                                                    ) : (
                                                        <CloudDownloadIcon />
                                                    )}
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    </Box>
                                </TableCell>
                                <TableCell align="right">
                                    <Box display="flex" justifyContent="flex-end" gap={1}>
                                        {group.versions.length > 1 && (
                                            <Tooltip title="View history versions" arrow>
                                                <span>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => onVersionMenuOpen(group.url)}
                                                    >
                                                        <HistoryIcon />
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        )}
                                    </Box>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </TableContainer>
    );
} 