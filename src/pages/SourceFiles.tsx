import { Box } from '@mui/material';
import WebsiteSourceMapTree from '../components/SourceFiles/WebsiteSourceMapTree';
import { useState, useEffect } from 'react';
import { FileNode } from '../types/files';
import SourceViewer from '../components/SourceFiles/SourceViewer';
import { IpcRendererEvent } from 'electron';

interface SelectFileData {
    url: string;
    type: 'crx' | 'sourcemap';
}

const SourceFiles = () => {
    const [sourceFiles, setSourceFiles] = useState<FileNode[]>([]);
    const [selectedSourceMapId, setSelectedSourceMapId] = useState<number | null>(null);

    useEffect(() => {
        // Listen for file selection events from the main process
        window.database.onSelectFile((event: IpcRendererEvent, data: SelectFileData) => {
            if (data.type === 'sourcemap') {
                // Find the source map file by URL and select it
                const findAndSelectFile = async () => {
                    try {
                        const response = await window.database.getSourceMapFileByUrl(data.url);
                        if (response.success && response.data) {
                            setSelectedSourceMapId(response.data.id);
                        }
                    } catch (error) {
                        console.error('Error finding source map file:', error);
                    }
                };
                findAndSelectFile();
            }
        });
    }, []);

    const handleSourceMapSelect = async (sourceMapId: number) => {
        setSelectedSourceMapId(sourceMapId);
        try {
            const response = await window.database.getParsedSourceFiles({ sourceMapFileId: sourceMapId });
            if (response.success && response.data) {
                const parsedFiles = response.data;
                // Create root node
                const root: FileNode = {
                    name: 'root',
                    path: '/',
                    isDirectory: true,
                    children: {}
                };

                // Process each source file
                parsedFiles.forEach((file) => {
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
                        size: file.content.length,
                        isDirectory: false,
                        children: {},
                        content: file.content
                    };
                });

                setSourceFiles(Object.values(root.children));
            }
        } catch (error) {
            console.error('Error loading source map:', error);
        }
    };

    const handlePageSelect = async (pageId: number) => {
        try {
            // Get all source maps for this page
            const response = await window.database.getSourceMaps(pageId, 0, 1000); // Large limit to get all
            if (response.success && response.data?.sourceMaps) {
                // Create a root node for all files
                const root: FileNode = {
                    name: 'root',
                    path: '/',
                    isDirectory: true,
                    children: {}
                };

                // Process each source map
                for (const sourceMap of response.data.sourceMaps) {
                    const filesResponse = await window.database.getParsedSourceFiles({ sourceMapFileId: sourceMap.id });
                    if (filesResponse.success && filesResponse.data) {
                        // Process each source file
                        filesResponse.data.forEach((file) => {
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
                            // If file already exists, append source map ID to make it unique
                            const existingFiles = Object.values(currentNode.children).filter(child => child.name === fileName);
                            if (existingFiles.length === 0) {
                                currentNode.children[fileName] = {
                                    name: fileName,
                                    path: file.path,
                                    size: file.content.length,
                                    isDirectory: false,
                                    children: {},
                                    content: file.content
                                };
                            }
                        });
                    }
                }

                setSourceFiles(Object.values(root.children));
            }
        } catch (error) {
            console.error('Error loading page source maps:', error);
        }
    };

    return (
        <Box sx={{
            display: 'flex',
            position: 'relative',
            height: '100%',
            width: '100%',
            bgcolor: 'background.default',
            color: 'text.primary'
        }}>
            {/* Left side - Source Tree */}
            <Box sx={{
                width: 300,
                borderRight: 1,
                borderColor: 'divider',
                overflow: 'auto',
                flexShrink: 0,
                backgroundColor: 'background.paper'
            }}>
                <WebsiteSourceMapTree
                    onSourceMapSelect={handleSourceMapSelect}
                    onPageSelect={handlePageSelect}
                />
            </Box>

            {/* Right side - Source Viewer */}
            <SourceViewer sourceFiles={sourceFiles} />
        </Box>
    );
};

export default SourceFiles; 