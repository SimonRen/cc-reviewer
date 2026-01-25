/**
 * Shared module for slash command installation
 *
 * Used by both:
 * - setup.ts (manual CLI tool: npx cc-reviewer-setup)
 * - index.ts (auto-install on MCP server startup)
 */
export interface InstallResult {
    success: boolean;
    installed: string[];
    error?: string;
}
/**
 * Get source and target paths for command files
 */
export declare function getCommandPaths(): {
    source: string;
    target: string;
};
/**
 * Install slash commands to ~/.claude/commands/
 *
 * @returns Result object with success status and installed commands
 */
export declare function installCommands(): InstallResult;
