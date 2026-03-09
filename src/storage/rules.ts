import { Rule, RulesStorageState } from '@/types/rules';

const RULES_STORAGE_KEY = 'leak_scanner_rules';

function createDefaultRulesStorageState(): RulesStorageState {
    return {
        userRules: [],
        builtInRuleEnabledMap: {}
    };
}

export const BUILT_IN_RULES: ReadonlyArray<Rule> = [
    {
        id: 'openai_api_key',
        name: 'OpenAI',
        pattern: 'sk-[a-zA-Z0-9]{48}',
        description: 'OpenAI API key pattern',
        isEnabled: true,
        isBuiltIn: true
    },
    {
        id: 'anthropic_api_key',
        name: 'Anthropic',
        pattern: 'ant-api-key-v1-[a-zA-Z0-9-]{80,120}',
        description: 'Anthropic API key pattern',
        isEnabled: true,
        isBuiltIn: true
    },
    {
        id: 'google_gemini_api_key',
        name: 'Google Gemini',
        pattern: 'AIzaSy[a-zA-Z0-9-_]{33}',
        description: 'Google Gemini API key pattern',
        isEnabled: true,
        isBuiltIn: true
    },
    {
        id: 'aws_access_key_id',
        name: 'AWS Access Keys',
        pattern: 'AKIA[0-9A-Z]{16}',
        description: 'AWS access key ID pattern',
        isEnabled: true,
        isBuiltIn: true
    },
    {
        id: 'common_api_proxy_key',
        name: 'Common API Proxy keys',
        pattern: 'sk-[a-zA-Z0-9]{20,64}',
        description: 'Common API proxy key pattern',
        isEnabled: true,
        isBuiltIn: true
    }
];

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isRule(value: unknown): value is Rule {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.id === 'string'
        && typeof value.name === 'string'
        && typeof value.pattern === 'string'
        && (value.flags === undefined || typeof value.flags === 'string')
        && (value.description === undefined || typeof value.description === 'string')
        && typeof value.isEnabled === 'boolean'
        && typeof value.isBuiltIn === 'boolean';
}

function isValidRegex(pattern: string, flags?: string): boolean {
    try {
        new RegExp(pattern, flags ?? '');
        return true;
    } catch {
        return false;
    }
}

function createRuleCopy(rule: Rule): Rule {
    return { ...rule };
}

function sanitizeRulesStorageState(value: unknown): RulesStorageState {
    if (!isRecord(value)) {
        return createDefaultRulesStorageState();
    }

    const userRulesRaw = Array.isArray(value.userRules) ? value.userRules : [];
    const userRules: Rule[] = userRulesRaw
        .filter(isRule)
        .map((rule) => ({
            ...rule,
            id: rule.id.trim(),
            name: rule.name.trim(),
            pattern: rule.pattern.trim(),
            isBuiltIn: false
        }))
        .filter((rule) => rule.id.length > 0 && rule.name.length > 0 && rule.pattern.length > 0 && isValidRegex(rule.pattern, rule.flags));

    const builtInRuleEnabledMap: Record<string, boolean> = {};
    if (isRecord(value.builtInRuleEnabledMap)) {
        for (const [key, enabled] of Object.entries(value.builtInRuleEnabledMap)) {
            if (typeof enabled === 'boolean') {
                builtInRuleEnabledMap[key] = enabled;
            }
        }
    }

    return {
        userRules,
        builtInRuleEnabledMap
    };
}

function createBuiltInRules(enabledMap: Record<string, boolean>): Rule[] {
    return BUILT_IN_RULES.map((rule) => ({
        ...rule,
        isEnabled: enabledMap[rule.id] ?? rule.isEnabled
    }));
}

async function storageGet<T>(key: string): Promise<T | undefined> {
    const items = await chrome.storage.local.get([key]) as Record<string, unknown>;
    return items[key] as T | undefined;
}

async function storageSet<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
}

async function getRulesStorageState(): Promise<RulesStorageState> {
    const storedState = await storageGet<unknown>(RULES_STORAGE_KEY);
    return sanitizeRulesStorageState(storedState);
}

async function setRulesStorageState(state: RulesStorageState): Promise<void> {
    await storageSet(RULES_STORAGE_KEY, state);
}

function validateUserRule(rule: Rule): void {
    if (rule.isBuiltIn) {
        throw new Error('User-defined rules cannot be marked as built-in.');
    }

    if (rule.id.trim().length === 0 || rule.name.trim().length === 0 || rule.pattern.trim().length === 0) {
        throw new Error('Rule id, name, and pattern are required.');
    }

    if (!isValidRegex(rule.pattern, rule.flags)) {
        throw new Error(`Invalid regex pattern in rule "${rule.name}".`);
    }
}

export async function initializeRulesStorage(): Promise<void> {
    const currentState = await getRulesStorageState();
    await setRulesStorageState(currentState);
}

export async function getBuiltInRules(): Promise<Rule[]> {
    const state = await getRulesStorageState();
    return createBuiltInRules(state.builtInRuleEnabledMap);
}

export async function getUserRules(): Promise<Rule[]> {
    const state = await getRulesStorageState();
    return state.userRules.map(createRuleCopy);
}

export async function getAllRules(): Promise<Rule[]> {
    const state = await getRulesStorageState();
    return [
        ...createBuiltInRules(state.builtInRuleEnabledMap),
        ...state.userRules.map(createRuleCopy)
    ];
}

export async function getActiveRules(): Promise<Rule[]> {
    const allRules = await getAllRules();
    return allRules.filter((rule) => rule.isEnabled);
}

export async function upsertUserRule(rule: Rule): Promise<void> {
    validateUserRule(rule);

    const normalizedRule: Rule = {
        ...rule,
        id: rule.id.trim(),
        name: rule.name.trim(),
        pattern: rule.pattern.trim(),
        isBuiltIn: false
    };

    const state = await getRulesStorageState();
    const existingIndex = state.userRules.findIndex((existingRule) => existingRule.id === normalizedRule.id);

    if (existingIndex === -1) {
        state.userRules.push(normalizedRule);
    } else {
        state.userRules[existingIndex] = normalizedRule;
    }

    await setRulesStorageState(state);
}

export async function removeUserRule(ruleId: string): Promise<void> {
    const state = await getRulesStorageState();
    state.userRules = state.userRules.filter((rule) => rule.id !== ruleId);
    await setRulesStorageState(state);
}

export async function setRuleEnabled(ruleId: string, isEnabled: boolean): Promise<void> {
    const state = await getRulesStorageState();
    const isBuiltInRule = BUILT_IN_RULES.some((rule) => rule.id === ruleId);

    if (isBuiltInRule) {
        state.builtInRuleEnabledMap[ruleId] = isEnabled;
        await setRulesStorageState(state);
        return;
    }

    const userRuleIndex = state.userRules.findIndex((rule) => rule.id === ruleId);
    if (userRuleIndex < 0) {
        throw new Error(`Rule "${ruleId}" does not exist.`);
    }

    state.userRules[userRuleIndex] = {
        ...state.userRules[userRuleIndex],
        isEnabled
    };

    await setRulesStorageState(state);
}

for (const rule of BUILT_IN_RULES) {
    if (!isValidRegex(rule.pattern, rule.flags)) {
        throw new Error(`Built-in leak detection rule "${rule.name}" has an invalid regex pattern.`);
    }
}
