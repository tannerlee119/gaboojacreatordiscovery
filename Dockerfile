# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Install dependencies required by Playwright/Chromium
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Playwright to use the installed Chromium
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/bin
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files first to leverage Docker layer caching
COPY package*.json ./

# Install all dependencies (dev deps needed for the build)
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build the application
RUN npm run build

# Remove development dependencies to slim down the final image
RUN npm prune --omit=dev

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership of the app directory
USER nextjs

# Expose the Next.js port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["npm", "start"]

