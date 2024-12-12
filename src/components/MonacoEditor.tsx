import React, { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import { Box } from '@mui/material';

interface MonacoEditorProps {
    value: string;
    language: string;
    theme?: 'vs-dark' | 'light';
    height?: string;
    options?: monaco.editor.IStandaloneEditorConstructionOptions;
}

export default function MonacoEditor({
    value,
    language,
    theme = 'vs-dark',
    height = '100%',
    options = {}
}: MonacoEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

    useEffect(() => {
        if (editorRef.current) {
            editor.current = monaco.editor.create(editorRef.current, {
                value,
                language,
                theme,
                automaticLayout: true,
                ...options
            });

            return () => {
                editor.current?.dispose();
            };
        }
    }, []);

    useEffect(() => {
        if (editor.current) {
            if (editor.current.getValue() !== value) {
                editor.current.setValue(value);
            }
        }
    }, [value]);

    useEffect(() => {
        if (editor.current) {
            monaco.editor.setTheme(theme);
        }
    }, [theme]);

    return (
        <Box
            ref={editorRef}
            sx={{
                height,
                width: '100%',
                overflow: 'hidden'
            }}
        />
    );
}