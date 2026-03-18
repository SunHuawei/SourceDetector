import { Box, Chip, Stack, Typography } from '@mui/material';
import { detectCodeLanguage } from '@/pages/desktop/sourceCodeTree';

interface Props {
    filePath: string;
    content: string;
}

interface TokenSegment {
    text: string;
    color?: string;
}

const KEYWORD_PATTERN = /\b(const|let|var|function|return|if|else|for|while|switch|case|break|continue|export|import|from|class|new|try|catch|finally|throw|await|async|interface|type)\b/g;
const NUMBER_PATTERN = /\b\d+(?:\.\d+)?\b/g;
const COMMENT_PATTERN = /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm;
const STRING_PATTERN = /(["'`])(?:\\.|(?!\1)[^\\])*\1/g;

function colorizeLine(line: string): TokenSegment[] {
    if (!line) {
        return [{ text: '' }];
    }

    const matches: Array<{ start: number; end: number; color: string }> = [];
    const collect = (pattern: RegExp, color: string) => {
        for (const match of line.matchAll(pattern)) {
            const start = match.index ?? 0;
            matches.push({ start, end: start + match[0].length, color });
        }
    };

    collect(COMMENT_PATTERN, '#6A9955');
    collect(STRING_PATTERN, '#CE9178');
    collect(NUMBER_PATTERN, '#B5CEA8');
    collect(KEYWORD_PATTERN, '#569CD6');

    matches.sort((left, right) => left.start - right.start || right.end - left.end);

    const segments: TokenSegment[] = [];
    let cursor = 0;

    for (const match of matches) {
        if (match.start < cursor) {
            continue;
        }
        if (match.start > cursor) {
            segments.push({ text: line.slice(cursor, match.start) });
        }
        segments.push({ text: line.slice(match.start, match.end), color: match.color });
        cursor = match.end;
    }

    if (cursor < line.length) {
        segments.push({ text: line.slice(cursor) });
    }

    return segments.length > 0 ? segments : [{ text: line }];
}

export function CodeViewer({ filePath, content }: Props) {
    const language = detectCodeLanguage(filePath);
    const lines = content.split('\n');

    return (
        <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ px: 2, py: 1, bgcolor: '#1E1E1E', borderBottom: '1px solid #333' }}
            >
                <Typography variant="subtitle2" sx={{ color: '#D4D4D4', wordBreak: 'break-all' }}>
                    {filePath}
                </Typography>
                <Chip size="small" label={language} sx={{ bgcolor: '#2D2D30', color: '#D4D4D4' }} />
            </Stack>
            <Box
                component="div"
                sx={{
                    bgcolor: '#1E1E1E',
                    color: '#D4D4D4',
                    fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
                    fontSize: 12,
                    maxHeight: 520,
                    overflow: 'auto'
                }}
            >
                {lines.map((line, index) => (
                    <Box key={`${filePath}-${index}`} sx={{ display: 'flex' }}>
                        <Box
                            sx={{
                                minWidth: 56,
                                px: 1.5,
                                py: 0.25,
                                textAlign: 'right',
                                color: '#858585',
                                userSelect: 'none',
                                borderRight: '1px solid #333'
                            }}
                        >
                            {index + 1}
                        </Box>
                        <Box sx={{ px: 1.5, py: 0.25, whiteSpace: 'pre' }}>
                            {colorizeLine(line).map((segment, segmentIndex) => (
                                <Box
                                    key={`${filePath}-${index}-${segmentIndex}`}
                                    component="span"
                                    sx={{ color: segment.color ?? '#D4D4D4' }}
                                >
                                    {segment.text}
                                </Box>
                            ))}
                        </Box>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
