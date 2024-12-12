import React, { useEffect, useState } from 'react';
import {
    Box,
    IconButton,
    Typography,
    AppBar,
    Toolbar,
    Drawer,
    Tab,
    Tabs,
    CircularProgress,
    Button,
} from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import {
    ExpandMore as ExpandMoreIcon,
    ChevronRight as ChevronRightIcon,
    Folder as FolderIcon,
    FolderOpen as FolderOpenIcon,
    Description as FileIcon,
    Code as CodeIcon,
    Download as DownloadIcon,
} from '@mui/icons-material';
import { SourceMapFile } from '@/types';
import { MESSAGE_TYPES } from '@/background/constants';
import { SourceMapConsumer } from 'source-map-js';
import { SourceMapDownloader } from '@/utils/sourceMapDownloader';
import MonacoEditor from '@/components/MonacoEditor';

interface FileTreeNode {
    id: string;
    name: string;
    type: 'folder' | 'source';
    path: string;
    content?: string;
    sourceMapFile?: SourceMapFile;
    children?: FileTreeNode[];
}

export default function App() {
    const [loading, setLoading] = useState(true);
    const [fileTree, setFileTree] = useState<FileTreeNode | null>(null);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<FileTreeNode | null>(null);
    const [expanded, setExpanded] = useState<string[]>([]);

    useEffect(() => {
        loadDomainData();
    }, []);

    const loadDomainData = async () => {
        try {
            const params = new URLSearchParams(window.location.search);
            const domain = params.get('domain');
            if (!domain) return;

            const response = await chrome.runtime.sendMessage({
                type: MESSAGE_TYPES.GET_ALL_SOURCE_MAPS
            });

            if (response.success) {
                const domainFiles = response.data.filter((file: SourceMapFile) => {
                    try {
                        return new URL(file.pageUrl).hostname === domain;
                    } catch {
                        return false;
                    }
                });

                if (domainFiles.length > 0) {
                    const tree = await buildDomainTree(domainFiles, domain);
                    setFileTree(tree);
                    setExpanded(['root']);
                }
            }
        } catch (error) {
            console.error('Error loading domain data:', error);
        } finally {
            setLoading(false);
        }
    };

    const buildDomainTree = async (files: SourceMapFile[], domain: string): Promise<FileTreeNode> => {
        const root: FileTreeNode = {
            id: 'root',
            name: domain,
            type: 'folder',
            path: '/',
            children: []
        };

        // Group files by page URL
        const pageGroups = new Map<string, SourceMapFile[]>();
        files.forEach(file => {
            const pageUrl = file.pageUrl;
            if (!pageGroups.has(pageUrl)) {
                pageGroups.set(pageUrl, []);
            }
            pageGroups.get(pageUrl)?.push(file);
        });

        // Create page level nodes
        for (const [pageUrl, pageFiles] of pageGroups) {
            const pageNode: FileTreeNode = {
                id: `page-${pageUrl}`,
                name: pageFiles[0].pageTitle || new URL(pageUrl).pathname,
                type: 'folder',
                path: pageUrl,
                children: []
            };
            root.children?.push(pageNode);

            // Process source maps for each page
            for (const file of pageFiles) {
                try {
                    const consumer = await new SourceMapConsumer(JSON.parse(file.content));
                    const sources = consumer.sources;
                    const contents = consumer.sourcesContent;

                    sources.forEach((source, index) => {
                        const parts = source.split('/').filter(Boolean);
                        let currentNode = pageNode;

                        // Create folder structure
                        for (let i = 0; i < parts.length - 1; i++) {
                            const part = parts[i];
                            const path = '/' + parts.slice(0, i + 1).join('/');
                            const id = `folder-${pageUrl}-${path}`;

                            let folder = currentNode.children?.find(child => child.name === part);
                            if (!folder) {
                                folder = {
                                    id,
                                    name: part,
                                    type: 'folder',
                                    path,
                                    children: []
                                };
                                currentNode.children = currentNode.children || [];
                                currentNode.children.push(folder);
                            }
                            currentNode = folder;
                        }

                        // Add source file
                        const fileName = parts[parts.length - 1];
                        currentNode.children = currentNode.children || [];
                        currentNode.children.push({
                            id: `source-${pageUrl}-${source}`,
                            name: fileName,
                            type: 'source',
                            path: source,
                            content: contents?.[index],
                            sourceMapFile: file
                        });
                    });
                } catch (error) {
                    console.error('Error parsing source map:', error);
                }
            }
        }

        return root;
    };

    const renderTree = (node: FileTreeNode) => (
        <TreeItem
            key={node.id}
            itemId={node.id}
            label={
                <Box display="flex" alignItems="center" gap={1}>
                    {node.type === 'folder' ? (
                        expanded.includes(node.id) ? <FolderOpenIcon /> : <FolderIcon />
                    ) : (
                        <FileIcon />
                    )}
                    <Typography variant="body2">{node.name}</Typography>
                </Box>
            }
            onClick={() => {
                if (node.type === 'source') {
                    setSelectedFile(node.path);
                    setSelectedNode(node);
                }
            }}
        >
            {node.children?.map((child) => renderTree(child))}
        </TreeItem>
    );

    const handleNodeToggle = (_event: React.SyntheticEvent, nodeIds: string[]) => {
        setExpanded(nodeIds);
    };

    const handleDownload = async (url?: string) => {
        if (!url) return;

        try {
            const response = await fetch(url);
            const content = await response.text();
            const blob = new Blob([content], { type: 'application/json' });
            const downloadUrl = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = url.split('/').pop() || 'download';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    // Function to detect file language based on file extension
    const getFileLanguage = (fileName: string): string => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'js':
            case 'jsx':
                return 'javascript';
            case 'ts':
            case 'tsx':
                return 'typescript';
            case 'css':
                return 'css';
            case 'scss':
                return 'scss';
            case 'less':
                return 'less';
            case 'html':
                return 'html';
            case 'json':
                return 'json';
            default:
                return 'plaintext';
        }
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box height="100vh" display="flex" flexDirection="column">
            <AppBar position="static">
                <Toolbar variant="dense">
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Source Map Viewer
                    </Typography>
                </Toolbar>
            </AppBar>

            <Box display="flex" flexGrow={1} overflow="hidden">
                <Drawer
                    variant="permanent"
                    sx={{
                        width: 300,
                        flexShrink: 0,
                        position: 'relative',
                        height: '100%',
                        '& .MuiDrawer-paper': {
                            width: 300,
                            position: 'relative',
                            height: '100%',
                            overflowY: 'auto'
                        }
                    }}
                >
                    <SimpleTreeView
                        aria-label="file system navigator"
                        onExpandedItemsChange={handleNodeToggle}
                    >
                        {fileTree && renderTree(fileTree)}
                    </SimpleTreeView>
                </Drawer>

                <Box
                    flexGrow={1}
                    display="flex"
                    flexDirection="column"
                    overflow="hidden"
                    position="relative"
                    sx={{
                        '& .monaco-editor': {
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            bottom: 0,
                            left: 0
                        }
                    }}
                >
                    {selectedFile && selectedNode && (
                        <Box display="flex" flexDirection="column" height="100%">
                            <Box p={2} borderBottom={1} borderColor="divider">
                                <Typography variant="subtitle1" gutterBottom>
                                    Source File: {selectedNode.path}
                                </Typography>
                                <Box display="flex" gap={1}>
                                    <Button
                                        size="small"
                                        startIcon={<DownloadIcon />}
                                        onClick={() => handleDownload(selectedNode.sourceMapFile?.url)}
                                    >
                                        Download Original Source
                                    </Button>
                                    <Button
                                        size="small"
                                        startIcon={<DownloadIcon />}
                                        onClick={() => handleDownload(selectedNode.sourceMapFile?.sourceMapUrl)}
                                    >
                                        Download Source Map
                                    </Button>
                                </Box>
                            </Box>
                            <Box
                                flexGrow={1}
                                position="relative"
                            >
                                <MonacoEditor
                                    value={selectedNode.content || ''}
                                    language={getFileLanguage(selectedNode.path)}
                                    theme={document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light'}
                                // options={{
                                //     readOnly: true,
                                //     minimap: { enabled: true },
                                //     scrollBeyondLastLine: false,
                                //     fontSize: 14,
                                //     lineNumbers: 'on',
                                //     renderLineHighlight: 'all',
                                //     scrollbar: {
                                //         vertical: 'visible',
                                //         horizontal: 'visible'
                                //     }
                                // }}
                                />
                            </Box>
                        </Box>
                    )}
                    {!selectedFile && (
                        <Box p={4}>
                            <Typography color="text.secondary">
                                Select a file from the tree to view its contents
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
} 