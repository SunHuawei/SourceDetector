import { Box } from '@mui/material';
import WebsiteSourceMapTree from '../components/SourceFiles/WebsiteSourceMapTree';
import { useState } from 'react';
import { SourceMapConsumer } from 'source-map-js';
import { FileNode } from '../types/files';
import SourceViewer from '../components/SourceFiles/SourceViewer';

const SourceFiles = () => {
    const [sourceFiles, setSourceFiles] = useState<FileNode[]>([]);
    const handleSourceMapSelect = async (sourceMapId: number) => {
        try {
            const response = await window.database.getSourceMapFile({ id: sourceMapId });
            if (response.success && response.data) {
                const sourceMap = response.data;
                // Parse the source map
                const rawSourceMap = JSON.parse(sourceMap.content);
                const consumer = new SourceMapConsumer(rawSourceMap);
                
                // Create root node
                const root: FileNode = {
                    name: 'root',
                    path: '/',
                    isDirectory: true,
                    children: {}
                };


                // Process each source file
                consumer.sources.forEach((sourcePath) => {
                    const sourceContent = consumer.sourceContentFor(sourcePath);
                    if (sourceContent) {
                        // Split path into segments and create folder structure
                        const pathSegments = sourcePath.split('/');
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
                            path: sourcePath,
                            size: sourceContent.length,
                            isDirectory: false,
                            children: {},
                            content: sourceContent
                        };
                    }
                });

                setSourceFiles(Object.values(root.children));
            }
        } catch (error) {
            console.error('Error loading source map:', error);
        }
    };

    return (
        <Box sx={{
            display: 'flex',
            width: '100%',
            height: '100vh',
            bgcolor: 'background.default',
            color: 'text.primary'
        }}>
            {/* Left side - Source Tree */}
            <Box sx={{
                width: 300,
                borderRight: 1,
                borderColor: 'divider',
                overflow: 'auto',
                flexShrink: 0
            }}>
                <WebsiteSourceMapTree 
                    onSourceMapSelect={handleSourceMapSelect}
                />
            </Box>

            {/* Right side - Source Viewer */}
            <SourceViewer sourceFiles={sourceFiles} />
        </Box>
    );
};

export default SourceFiles; 