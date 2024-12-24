import { getFileIcon } from '@/components/fileIcon';
import { ParsedCrxFile } from '@/types';
import { formatBytes } from '@/utils/format';
import {
    ChevronRight,
    CloudDownload,
    ExpandMore,
    Folder,
} from '@mui/icons-material';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { TreeItem as MuiTreeItem, SimpleTreeView as MuiTreeView } from '@mui/x-tree-view';
import JSZip from 'jszip';
import React, { useEffect, useState } from 'react';
import { LoadingScreen } from './LoadingScreen';

interface FileNode {
    name: string;
    path: string;
    size?: number;
    isDirectory?: boolean;
    children: { [key: string]: FileNode };
}

interface Props {
    crxUrl: string;
    parsed: ParsedCrxFile | null;
    onDownload: (path: string) => void;
}

const TreeItem = MuiTreeItem as any;
const TreeView = MuiTreeView as any;

export function CrxFileTree({ crxUrl, parsed, onDownload }: Props) {
    const [expanded, setExpanded] = useState<string[]>([]);
    const [fileTree, setFileTree] = useState<FileNode | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadFileTree = async () => {
            try {
                setLoading(true);
                if (parsed?.zip) {
                    const tree = await buildFileTreeFromJszip(parsed.zip);
                    setFileTree(tree);
                }
            } catch (error) {
                console.error('Error loading file tree:', error);
            } finally {
                setLoading(false);
            }
        };
        loadFileTree();
    }, [parsed]);

    const buildFileTreeFromJszip = async (jszip: JSZip): Promise<FileNode> => {
        const root: FileNode = {
            name: 'root',
            path: '',
            isDirectory: true,
            children: {},
        };

        // Process each file in the zip
        for (const [path, file] of Object.entries(jszip.files)) {
            if (file.dir) continue; // Skip directory entries as we'll create them implicitly

            // Split the path into segments
            const segments = path.split('/');
            let currentNode = root;

            // Create/traverse the folder structure
            for (let i = 0; i < segments.length - 1; i++) {
                const segment = segments[i];
                if (!currentNode.children[segment]) {
                    console.log('create folder', segment, segments.slice(0, i + 1).join('/'))
                    currentNode.children[segment] = {
                        name: segment,
                        path: segments.slice(0, i + 1).join('/'),
                        isDirectory: true,
                        children: {},
                    };
                }
                currentNode = currentNode.children[segment];
            }

            // Add the file to its parent folder
            const fileName = segments[segments.length - 1];
            try {
                const fileData = await file.async('uint8array');
                console.log('path', path, fileName, fileData.length)
                currentNode.children[fileName] = {
                    name: fileName,
                    path: path,
                    size: fileData.length,
                    isDirectory: false,
                    children: {}, // Empty children for files
                };
            } catch (error) {
                console.error(`Error processing file ${path}:`, error);
                console.log('create file- error ', fileName, path)
                currentNode.children[fileName] = {
                    name: fileName,
                    path: path,
                    isDirectory: false,
                    children: {},
                };
            }
        }

        return root;
    };

    const renderTree = (node: FileNode, nodeId: string) => {
        const label = (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                {node.isDirectory ? (
                    <Folder fontSize="small" />
                ) : (
                    getFileIcon(node.name)
                )}
                <Tooltip title={`${node.path}${node.size ? ` (${formatBytes(node.size)})` : ''}`}>
                    <span>{node.name}</span>
                </Tooltip>
                {!node.isDirectory && (
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDownload(node.path);
                        }}
                        sx={{ ml: 'auto' }}
                    >
                        <CloudDownload fontSize="small" />
                    </IconButton>
                )}
            </Box>
        );

        return (
            <TreeItem
                key={nodeId}
                itemId={node.path || nodeId}
                label={label}
            >
                {Object.entries(node.children).map(([childName, childNode]) =>
                    renderTree(childNode, `${node.path || nodeId}-${childName}`)
                )}
            </TreeItem>
        );
    };

    const handleToggle = (_event: React.SyntheticEvent, nodeIds: string[]) => {
        setExpanded(nodeIds);
    };

    if (loading) {
        return <LoadingScreen />
    }

    if (!fileTree) {
        return <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            <Typography variant="body1" color="text.secondary">
                No files found on this page
            </Typography>
        </Box>
    }

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
            <TreeView
                defaultCollapseIcon={<ExpandMore />}
                defaultExpandIcon={<ChevronRight />}
                expanded={expanded}
                onNodeToggle={handleToggle}
                sx={{ flexGrow: 1 }}
            >
                {Object.entries(fileTree.children).map(([name, node]) =>
                    renderTree(node, name)
                )}
            </TreeView>
        </Box>
    );
} 