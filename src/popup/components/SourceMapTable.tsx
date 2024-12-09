import { getFileIcon } from '@/components/fileIcon';
import { SourceMapFile } from '@/types';
import { formatBytes } from '@/utils/format';
import { GroupedSourceMapFile } from '@/utils/sourceMapUtils';
import { CloudDownload as CloudDownloadIcon, History as HistoryIcon } from '@mui/icons-material';
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
    onVersionMenuOpen: (groupUrl: string) => void;
    downloading: { [key: string]: boolean };
}

export function SourceMapTable({ groupedFiles, onDownload, onVersionMenuOpen, downloading }: Props) {
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
                    {groupedFiles.map((group) => (
                        <TableRow key={group.url}>
                            <TableCell sx={{
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis'
                            }}>
                                <Tooltip title={group.url} arrow>
                                    <Box display="flex" alignItems="center" gap={1} sx={{
                                        minWidth: 0,
                                    }}>
                                        {getFileIcon(group.url.split('/').pop())}
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
                                            {group.url.split('/').pop()}
                                        </Typography>
                                    </Box>
                                </Tooltip>
                            </TableCell>
                            <TableCell align="right">
                                <Box display="flex" justifyContent="flex-end" gap={1}>
                                    <Tooltip title={`Download latest version (${formatBytes(group.versions[0].size)})`} arrow>
                                        <span>
                                            <IconButton
                                                size="small"
                                                onClick={() => onDownload(group.versions[0])}
                                                disabled={downloading[group.versions[0].id]}
                                            >
                                                {downloading[group.versions[0].id] ? (
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
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
} 