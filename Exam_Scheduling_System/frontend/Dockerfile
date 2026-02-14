FROM oven/bun:1.3.6

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --no-progress --network-concurrency=16 --registry https://registry.npmjs.org/ \
  || bun install --frozen-lockfile --no-progress --network-concurrency=16 --registry https://registry.npmmirror.com

COPY . .

EXPOSE 5173

CMD ["sh", "-c", "bun run dev -- --host 0.0.0.0 --port 5173"]

