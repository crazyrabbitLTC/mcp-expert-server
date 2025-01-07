# MCP Expert Server

A Model Context Protocol server that provides intelligent query generation and documentation assistance using Claude AI. The server analyzes your API documentation and provides two main tools:

- **create-query**: Generates queries based on natural language requests
- **documentation**: Provides relevant documentation information based on questions

## Prerequisites

- Node.js >= 18
- An Anthropic API key for Claude

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Create a `.env` file with your Anthropic API key:
```
ANTHROPIC_API_KEY=your_api_key_here
```

## Setup

Before running the server, you need to:

1. Add your API documentation files to the `docs` directory (supports `.txt`, `.md`, and `.json` files)

2. Optionally customize the prompts in the `prompts` directory:
   - `system-prompt.txt`: Main system prompt for Claude
   - `tool-metadata.txt`: Additional context for tool descriptions
   - `query-metadata.txt`: Additional context for query generation

3. Run the setup script to analyze documentation and generate service description:
```bash
npm run build
npm run setup
```

## Usage

1. Start the server:
```bash
npm start
```

2. The server exposes two tools via the Model Context Protocol:

   - **create-query**: Generate a query based on natural language request
     ```json
     {
       "name": "create-query",
       "arguments": {
         "request": "Find all users who signed up in the last week"
       }
     }
     ```

   - **documentation**: Get information from the documentation
     ```json
     {
       "name": "documentation",
       "arguments": {
         "request": "How do I authenticate API requests?"
       }
     }
     ```

## Directory Structure

```
.
├── docs/                  # Your API documentation files
├── prompts/              # System prompts and metadata
│   ├── system-prompt.txt    # Main system prompt
│   ├── tool-metadata.txt    # Tool description context
│   ├── query-metadata.txt   # Query generation context
│   └── service-description.txt  # Generated service description
├── src/                  # Source code
│   ├── index.ts            # Entry point
│   ├── server.ts           # MCP server implementation
│   └── services/           # Core services
│       └── expertService.ts  # Claude integration
└── package.json
```

## Development

- Build the project:
```bash
npm run build
```

- The server uses TypeScript and follows a modular architecture
- All Claude interactions are handled by the ExpertService class
- Debug logs are written to stderr with [DEBUG] prefix

## Environment Variables

- `ANTHROPIC_API_KEY`: Your Anthropic API key (required)

## License

MIT
