#!/usr/bin/env node
import { ExpertService } from './services/expertService.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

async function setup() {
  console.log('Starting setup...');
  const baseDir = process.cwd();
  
  try {
    // Create required directories
    const dirs = ['docs', 'prompts'];
    for (const dir of dirs) {
      const dirPath = join(baseDir, dir);
      if (!existsSync(dirPath)) {
        console.log(`Creating directory: ${dirPath}`);
        mkdirSync(dirPath);
      }
    }

    // Create required files with default content
    const files = [
      {
        path: join(baseDir, 'prompts', 'system-prompt.txt'),
        content: 'You are an API expert and expert at analyzing documentation and generating accurate queries and responses based on the provided documentation and context. When asked to generate a query, return ONLY the query with no additional explanation. When asked about documentation, provide clear, concise responses that take into account both the documentation and any additional context provided. Always ensure your responses align with the intended use cases and audience specified in the context.'
      },
      {
        path: join(baseDir, 'prompts', 'tool-metadata.txt'),
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
        path: join(baseDir, 'prompts', 'query-metadata.txt'),
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
        console.log(`Creating file: ${file.path}`);
        writeFileSync(file.path, file.content, 'utf-8');
      }
    }

    // Initialize ExpertService and generate service description
    console.log('Initializing ExpertService...');
    const expertService = new ExpertService();
    
    console.log('Analyzing documentation...');
    const description = await expertService.analyzeDocumentation();
    if (!description) {
      throw new Error('Failed to generate service description');
    }
    
    // Save the description to a file
    const descriptionPath = join(baseDir, 'prompts', 'service-description.txt');
    console.log(`Saving service description to: ${descriptionPath}`);
    writeFileSync(descriptionPath, description, 'utf-8');
    
    console.log('\nSetup complete! The following files have been created:');
    console.log('- docs/          (directory for your API documentation)');
    console.log('- prompts/       (directory for system prompts and metadata)');
    [...files, { path: descriptionPath }].forEach(file => {
      console.log(`- ${file.path.replace(baseDir + '/', '')}`);
    });
    
    console.log('\nService description:', description);
    console.log('\nNext steps:');
    console.log('1. Add your API documentation files to the docs/ directory');
    console.log('2. Customize the prompt files in the prompts/ directory');
    console.log('3. Run the server with: npm start');
    
    process.exit(0);
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

setup(); 