# 1. 빌드 단계
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY .env .
COPY . .
RUN npm run build

# 2. 실행 단계
FROM node:20-slim
WORKDIR /app
# 빌드 결과물 및 프로덕션 의존성만 복사
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src

# prepare("svelte-kit sync")는 devDependencies용이므로 프로덕션 스테이지에서는 --ignore-scripts로 차단
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "build"]
