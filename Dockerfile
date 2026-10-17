# syntax=docker/dockerfile:1.7
#
# Imagem de produção da Tirvo (Next.js standalone + Prisma), para linux/amd64 e
# linux/arm64 (Oracle Cloud Ampere A1).
#
#   docker compose build app            imagem final (alvo "runner")
#   docker compose run --rm tools ...   imagem com o projeto completo (migrações e seed)
#
# Atrás de um proxy que intercepta HTTPS, passe o certificado da rede como segredo
# opcional: docker build --secret id=extra_ca,src=/caminho/ca.crt .

ARG NODE_IMAGE=node:22-bookworm-slim

# ───────── Base: Node + OpenSSL (o Prisma detecta a versão da libssl)
FROM ${NODE_IMAGE} AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ───────── Dependências (o postinstall roda "prisma generate", por isso o prisma/ vem antes)
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi \
 && npm ci \
 && test -f node_modules/.prisma/client/index.js

# ───────── Build do Next (não precisa de banco: todas as páginas são dinâmicas)
FROM deps AS build
COPY . .
RUN npm run build && test -f .next/standalone/server.js

# ───────── Monta a pasta final em /opt/app (uma camada só na imagem de produção):
# site standalone + estáticos + CLI do Prisma e sharp com dependências + Prisma Client
# completo + schema e migrações.
FROM build AS assemble
RUN set -eux; \
    mkdir -p /opt/app/.next /opt/app/prisma /opt/app/docker; \
    cp -a .next/standalone/. /opt/app/; \
    cp -a .next/static /opt/app/.next/static; \
    cp -a public /opt/app/public; \
    node docker/collect-deps.cjs /opt/app/node_modules prisma sharp; \
    cp -a node_modules/.prisma /opt/app/node_modules/; \
    rm -rf /opt/app/node_modules/@prisma/client; \
    cp -a node_modules/@prisma/client /opt/app/node_modules/@prisma/client; \
    cp -a prisma/schema.prisma prisma/migrations /opt/app/prisma/; \
    cp docker/entrypoint.sh /opt/app/docker/entrypoint.sh; \
    # O rastreamento do Next pode copiar o código-fonte junto; no servidor ele não é usado.
    rm -rf /opt/app/src /opt/app/tests /opt/app/docker/*.cjs /opt/app/Dockerfile /opt/app/*.md \
      /opt/app/tsconfig.json /opt/app/vitest.config.ts /opt/app/playwright.config.ts /opt/app/postcss.config.mjs; \
    # Sem a seção "prisma" do package.json (evita o aviso de configuração antiga da CLI).
    node -e "const f='/opt/app/package.json',p=require(f);delete p.prisma;delete p.devDependencies;require('fs').writeFileSync(f,JSON.stringify(p,null,2))"

# ───────── Ferramentas: projeto completo para migrações e seed
#   docker compose run --rm tools npm run db:seed -- --minimal
FROM build AS tools
ENV NODE_ENV=production \
    UPLOAD_DIR=/app/data/uploads
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data
ENTRYPOINT ["sh", "/app/docker/entrypoint.sh"]
CMD ["npm", "run", "db:seed", "--", "--minimal"]

# ───────── Imagem final
FROM base AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    UPLOAD_DIR=/app/data/uploads

COPY --from=assemble /opt/app ./

RUN test -f server.js \
 && test -f node_modules/prisma/build/index.js \
 && test -n "$(ls node_modules/.prisma/client/libquery_engine-*.so.node)" \
 && test -n "$(ls node_modules/@prisma/engines/schema-engine-*)" \
 && node -e "require('sharp')" \
 && mkdir -p /app/data/uploads \
 && chown -R node:node /app/data

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/manifest.webmanifest').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# O entrypoint começa como root só para acertar o dono da pasta de imagens (volume)
# e passa a rodar como o usuário "node" antes de iniciar o servidor.
ENTRYPOINT ["sh", "/app/docker/entrypoint.sh"]
CMD ["node", "server.js"]
