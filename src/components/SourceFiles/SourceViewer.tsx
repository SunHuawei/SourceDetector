import { Box } from '@mui/material';
import { useEffect, useState } from 'react';
import { FileNode } from '../../types/files';
import FileViewer from './FileViewer';
import ParsedSourceFileTree from './ParsedSourceFileTree';
interface SourceViewerProps {
    sourceFiles: FileNode[];
}

function getSelectedNodePath(sourceFiles: FileNode[], selectedFile: FileNode | null): string[] {
    if (!selectedFile) {
        return [];
    }
    const selectedNodePath: string[] = [];
    let currentNode = sourceFiles[0];
    while (currentNode) {
        selectedNodePath.push(currentNode.path);
        currentNode = Object.values(currentNode.children)[0];
    }
    return selectedNodePath;
}

const SourceViewer = ({ sourceFiles }: SourceViewerProps) => {
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);

    useEffect(() => {
        if (sourceFiles.length > 0) {
            let currentNode = sourceFiles[0];
            while (currentNode) {
                const temp = Object.values(currentNode.children)[0];
                if (temp) {
                    currentNode = temp;
                } else {
                    break;
                }
            }
            if (currentNode) {
                setSelectedFile(currentNode);
            }
        }
    }, [sourceFiles]);

    const handleFileSelect = (file: FileNode) => {
        if (file.isDirectory) {
            // TODO: expand the directory
        } else {
            setSelectedFile(file);
        }
    };

    return (
        <Box sx={{
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
            minWidth: 0
        }}>
            {/* Explorer */}
            <Box sx={{
                width: 300,
                borderRight: 1,
                borderColor: 'divider',
                overflow: 'auto',
                flexShrink: 0
            }}>
                <ParsedSourceFileTree
                    onFileSelect={handleFileSelect}
                    files={sourceFiles}
                    selectedNodePath={getSelectedNodePath(sourceFiles, selectedFile)}
                />
            </Box>

            {/* File content */}
            <Box sx={{
                flex: 1,
                overflow: 'auto',
                minWidth: 0
            }}>
                <FileViewer file={selectedFile} />
            </Box>
        </Box>
    );
};

export default SourceViewer; 