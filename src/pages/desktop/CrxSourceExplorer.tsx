import { SourceDetectorDB } from '@/storage/database';
import { CrxFile } from '@/types';
import {
    buildCrxFileTreeFromZip,
    CrxExplorerCodeFile,
    CrxExplorerFileNode,
    getDefaultCrxCodeFilePath,
    listCrxCodeFiles,
    readZipTextFile
} from '@/utils/crxExplorer';
import { parsedCrxFileFromCrxFile } from '@/utils/parseCrxFile';
import {
    Alert,
    Box,
    Card,
    CardContent,
    CircularProgress,
    Divider,
    Grid,
    List,
    ListItemButton,
    ListItemText,
    Paper,
    Typography
} from '@mui/material';
import { TreeItem as MuiTreeItem, SimpleTreeView as MuiTreeView } from '@mui/x-tree-view';
import { useEffect, useMemo, useState } from 'react';

const TreeItem = MuiTreeItem as any;
const TreeView = MuiTreeView as any;

interface Props {
    targetUrl?: string;
}

function renderHighlightedCode(text: string): string {
    const escaped = text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');

    return escaped
        .replace(/\b(const|let|var|function|return|if|else|for|while|import|from|export|class|extends|new|await|async|try|catch|throw)\b/g, '<span style="color:#c792ea">$1</span>')
        .replace(/("[^"]*"|'[^']*')/g, '<span style="color:#ecc48d">$1</span>')
        .replace(/\b([0-9]+)\b/g, '<span style="color:#f78c6c">$1</span>');
}

export default function CrxSourceExplorer({ targetUrl }: Props) {
    const db = useMemo(() => new SourceDetectorDB(), []);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [crxFile, setCrxFile] = useState<CrxFile | null>(null);
    const [fileTree, setFileTree] = useState<CrxExplorerFileNode | null>(null);
    const [codeFiles, setCodeFiles] = useState<CrxExplorerCodeFile[]>([]);
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const [selectedContent, setSelectedContent] = useState<string>('');

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                let record: CrxFile | undefined;
                if (targetUrl) {
                    record = await db.getCrxFileByCrxUrl(targetUrl);
                    if (!record) {
                        record = await db.getCrxFileByPageUrl(targetUrl);
                    }
                }

                if (!record) {
                    const all = await db.crxFiles.orderBy('timestamp').reverse().toArray();
                    record = all[0];
                }

                if (!record) {
                    setError('No extension package found in local database yet. Open a Chrome Web Store page first.');
                    return;
                }

                const parsed = await parsedCrxFileFromCrxFile(record);
                if (!parsed) {
                    setError('Failed to parse extension package.');
                    return;
                }

                const tree = await buildCrxFileTreeFromZip(parsed.zip);
                const extracted = listCrxCodeFiles(tree);
                const defaultPath = getDefaultCrxCodeFilePath(extracted);

                if (cancelled) return;

                setCrxFile(record);
                setFileTree(tree);
                setCodeFiles(extracted);
                setSelectedPath(defaultPath);

                if (defaultPath) {
                    const content = await readZipTextFile(parsed.zip, defaultPath);
                    if (!cancelled) {
                        setSelectedContent(content);
                    }
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(loadError instanceof Error ? loadError.message : 'Failed to load extension source files.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [db, targetUrl]);

    const handleSelectFile = async (path: string) => {
        if (!crxFile) return;
        try {
            const parsed = await parsedCrxFileFromCrxFile(crxFile);
            if (!parsed) {
                return;
            }
            const content = await readZipTextFile(parsed.zip, path);
            setSelectedPath(path);
            setSelectedContent(content);
        } catch {
            setSelectedPath(path);
            setSelectedContent('Unable to read this file as text.');
        }
    };

    const renderTree = (node: CrxExplorerFileNode, parentKey: string): any => {
        const nodeId = node.path || `${parentKey}/${node.name}`;
        const isDirectory = node.isDirectory;
        const isCodeFile = !isDirectory && codeFiles.some((file) => file.path === node.path);

        return (
            <TreeItem
                key={nodeId}
                itemId={nodeId}
                label={node.name}
                onClick={() => {
                    if (!isDirectory && isCodeFile) {
                        void handleSelectFile(node.path);
                    }
                }}
            >
                {Object.values(node.children)
                    .sort((left, right) => {
                        if (left.isDirectory !== right.isDirectory) {
                            return left.isDirectory ? -1 : 1;
                        }
                        return left.name.localeCompare(right.name);
                    })
                    .map((child) => renderTree(child, nodeId))}
            </TreeItem>
        );
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return <Alert severity="info">{error}</Alert>;
    }

    if (!fileTree) {
        return <Alert severity="info">No extension files available.</Alert>;
    }

    return (
        <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
                <Card variant="outlined" sx={{ height: 'calc(100vh - 152px)' }}>
                    <CardContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ px: 2, py: 1.5 }}>
                            <Typography variant="h6">Extension Source Tree</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                                {crxFile?.pageTitle || crxFile?.crxUrl}
                            </Typography>
                        </Box>
                        <Divider />
                        <Box sx={{ overflow: 'auto', flexGrow: 1, px: 1, py: 1 }}>
                            <TreeView sx={{ flexGrow: 1 }}>
                                {Object.values(fileTree.children).map((child) => renderTree(child, 'root'))}
                            </TreeView>
                        </Box>
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12} md={3}>
                <Card variant="outlined" sx={{ height: 'calc(100vh - 152px)' }}>
                    <CardContent sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ px: 2, py: 1.5 }}>
                            <Typography variant="h6">Source-like Files</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {codeFiles.length} files
                            </Typography>
                        </Box>
                        <Divider />
                        <List disablePadding sx={{ overflowY: 'auto', flexGrow: 1 }}>
                            {codeFiles.map((file) => (
                                <ListItemButton
                                    key={file.path}
                                    selected={file.path === selectedPath}
                                    onClick={() => {
                                        void handleSelectFile(file.path);
                                    }}
                                >
                                    <ListItemText
                                        primary={file.path.split('/').pop() || file.path}
                                        secondary={`${file.language} · ${file.path}`}
                                    />
                                </ListItemButton>
                            ))}
                        </List>
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12} md={6}>
                <Paper variant="outlined" sx={{ height: 'calc(100vh - 152px)', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
                        <Typography variant="subtitle1">Code Viewer (Source Browser)</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                            {selectedPath ?? 'No file selected'}
                        </Typography>
                    </Box>
                    <Box sx={{ overflow: 'auto', p: 2, flexGrow: 1, bgcolor: '#0f172a' }}>
                        <pre
                            style={{ margin: 0, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5, color: '#e2e8f0' }}
                            dangerouslySetInnerHTML={{
                                __html: renderHighlightedCode(selectedContent)
                            }}
                        />
                    </Box>
                </Paper>
            </Grid>
        </Grid>
    );
}
