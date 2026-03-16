# Use Node 18 LTS
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Copy start script
COPY start.sh /app/start.sh

# Give execute permission
RUN chmod +x /app/start.sh

# Environment variable
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start both server and worker
CMD ["/bin/bash", "/app/start.sh"]