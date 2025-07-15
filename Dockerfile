# Use the official Node.js 20 image.
FROM node:20-slim

# Create and change to the app directory.
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install production dependencies.
# For development, you might want to run `npm install` without `--omit=dev`
RUN npm cache clean --force
RUN npm install --verbose

# Copy the rest of the application's source code from the host to the image's filesystem.
COPY . .

# Build the client-side assets
# The client directory and vite config needs to exist first.
# We will handle this later.
# RUN npm run build

# The application listens on port 3000.
EXPOSE 3000

# The command to run the application will be handled by docker-compose
# CMD ["node", "server/src/index.js"]
