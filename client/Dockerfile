# Use official Node runtime
FROM node:22-alpine

WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose port 3000 (Vite needs to be configured to listen on this port)
EXPOSE 3000

# Start the Vite development server
CMD ["npm", "run", "dev"]
