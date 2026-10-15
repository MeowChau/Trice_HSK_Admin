FROM node:24.14.1-alpine AS build
WORKDIR /app
ENV HUSKY=0
COPY package.json package-lock.json ./
RUN npm ci
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:24.14.1-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY src/mail/mail-templates ./src/mail/mail-templates
RUN mkdir -p files && chown node:node files
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
