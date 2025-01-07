import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ExpertService } from "./services/expertService.js";
import { z } from "zod";
import { existsSync } from 'fs';
import { join } from 'path';

function debugLog(message: string) {
  console.error(`[DEBUG] ${message}`);
}

// Validate required directories exist
const baseDir = process.cwd();
const requiredDirs = ['docs', 'prompts'].map(dir => join(baseDir, dir));
const missingDirs = requiredDirs.filter(dir => !existsSync(dir));

if (missingDirs.length > 0) {
  throw new Error(`Required directories are missing. Please run 'npm run setup' first.\nMissing directories: ${missingDirs.join(', ')}`);
}

// Validate required files exist
const requiredFiles = [
  join(baseDir, 'prompts', 'system-prompt.txt'),
  join(baseDir, 'prompts', 'tool-metadata.txt'),
  join(baseDir, 'prompts', 'query-metadata.txt'),
  join(baseDir, 'prompts', 'service-description.txt')
];

const missingFiles = requiredFiles.filter(file => !existsSync(file));

if (missingFiles.length > 0) {
  throw new Error(`Required files are missing. Please run 'npm run setup' first.\nMissing files: ${missingFiles.join(', ')}`);
}

const QueryArgumentsSchema = z.object({
  request: z.string().min(1, 'Request cannot be empty'),
});

const DocumentationArgumentsSchema = z.object({
  request: z.string().min(1, 'Request cannot be empty'),
});

interface ServerConfig {
  model?: string;
  maxTokens?: number;
  docsDir?: string;
  promptsDir?: string;
}

export async function createServer(config?: ServerConfig) {
  const expertService = new ExpertService({
    model: config?.model,
    maxTokens: config?.maxTokens,
    docsDir: config?.docsDir,
    promptsDir: config?.promptsDir,
  });

  const server = new Server(
    {
      name: "expert-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Initialize service description if not already done
    if (!expertService.getServiceDescription()) {
      debugLog('Initializing service description...');
      await expertService.analyzeDocumentation();
    }

    const baseDescription = expertService.getServiceDescription();
    const toolDescription = baseDescription ? 
      ` for ${baseDescription.toLowerCase()}` : 
      ' using the API documentation';

    return {
      tools: [
        {
          name: "create-query",
          description: `Generate a query${toolDescription}`,
          inputSchema: {
            type: "object",
            properties: {
              request: {
                type: "string",
                description: "Natural language request for the query you want to generate",
              },
            },
            required: ["request"],
          },
        },
        {
          name: "documentation",
          description: `Get information about${toolDescription}`,
          inputSchema: {
            type: "object",
            properties: {
              request: {
                type: "string",
                description: "Natural language question about the API documentation",
              },
            },
            required: ["request"],
          },
        },
      ],
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const startTime = Date.now();
    const { name, arguments: args } = request.params;
    debugLog(`Received ${name} request with arguments: ${JSON.stringify(args)}`);

    try {
      if (name === "create-query") {
        const { request: queryRequest } = QueryArgumentsSchema.parse(args);
        const query = await expertService.generateQuery(queryRequest);
        
        if (query.startsWith('Error:')) {
          debugLog(`Query generation failed: ${query}`);
        }
        
        const response = {
          content: [
            {
              type: "text",
              text: query,
            },
          ],
        };
        
        const duration = Date.now() - startTime;
        debugLog(`Request completed in ${duration}ms with response: ${JSON.stringify(response)}`);
        return response;
      } else if (name === "documentation") {
        const { request: docRequest } = DocumentationArgumentsSchema.parse(args);
        const response = await expertService.getDocumentationResponse(docRequest);
        
        if (response.startsWith('Error:')) {
          debugLog(`Documentation request failed: ${response}`);
        }
        
        const result = {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
        
        const duration = Date.now() - startTime;
        debugLog(`Request completed in ${duration}ms with response: ${JSON.stringify(result)}`);
        return result;
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      debugLog(`Request failed after ${duration}ms: ${error}`);
      
      if (error instanceof z.ZodError) {
        const message = `Invalid arguments: ${error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join(", ")}`;
        debugLog(message);
        throw new Error(message);
      }
      
      throw error;
    }
  });

  return server;
}
