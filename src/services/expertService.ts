import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

config();

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!CLAUDE_API_KEY) {
  console.error('Error: The ANTHROPIC_API_KEY environment variable is missing or not set.');
  throw new Error('ANTHROPIC_API_KEY environment variable is required for the Expert Service to function.');
}

/**
 * Interface for Claude message content
 */
interface ClaudeContent {
  type: 'text' | 'image';
  text?: string;
  source?: {
    type: 'base64' | 'url';
    media_type: string;
    data: string;
  };
}

/**
 * Interface for Claude message
 */
interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | Array<ClaudeContent>;
}

/**
 * Interface for Claude API response
 */
interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: Array<ClaudeContent>;
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence';
  stop_sequence?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Configuration options for ExpertService
 */
interface ExpertServiceConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  docsDir?: string;
  promptsDir?: string;
}

// Add a debug logging function that only writes to stderr
function debugLog(message: string) {
  console.error(`[DEBUG] ${message}`);
}

/**
 * Service for handling documentation queries and generation using Claude
 */
export class ExpertService {
  private anthropic: Anthropic;
  private documentation: Map<string, string>;
  private systemPrompt: string;
  private toolMetadata: string = '';
  private queryMetadata: string = '';
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly docsDir: string;
  private readonly promptsDir: string;
  private serviceDescription: string = '';

  /**
   * Creates a new instance of ExpertService
   * @param config - Optional configuration parameters
   */
  constructor(config?: ExpertServiceConfig) {
    this.anthropic = new Anthropic({
      apiKey: config?.apiKey || CLAUDE_API_KEY,
    });
    this.documentation = new Map();
    this.model = config?.model || 'claude-3-sonnet-20240229';
    this.maxTokens = config?.maxTokens || 1500;
    this.docsDir = config?.docsDir || join(process.cwd(), 'docs');
    this.promptsDir = config?.promptsDir || join(process.cwd(), 'prompts');
    
    // Load documentation, system prompt, and metadata
    this.loadDocumentation();
    this.systemPrompt = this.loadSystemPrompt();
    this.toolMetadata = this.loadToolMetadata();
    this.queryMetadata = this.loadQueryMetadata();
    
    // Validate initialization
    if (!this.systemPrompt) {
      debugLog('Warning: System prompt could not be loaded. Service may not function as expected.');
    }
    if (this.documentation.size === 0) {
      debugLog('Warning: No documentation files were loaded. Service may not function as expected.');
    }
  }

  /**
   * Loads the system prompt from file
   * @returns The system prompt string or empty string if not found
   */
  private loadSystemPrompt(): string {
    const promptPath = join(this.promptsDir, 'system-prompt.txt');
    try {
      return readFileSync(promptPath, 'utf-8');
    } catch (error) {
      debugLog(`Failed to load system prompt from ${promptPath}: ${error}`);
      return '';
    }
  }

  /**
   * Loads all documentation files from the docs directory
   */
  private loadDocumentation(): void {
    try {
      const files = readdirSync(this.docsDir)
        .filter(file => {
          // Filter out system files and non-text files
          return !file.startsWith('.') && 
                 (file.endsWith('.txt') || file.endsWith('.md') || file.endsWith('.json'));
        });

      if (files.length === 0) {
        debugLog(`No valid documentation files found in ${this.docsDir}`);
        return;
      }

      for (const file of files) {
        try {
          const filePath = join(this.docsDir, file);
          const content = readFileSync(filePath, 'utf-8');
          this.documentation.set(file, content);
          debugLog(`Successfully loaded documentation from ${file}`);
        } catch (error) {
          debugLog(`Failed to load documentation file ${file}: ${error}`);
        }
      }
    } catch (error) {
      debugLog(`Failed to read docs directory ${this.docsDir}: ${error}`);
    }
  }

  /**
   * Loads tool description metadata from file
   */
  private loadToolMetadata(): string {
    const metadataPath = join(this.promptsDir, 'tool-metadata.txt');
    try {
      const metadata = readFileSync(metadataPath, 'utf-8');
      debugLog('Successfully loaded tool metadata file');
      return metadata;
    } catch (error) {
      debugLog('No tool metadata file found - this is optional and can be added to provide additional context for tool descriptions');
      return '';
    }
  }

  /**
   * Loads query context metadata from file
   */
  private loadQueryMetadata(): string {
    const metadataPath = join(this.promptsDir, 'query-metadata.txt');
    try {
      const metadata = readFileSync(metadataPath, 'utf-8');
      debugLog('Successfully loaded query metadata file');
      return metadata;
    } catch (error) {
      debugLog('No query metadata file found - this is optional and can be added to provide additional context for queries');
      return '';
    }
  }

  /**
   * Combines all loaded documentation into a single string
   * @returns Combined documentation string
   */
  getAllDocumentation(): string {
    if (this.documentation.size === 0) {
      debugLog('No documentation files are currently loaded');
      return '';
    }
    return Array.from(this.documentation.values()).join('\n\n');
  }

  /**
   * Validates and extracts text content from Claude's response
   * @param response - The response from Claude
   * @param context - Context for error messages
   * @returns The extracted text or an error message
   */
  private validateClaudeResponse(response: ClaudeResponse, context: string): string {
    if (!response?.content?.length) {
      debugLog(`Empty response from Claude for ${context}`);
      return `Error: Unable to process ${context}`;
    }

    const content = response.content[0];
    if (content.type !== 'text' || !content.text) {
      debugLog(`Unexpected response type from Claude for ${context}`);
      return `Error: Unable to process ${context}`;
    }

    return content.text;
  }

  private async callClaude(params: Parameters<typeof this.anthropic.messages.create>[0], context: string): Promise<ClaudeResponse> {
    const timeout = 30000; // 30 seconds timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Request timed out after ${timeout}ms`)), timeout);
    });

    try {
      debugLog(`Making API request to Claude for ${context}...`);
      const response = await Promise.race([
        this.anthropic.messages.create(params),
        timeoutPromise
      ]);
      debugLog('Received response from Claude');
      return response as ClaudeResponse;
    } catch (error) {
      if (error instanceof Error && error.message.includes('timed out')) {
        debugLog(`Claude API request timed out for ${context}`);
      } else {
        debugLog(`Claude API request failed for ${context}: ${error}`);
      }
      throw error;
    }
  }

  /**
   * Generates a query based on natural language request
   * @param request - The natural language request
   * @returns Generated query or error message
   */
  async generateQuery(request: string): Promise<string> {
    const startTime = Date.now();
    debugLog(`Starting query generation for: "${request}"`);
    
    try {
      const message = await this.callClaude({
        model: this.model,
        max_tokens: this.maxTokens,
        system: this.systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Given this API documentation:
          
${this.getAllDocumentation()}

${this.queryMetadata ? `Additional Query Context:\n${this.queryMetadata}\n\n` : ''}

Generate a query for this request: "${request}"

Please return ONLY the query, with no additional explanation or context.`
          }
        ]
      }, `query request: "${request}"`);

      const response = this.validateClaudeResponse(message, `query request: "${request}"`);
      const duration = Date.now() - startTime;
      debugLog(`Query generation completed in ${duration}ms`);
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      debugLog(`Query generation failed after ${duration}ms: ${error}`);
      return `Error: Unable to generate query for request: "${request}"`;
    }
  }

  /**
   * Gets information from documentation based on a question
   * @param request - The documentation question
   * @returns Response from documentation or error message
   */
  async getDocumentationResponse(request: string): Promise<string> {
    const startTime = Date.now();
    debugLog(`Starting documentation request for: "${request}"`);
    
    try {
      const message = await this.callClaude({
        model: this.model,
        max_tokens: this.maxTokens,
        system: this.systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Given this API documentation:
          
${this.getAllDocumentation()}

${this.queryMetadata ? `Additional Context:\n${this.queryMetadata}\n\n` : ''}

Answer this question about the documentation: "${request}"

Please provide a clear, concise response based solely on the provided documentation and context.`
          }
        ]
      }, `documentation request: "${request}"`);

      const response = this.validateClaudeResponse(message, `documentation request: "${request}"`);
      const duration = Date.now() - startTime;
      debugLog(`Documentation request completed in ${duration}ms`);
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      debugLog(`Documentation request failed after ${duration}ms: ${error}`);
      return `Error: Unable to process documentation request: "${request}"`;
    }
  }

  /**
   * Analyzes the documentation to generate a service description
   * @returns A promise that resolves to the service description
   */
  async analyzeDocumentation(): Promise<string> {
    debugLog('Analyzing documentation to generate service description...');
    
    try {
      const docs = this.getAllDocumentation();
      if (!docs) {
        debugLog('No documentation available for analysis');
        return '';
      }

      debugLog(`Analyzing ${this.documentation.size} documentation files...`);
      if (this.toolMetadata) {
        debugLog('Including tool metadata in analysis');
      }
      
      const message = await this.callClaude({
        model: this.model,
        max_tokens: this.maxTokens,
        system: this.systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Analyze this API documentation and provide a concise 1-2 sentence description of what this API/service is about and what it does.

Documentation:
${docs}

${this.toolMetadata ? `Additional Context:\n${this.toolMetadata}` : ''}

Your response should be direct and focused on the core functionality, suitable for use in an API tool description.`
          }
        ]
      }, 'documentation analysis');

      debugLog('Received response from Claude');
      const description = this.validateClaudeResponse(message, 'documentation analysis');
      if (!description.startsWith('Error:')) {
        debugLog('Successfully generated service description: ' + description);
        this.serviceDescription = description;
      } else {
        debugLog('Failed to generate service description: ' + description);
      }
      
      return this.serviceDescription;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debugLog('Error analyzing documentation: ' + errorMessage);
      if (error instanceof Error && error.stack) {
        debugLog('Stack trace: ' + error.stack);
      }
      return '';
    }
  }

  /**
   * Gets the current service description
   * @returns The service description
   */
  getServiceDescription(): string {
    return this.serviceDescription;
  }

  /**
   * Reloads all documentation and metadata files and updates the service description
   * @returns A promise that resolves when the reload is complete
   */
  async reloadDocumentation(): Promise<void> {
    debugLog('Reloading documentation and metadata...');
    
    // Clear existing documentation
    this.documentation.clear();
    
    // Reload all files
    this.loadDocumentation();
    this.systemPrompt = this.loadSystemPrompt();
    this.toolMetadata = this.loadToolMetadata();
    this.queryMetadata = this.loadQueryMetadata();
    
    // Update service description
    debugLog('Updating service description...');
    await this.analyzeDocumentation();
    
    debugLog('Documentation reload complete');
  }

  /**
   * Gets the paths to the documentation and prompts directories
   * @returns Object containing the directory paths
   */
  getDirectoryPaths(): { docsDir: string; promptsDir: string } {
    return {
      docsDir: this.docsDir,
      promptsDir: this.promptsDir
    };
  }
}
