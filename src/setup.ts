#!/usr/bin/env node
import { ExpertService } from './services/expertService.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function setup() {
  console.log('Starting setup...');
  
  try {
    const expertService = new ExpertService();
    console.log('Analyzing documentation...');
    
    const description = await expertService.analyzeDocumentation();
    if (!description) {
      throw new Error('Failed to generate service description');
    }
    
    // Save the description to a file
    const descriptionPath = join(process.cwd(), 'prompts', 'service-description.txt');
    writeFileSync(descriptionPath, description, 'utf-8');
    
    console.log('Setup complete! Service description saved to prompts/service-description.txt');
    console.log('Description:', description);
    process.exit(0);
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

setup(); 