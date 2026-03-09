import assert from 'node:assert/strict';
import test from 'node:test';
import { Rule } from '../types/rules';
import { scanCode } from './leakScanner';

function createRule(overrides: Partial<Rule>): Rule {
    return {
        id: overrides.id ?? 'rule',
        name: overrides.name ?? 'Rule',
        pattern: overrides.pattern ?? 'token',
        flags: overrides.flags,
        description: overrides.description,
        isEnabled: overrides.isEnabled ?? true,
        isBuiltIn: overrides.isBuiltIn ?? true
    };
}

const openAiRule = createRule({
    id: 'openai_api_key',
    name: 'OpenAI',
    pattern: 'sk-[a-zA-Z0-9]{48}'
});

const awsRule = createRule({
    id: 'aws_access_key_id',
    name: 'AWS Access Keys',
    pattern: 'AKIA[0-9A-Z]{16}'
});

const geminiRule = createRule({
    id: 'google_gemini_api_key',
    name: 'Google Gemini',
    pattern: 'AIzaSy[a-zA-Z0-9-_]{33}'
});

const anthropicRule = createRule({
    id: 'anthropic_api_key',
    name: 'Anthropic',
    pattern: 'ant-api-key-v1-[a-zA-Z0-9-]{80,120}'
});

test('detects OpenAI key with accurate line and column', () => {
    const openAiKey = `sk-${'A'.repeat(48)}`;
    const code = [
        'const safe = "hello";',
        `const openAiKey = "${openAiKey}";`
    ].join('\n');

    const findings = scanCode(code, [openAiRule]);

    assert.equal(findings.length, 1);
    assert.equal(findings[0].ruleName, 'OpenAI');
    assert.equal(findings[0].matchedText, openAiKey);
    assert.equal(findings[0].line, 2);
    assert.equal(findings[0].column, code.split('\n')[1].indexOf(openAiKey) + 1);
});

test('detects AWS key while rejecting near-miss values', () => {
    const validAwsKey = 'AKIA1234567890ABCDEF';
    const lowerCasePrefix = 'akia1234567890ABCDEF';
    const mixedCasePayload = 'AKIA1234567890ABcDEF';

    const code = [
        `const valid = "${validAwsKey}";`,
        `const invalidPrefix = "${lowerCasePrefix}";`,
        `const invalidPayload = "${mixedCasePayload}";`
    ].join('\n');

    const findings = scanCode(code, [awsRule]);

    assert.equal(findings.length, 1);
    assert.equal(findings[0].matchedText, validAwsKey);
});

test('detects OpenAI, AWS, Gemini and Anthropic keys together', () => {
    const openAiKey = `sk-${'B'.repeat(48)}`;
    const awsKey = 'AKIAZYXWVUTSRQPONM12';
    const geminiKey = `AIzaSy${'x'.repeat(33)}`;
    const anthropicKey = `ant-api-key-v1-${'a'.repeat(90)}`;

    const code = [
        `const one = "${openAiKey}";`,
        `const two = "${awsKey}";`,
        `const three = "${geminiKey}";`,
        `const four = "${anthropicKey}";`
    ].join('\n');

    const findings = scanCode(code, [openAiRule, awsRule, geminiRule, anthropicRule]);
    const rulesMatched = findings.map((finding) => finding.ruleName).sort();

    assert.equal(findings.length, 4);
    assert.deepEqual(rulesMatched, ['AWS Access Keys', 'Anthropic', 'Google Gemini', 'OpenAI']);
});

test('skips disabled rules', () => {
    const openAiKey = `sk-${'C'.repeat(48)}`;
    const code = `const openAiKey = "${openAiKey}";`;
    const disabledOpenAiRule = createRule({
        ...openAiRule,
        isEnabled: false
    });

    const findings = scanCode(code, [disabledOpenAiRule]);

    assert.equal(findings.length, 0);
});

test('ignores invalid regex rule and still scans with valid rules', () => {
    const openAiKey = `sk-${'D'.repeat(48)}`;
    const code = `const openAiKey = "${openAiKey}";`;
    const invalidRule = createRule({
        id: 'invalid',
        name: 'Invalid Rule',
        pattern: '(unclosed'
    });

    const findings = scanCode(code, [invalidRule, openAiRule]);

    assert.equal(findings.length, 1);
    assert.equal(findings[0].matchedText, openAiKey);
});

test('detects repeated secrets as separate findings with increasing indexes', () => {
    const openAiKey = `sk-${'E'.repeat(48)}`;
    const code = [
        `const first = "${openAiKey}";`,
        `const second = "${openAiKey}";`
    ].join('\n');

    const findings = scanCode(code, [openAiRule]);

    assert.equal(findings.length, 2);
    assert.ok(findings[0].startIndex < findings[1].startIndex);
    assert.ok(findings[0].endIndex < findings[1].endIndex);
});

test('rejects off-by-one and malformed candidates across providers', () => {
    const almostOpenAi = `sk-${'F'.repeat(47)}`;
    const almostAws = 'AKIA1234567890ABCDE';
    const almostGemini = `AIzaSy${'g'.repeat(32)}`;
    const almostAnthropic = `ant-api-key-v1-${'h'.repeat(79)}`;

    const code = [
        `const openai = "${almostOpenAi}";`,
        `const aws = "${almostAws}";`,
        `const gemini = "${almostGemini}";`,
        `const anthropic = "${almostAnthropic}";`
    ].join('\n');

    const findings = scanCode(code, [openAiRule, awsRule, geminiRule, anthropicRule]);

    assert.equal(findings.length, 0);
});
