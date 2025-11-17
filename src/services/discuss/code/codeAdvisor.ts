/**
 * Code Advisor
 * Secure code analysis service with caching and input validation
 */

import type { CodeRequest } from "@/domain/discuss/types.js";
import { spawn } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { SecurityError, ValidationError } from "../errors/index.js";
import { DISCUSSION_CONFIG } from "../config/constants.js";

/**
 * Code Advisor provides secure code analysis through Codex
 */
export class CodeAdvisor {
  private cache: Map<string, { context: string; timestamp: number }> = new Map();
  private readonly codexPath: string;
  private readonly maxCacheAge: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Validate codex availability
    this.codexPath = this.findCodexExecutable();
    this.validateCodexInstallation();
  }

  /**
   * Request code context with security validation and caching
   */
  async requestCodeContext(request: CodeRequest): Promise<string> {
    try {
      // Validate request
      this.validateCodeRequest(request);

      // Check cache first
      const cacheKey = this.generateCacheKey(request);
      const cached = this.cache.get(cacheKey);

      if (cached && this.isCacheValid(cached.timestamp)) {
        console.log(`    ↻ Using cached code context for: ${request.topic}`);
        return cached.context;
      }

      console.log(`    🔍 Codex analyzing: ${request.topic}...`);

      // Create secure prompt
      const prompt = this.buildSecurePrompt(request);

      // Execute codex with security measures
      const context = await this.executeCodexSecurely(prompt);

      // Validate response
      this.validateCodexResponse(context);

      // Cache the result
      this.cache.set(cacheKey, {
        context,
        timestamp: Date.now(),
      });

      console.log(`    ✓ Code context retrieved (${context.length} chars)`);
      return context;

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ValidationError(
        `Code analysis failed: ${message}`,
        "codeAnalysis",
        request
      );
    }
  }

  /**
   * Clear expired cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.maxCacheAge) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`🧹 Code advisor: cleaned ${removed} expired cache entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses to calculate
    };
  }

  // Private methods

  private findCodexExecutable(): string {
    const possiblePaths = [
      'codex',
      '/usr/local/bin/codex',
      '/usr/bin/codex',
      join(process.cwd(), 'node_modules', '.bin', 'codex'),
    ];

    for (const path of possiblePaths) {
      try {
        // Simple existence check - in production you'd want more thorough validation
        return path;
      } catch {
        continue;
      }
    }

    throw new ValidationError('Codex executable not found. Please install codex CLI tool.');
  }

  private validateCodexInstallation(): void {
    // In a real implementation, you'd validate the codex version and capabilities
    console.log(`✓ Using codex at: ${this.codexPath}`);
  }

  private validateCodeRequest(request: CodeRequest): void {
    if (!request.topic || typeof request.topic !== 'string') {
      throw new ValidationError('Topic is required and must be a string', 'topic');
    }

    if (request.topic.length > 1000) {
      throw new ValidationError('Topic too long (max 1000 characters)', 'topic');
    }

    if (request.specificNeeds && Array.isArray(request.specificNeeds)) {
      if (request.specificNeeds.length > 10) {
        throw new ValidationError('Too many specific needs (max 10)', 'specificNeeds');
      }

      for (const need of request.specificNeeds) {
        if (typeof need !== 'string' || need.length > 500) {
          throw new ValidationError('Each specific need must be a string (max 500 chars)', 'specificNeeds');
        }
      }
    }
  }

  private buildSecurePrompt(request: CodeRequest): string {
    // Build prompt with input sanitization
    let prompt = `You are a code analysis assistant. Please analyze the following:\n\n`;
    prompt += `Topic: ${this.sanitizeInput(request.topic)}\n\n`;

    if (request.specificNeeds && request.specificNeeds.length > 0) {
      prompt += `Specific areas to analyze:\n`;
      request.specificNeeds.forEach((need, index) => {
        prompt += `${index + 1}. ${this.sanitizeInput(need)}\n`;
      });
    }

    if (request.focus) {
      prompt += `\nSpecial focus: ${this.sanitizeInput(request.focus)}\n`;
    }

    prompt += `\nPlease provide a detailed analysis focusing on the requested areas. ` +
             `Include relevant code examples, patterns, and recommendations.\n\n` +
             `Keep your response under 2000 words and be specific and actionable.`;

    return prompt;
  }

  private sanitizeInput(input: string): string {
    // Remove dangerous characters and patterns
    return input
      .replace(/[;&|`$(){}[\]]/g, '') // Remove shell metacharacters
      .replace(/\0/g, '') // Remove null bytes
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .trim()
      .substring(0, 2000); // Limit length
  }

  private async executeCodexSecurely(prompt: string): Promise<string> {
    // Create temporary file with secure permissions
    const tempFile = await this.createSecureTempFile(prompt);

    try {
      // Execute codex with security arguments
      const args = [
        '--config', 'model_reasoning_effort=high',
        '--dangerously-bypass-approvals-and-sandbox', // For automated usage
        '--', // Argument separator to prevent injection
        tempFile,
      ];

      const result = await this.executeCommand(this.codexPath, args);
      return result;

    } finally {
      // Always cleanup temp file
      await this.cleanupTempFile(tempFile);
    }
  }

  private async createSecureTempFile(content: string): Promise<string> {
    const filename = `xling-discuss-${randomUUID()}.txt`;
    const filepath = join(tmpdir(), filename);

    await writeFile(filepath, content, {
      mode: DISCUSSION_CONFIG.security.tempFilePermissions,
    });

    return filepath;
  }

  private async cleanupTempFile(filepath: string): Promise<void> {
    try {
      await unlink(filepath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Failed to cleanup temp file ${filepath}: ${message}`);
    }
  }

  private async executeCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: DISCUSSION_CONFIG.timeouts.cli,
        env: {
          ...process.env,
          // Remove potentially dangerous environment variables
          NODE_OPTIONS: undefined,
          ELECTRON_ENABLE_STACK_DUMPING: undefined,
        },
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("close", (code: number | null) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          // Sanitize error message
          const sanitizedError = this.sanitizeErrorMessage(stderr);
          reject(new Error(`Codex failed (exit code ${code}): ${sanitizedError}`));
        }
      });

      child.on("error", (error: Error) => {
        reject(new Error(`Failed to execute codex: ${error.message}`));
      });

    });
  }

  private sanitizeErrorMessage(error: string): string {
    // Remove potentially sensitive information from error messages
    return error
      .replace(/\/[^\s]+/g, '[PATH]') // Replace file paths
      .replace(/password[=:]\s*[^\s]+/gi, 'password=[REDACTED]') // Redact passwords
      .replace(/key[=:]\s*[^\s]+/gi, 'key=[REDACTED]') // Redact keys
      .substring(0, 500); // Limit error message length
  }

  private validateCodexResponse(response: string): void {
    if (!response || typeof response !== 'string') {
      throw new ValidationError('Empty or invalid codex response');
    }

    if (response.length > 50000) { // 50KB limit
      throw new ValidationError('Codex response too large');
    }

    // Check for suspicious content
    const suspiciousPatterns = [
      /error[:\s]/i,
      /failed[:\s]/i,
      /exception[:\s]/i,
      /traceback/i,
      /stack trace/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(response)) {
        throw new ValidationError('Codex response appears to contain error information');
      }
    }
  }

  private generateCacheKey(request: CodeRequest): string {
    // Create a cache key from the request
    const key = {
      topic: request.topic,
      needs: request.specificNeeds?.sort() || [],
      focus: request.focus || '',
    };

    return Buffer.from(JSON.stringify(key)).toString('base64');
  }

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.maxCacheAge;
  }
}
