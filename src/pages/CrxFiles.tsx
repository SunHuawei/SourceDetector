import { Box, List, ListItem, ListItemButton, ListItemText, Button } from '@mui/material';
import { useState, useEffect } from 'react';
import SourceViewer from '../components/SourceFiles/SourceViewer';
import { FileNode } from '../types/files';

interface CrxFile {
    id: number;
    pageUrl: string;
    pageTitle: string;
    crxUrl: string;
    timestamp: number;
}

interface ParsedCrxFile {
    id: number;
    path: string;
    content: string;
    crxFileId: number;
    size: number;
    timestamp: number;
}

const CrxFiles = () => {
    const [crxFiles, setCrxFiles] = useState<CrxFile[]>([]);
    const [selectedCrxId, setSelectedCrxId] = useState<number | null>(null);
    const [sourceFiles, setSourceFiles] = useState<FileNode[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);

    const loadCrxFiles = async () => {
        try {
            setLoading(true);
            const response = await window.database.getCrxFiles();
            if (response.success && response.data) {
                setCrxFiles(response.data);
                setHasMore(response.data.length >= 100);
                if (response.data.length > 0) {
                    handleCrxSelect(response.data[0].id);
                }
            }
        } catch (error) {
            console.error('Error loading CRX files:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCrxFiles();
    }, []);

    const handleCrxSelect = async (crxId: number) => {
        setSelectedCrxId(crxId);
        try {
            const response = await window.database.getParsedCrxFiles({ crxFileId: crxId });
            if (response.success && response.data) {
                const parsedFiles = response.data as ParsedCrxFile[];

                // Create root node
                const root: FileNode = {
                    name: 'root',
                    path: '/',
                    isDirectory: true,
                    children: {}
                };

                // Process each file
                parsedFiles.forEach((file: ParsedCrxFile) => {
                    // Split path into segments and create folder structure
                    const pathSegments = file.path.split('/');
                    let currentNode = root;

                    // Process all segments except the last one (file name)
                    for (let i = 0; i < pathSegments.length - 1; i++) {
                        const segment = pathSegments[i];
                        if (!segment) continue; // Skip empty segments

                        if (!currentNode.children[segment]) {
                            currentNode.children[segment] = {
                                name: segment,
                                path: pathSegments.slice(0, i + 1).join('/'),
                                isDirectory: true,
                                children: {}
                            };
                        }
                        currentNode = currentNode.children[segment];
                    }

                    // Add the file
                    const fileName = pathSegments[pathSegments.length - 1];
                    currentNode.children[fileName] = {
                        name: fileName,
                        path: file.path,
                        size: file.size,
                        isDirectory: false,
                        children: {},
                        content: file.content
                    };
                });

                setSourceFiles(Object.values(root.children));
            }
        } catch (error) {
            console.error('Error loading parsed CRX files:', error);
        }
    };

    const handleLoadMore = async () => {
        // TODO: Implement load more functionality
        setHasMore(false);
    };

    return (
        <Box sx={{
            display: 'flex',
            position: 'relative',
            height: '100%',
            width: '100%',
            bgcolor: 'background.default',
            color: 'text.primary',
        }}>
            {/* Left side - CRX Files List */}
            <Box sx={{
                width: 300,
                borderRight: 1,
                borderColor: 'divider',
                overflow: 'auto',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'background.paper'
            }}>
                <List>
                    {crxFiles.map((file) => (
                        <ListItem key={file.id} disablePadding>
                            <ListItemButton
                                selected={selectedCrxId === file.id}
                                onClick={() => handleCrxSelect(file.id)}
                            >
                                <ListItemText
                                    primary={file.pageTitle}
                                    secondary={new URL(file.pageUrl).hostname}
                                    sx={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}
                                />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
                {hasMore && (
                    <Button
                        onClick={handleLoadMore}
                        disabled={loading}
                        sx={{ m: 1 }}
                    >
                        {loading ? 'Loading...' : 'Show More'}
                    </Button>
                )}
            </Box>

            {/* Right side - Source Viewer */}
            <SourceViewer sourceFiles={sourceFiles} />
        </Box>
    );
};

export default CrxFiles; 