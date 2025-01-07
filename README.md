# Expert MCP Server

A Model Context Protocol server that provides tools for query generation and documentation assistance using Claude.

## Features

- `create-query`: Generate queries from natural language requests using API documentation
- `documentation`: Get information from API documentation using natural language questions
- File-based documentation system for easy customization
- Configurable system prompt

## Prerequisites

- Node.js >= 18
- An Anthropic API key for Claude

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```
3. Copy `.env.example` to `.env` and configure your environment variables:
```bash
cp .env.example .env
```
4. Add your Anthropic API key to `.env`

## Documentation Setup

1. Place your documentation files in the `docs` directory
2. List the documentation files in `docs.txt`, one file per line. For example:
```
api.txt
endpoints.txt
authentication.txt
```
3. Customize the system prompt in `prompts/system-prompt.txt`

## Building

```bash
npm run build
```

## Running

```bash
npm start
```

## Usage with Claude for Desktop

Add this configuration to your Claude for Desktop config file:

```json
{
  "mcpServers": {
    "expert": {
      "command": "node",
      "args": ["path/to/expert-server/build/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Available Tools

### create-query

Generates a query based on a natural language request using the provided API documentation.

Example:
```
"Get all users who signed up in the last week"
```

### documentation

Answers questions about the API documentation using natural language.

Example:
```
"What authentication methods are supported?"
```

## File Structure

```
/
├── docs/                  # Documentation files
│   ├── api.txt           # API documentation
│   ├── endpoints.txt     # Endpoint documentation
│   └── ...              # Other documentation files
├── prompts/
│   └── system-prompt.txt # System prompt for Claude
├── docs.txt             # List of documentation files to load
└── ...                  # Other project files
```

## License

MIT
