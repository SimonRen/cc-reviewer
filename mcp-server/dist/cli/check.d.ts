/**
 * CLI Availability Checker
 */
import { CliStatus, CliType } from '../types.js';
/**
 * Check availability of all supported CLIs
 */
export declare function checkCliAvailability(): Promise<CliStatus>;
/**
 * Check if a specific CLI is available
 */
export declare function isCliAvailable(cli: CliType): Promise<boolean>;
/**
 * Get CLI version (for debugging)
 */
export declare function getCliVersion(cli: CliType): Promise<string | null>;
/**
 * Log CLI availability status (for startup debugging)
 */
export declare function logCliStatus(): Promise<void>;
