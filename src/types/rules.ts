export interface Rule {
    id: string;
    name: string;
    pattern: string;
    flags?: string;
    description?: string;
    isEnabled: boolean;
    isBuiltIn: boolean;
}

export interface LeakFindingContextLine {
    line: number;
    content: string;
}

export interface LeakFinding {
    ruleId: string;
    ruleName: string;
    matchedText: string;
    startIndex: number;
    endIndex: number;
    line: number;
    column: number;
    contextLines?: LeakFindingContextLine[];
}

export interface RulesStorageState {
    userRules: Rule[];
    builtInRuleEnabledMap: Record<string, boolean>;
}
