FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api/package.json packages/api/package.json
RUN npm install --workspaces --include-workspace-root

COPY packages/shared packages/shared
COPY packages/api packages/api

RUN npm run build -w packages/shared && npm run build -w packages/api

EXPOSE 3001
CMD ["npm", "run", "start", "-w", "packages/api"]
