import { LeakFinding, LeakFindingContextLine, Rule } from '@/types/rules';

interface Position {
    line: number;
    column: number;
}

function getNormalizedFlags(flags?: string): string {
    const flagSet = new Set((flags ?? '').split('').filter(Boolean));
    flagSet.add('g');
    return Array.from(flagSet).join('');
}

function buildRegexFromRule(rule: Rule): RegExp | null {
    try {
        return new RegExp(rule.pattern, getNormalizedFlags(rule.flags));
    } catch {
        return null;
    }
}

function buildLineStartIndexes(content: string): number[] {
    const lineStartIndexes: number[] = [0];

    for (let index = 0; index < content.length; index += 1) {
        if (content.charCodeAt(index) === 10) {
            lineStartIndexes.push(index + 1);
        }
    }

    return lineStartIndexes;
}

function getPositionFromIndex(index: number, lineStartIndexes: number[]): Position {
    let left = 0;
    let right = lineStartIndexes.length - 1;

    while (left <= right) {
        const middle = Math.floor((left + right) / 2);
        const lineStartIndex = lineStartIndexes[middle];

        if (lineStartIndex === index) {
            return {
                line: middle + 1,
                column: 1
            };
        }

        if (lineStartIndex < index) {
            left = middle + 1;
        } else {
            right = middle - 1;
        }
    }

    const lineIndex = Math.max(0, right);
    const lineStartIndex = lineStartIndexes[lineIndex];

    return {
        line: lineIndex + 1,
        column: index - lineStartIndex + 1
    };
}

function getContextLines(line: number, sourceLines: string[]): LeakFindingContextLine[] {
    if (sourceLines.length === 0) {
        return [];
    }

    const totalLines = sourceLines.length;
    const maxStartLine = Math.max(1, totalLines - 2);
    const startLine = Math.max(1, Math.min(line - 1, maxStartLine));
    const endLine = Math.min(totalLines, startLine + 2);
    const contextLines: LeakFindingContextLine[] = [];

    for (let currentLine = startLine; currentLine <= endLine; currentLine += 1) {
        contextLines.push({
            line: currentLine,
            content: sourceLines[currentLine - 1]
        });
    }

    return contextLines;
}

export function scanCode(code: string, activeRules: Rule[]): LeakFinding[] {
    if (code.length === 0 || activeRules.length === 0) {
        return [];
    }

    const findings: LeakFinding[] = [];
    const lineStartIndexes = buildLineStartIndexes(code);
    const sourceLines = code.split('\n');

    for (const rule of activeRules) {
        if (!rule.isEnabled) {
            continue;
        }

        const regex = buildRegexFromRule(rule);
        if (!regex) {
            continue;
        }

        for (const match of code.matchAll(regex)) {
            if (typeof match.index !== 'number') {
                continue;
            }

            const matchedText = match[0];
            if (matchedText.length === 0) {
                continue;
            }

            const startIndex = match.index;
            const endIndex = startIndex + matchedText.length;
            const position = getPositionFromIndex(startIndex, lineStartIndexes);

            findings.push({
                ruleId: rule.id,
                ruleName: rule.name,
                matchedText,
                startIndex,
                endIndex,
                line: position.line,
                column: position.column,
                contextLines: getContextLines(position.line, sourceLines)
            });
        }
    }

    return findings;
}
