FROM node:20-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY next.config.mjs postcss.config.js tailwind.config.ts tsconfig.json ./
COPY src ./src
EXPOSE 3000
CMD ["pnpm","dev","--port","3000","--hostname","0.0.0.0"]
