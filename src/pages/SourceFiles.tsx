import { Box } from '@mui/material';
import FolderTree from '../components/SourceFiles/FolderTree';
import MockFolderTree from '../components/SourceFiles/MockFolderTree';
import { useState } from 'react';
import FileViewer from '../components/SourceFiles/FileViewer';

interface FileContent {
    id: string;
    content: string;
    language: string;
}

const SourceFiles = () => {
    const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);

    // Mock data for testing
    const mockFileContent: Record<string, FileContent> = {
        'file1.js': {
            id: 'file1.js',
            content: `function hello() {
  console.log("Hello, World!");
}`,
            language: 'javascript'
        },
        'styles.css': {
            id: 'styles.css',
            content: `.container {
  display: flex;
  background-color: #f0f0f0;
}`,
            language: 'css'
        },
        'index.html': {
            id: 'index.html',
            content: `<!DOCTYPE html>
<html>
  <head>
    <title>Test Page</title>
  </head>
  <body>
    <h1>Hello World</h1>
  </body>
</html>`,
            language: 'html'
        }
    };

    const handleFileSelect = (fileId: string) => {
        setSelectedFile(mockFileContent[fileId] || null);
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
                <FolderTree />
            </Box>

            {/* Right side - VSCode-like interface */}
            <Box sx={{
                display: 'flex',
                flex: 1,
                overflow: 'hidden',
                minWidth: 0 // This prevents flex items from overflowing
            }}>
                {/* Explorer */}
                <Box sx={{
                    width: 300,
                    borderRight: 1,
                    borderColor: 'divider',
                    overflow: 'auto',
                    flexShrink: 0
                }}>
                    <MockFolderTree onFileSelect={handleFileSelect} />
                </Box>

                {/* File content */}
                <Box sx={{
                    flex: 1,
                    overflow: 'auto',
                    minWidth: 0 // This prevents flex items from overflowing
                }}>
                    <FileViewer file={selectedFile} />
                </Box>
            </Box>
        </Box>
    );
};

export default SourceFiles; 