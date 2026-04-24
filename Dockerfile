# 1. 빌드 단계
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY .env .
COPY . .
RUN npm run build

# 2. 실행 단계
FROM node:20-slim
WORKDIR /app
# 빌드 결과물만 쏙 빼오기
COPY --from=builder /app/build ./build
COPY --from=builder /app/package.json ./package.json
#COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src

RUN npm install --omit=dev

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "build"]

