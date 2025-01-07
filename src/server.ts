import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { ExpertService } from "./services/expertService.js";
import { z } from "zod";
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

function debugLog(message: string) {
  console.error(`[DEBUG] ${message}`);
}

// Create required directories if they don't exist
const dirs = ['docs', 'prompts'].map(dir => join(process.cwd(), dir));
for (const dir of dirs) {
  if (!existsSync(dir)) {
    debugLog(`Creating directory: ${dir}`);
    mkdirSync(dir);
  }
}

// Create required files if they don't exist
const files = [
  {
    path: join(process.cwd(), 'prompts', 'system-prompt.txt'),
    content: 'You are an expert at analyzing documentation and generating accurate queries and responses based on the provided documentation and context. When asked to generate a query, return ONLY the query with no additional explanation. When asked about documentation, provide clear, concise responses that take into account both the documentation and any additional context provided. Always ensure your responses align with the intended use cases and audience specified in the context.'
  },
  {
    path: join(process.cwd(), 'prompts', 'tool-metadata.txt'),
    content: `# Additional context about the API/Service for tool descriptions
# Add information that helps describe what this service is and how it should be used
# For example:
# - The intended audience (e.g., "This API is designed for enterprise developers")
# - Primary use cases (e.g., "Commonly used in IoT deployments")
# - Service category (e.g., "Part of our data processing suite")
# - Integration points (e.g., "Core component of our ML pipeline")

# Remove these example comments and add your tool description metadata here`
  },
  {
    path: join(process.cwd(), 'prompts', 'query-metadata.txt'),
    content: `# Additional context for query generation and documentation responses
# Add information that helps generate better queries and documentation responses
# For example:
# - Authentication requirements (e.g., "All queries require Bearer token")
# - Common query patterns (e.g., "Queries should include pagination parameters")
# - Rate limiting details (e.g., "Max 100 requests per minute")
# - Required headers (e.g., "Content-Type must be application/json")
# - Response formats (e.g., "All responses are in JSON format")
# - Error handling (e.g., "Include error handling for 429 rate limit responses")

# Remove these example comments and add your query metadata here`
  }
];

for (const file of files) {
  if (!existsSync(file.path)) {
    debugLog(`Creating file: ${file.path}`);
    writeFileSync(file.path, file.content, 'utf-8');
  }
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
}

export async function createServer(config?: ServerConfig) {
  const expertService = new ExpertService({
    model: config?.model,
    maxTokens: config?.maxTokens,
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
