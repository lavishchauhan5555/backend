# Use Node 18 LTS
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files first to install dependencies
COPY package*.json ./

# Install only production dependencies
RUN npm install --production

# Copy the rest of the backend code
COPY . .

# Set environment variable
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
