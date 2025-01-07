#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

function debugLog(message: string) {
  console.error(`[DEBUG] ${message}`);
}

interface ServerOptions {
  model?: string;
  maxTokens?: number;
}

function parseArguments(): ServerOptions {
  const options: ServerOptions = {};
  
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
    
    const options = parseArguments();
    if (options.model) {
      debugLog(`Using model: ${options.model}`);
    }
    if (options.maxTokens) {
      debugLog(`Max tokens: ${options.maxTokens}`);
    }
    
    const server = await createServer(options);
    const transport = new StdioServerTransport();
    
    await server.connect(transport);
    debugLog("Expert MCP Server running on stdio");
  } catch (error) {
    debugLog("Fatal error: " + error);
    process.exit(1);
  }
}

process.on('unhandledRejection', (error) => {
  debugLog('Unhandled promise rejection: ' + error);
  process.exit(1);
});

main().catch((error) => {
  debugLog("Unhandled error: " + error);
  process.exit(1);
});
