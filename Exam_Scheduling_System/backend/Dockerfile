FROM oven/bun:1.3.6

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY prisma ./prisma
RUN bunx prisma generate

COPY . .

EXPOSE 3001

CMD ["sh", "-c", "if [ \"$NODE_ENV\" = \"development\" ]; then bunx prisma db push; else bunx prisma migrate deploy; fi && bun start"]

