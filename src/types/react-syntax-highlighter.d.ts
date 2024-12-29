declare module 'react-syntax-highlighter' {
    import { ComponentType } from 'react';

    interface SyntaxHighlighterProps {
        language?: string;
        style?: any;
        customStyle?: React.CSSProperties;
        showLineNumbers?: boolean;
        lineNumberStyle?: React.CSSProperties;
        wrapLongLines?: boolean;
        children: string;
    }

    const SyntaxHighlighter: ComponentType<SyntaxHighlighterProps>;
    export default SyntaxHighlighter;
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
    const vscDarkPlus: any;
    export { vscDarkPlus };
} 