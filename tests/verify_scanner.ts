import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILT_IN_RULES } from '../src/storage/rules.ts';
import type { Rule } from '../src/types/rules.ts';
import { scanCode } from '../src/utils/leakScanner.ts';

interface SourceMapShape {
    sourcesContent?: string[];
}

const EXPECTED_FAKE_OPENAI_KEY = 'sk-1234567890abcdef1234567890abcdef1234567890abcdef';

async function readMockSiteFiles(mockSiteDir: string): Promise<{
    jsContent: string;
    mapContent: string;
    parsedMap: SourceMapShape;
}> {
    const jsPath = path.resolve(mockSiteDir, 'app.bundle.js');
    const mapPath = path.resolve(mockSiteDir, 'app.bundle.js.map');

    const [jsContent, mapContent] = await Promise.all([
        readFile(jsPath, 'utf8'),
        readFile(mapPath, 'utf8')
    ]);

    const parsedMap = JSON.parse(mapContent) as SourceMapShape;
    return { jsContent, mapContent, parsedMap };
}

async function main(): Promise<void> {
    const scriptPath = fileURLToPath(import.meta.url);
    const scriptDir = path.dirname(scriptPath);
    const mockSiteDir = path.resolve(scriptDir, 'mock-site');

    const { jsContent, mapContent, parsedMap } = await readMockSiteFiles(mockSiteDir);
    const rules: Rule[] = BUILT_IN_RULES.filter((rule) => rule.isEnabled).map((rule) => ({ ...rule }));

    const scanTarget = [
        jsContent,
        mapContent,
        ...(parsedMap.sourcesContent ?? [])
    ].join('\n');

    const findings = scanCode(scanTarget, rules);
    const openAiFindings = findings.filter((finding) => finding.ruleId === 'openai_api_key');

    assert.ok(openAiFindings.length > 0, 'Expected scanCode to detect at least one OpenAI key.');
    assert.ok(
        openAiFindings.some((finding) => finding.matchedText === EXPECTED_FAKE_OPENAI_KEY),
        'Expected scanner to match the fake OpenAI key from tests/mock-site.'
    );

    const matchedRules = Array.from(new Set(findings.map((finding) => finding.ruleName))).sort();

    console.log('Scanner verification passed.');
    console.log(`Total findings: ${findings.length}`);
    console.log(`OpenAI findings: ${openAiFindings.length}`);
    console.log(`Matched rule names: ${matchedRules.join(', ')}`);
}

main().catch((error) => {
    console.error('Scanner verification failed.');
    console.error(error);
    process.exitCode = 1;
});
