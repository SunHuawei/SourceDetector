import { Box, Typography } from '@mui/material';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs';

interface FileContent {
  id: string;
  content: string;
  language: string;
}

interface FileViewerProps {
  file: FileContent | null;
}

const FileViewer = ({ file }: FileViewerProps) => {
  if (!file) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%',
        color: 'text.secondary',
        bgcolor: 'background.default'
      }}>
        <Typography variant="body1">
          Select a file to view its content
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: '100%', 
      overflow: 'auto',
      bgcolor: 'background.default'
    }}>
      <SyntaxHighlighter
        language={file.language}
        style={vs2015}
        customStyle={{
          margin: 0,
          padding: '1rem',
          minHeight: '100%',
          fontSize: '0.875rem',
          lineHeight: '1.5'
        }}
        showLineNumbers
        wrapLongLines
      >
        {file.content}
      </SyntaxHighlighter>
    </Box>
  );
};

export default FileViewer; 