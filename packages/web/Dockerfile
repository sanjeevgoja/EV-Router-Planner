FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/web/package.json packages/web/package.json
RUN npm install --workspaces --include-workspace-root

COPY packages/shared packages/shared
COPY packages/web packages/web

RUN npm run build -w packages/shared

EXPOSE 5173
CMD ["npm", "run", "dev", "-w", "packages/web"]
