import {
    Code as CodeIcon,
    Css as CssIcon,
    Html as HtmlIcon,
    Image as ImageIcon,
    InsertDriveFile,
    Javascript as JavascriptIcon,
    DataObject as JsonIcon,
    Description as TextIcon
} from '@mui/icons-material';

export const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
            return <JavascriptIcon fontSize="small" />;
        case 'css':
        case 'scss':
        case 'sass':
        case 'less':
            return <CssIcon fontSize="small" />;
        case 'json':
            return <JsonIcon fontSize="small" />;
        case 'html':
        case 'htm':
            return <HtmlIcon fontSize="small" />;
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'svg':
        case 'webp':
        case 'ico':
            return <ImageIcon fontSize="small" />;
        case 'xml':
        case 'yaml':
        case 'yml':
            return <CodeIcon fontSize="small" />;
        case 'txt':
        case 'md':
            return <TextIcon fontSize="small" />;
        default:
            return <InsertDriveFile fontSize="small" />;
    }
}; 