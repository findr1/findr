# Findr: one image with the React website and the Express API.
# Build: docker build -t findr .

# Stage 1: build the React website into static files
FROM node:22.23-alpine3.24 AS frontend
WORKDIR /app/frontend
# Copy the package files first, so Docker reuses the npm ci layer
# when only the code changes
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# The website and the API are on the same address, so call /api
ENV VITE_API_URL=/api
RUN npm run build

# Stage 2: install the backend packages, without test tools
FROM node:22.23-alpine3.24 AS backend
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Stage 3: the small image that runs the app
FROM node:22.23-alpine3.24
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Express serves the website from this folder
ENV STATIC_DIR=/app/public

# Copy only what the app needs from the stages above
COPY --from=backend --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node backend/package.json ./
COPY --chown=node:node backend/src ./src
COPY --from=frontend --chown=node:node /app/frontend/dist ./public

# The app runs with node only. Remove npm, npx and corepack that come with the
# base image: Trivy found HIGH problems in npm's own packages (see SECURITY.md)
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

# Don't run as root. The node user comes with the base image
USER node

EXPOSE 3000

# Docker checks the API every 30 seconds
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Start Node directly so it stops cleanly
CMD ["node", "src/index.js"]
