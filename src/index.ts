#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function debugLog(message: string, error?: any) {
  const timestamp = new Date().toISOString();
  if (error) {
    console.error(`[DEBUG ${timestamp}] ${message}`, error);
    if (error.stack) {
      console.error(`[DEBUG ${timestamp}] Stack trace:`, error.stack);
    }
  } else {
    console.error(`[DEBUG ${timestamp}] ${message}`);
  }
}

interface ServerOptions {
  model?: string;
  maxTokens?: number;
}

function parseArguments(): ServerOptions {
  const options: ServerOptions = {};
  
  debugLog('Parsing command line arguments:', process.argv);
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--model' && i + 1 < process.argv.length) {
      options.model = process.argv[++i];
    } else if (arg === '--max-tokens' && i + 1 < process.argv.length) {
      const tokens = parseInt(process.argv[++i]);
      if (!isNaN(tokens)) {
        options.maxTokens = tokens;
      }
    }
  }
  
  return options;
}

async function main() {
  try {
    debugLog('Starting Expert MCP Server...');
    debugLog(`Current directory: ${process.cwd()}`);
    debugLog(`Script directory: ${__dirname}`);
    
    const options = parseArguments();
    if (options.model) {
      debugLog(`Using model: ${options.model}`);
    }
    if (options.maxTokens) {
      debugLog(`Max tokens: ${options.maxTokens}`);
    }
    
    const docsDir = join(__dirname, '../docs');
    const promptsDir = join(__dirname, '../prompts');
    
    debugLog(`Docs directory: ${docsDir}`);
    debugLog(`Prompts directory: ${promptsDir}`);
    
    const server = await createServer({
      ...options,
      docsDir,
      promptsDir
    });
    
    debugLog('Server created, initializing transport...');
    const transport = new StdioServerTransport();
    
    debugLog('Connecting to transport...');
    await server.connect(transport);
    debugLog("Expert MCP Server running on stdio");
  } catch (error) {
    debugLog("Fatal error:", error);
    process.exit(1);
  }
}

// Handle promise rejections
process.on('unhandledRejection', (error) => {
  debugLog('Unhandled promise rejection:', error);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  debugLog('Uncaught exception:', error);
  process.exit(1);
});

// Log when process exits
process.on('exit', (code) => {
  debugLog(`Process exiting with code: ${code}`);
});

main().catch((error) => {
  debugLog("Unhandled error:", error);
  process.exit(1);
});
