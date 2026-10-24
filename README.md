# Tirvo · loja de eletrônicos

> Se algo pode ser melhorado, ainda não está pronto.

Loja virtual de eletrônicos (headsets gamer, fones de ouvido, controles, minigames, caixas de som, suportes de celular, acessórios para carro, carregadores, chapinhas, babyliss, massageadores, smartwatches e periféricos) que vende **só para Curitiba e região metropolitana**, entrega por **motoboy** com frete calculado por km a partir da loja e recebe os pedidos **no WhatsApp** da loja, já organizados. O dono configura tudo pelo painel em `/admin`.

## O que a loja faz

- **Vitrine completa:** página inicial com banners rotativos, ofertas relâmpago com contagem regressiva, lançamentos, mais vendidos, categorias, marcas, busca com sugestões, filtros (marca, voltagem, preço, oferta, estoque, frete grátis) e favoritos.
- **Página do produto:** galeria, variações (voltagem, cor ou modelo) com estoque próprio, ficha técnica, avaliações moderadas e cálculo de frete pelo CEP.
- **Carrinho e checkout:** cupons, frete por km calculado na hora, desconto no Pix, retirada na loja e validação de preços e estoque sempre no servidor.
- **Pedido pelo WhatsApp:** ao finalizar, o cliente envia a mensagem pronta (itens, endereço, frete, pagamento) para o WhatsApp da loja e acompanha o pedido em `/pedido/<código>`.
- **Pagamentos:** online pela **Stripe** (cartão, Pix ou boleto), **Pix** para a chave da loja ou **na entrega** (dinheiro com troco, maquininha ou Pix).
- **Marketing:** promoções automáticas por categoria, marca ou produto, ofertas relâmpago, cupons (porcentagem, valor fixo, frete grátis, primeira compra, limite de uso), banners e newsletter.
- **App instalável (PWA)** com **notificações push** de promoções enviadas pelo painel.
- **Importador de produtos:** cadastra centenas de produtos de uma vez a partir de pastas do computador, `.zip`, Google Drive ou planilha (Excel/CSV, inclusive as exportadas do Mercado Livre e da Shopee), com preenchimento opcional por IA lendo as fotos da caixa e do manual.
- **Ferramentas para montar a loja:** IA à escolha (Gemini, ChatGPT, Claude, DeepSeek, Grok, Mistral, OpenRouter ou outro compatível) no importador e no cadastro, busca do produto pelo código de barras (inclusive pela câmera do celular), calculadora de preço com taxas e imposto, edição em massa (e por planilha do Excel), padronizador de fotos com marca d'água, gerador de páginas legais, catálogo para Google Shopping e Instagram e o checklist **Loja pronta**.
- **Painel completo:** dashboard de vendas, pedidos com linha do tempo e impressão, clientes, produtos com imagens, categorias, marcas, avaliações, banners, promoções, cupons, notificações, páginas institucionais, usuários com níveis de acesso e todas as configurações da loja.

**Tecnologia:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 6 + MySQL 8 · Stripe · Web Push · Docker + Caddy.

---

## Rodando no computador

Você precisa de **Node.js 22** e **Docker** (só para o MySQL).

```bash
# 1. MySQL 8 local
docker run -d --name tirvo-mysql -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=tirvo \
  mysql:8.4 --character-set-server=utf8mb4 --collation-server=utf8mb4_0900_ai_ci

# 2. Variáveis de ambiente
cp .env.example .env
```

No `.env`, para desenvolvimento, use:

```ini
DATABASE_URL=mysql://root:root@127.0.0.1:3306/tirvo
AUTH_SECRET=qualquer-texto-com-pelo-menos-32-caracteres-aqui
APP_URL=http://localhost:3000
ADMIN_EMAIL=admin@tirvo.com.br
ADMIN_PASSWORD=tirvo123
UPLOAD_DIR=./data/uploads
```

```bash
# 3. Dependências, banco e carga inicial
npm install
npx prisma migrate deploy
npm run db:seed

# 4. Servidor de desenvolvimento
npm run dev
```

Abra <http://localhost:3000>. O painel fica em <http://localhost:3000/admin> (login com `ADMIN_EMAIL` e `ADMIN_PASSWORD`).

Não existe mais loja de demonstração: o seed cria o administrador, as configurações, as páginas institucionais e as **categorias de eletrônicos** (headsets gamer, fones de ouvido, controles, minigames, caixas de som, suportes de celular, acessórios para carro, carregadores e cabos, beleza e cabelo, massageadores, smartwatches e periféricos, com subcategorias). A loja abre vazia, com as seções da página inicial prontas, esperando os produtos cadastrados no painel. Pode rodar de novo quando quiser: só cria o que falta e não mexe no que você já editou.

| Comando | O que faz |
| --- | --- |
| `npm run db:seed` | Admin, configurações, páginas e categorias de eletrônicos (só cria o que falta) |
| `npm run db:seed -- --reset` | Apaga produtos, pedidos, marketing, categorias, marcas e páginas e recria páginas e categorias (usuários e configurações ficam) |
| `npm run db:seed -- --demo-settings` | Preenche WhatsApp, endereço e Pix de **demonstração**, para testar o checkout no computador (troque no painel antes de vender) |
| `npm run db:seed -- --reset-admin-password` | Volta a senha do `ADMIN_EMAIL` para a do `ADMIN_PASSWORD` |

Outros comandos: `npm run typecheck` (tipos), `npm test` (testes unitários), `npm run test:e2e` (testes de ponta a ponta com Playwright, com o `npm run dev` rodando; eles criam sozinhos um produto temporário de teste no banco, por isso precisam do `DATABASE_URL`, e apagam no final), `npm run db:studio` (ver o banco).

---

## Configurando a loja no painel

Em **Painel → Configurações**, nesta ordem:

1. **Loja:** nome, **WhatsApp que recebe os pedidos** (com DDD, ex.: 41 99999-8888), telefone, e-mail, CNPJ, redes sociais e a faixa de aviso do topo. Sem WhatsApp, o checkout só oferece pagamento online.
2. **Endereço e retirada:** endereço da loja, de onde sai o frete. Depois de salvar, use **Localizar novamente** para conferir o ponto no mapa. Defina se aceita retirada e as instruções.
3. **Frete e entrega:** preço por km, taxa de saída, frete mínimo, adicional por item, arredondamento, distância máxima, frete grátis (liga/desliga, até quantos km da loja e pedido mínimo: com ele ligado, todos os produtos mostram o selo e a página inicial mostra o aviso), cidades atendidas e o texto do prazo. O simulador ao lado mostra o valor para qualquer distância.
4. **Pagamentos:** chave Pix e titular, desconto no Pix, pagamento na entrega (dinheiro, maquininha, Pix), parcelamento exibido e a opção de pagamento online.
5. **Integrações:**
   - **Stripe:** cole a chave publicável (`pk_…`) e a secreta (`sk_…`) do [painel da Stripe](https://dashboard.stripe.com/apikeys). Crie o webhook em *Developers → Webhooks* com o endereço `https://SEU-DOMINIO/api/stripe/webhook` e os eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` e `checkout.session.expired`; cole o segredo (`whsec_…`). Depois ative o pagamento online em *Pagamentos*.
   - **Mapas:** o padrão (OpenStreetMap) é gratuito, mas tem limite de uso. Para a loja real, escolha Google Maps, OpenRouteService ou Mapbox e cole a chave.
   - Google Analytics e Meta Pixel (opcionais, só carregam com o consentimento de cookies).
6. **Inteligência artificial** (opcional): escolha o provedor e cole a chave. O **Gemini** tem plano grátis ([criar chave](https://aistudio.google.com/apikey)); ChatGPT, Claude, DeepSeek, Grok, Mistral e OpenRouter também funcionam, e *Outro provedor* aceita qualquer serviço compatível com a API da OpenAI. Cada provedor guarda a própria chave. O modelo é escolhido sozinho (o mais novo e barato da sua chave) ou fixado por você; *Testar* confere tudo.
7. **Ferramentas do catálogo:** taxas da calculadora de preço (cartão, Pix, imposto, embalagem, margem desejada e final ,90/,99), padrão das fotos (fundo, quadrado, marca d'água com o logo da marca), chave do Google Drive (importador) e os links do catálogo para Google e Instagram.
8. **App e notificações:** as chaves de notificação são geradas sozinhas. Ajuste o convite para ativar as notificações. As campanhas são enviadas em **Marketing → Notificações do app**.
9. **SEO e aparência:** título e descrição para o Google, imagem de compartilhamento, tema padrão (escuro ou claro) e seções da página inicial.

Depois: confira as **categorias** (as de eletrônicos já vêm criadas pelo seed; renomeie, esconda ou crie outras à vontade), cadastre **marcas e produtos**, os **banners**, **promoções** e **cupons**, gere as **páginas legais** em *Páginas → Gerar páginas legais* (trocas, privacidade, termos e entregas, com o CNPJ, endereço, frete e pagamentos da loja) e, em **Usuários**, troque a senha do administrador e crie acessos para a equipe (proprietário, administrador ou editor).

---

## Importando produtos

Em **Produtos → Importar**. Tudo entra como **rascunho** (a não ser que marque *Publicar direto*): revise e ative em massa na lista de produtos. Produto com o mesmo SKU ou o mesmo nome de um já cadastrado é pulado, então dá para rodar de novo sem duplicar.

**Pastas (computador, `.zip` ou Google Drive):** uma subpasta por produto.

```
Produtos/
├─ Fone JBL Tune 520BT/
│  ├─ 01.jpg … 12.jpg     fotos do anúncio, em ordem (01 é a capa)
│  ├─ info-caixa.jpg      fotos de apoio: começam com info, caixa, manual ou etiqueta
│  ├─ info/               (ou ficam numa subpasta) e não aparecem na loja
│  └─ dados.txt
└─ Headset Gamer XYZ/
```

O `dados.txt` tem uma informação por linha (`preco: 299,90`, `estoque: 10`, `categoria: Fones de Ouvido`, `marca: JBL`, `voltagem: bivolt`, `peso: 250 g`, `medidas: 20 x 18 x 6 cm`…) e as seções `[especificacoes]`, `[variacoes]` e `[descricao]`. Só o preço é obrigatório; sem `nome`, vale o nome da pasta. Baixe o modelo completo na tela do importador. No Drive, o `dados` pode ser um documento do Google.

- **Google Drive:** compartilhe a pasta principal como *Qualquer pessoa com o link* (leitor) e cole o link. Precisa de uma chave de API do Google Cloud com a **Google Drive API** ativada (gratuita), cadastrada em *Configurações → Ferramentas do catálogo*. Sem chave, baixe a pasta do Drive (vem em `.zip`) e use a opção `.zip`.
- **Planilha:** uma linha por produto; as colunas são reconhecidas pelo nome (nome/título, preço, estoque, SKU, EAN, marca, categoria, descrição, fotos…). Fotos são links (separados por vírgula ou em colunas *Imagem 1, Imagem 2…*). Linhas com o mesmo código de anúncio viram variações. Aceita a planilha de edição em massa do **Mercado Livre** e a de atualização em massa da **Shopee** do jeito que são baixadas (importe só anúncios seus).
- **IA:** com uma IA configurada em *Configurações → Inteligência artificial*, marque *Preencher com IA*. Ela lê as fotos de apoio (ou as primeiras fotos) e completa nome, marca, modelo, categoria, ficha técnica, descrição, EAN, medidas e SEO. Nunca mexe em preço e estoque, e o que estiver no `dados.txt` prevalece.
- **Código de barras:** com *Completar pelo código de barras*, produtos com EAN ganham nome, marca, medidas e (sem fotos próprias) as fotos da base.
- **Padronizar as fotos:** aplica o padrão das Configurações (fundo, quadrado, marca d'água). A original fica guardada.

Fotos de até 40 MB (Drive e links) ou 8 MB (computador; as maiores são reduzidas no navegador) viram WebP em 3 tamanhos, como no cadastro normal.

---

## Ferramentas do catálogo

- **Loja pronta** (menu *Visão geral*): checklist do que falta antes de abrir (obrigatório, recomendado e opcional), com os produtos que precisam de atenção e o atalho para resolver.
- **No cadastro do produto:** *Preencher com IA* (completa o que falta ou reescreve os textos de venda), **Buscar** pelo código de barras (ou leitura pela câmera no celular), **calculadora de preço** (preço sugerido pela margem e quanto sobra no cartão e no Pix) e **Padronizar fotos** (com *Voltar às originais*). *Duplicar* fica no menu ⋯.
- **Edição em massa** (*Produtos → Edição em massa*): tabela com preço, preço "de", custo, estoque, categoria, marca, status, peso, medidas, frete grátis e EAN de todos os produtos e variações. Ações em lote: reajuste em %, preço pela calculadora, preço riscado, categoria, marca, status, estoque e medidas. **Exportar planilha** (.xlsx ou CSV), editar no Excel e **Atualizar pela planilha**: as mudanças aparecem destacadas para revisar antes de salvar (célula vazia mantém o valor).
- **Padronizar fotos em lote:** na lista de produtos, selecione e use *Padronizar fotos* ou *Fotos originais*.
- **Páginas legais:** *Páginas → Gerar páginas legais* cria ou atualiza trocas e devoluções (CDC), política de privacidade (LGPD), termos de uso e entregas com os dados das Configurações. É um modelo de referência; revise antes de publicar.
- **Catálogo para Google e Instagram:** `/feeds/google.xml` (Google Merchant Center e Meta) e `/feeds/catalogo.csv`, só com produtos ativos com foto e preço, já com promoções e variações. Ligue ou desligue em *Configurações → Ferramentas do catálogo*.

---

## Publicando na Oracle Cloud (Always Free)

A loja roda de graça numa VM ARM da Oracle (Ampere A1), com Docker, MySQL e HTTPS automático pelo Caddy.

### 1. Conta

Crie a conta em <https://www.oracle.com/br/cloud/free/>. A **região inicial** não pode ser trocada depois: escolha **Brazil East (São Paulo)** ou **Brazil Southeast (Vinhedo)**. A Oracle pede cartão só para verificação.

### 2. Máquina virtual

Em **Compute → Instances → Create instance**:

- **Image:** Canonical Ubuntu **24.04** (ou 22.04).
- **Shape:** *Ampere* → **VM.Standard.A1.Flex**, **2 OCPUs e 12 GB** de memória (o grátis vai até 4 OCPUs e 24 GB no total).
- **Networking:** crie uma VCN nova com **sub-rede pública** e marque *Assign a public IPv4 address*.
- **SSH keys:** baixe a chave privada gerada (ou cole a sua chave pública).
- **Boot volume:** o padrão (≈ 47 GB) basta; o grátis vai até 200 GB.

Se aparecer *Out of capacity*, tente outro *Availability Domain* ou de novo mais tarde. Anote o **IP público** da instância.

### 3. Portas 80 e 443 na rede da Oracle

Em **Networking → Virtual cloud networks →** sua VCN **→ Subnets →** sub-rede pública **→ Security Lists → Default Security List → Add Ingress Rules**, crie duas regras:

| Source CIDR | IP Protocol | Destination Port |
| --- | --- | --- |
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

(Opcional: UDP `443` para HTTP/3.) O firewall interno da VM é liberado pelo script de instalação.

### 4. Domínio

Crie um registro **A** no DNS do seu domínio (ex.: `loja.seudominio.com.br`) apontando para o IP público. Sem domínio próprio, use um subdomínio grátis do [DuckDNS](https://www.duckdns.org): crie `minhaloja.duckdns.org` e cole o IP da VM. Confira com `ping loja.seudominio.com.br` antes de seguir.

### 5. Instalação

Entre na VM e rode o instalador:

```bash
ssh -i ~/caminho/chave-privada.key ubuntu@IP-DA-VM

git clone https://github.com/SEU-USUARIO/tirvo-loja.git ~/tirvo-loja
cd ~/tirvo-loja
bash deploy/oracle-setup.sh
```

O script pergunta o **domínio** e o **e-mail do administrador**. Ele:

- atualiza o Ubuntu, ajusta o fuso para `America/Sao_Paulo`, cria 2 GB de swap e ativa as atualizações automáticas de segurança;
- instala o Docker Engine e o Docker Compose (repositório oficial) e libera as portas 80/443 no firewall da VM (as imagens da Oracle bloqueiam tudo além do SSH);
- cria o `.env` com senhas e `AUTH_SECRET` aleatórios;
- constrói e sobe MySQL, app e Caddy (a primeira vez leva de 5 a 15 minutos);
- prepara o banco com `npm run db:seed` (administrador, configurações, páginas e categorias de eletrônicos, sem produtos de exemplo) e agenda o backup diário.

> Repositório privado? Crie uma chave na VM (`ssh-keygen -t ed25519`), adicione o conteúdo de `~/.ssh/id_ed25519.pub` em *GitHub → Settings → Deploy keys* do repositório e clone com `git clone git@github.com:SEU-USUARIO/tirvo-loja.git ~/tirvo-loja`.

Pode rodar o script de novo a qualquer momento: o que já estiver configurado é mantido.

### 6. Primeiro acesso

Ao terminar, o script mostra o endereço do painel, o e-mail e a **senha gerada** do administrador. O **HTTPS** é emitido sozinho pelo Caddy (Let's Encrypt) em até um minuto, desde que o domínio já aponte para a VM. Entre em `https://SEU-DOMINIO/admin`, troque a senha em **Usuários** e siga a [configuração no painel](#configurando-a-loja-no-painel).

### Evite que a Oracle desligue a VM ociosa

A Oracle pode **recuperar instâncias Always Free ociosas**: se, em 7 dias, o uso de CPU (percentil 95), de rede e de memória ficar abaixo de 20%, a VM é parada. Uma loja pequena pode cair nessa regra. A forma segura de evitar é **mudar a conta para Pay As You Go** (*Billing → Upgrade*): os recursos Always Free continuam gratuitos e contas pagas não sofrem essa recuperação. Crie também um **orçamento com alerta** (*Billing → Budgets*, ex.: US$ 1) para ser avisado se algo sair do gratuito. Manter carga artificial na VM só para não parecer ociosa não é recomendado.

---

## Deploy automático pelo GitHub

A cada push na `main`, o workflow **CI** checa tipos, testes, build do Next e da imagem Docker, e o workflow **Deploy** entra na VM por SSH e roda `deploy/update.sh`.

1. No seu computador, gere uma chave só para o deploy:
   ```bash
   ssh-keygen -t ed25519 -C github-deploy -f tirvo-deploy -N ""
   ```
2. Na VM, autorize a chave pública: `cat >> ~/.ssh/authorized_keys` e cole o conteúdo de `tirvo-deploy.pub`.
3. No GitHub, em **Settings → Secrets and variables → Actions**, crie os segredos:
   - `ORACLE_HOST`: IP público (ou domínio) da VM
   - `ORACLE_USER`: `ubuntu`
   - `ORACLE_SSH_KEY`: conteúdo completo do arquivo `tirvo-deploy` (chave privada)
   - `ORACLE_PORT` e `ORACLE_APP_DIR`: opcionais (padrões `22` e `~/tirvo-loja`)

Sem esses segredos o deploy é apenas ignorado. Para rodar manualmente: **Actions → Deploy → Run workflow**.

## Atualizando manualmente

```bash
cd ~/tirvo-loja
./deploy/update.sh      # git pull, build, reinício, confere a saúde do app e limpa imagens antigas
```

As migrações do banco são aplicadas sozinhas quando o app inicia.

Comandos úteis na VM: `docker compose ps` (estado), `docker compose logs -f app` (logs do app), `docker compose logs caddy` (HTTPS), `docker compose restart app`.

## Backups e restauração

- **Todo dia às 03:15** o `deploy/backup.sh` grava o banco em `~/tirvo-loja/backups/db-AAAAMMDD-HHMM.sql.gz` e uma cópia do `.env` (`env-latest`); aos domingos, também as imagens (`uploads-….tar.gz`). Os arquivos com mais de 14 dias são apagados (`KEEP_DAYS` muda isso). O registro fica em `backups/backup.log`.
- Backup completo agora: `./deploy/backup.sh --full`.
- **Cópia fora da VM (recomendado):** instale o [rclone](https://rclone.org) (`sudo apt install rclone`), configure um destino (`rclone config`: Google Drive, Backblaze B2, Oracle Object Storage…) e adicione ao `.env` `BACKUP_RCLONE_REMOTE=meudestino:tirvo-backups`.
- **Restaurar:**
  ```bash
  ./deploy/restore.sh backups/db-20261017-0315.sql.gz                               # só o banco
  ./deploy/restore.sh backups/db-20261017-0315.sql.gz backups/uploads-20261011-0315.tar.gz
  ```
  O banco atual é substituído (pede confirmação) e as imagens atuais vão para `data/uploads.antes-<data>`.
- **Mudar de VM:** rode a instalação na VM nova, copie o `.env` antigo (a `AUTH_SECRET` precisa ser a mesma para ler as chaves salvas no painel) e os backups, e restaure.

---

## Problemas comuns

**O site não abre (tempo esgotado).** Confira as regras 80/443 na Security List da VCN, se o domínio aponta para o IP certo (`dig +short seu.dominio`) e o firewall da VM (`sudo iptables -L INPUT -n --line-numbers`: as regras ACCEPT das portas 80 e 443 precisam vir antes do REJECT; rodar o `oracle-setup.sh` de novo corrige).

**Erro de certificado.** Veja `docker compose logs caddy`. O Let's Encrypt precisa da porta 80 aberta e do DNS já propagado; depois de várias falhas seguidas ele bloqueia novas tentativas por uma hora.

**Erro 502.** O app está iniciando ou com problema: `docker compose ps` e `docker compose logs -f app`. O primeiro start aplica as migrações e pode levar alguns segundos.

**O build trava ou é encerrado.** Falta de memória: confira o swap com `free -h` (o instalador cria 2 GB). Com 2 OCPUs o build leva cerca de 10 minutos.

**O checkout só mostra pagamento online.** Falta o WhatsApp da loja em *Configurações → Loja*: os pedidos com Pix e pagamento na entrega são enviados por ele.

**O frete não calcula ou demora.** O OpenStreetMap gratuito (Nominatim e OSRM público) tem limite de uso (cerca de 1 consulta por segundo e sem garantia). Em produção, escolha Google, OpenRouteService ou Mapbox em *Configurações → Integrações* (ou aponte `OSRM_URL` para um servidor OSRM próprio). Confira também se o endereço da loja foi localizado, a distância máxima e as cidades atendidas.

**Pagamento online não confirma o pedido.** Na Stripe, abra o webhook e veja as tentativas de entrega: o endereço precisa ser `https://SEU-DOMINIO/api/stripe/webhook`, com os 4 eventos e o segredo `whsec_…` certo (as chaves de teste e de produção têm webhooks diferentes). Para testar no computador com o [Stripe CLI](https://stripe.com/docs/stripe-cli):
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook   # copie o whsec_ mostrado para Integrações
```
e faça um pedido com o cartão de teste `4242 4242 4242 4242`.

**Notificações não chegam.** Exigem HTTPS. No iPhone, o cliente precisa instalar o app na tela de início (iOS 16.4 ou mais novo) antes de ativar.

**Esqueci a senha do painel.** Na VM, coloque uma nova senha em `ADMIN_PASSWORD` no `.env` e rode:
```bash
docker compose run --rm tools npm run db:seed -- --reset-admin-password
```

**Troquei a `AUTH_SECRET`.** Todos saem do painel e as chaves salvas (Stripe, mapas e notificações) precisam ser cadastradas de novo; os inscritos em notificações precisam ativá-las outra vez.

---

## Estrutura

```
src/app/(store)/     loja (páginas públicas)
src/app/admin/       painel
src/app/api/         carrinho, frete, pedidos, Stripe, notificações, uploads
src/lib/             regras: preços, cupons, frete, pedidos, configurações
src/lib/importer/    importador de produtos (dados.txt, pastas, planilhas, Drive, IA)
src/lib/ai/          IA com vários provedores (Gemini, OpenAI, Claude e compatíveis)
src/components/      interface da loja, do painel e componentes base
prisma/              schema, migrações e seed (páginas e categorias iniciais em prisma/seed/)
Dockerfile, docker-compose.yml, docker/   imagem de produção, MySQL e Caddy
deploy/              instalação na VM, atualização, backup e restauração
tests/               unitários (Vitest) e ponta a ponta (Playwright)
```

Para testar a imagem de produção no computador, sem o Caddy: `docker compose -f docker-compose.yml -f docker/compose.local.yml up -d --build mysql app` e abra <http://localhost:3100> (o `.env` precisa das variáveis `MYSQL_*`).
