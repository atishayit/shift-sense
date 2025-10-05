FROM node:20-alpine

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
RUN npx prisma generate

COPY tsconfig.json nest-cli.json ./
COPY src ./src
EXPOSE 4000
CMD ["pnpm","start:dev"]
