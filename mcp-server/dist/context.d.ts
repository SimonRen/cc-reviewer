/**
 * Rich Context Protocol for Review Handoff
 *
 * Defines the structured information that should flow from CC to reviewers.
 * This replaces the simple "ccOutput: string" with a rich, queryable context.
 */
import { z } from 'zod';
/**
 * Represents a change to a single file with semantic understanding
 */
export declare const FileChangeSchema: z.ZodObject<{
    path: z.ZodString;
    language: z.ZodOptional<z.ZodString>;
    changeType: z.ZodEnum<["created", "modified", "deleted", "renamed"]>;
    diff: z.ZodOptional<z.ZodString>;
    linesAdded: z.ZodOptional<z.ZodNumber>;
    linesRemoved: z.ZodOptional<z.ZodNumber>;
    content: z.ZodOptional<z.ZodString>;
    changedSymbols: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodEnum<["function", "class", "variable", "type", "import", "export", "other"]>;
        lineStart: z.ZodOptional<z.ZodNumber>;
        lineEnd: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        type: "function" | "type" | "other" | "class" | "variable" | "import" | "export";
        name: string;
        lineStart?: number | undefined;
        lineEnd?: number | undefined;
    }, {
        type: "function" | "type" | "other" | "class" | "variable" | "import" | "export";
        name: string;
        lineStart?: number | undefined;
        lineEnd?: number | undefined;
    }>, "many">>;
    imports: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    importedBy: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    testFile: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    path: string;
    changeType: "created" | "modified" | "deleted" | "renamed";
    language?: string | undefined;
    diff?: string | undefined;
    linesAdded?: number | undefined;
    linesRemoved?: number | undefined;
    content?: string | undefined;
    changedSymbols?: {
        type: "function" | "type" | "other" | "class" | "variable" | "import" | "export";
        name: string;
        lineStart?: number | undefined;
        lineEnd?: number | undefined;
    }[] | undefined;
    imports?: string[] | undefined;
    importedBy?: string[] | undefined;
    testFile?: string | undefined;
}, {
    path: string;
    changeType: "created" | "modified" | "deleted" | "renamed";
    language?: string | undefined;
    diff?: string | undefined;
    linesAdded?: number | undefined;
    linesRemoved?: number | undefined;
    content?: string | undefined;
    changedSymbols?: {
        type: "function" | "type" | "other" | "class" | "variable" | "import" | "export";
        name: string;
        lineStart?: number | undefined;
        lineEnd?: number | undefined;
    }[] | undefined;
    imports?: string[] | undefined;
    importedBy?: string[] | undefined;
    testFile?: string | undefined;
}>;
export type FileChange = z.infer<typeof FileChangeSchema>;
/**
 * Results from running tests, build, lint, etc.
 */
export declare const ExecutionContextSchema: z.ZodObject<{
    tests: z.ZodOptional<z.ZodObject<{
        ran: z.ZodBoolean;
        passed: z.ZodOptional<z.ZodNumber>;
        failed: z.ZodOptional<z.ZodNumber>;
        skipped: z.ZodOptional<z.ZodNumber>;
        failures: z.ZodOptional<z.ZodArray<z.ZodObject<{
            testName: z.ZodString;
            file: z.ZodOptional<z.ZodString>;
            error: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            testName: string;
            error: string;
            file?: string | undefined;
        }, {
            testName: string;
            error: string;
            file?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        ran: boolean;
        passed?: number | undefined;
        failed?: number | undefined;
        skipped?: number | undefined;
        failures?: {
            testName: string;
            error: string;
            file?: string | undefined;
        }[] | undefined;
    }, {
        ran: boolean;
        passed?: number | undefined;
        failed?: number | undefined;
        skipped?: number | undefined;
        failures?: {
            testName: string;
            error: string;
            file?: string | undefined;
        }[] | undefined;
    }>>;
    build: z.ZodOptional<z.ZodObject<{
        ran: z.ZodBoolean;
        success: z.ZodOptional<z.ZodBoolean>;
        errors: z.ZodOptional<z.ZodArray<z.ZodObject<{
            file: z.ZodString;
            line: z.ZodOptional<z.ZodNumber>;
            message: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            message: string;
            file: string;
            line?: number | undefined;
        }, {
            message: string;
            file: string;
            line?: number | undefined;
        }>, "many">>;
        warnings: z.ZodOptional<z.ZodArray<z.ZodObject<{
            file: z.ZodString;
            line: z.ZodOptional<z.ZodNumber>;
            message: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            message: string;
            file: string;
            line?: number | undefined;
        }, {
            message: string;
            file: string;
            line?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        ran: boolean;
        success?: boolean | undefined;
        errors?: {
            message: string;
            file: string;
            line?: number | undefined;
        }[] | undefined;
        warnings?: {
            message: string;
            file: string;
            line?: number | undefined;
        }[] | undefined;
    }, {
        ran: boolean;
        success?: boolean | undefined;
        errors?: {
            message: string;
            file: string;
            line?: number | undefined;
        }[] | undefined;
        warnings?: {
            message: string;
            file: string;
            line?: number | undefined;
        }[] | undefined;
    }>>;
    typeCheck: z.ZodOptional<z.ZodObject<{
        ran: z.ZodBoolean;
        errors: z.ZodOptional<z.ZodArray<z.ZodObject<{
            file: z.ZodString;
            line: z.ZodOptional<z.ZodNumber>;
            message: z.ZodString;
            code: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            message: string;
            file: string;
            code?: string | undefined;
            line?: number | undefined;
        }, {
            message: string;
            file: string;
            code?: string | undefined;
            line?: number | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        ran: boolean;
        errors?: {
            message: string;
            file: string;
            code?: string | undefined;
            line?: number | undefined;
        }[] | undefined;
    }, {
        ran: boolean;
        errors?: {
            message: string;
            file: string;
            code?: string | undefined;
            line?: number | undefined;
        }[] | undefined;
    }>>;
    lint: z.ZodOptional<z.ZodObject<{
        ran: z.ZodBoolean;
        issues: z.ZodOptional<z.ZodArray<z.ZodObject<{
            file: z.ZodString;
            line: z.ZodOptional<z.ZodNumber>;
            rule: z.ZodOptional<z.ZodString>;
            severity: z.ZodEnum<["error", "warning", "info"]>;
            message: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            message: string;
            file: string;
            severity: "info" | "error" | "warning";
            line?: number | undefined;
            rule?: string | undefined;
        }, {
            message: string;
            file: string;
            severity: "info" | "error" | "warning";
            line?: number | undefined;
            rule?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        ran: boolean;
        issues?: {
            message: string;
            file: string;
            severity: "info" | "error" | "warning";
            line?: number | undefined;
            rule?: string | undefined;
        }[] | undefined;
    }, {
        ran: boolean;
        issues?: {
            message: string;
            file: string;
            severity: "info" | "error" | "warning";
            line?: number | undefined;
            rule?: string | undefined;
        }[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    tests?: {
        ran: boolean;
        passed?: number | undefined;
        failed?: number | undefined;
        skipped?: number | undefined;
        failures?: {
            testName: string;
            error: string;
            file?: string | undefined;
        }[] | undefined;
    } | undefined;
    build?: {
        ran: boolean;
        success?: boolean | undefined;
        errors?: {
            message: string;
            file: string;
            line?: number | undefined;
        }[] | undefined;
        warnings?: {
            message: string;
            file: string;
            line?: number | undefined;
        }[] | undefined;
    } | undefined;
    typeCheck?: {
        ran: boolean;
        errors?: {
            message: string;
            file: string;
            code?: string | undefined;
            line?: number | undefined;
        }[] | undefined;
    } | undefined;
    lint?: {
        ran: boolean;
        issues?: {
            message: string;
            file: string;
            severity: "info" | "error" | "warning";
            line?: number | undefined;
            rule?: string | undefined;
        }[] | undefined;
    } | undefined;
}, {
    tests?: {
        ran: boolean;
        passed?: number | undefined;
        failed?: number | undefined;
        skipped?: number | undefined;
        failures?: {
            testName: string;
            error: string;
            file?: string | undefined;
        }[] | undefined;
    } | undefined;
    build?: {
        ran: boolean;
        success?: boolean | undefined;
        errors?: {
            message: string;
            file: string;
            line?: number | undefined;
        }[] | undefined;
        warnings?: {
            message: string;
            file: string;
            line?: number | undefined;
        }[] | undefined;
    } | undefined;
    typeCheck?: {
        ran: boolean;
        errors?: {
            message: string;
            file: string;
            code?: string | undefined;
            line?: number | undefined;
        }[] | undefined;
    } | undefined;
    lint?: {
        ran: boolean;
        issues?: {
            message: string;
            file: string;
            severity: "info" | "error" | "warning";
            line?: number | undefined;
            rule?: string | undefined;
        }[] | undefined;
    } | undefined;
}>;
export type ExecutionContext = z.infer<typeof ExecutionContextSchema>;
export declare const GitContextSchema: z.ZodObject<{
    branch: z.ZodOptional<z.ZodString>;
    baseBranch: z.ZodOptional<z.ZodString>;
    commits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        hash: z.ZodString;
        message: z.ZodString;
        filesChanged: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        message: string;
        hash: string;
        filesChanged: string[];
    }, {
        message: string;
        hash: string;
        filesChanged: string[];
    }>, "many">>;
    pullRequest: z.ZodOptional<z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        description: z.ZodOptional<z.ZodString>;
        targetBranch: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        title?: string | undefined;
        description?: string | undefined;
        targetBranch?: string | undefined;
    }, {
        title?: string | undefined;
        description?: string | undefined;
        targetBranch?: string | undefined;
    }>>;
    uncommittedChanges: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    branch?: string | undefined;
    baseBranch?: string | undefined;
    commits?: {
        message: string;
        hash: string;
        filesChanged: string[];
    }[] | undefined;
    pullRequest?: {
        title?: string | undefined;
        description?: string | undefined;
        targetBranch?: string | undefined;
    } | undefined;
    uncommittedChanges?: boolean | undefined;
}, {
    branch?: string | undefined;
    baseBranch?: string | undefined;
    commits?: {
        message: string;
        hash: string;
        filesChanged: string[];
    }[] | undefined;
    pullRequest?: {
        title?: string | undefined;
        description?: string | undefined;
        targetBranch?: string | undefined;
    } | undefined;
    uncommittedChanges?: boolean | undefined;
}>;
export type GitContext = z.infer<typeof GitContextSchema>;
export declare const CCAnalysisSchema: z.ZodObject<{
    originalRequest: z.ZodString;
    taskType: z.ZodOptional<z.ZodEnum<["feature", "bugfix", "refactor", "security-fix", "performance", "review", "other"]>>;
    summary: z.ZodString;
    findings: z.ZodOptional<z.ZodArray<z.ZodObject<{
        category: z.ZodString;
        description: z.ZodString;
        location: z.ZodOptional<z.ZodString>;
        confidence: z.ZodOptional<z.ZodNumber>;
        addressed: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        category: string;
        description: string;
        confidence?: number | undefined;
        location?: string | undefined;
        addressed?: boolean | undefined;
    }, {
        category: string;
        description: string;
        confidence?: number | undefined;
        location?: string | undefined;
        addressed?: boolean | undefined;
    }>, "many">>;
    uncertainties: z.ZodOptional<z.ZodArray<z.ZodObject<{
        topic: z.ZodString;
        question: z.ZodString;
        ccBestGuess: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        topic: string;
        question: string;
        ccBestGuess?: string | undefined;
    }, {
        topic: string;
        question: string;
        ccBestGuess?: string | undefined;
    }>, "many">>;
    assumptions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    decisions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        decision: z.ZodString;
        rationale: z.ZodString;
        alternatives: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        decision: string;
        rationale: string;
        alternatives?: string[] | undefined;
    }, {
        decision: string;
        rationale: string;
        alternatives?: string[] | undefined;
    }>, "many">>;
    confidence: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    summary: string;
    originalRequest: string;
    confidence?: number | undefined;
    findings?: {
        category: string;
        description: string;
        confidence?: number | undefined;
        location?: string | undefined;
        addressed?: boolean | undefined;
    }[] | undefined;
    taskType?: "performance" | "other" | "review" | "feature" | "bugfix" | "refactor" | "security-fix" | undefined;
    uncertainties?: {
        topic: string;
        question: string;
        ccBestGuess?: string | undefined;
    }[] | undefined;
    assumptions?: string[] | undefined;
    decisions?: {
        decision: string;
        rationale: string;
        alternatives?: string[] | undefined;
    }[] | undefined;
}, {
    summary: string;
    originalRequest: string;
    confidence?: number | undefined;
    findings?: {
        category: string;
        description: string;
        confidence?: number | undefined;
        location?: string | undefined;
        addressed?: boolean | undefined;
    }[] | undefined;
    taskType?: "performance" | "other" | "review" | "feature" | "bugfix" | "refactor" | "security-fix" | undefined;
    uncertainties?: {
        topic: string;
        question: string;
        ccBestGuess?: string | undefined;
    }[] | undefined;
    assumptions?: string[] | undefined;
    decisions?: {
        decision: string;
        rationale: string;
        alternatives?: string[] | undefined;
    }[] | undefined;
}>;
export type CCAnalysis = z.infer<typeof CCAnalysisSchema>;
export declare const ReviewScopeSchema: z.ZodObject<{
    mustReview: z.ZodOptional<z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        reason: z.ZodString;
        specificConcerns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        reason: string;
        specificConcerns?: string[] | undefined;
    }, {
        path: string;
        reason: string;
        specificConcerns?: string[] | undefined;
    }>, "many">>;
    shouldReview: z.ZodOptional<z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        reason: string;
    }, {
        path: string;
        reason: string;
    }>, "many">>;
    mayReview: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    skipReview: z.ZodOptional<z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        reason: string;
    }, {
        path: string;
        reason: string;
    }>, "many">>;
    questions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        question: z.ZodString;
        context: z.ZodOptional<z.ZodString>;
        relevantFiles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        ccAnswer: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        question: string;
        context?: string | undefined;
        relevantFiles?: string[] | undefined;
        ccAnswer?: string | undefined;
    }, {
        question: string;
        context?: string | undefined;
        relevantFiles?: string[] | undefined;
        ccAnswer?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    mustReview?: {
        path: string;
        reason: string;
        specificConcerns?: string[] | undefined;
    }[] | undefined;
    shouldReview?: {
        path: string;
        reason: string;
    }[] | undefined;
    mayReview?: string[] | undefined;
    skipReview?: {
        path: string;
        reason: string;
    }[] | undefined;
    questions?: {
        question: string;
        context?: string | undefined;
        relevantFiles?: string[] | undefined;
        ccAnswer?: string | undefined;
    }[] | undefined;
}, {
    mustReview?: {
        path: string;
        reason: string;
        specificConcerns?: string[] | undefined;
    }[] | undefined;
    shouldReview?: {
        path: string;
        reason: string;
    }[] | undefined;
    mayReview?: string[] | undefined;
    skipReview?: {
        path: string;
        reason: string;
    }[] | undefined;
    questions?: {
        question: string;
        context?: string | undefined;
        relevantFiles?: string[] | undefined;
        ccAnswer?: string | undefined;
    }[] | undefined;
}>;
export type ReviewScope = z.infer<typeof ReviewScopeSchema>;
/**
 * Complete context for a review request.
 * This is what should be passed from CC to reviewers.
 */
export declare const ReviewContextSchema: z.ZodObject<{
    timestamp: z.ZodOptional<z.ZodString>;
    workingDir: z.ZodString;
    changes: z.ZodObject<{
        files: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            language: z.ZodOptional<z.ZodString>;
            changeType: z.ZodEnum<["created", "modified", "deleted", "renamed"]>;
            diff: z.ZodOptional<z.ZodString>;
            linesAdded: z.ZodOptional<z.ZodNumber>;
            linesRemoved: z.ZodOptional<z.ZodNumber>;
            content: z.ZodOptional<z.ZodString>;
            changedSymbols: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                type: z.ZodEnum<["function", "class", "variable", "type", "import", "export", "other"]>;
                lineStart: z.ZodOptional<z.ZodNumber>;
                lineEnd: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                type: "function" | "type" | "other" | "class" | "variable" | "import" | "export";
                name: string;
                lineStart?: number | undefined;
                lineEnd?: number | undefined;
            }, {
                type: "function" | "type" | "other" | "class" | "variable" | "import" | "export";
                name: string;
                lineStart?: number | undefined;
                lineEnd?: number | undefined;
            }>, "many">>;
            imports: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            importedBy: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            testFile: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            path: string;
            changeType: "created" | "modified" | "deleted" | "renamed";
            language?: string | undefined;
            diff?: string | undefined;
            linesAdded?: number | undefined;
            linesRemoved?: number | undefined;
            content?: string | undefined;
            changedSymbols?: {
                type: "function" | "type" | "other" | "class" | "variable" | "import" | "export";
                name: string;
                lineStart?: number | undefined;
                lineEnd?: number | undefined;
            }[] | undefined;
            imports?: string[] | undefined;
            importedBy?: string[] | undefined;
            testFile?: string | undefined;
        }, {
            path: string;
            changeType: "created" | "modified" | "deleted" | "renamed";
            language?: string | undefined;
            diff?: string | undefined;
            linesAdded?: number | undefined;
            linesRemoved?: number | undefined;
            content?: string | undefined;
            changedSymbols?: {
                type: "function" | "type" | "other" | "class" | "variable" | "import" | "export";
                name: string;
                lineStart?: number | undefined;
                lineEnd?: number | undefined;
            }[] | undefined;
            imports?: string[] | undefined;
            importedBy?: string[] | undefined;
            testFile?: string | undefined;
        }>, "many">;
        totalLinesAdded: z.ZodOptional<z.ZodNumber>;
        totalLinesRemoved: z.ZodOptional<z.ZodNumber>;
        impactedModules: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        files: {
            path: string;
            changeType: "created" | "modified" | "deleted" | "renamed";
            language?: string | undefined;
            diff?: string | undefined;
            linesAdded?: number | undefined;
            linesRemoved?: number | undefined;
            content?: string | undefined;
            changedSymbols?: {
                type: "function" | "type" | "other" | "class" | "variable" | "import" | "export";
                name: string;
                lineStart?: number | undefined;
                lineEnd?: number | undefined;
            }[] | undefined;
            imports?: string[] | undefined;
            importedBy?: string[] | undefined;
            testFile?: string | undefined;
        }[];
        totalLinesAdded?: number | undefined;
        totalLinesRemoved?: number | undefined;
        impactedModules?: string[] | undefined;
    }, {
        files: {
            path: string;
            changeType: "created" | "modified" | "deleted" | "renamed";
            language?: string | undefined;
            diff?: string | undefined;
            linesAdded?: number | undefined;
            linesRemoved?: number | undefined;
            content?: string | undefined;
            changedSymbols?: {
                type: "function" | "type" | "other" | "class" | "variable" | "import" | "export";
                name: string;
                lineStart?: number | undefined;
                lineEnd?: number | undefined;
            }[] | undefined;
            imports?: string[] | undefined;
            importedBy?: string[] | undefined;
            testFile?: string | undefined;
        }[];
        totalLinesAdded?: number | undefined;
        totalLinesRemoved?: number | undefined;
        impactedModules?: string[] | undefined;
    }>;
    analysis: z.ZodObject<{
        originalRequest: z.ZodString;
        taskType: z.ZodOptional<z.ZodEnum<["feature", "bugfix", "refactor", "security-fix", "performance", "review", "other"]>>;
        summary: z.ZodString;
        findings: z.ZodOptional<z.ZodArray<z.ZodObject<{
            category: z.ZodString;
            description: z.ZodString;
            location: z.ZodOptional<z.ZodString>;
            confidence: z.ZodOptional<z.ZodNumber>;
            addressed: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            category: string;
            description: string;
            confidence?: number | undefined;
            location?: string | undefined;
            addressed?: boolean | undefined;
        }, {
            category: string;
            description: string;
            confidence?: number | undefined;
            location?: string | undefined;
            addressed?: boolean | undefined;
        }>, "many">>;
        uncertainties: z.ZodOptional<z.ZodArray<z.ZodObject<{
            topic: z.ZodString;
            question: z.ZodString;
            ccBestGuess: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            topic: string;
            question: string;
            ccBestGuess?: string | undefined;
        }, {
            topic: string;
            question: string;
            ccBestGuess?: string | undefined;
        }>, "many">>;
        assumptions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        decisions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            decision: z.ZodString;
            rationale: z.ZodString;
            alternatives: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            decision: string;
            rationale: string;
            alternatives?: string[] | undefined;
        }, {
            decision: string;
            rationale: string;
            alternatives?: string[] | undefined;
        }>, "many">>;
        confidence: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        summary: string;
        originalRequest: string;
        confidence?: number | undefined;
        findings?: {
            category: string;
            description: string;
            confidence?: number | undefined;
            location?: string | undefined;
            addressed?: boolean | undefined;
        }[] | undefined;
        taskType?: "performance" | "other" | "review" | "feature" | "bugfix" | "refactor" | "security-fix" | undefined;
        uncertainties?: {
            topic: string;
            question: string;
            ccBestGuess?: string | undefined;
        }[] | undefined;
        assumptions?: string[] | undefined;
        decisions?: {
            decision: string;
            rationale: string;
            alternatives?: string[] | undefined;
        }[] | undefined;
    }, {
        summary: string;
        originalRequest: string;
        confidence?: number | undefined;
        findings?: {
            category: string;
            description: string;
            confidence?: number | undefined;
            location?: string | undefined;
            addressed?: boolean | undefined;
        }[] | undefined;
        taskType?: "performance" | "other" | "review" | "feature" | "bugfix" | "refactor" | "security-fix" | undefined;
        uncertainties?: {
            topic: string;
            question: string;
            ccBestGuess?: string | undefined;
        }[] | undefined;
        assumptions?: string[] | undefined;
        decisions?: {
            decision: string;
            rationale: string;
            alternatives?: string[] | undefined;
        }[] | undefined;
    }>;
    execution: z.ZodOptional<z.ZodObject<{
        tests: z.ZodOptional<z.ZodObject<{
            ran: z.ZodBoolean;
            passed: z.ZodOptional<z.ZodNumber>;
            failed: z.ZodOptional<z.ZodNumber>;
            skipped: z.ZodOptional<z.ZodNumber>;
            failures: z.ZodOptional<z.ZodArray<z.ZodObject<{
                testName: z.ZodString;
                file: z.ZodOptional<z.ZodString>;
                error: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                testName: string;
                error: string;
                file?: string | undefined;
            }, {
                testName: string;
                error: string;
                file?: string | undefined;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            ran: boolean;
            passed?: number | undefined;
            failed?: number | undefined;
            skipped?: number | undefined;
            failures?: {
                testName: string;
                error: string;
                file?: string | undefined;
            }[] | undefined;
        }, {
            ran: boolean;
            passed?: number | undefined;
            failed?: number | undefined;
            skipped?: number | undefined;
            failures?: {
                testName: string;
                error: string;
                file?: string | undefined;
            }[] | undefined;
        }>>;
        build: z.ZodOptional<z.ZodObject<{
            ran: z.ZodBoolean;
            success: z.ZodOptional<z.ZodBoolean>;
            errors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                file: z.ZodString;
                line: z.ZodOptional<z.ZodNumber>;
                message: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                message: string;
                file: string;
                line?: number | undefined;
            }, {
                message: string;
                file: string;
                line?: number | undefined;
            }>, "many">>;
            warnings: z.ZodOptional<z.ZodArray<z.ZodObject<{
                file: z.ZodString;
                line: z.ZodOptional<z.ZodNumber>;
                message: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                message: string;
                file: string;
                line?: number | undefined;
            }, {
                message: string;
                file: string;
                line?: number | undefined;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            ran: boolean;
            success?: boolean | undefined;
            errors?: {
                message: string;
                file: string;
                line?: number | undefined;
            }[] | undefined;
            warnings?: {
                message: string;
                file: string;
                line?: number | undefined;
            }[] | undefined;
        }, {
            ran: boolean;
            success?: boolean | undefined;
            errors?: {
                message: string;
                file: string;
                line?: number | undefined;
            }[] | undefined;
            warnings?: {
                message: string;
                file: string;
                line?: number | undefined;
            }[] | undefined;
        }>>;
        typeCheck: z.ZodOptional<z.ZodObject<{
            ran: z.ZodBoolean;
            errors: z.ZodOptional<z.ZodArray<z.ZodObject<{
                file: z.ZodString;
                line: z.ZodOptional<z.ZodNumber>;
                message: z.ZodString;
                code: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                message: string;
                file: string;
                code?: string | undefined;
                line?: number | undefined;
            }, {
                message: string;
                file: string;
                code?: string | undefined;
                line?: number | undefined;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            ran: boolean;
            errors?: {
                message: string;
                file: string;
                code?: string | undefined;
                line?: number | undefined;
            }[] | undefined;
        }, {
            ran: boolean;
            errors?: {
                message: string;
                file: string;
                code?: string | undefined;
                line?: number | undefined;
            }[] | undefined;
        }>>;
        lint: z.ZodOptional<z.ZodObject<{
            ran: z.ZodBoolean;
            issues: z.ZodOptional<z.ZodArray<z.ZodObject<{
                file: z.ZodString;
                line: z.ZodOptional<z.ZodNumber>;
                rule: z.ZodOptional<z.ZodString>;
                severity: z.ZodEnum<["error", "warning", "info"]>;
                message: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                message: string;
                file: string;
                severity: "info" | "error" | "warning";
                line?: number | undefined;
                rule?: string | undefined;
            }, {
                message: string;
                file: string;
                severity: "info" | "error" | "warning";
                line?: number | undefined;
                rule?: string | undefined;
            }>, "many">>;
        }, "strip", z.ZodTypeAny, {
            ran: boolean;
            issues?: {
                message: string;
                file: string;
                severity: "info" | "error" | "warning";
                line?: number | undefined;
                rule?: string | undefined;
            }[] | undefined;
        }, {
            ran: boolean;
            issues?: {
                message: string;
                file: string;
                severity: "info" | "error" | "warning";
                line?: number | undefined;
                rule?: string | undefined;
            }[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        tests?: {
            ran: boolean;
            passed?: number | undefined;
            failed?: number | undefined;
            skipped?: number | undefined;
            failures?: {
                testName: string;
                error: string;
                file?: string | undefined;
            }[] | undefined;
        } | undefined;
        build?: {
            ran: boolean;
            success?: boolean | undefined;
            errors?: {
                message: string;
                file: string;
                line?: number | undefined;
            }[] | undefined;
            warnings?: {
                message: string;
                file: string;
                line?: number | undefined;
            }[] | undefined;
        } | undefined;
        typeCheck?: {
            ran: boolean;
            errors?: {
                message: string;
                file: string;
                code?: string | undefined;
                line?: number | undefined;
            }[] | undefined;
        } | undefined;
        lint?: {
            ran: boolean;
            issues?: {
                message: string;
                file: string;
                severity: "info" | "error" | "warning";
                line?: number | undefined;
                rule?: string | undefined;
            }[] | undefined;
        } | undefined;
    }, {
        tests?: {
            ran: boolean;
            passed?: number | undefined;
            failed?: number | undefined;
            skipped?: number | undefined;
            failures?: {
                testName: string;
                error: string;
                file?: string | undefined;
            }[] | undefined;
        } | undefined;
        build?: {
            ran: boolean;
            success?: boolean | undefined;
            errors?: {
                message: string;
                file: string;
                line?: number | undefined;
            }[] | undefined;
            warnings?: {
                message: string;
                file: string;
                line?: number | undefined;
            }[] | undefined;
        } | undefined;
        typeCheck?: {
            ran: boolean;
            errors?: {
                message: string;
                file: string;
                code?: string | undefined;
                line?: number | undefined;
            }[] | undefined;
        } | undefined;
        lint?: {
            ran: boolean;
            issues?: {
                message: string;
                file: string;
                severity: "info" | "error" | "warning";
                line?: number | undefined;
                rule?: string | undefined;
            }[] | undefined;
        } | undefined;
    }>>;
    git: z.ZodOptional<z.ZodObject<{
        branch: z.ZodOptional<z.ZodString>;
        baseBranch: z.ZodOptional<z.ZodString>;
        commits: z.ZodOptional<z.ZodArray<z.ZodObject<{
            hash: z.ZodString;
            message: z.ZodString;
            filesChanged: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            message: string;
            hash: string;
            filesChanged: string[];
        }, {
            message: string;
            hash: string;
            filesChanged: string[];
        }>, "many">>;
        pullRequest: z.ZodOptional<z.ZodObject<{
            title: z.ZodOptional<z.ZodString>;
            description: z.ZodOptional<z.ZodString>;
            targetBranch: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            title?: string | undefined;
            description?: string | undefined;
            targetBranch?: string | undefined;
        }, {
            title?: string | undefined;
            description?: string | undefined;
            targetBranch?: string | undefined;
        }>>;
        uncommittedChanges: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        branch?: string | undefined;
        baseBranch?: string | undefined;
        commits?: {
            message: string;
            hash: string;
            filesChanged: string[];
        }[] | undefined;
        pullRequest?: {
            title?: string | undefined;
            description?: string | undefined;
            targetBranch?: string | undefined;
        } | undefined;
        uncommittedChanges?: boolean | undefined;
    }, {
        branch?: string | undefined;
        baseBranch?: string | undefined;
        commits?: {
            message: string;
            hash: string;
            filesChanged: string[];
        }[] | undefined;
        pullRequest?: {
            title?: string | undefined;
            description?: string | undefined;
            targetBranch?: string | undefined;
        } | undefined;
        uncommittedChanges?: boolean | undefined;
    }>>;
    scope: z.ZodOptional<z.ZodObject<{
        mustReview: z.ZodOptional<z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            reason: z.ZodString;
            specificConcerns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            path: string;
            reason: string;
            specificConcerns?: string[] | undefined;
        }, {
            path: string;
            reason: string;
            specificConcerns?: string[] | undefined;
        }>, "many">>;
        shouldReview: z.ZodOptional<z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            reason: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            path: string;
            reason: string;
        }, {
            path: string;
            reason: string;
        }>, "many">>;
        mayReview: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        skipReview: z.ZodOptional<z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            reason: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            path: string;
            reason: string;
        }, {
            path: string;
            reason: string;
        }>, "many">>;
        questions: z.ZodOptional<z.ZodArray<z.ZodObject<{
            question: z.ZodString;
            context: z.ZodOptional<z.ZodString>;
            relevantFiles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            ccAnswer: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            question: string;
            context?: string | undefined;
            relevantFiles?: string[] | undefined;
            ccAnswer?: string | undefined;
        }, {
            question: string;
            context?: string | undefined;
            relevantFiles?: string[] | undefined;
            ccAnswer?: string | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        mustReview?: {
            path: string;
            reason: string;
            specificConcerns?: string[] | undefined;
        }[] | undefined;
        shouldReview?: {
            path: string;
            reason: string;
        }[] | undefined;
        mayReview?: string[] | undefined;
        skipReview?: {
            path: string;
            reason: string;
        }[] | undefined;
        questions?: {
            question: string;
            context?: string | undefined;
            relevantFiles?: string[] | undefined;
            ccAnswer?: string | undefined;
        }[] | undefined;
    }, {
        mustReview?: {
            path: string;
            reason: string;
            specificConcerns?: string[] | undefined;
        }[] | undefined;
        shouldReview?: {
            path: string;
            reason: string;
        }[] | undefined;
        mayReview?: string[] | undefined;
        skipReview?: {
            path: string;
            reason: string;
        }[] | undefined;
        questions?: {
            question: string;
            context?: string | undefined;
            relevantFiles?: string[] | undefined;
            ccAnswer?: string | undefined;
        }[] | undefined;
    }>>;
    focusAreas: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    customInstructions: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    workingDir: string;
    changes: {
        files: {
            path: string;
            changeType: "created" | "modified" | "deleted" | "renamed";
            language?: string | undefined;
            diff?: string | undefined;
            linesAdded?: number | undefined;
            linesRemoved?: number | undefined;
            content?: string | undefined;
            changedSymbols?: {
                type: "function" | "type" | "other" | "class" | "variable" | "import" | "export";
                name: string;
                lineStart?: number | undefined;
                lineEnd?: number | undefined;
            }[] | undefined;
            imports?: string[] | undefined;
            importedBy?: string[] | undefined;
            testFile?: string | undefined;
        }[];
        totalLinesAdded?: number | undefined;
        totalLinesRemoved?: number | undefined;
        impactedModules?: string[] | undefined;
    };
    analysis: {
        summary: string;
        originalRequest: string;
        confidence?: number | undefined;
        findings?: {
            category: string;
            description: string;
            confidence?: number | undefined;
            location?: string | undefined;
            addressed?: boolean | undefined;
        }[] | undefined;
        taskType?: "performance" | "other" | "review" | "feature" | "bugfix" | "refactor" | "security-fix" | undefined;
        uncertainties?: {
            topic: string;
            question: string;
            ccBestGuess?: string | undefined;
        }[] | undefined;
        assumptions?: string[] | undefined;
        decisions?: {
            decision: string;
            rationale: string;
            alternatives?: string[] | undefined;
        }[] | undefined;
    };
    timestamp?: string | undefined;
    execution?: {
        tests?: {
            ran: boolean;
            passed?: number | undefined;
            failed?: number | undefined;
            skipped?: number | undefined;
            failures?: {
                testName: string;
                error: string;
                file?: string | undefined;
            }[] | undefined;
        } | undefined;
        build?: {
            ran: boolean;
            success?: boolean | undefined;
            errors?: {
                message: string;
                file: string;
                line?: number | undefined;
            }[] | undefined;
            warnings?: {
                message: string;
                file: string;
                line?: number | undefined;
            }[] | undefined;
        } | undefined;
        typeCheck?: {
            ran: boolean;
            errors?: {
                message: string;
                file: string;
                code?: string | undefined;
                line?: number | undefined;
            }[] | undefined;
        } | undefined;
        lint?: {
            ran: boolean;
            issues?: {
                message: string;
                file: string;
                severity: "info" | "error" | "warning";
                line?: number | undefined;
                rule?: string | undefined;
            }[] | undefined;
        } | undefined;
    } | undefined;
    git?: {
        branch?: string | undefined;
        baseBranch?: string | undefined;
        commits?: {
            message: string;
            hash: string;
            filesChanged: string[];
        }[] | undefined;
        pullRequest?: {
            title?: string | undefined;
            description?: string | undefined;
            targetBranch?: string | undefined;
        } | undefined;
        uncommittedChanges?: boolean | undefined;
    } | undefined;
    scope?: {
        mustReview?: {
            path: string;
            reason: string;
            specificConcerns?: string[] | undefined;
        }[] | undefined;
        shouldReview?: {
            path: string;
            reason: string;
        }[] | undefined;
        mayReview?: string[] | undefined;
        skipReview?: {
            path: string;
            reason: string;
        }[] | undefined;
        questions?: {
            question: string;
            context?: string | undefined;
            relevantFiles?: string[] | undefined;
            ccAnswer?: string | undefined;
        }[] | undefined;
    } | undefined;
    focusAreas?: string[] | undefined;
    customInstructions?: string | undefined;
}, {
    workingDir: string;
    changes: {
        files: {
            path: string;
            changeType: "created" | "modified" | "deleted" | "renamed";
            language?: string | undefined;
            diff?: string | undefined;
            linesAdded?: number | undefined;
            linesRemoved?: number | undefined;
            content?: string | undefined;
            changedSymbols?: {
                type: "function" | "type" | "other" | "class" | "variable" | "import" | "export";
                name: string;
                lineStart?: number | undefined;
                lineEnd?: number | undefined;
            }[] | undefined;
            imports?: string[] | undefined;
            importedBy?: string[] | undefined;
            testFile?: string | undefined;
        }[];
        totalLinesAdded?: number | undefined;
        totalLinesRemoved?: number | undefined;
        impactedModules?: string[] | undefined;
    };
    analysis: {
        summary: string;
        originalRequest: string;
        confidence?: number | undefined;
        findings?: {
            category: string;
            description: string;
            confidence?: number | undefined;
            location?: string | undefined;
            addressed?: boolean | undefined;
        }[] | undefined;
        taskType?: "performance" | "other" | "review" | "feature" | "bugfix" | "refactor" | "security-fix" | undefined;
        uncertainties?: {
            topic: string;
            question: string;
            ccBestGuess?: string | undefined;
        }[] | undefined;
        assumptions?: string[] | undefined;
        decisions?: {
            decision: string;
            rationale: string;
            alternatives?: string[] | undefined;
        }[] | undefined;
    };
    timestamp?: string | undefined;
    execution?: {
        tests?: {
            ran: boolean;
            passed?: number | undefined;
            failed?: number | undefined;
            skipped?: number | undefined;
            failures?: {
                testName: string;
                error: string;
                file?: string | undefined;
            }[] | undefined;
        } | undefined;
        build?: {
            ran: boolean;
            success?: boolean | undefined;
            errors?: {
                message: string;
                file: string;
                line?: number | undefined;
            }[] | undefined;
            warnings?: {
                message: string;
                file: string;
                line?: number | undefined;
            }[] | undefined;
        } | undefined;
        typeCheck?: {
            ran: boolean;
            errors?: {
                message: string;
                file: string;
                code?: string | undefined;
                line?: number | undefined;
            }[] | undefined;
        } | undefined;
        lint?: {
            ran: boolean;
            issues?: {
                message: string;
                file: string;
                severity: "info" | "error" | "warning";
                line?: number | undefined;
                rule?: string | undefined;
            }[] | undefined;
        } | undefined;
    } | undefined;
    git?: {
        branch?: string | undefined;
        baseBranch?: string | undefined;
        commits?: {
            message: string;
            hash: string;
            filesChanged: string[];
        }[] | undefined;
        pullRequest?: {
            title?: string | undefined;
            description?: string | undefined;
            targetBranch?: string | undefined;
        } | undefined;
        uncommittedChanges?: boolean | undefined;
    } | undefined;
    scope?: {
        mustReview?: {
            path: string;
            reason: string;
            specificConcerns?: string[] | undefined;
        }[] | undefined;
        shouldReview?: {
            path: string;
            reason: string;
        }[] | undefined;
        mayReview?: string[] | undefined;
        skipReview?: {
            path: string;
            reason: string;
        }[] | undefined;
        questions?: {
            question: string;
            context?: string | undefined;
            relevantFiles?: string[] | undefined;
            ccAnswer?: string | undefined;
        }[] | undefined;
    } | undefined;
    focusAreas?: string[] | undefined;
    customInstructions?: string | undefined;
}>;
export type ReviewContext = z.infer<typeof ReviewContextSchema>;
/**
 * Build a minimal context from legacy inputs
 */
export declare function buildMinimalContext(workingDir: string, ccOutput: string, analyzedFiles?: string[], focusAreas?: string[], customPrompt?: string): ReviewContext;
/**
 * Build context from git diff
 */
export declare function buildContextFromGitDiff(workingDir: string, baseBranch?: string): Promise<Partial<ReviewContext>>;
export interface OptimizationOptions {
    maxTokens: number;
    focusAreas?: string[];
    includeFullContent: boolean;
    includeDiffs: boolean;
}
/**
 * Optimize context to fit within token limits while preserving important info
 */
export declare function optimizeContext(context: ReviewContext, options: OptimizationOptions): ReviewContext;
/**
 * Convert context to a string suitable for inclusion in prompts
 */
export declare function contextToPromptString(context: ReviewContext): string;
/**
 * Data needed to verify reviewer claims
 */
export interface VerificationData {
    existingFiles: Set<string>;
    fileContents: Map<string, string>;
    fileLineCounts: Map<string, number>;
}
/**
 * Check if a file:line reference is valid
 */
export declare function verifyFileLineReference(reference: {
    file: string;
    line?: number;
}, verification: VerificationData): {
    valid: boolean;
    reason?: string;
};
