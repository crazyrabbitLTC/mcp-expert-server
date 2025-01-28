# Generated by https://smithery.ai. See: https://smithery.ai/docs/config#dockerfile
# Start with a Node.js 18 image
FROM node:18-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --ignore-scripts

# Copy the entire project
COPY . .

# Build the project
RUN npm run build
RUN npm run setup

# Use a clean Node.js image for running the app
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy only the build and necessary files
COPY --from=builder /app/build /app/build
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json
COPY --from=builder /app/prompts /app/prompts
COPY --from=builder /app/docs /app/docs

# Install only production dependencies
RUN npm ci --omit=dev

# Define environment variable
ENV ANTHROPIC_API_KEY=your_api_key_here

# Expose port if necessary (assuming the app listens on 3000)
EXPOSE 3000

# Start the server
CMD ["npm", "start"]