import { Box, Typography } from '@mui/material';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { a11yDark as style } from 'react-syntax-highlighter/dist/esm/styles/hljs';

import { FileNode } from '../../types/files';

interface FileViewerProps {
    file: FileNode | null;
}

// @ts-ignore
const HighlighterComponent = SyntaxHighlighter as unknown as React.ComponentType<any>;

const FileViewer = ({ file }: FileViewerProps) => {
    if (!file) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography>No file selected</Typography>
            </Box>
        );
    }

    if (file.isDirectory) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography>Selected item is a directory</Typography>
            </Box>
        );
    }

    const getLanguage = (fileName: string) => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'json':
                return 'json';
            case 'js':
            case 'jsx':
            case 'ts':
            case 'tsx':
                return 'javascript';
            case 'css':
                return 'css';
            case 'html':
                return 'html';
            default:
                return 'plaintext';
        }
    };

    console.log('=======>', getLanguage(file.name));

    return (
        <Box sx={{ p: 2 }} >
            <Typography variant="h6" gutterBottom>
                {file.name}
            </Typography>
            <HighlighterComponent
                language={getLanguage(file.name)}
                style={style}
                showLineNumbers
                customStyle={{
                    height: 'calc(100vh - 100px)',
                    fontSize: '14px',
                    background: 'rgb(26 26 26)'
                }}
            >
                {file.content || ''}
            </HighlighterComponent>
        </Box>
    );
};

export default FileViewer; 