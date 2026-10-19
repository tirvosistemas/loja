// Páginas institucionais (markdown simples). Ficam no rodapé e podem ser editadas
// no painel, em Páginas.

export type SeedPage = { slug: string; title: string; content: string };

export const PAGES: SeedPage[] = [
  {
    slug: "sobre-nos",
    title: "Sobre a Tirvo",
    content: `A Tirvo é uma loja de eletrônicos de Curitiba que nasceu com uma ideia simples: **se algo pode ser melhorado, ainda não está pronto**. Por isso a gente revisa cada detalhe da compra, do preço ao momento em que o produto chega na sua casa.

## O que fazemos

Vendemos headsets gamer, fones de ouvido, controles, minigames, caixas de som, suportes de celular para moto, bicicleta e carro, acessórios eletrônicos para carro, carregadores e cabos, chapinhas, babyliss, massageadores, smartwatches e muito mais, sempre com nota fiscal e garantia.

Atendemos **somente Curitiba e região metropolitana**. Essa escolha é o que permite entregar rápido, com motoboy e frota próprios, e cobrar um frete justo, calculado pela distância real até o seu endereço.

## Como trabalhamos

- **Preço claro:** o valor que aparece no site é o valor que você paga, com o frete calculado na hora.
- **Atendimento de gente:** todo pedido chega no nosso WhatsApp e é confirmado por uma pessoa da equipe.
- **Entrega rápida:** pedidos confirmados até as 14h em dias úteis saem no mesmo dia para Curitiba.
- **Pagamento do seu jeito:** online, Pix ou na entrega, em dinheiro, cartão ou Pix.

## Fale com a gente

Tem dúvida sobre um produto, compatibilidade ou voltagem? Chame no WhatsApp pelo botão do site. A gente responde em horário comercial e ajuda você a escolher o eletrônico certo para o seu celular, videogame ou dia a dia.`,
  },
  {
    slug: "como-comprar",
    title: "Como comprar",
    content: `Comprar na Tirvo leva poucos minutos. Você monta o carrinho no site, informa o endereço e o pedido chega organizado no WhatsApp da loja.

## Passo a passo

1. **Escolha os produtos.** Na página do produto, selecione a opção (cor, modelo ou voltagem), quando houver, e toque em **Adicionar ao carrinho**.
2. **Confira o carrinho.** Ajuste quantidades, aplique um cupom de desconto e informe o CEP para ver o frete na hora.
3. **Finalize o pedido.** No checkout, preencha nome, WhatsApp e endereço completo, ou escolha **retirar na loja**.
4. **Escolha como pagar.** Veja as opções abaixo.
5. **Envie pelo WhatsApp.** Ao concluir, abrimos o WhatsApp com a mensagem do pedido pronta: é só tocar em enviar. Nossa equipe confirma o pedido e o horário de entrega por lá.

Depois de enviar, você acompanha cada etapa na página do pedido ou em **Acompanhar pedido**, com o código que aparece na confirmação.

## Formas de pagamento

- **Pagamento online:** cartão de crédito, Pix ou boleto em ambiente seguro da Stripe. O pedido é confirmado assim que o pagamento é aprovado.
- **Pix para a chave da loja:** você paga na hora e envia o comprovante pelo WhatsApp. Pagamentos com Pix têm desconto especial, mostrado no carrinho.
- **Na entrega:** dinheiro (informe se precisa de troco), cartão na maquininha ou Pix no momento em que o produto chega.

## Cupons

Os cupons valem uma vez por pedido e são conferidos no carrinho. Alguns têm valor mínimo de compra ou valem só para a primeira compra; as regras aparecem quando você aplica o código.

## Dúvidas

Se algo não ficou claro, fale com a gente pelo WhatsApp antes de finalizar. Preferimos tirar dúvidas antes a resolver problemas depois.`,
  },
  {
    slug: "entregas",
    title: "Entregas e retirada",
    content: `Entregamos com motoboy e veículos próprios em **Curitiba e região metropolitana**. Para outras cidades, ainda não fazemos envios.

## Como o frete é calculado

O frete é calculado **por quilômetro**, pela distância de rota entre a nossa loja e o seu endereço. O valor aparece na hora, no carrinho e no checkout, assim que você informa o CEP e o número.

- Há uma taxa fixa de saída mais um valor por quilômetro rodado.
- Quando o frete grátis está ativo, pedidos a partir do valor mínimo não pagam entrega dentro da distância indicada no site.
- Alguns produtos têm **frete grátis** sempre, sinalizado na página do produto.
- Cupons de frete grátis zeram a entrega quando as regras do cupom são atendidas.

## Prazos

- **Curitiba:** pedidos confirmados até as 14h em dias úteis saem no mesmo dia.
- **Região metropolitana:** entrega em até 24 horas úteis após a confirmação.
- Aos sábados, entregamos os pedidos confirmados até as 11h.

Assim que o pedido sair para entrega, avisamos pelo WhatsApp. Você também acompanha o status em **Acompanhar pedido**.

## Recebimento

- Confira a embalagem na frente do entregador. Se houver avaria, recuse o produto e avise a gente na hora.
- Confira na caixa se o modelo, a cor e a voltagem são os do pedido.
- Guarde a nota fiscal e a embalagem: elas facilitam a troca e o acionamento da garantia.

## Retirada na loja

Prefere buscar? Escolha **Retirar na loja** no checkout. Avisamos pelo WhatsApp quando o pedido estiver pronto. Leve o número do pedido e um documento com foto.`,
  },
  {
    slug: "trocas-e-devolucoes",
    title: "Trocas e devoluções",
    content: `Queremos que você fique satisfeito com a compra. Estas são as regras de troca e devolução, de acordo com o Código de Defesa do Consumidor.

## Arrependimento: 7 dias

Em compras feitas pela internet, você pode desistir em até **7 dias corridos** a partir do recebimento, sem precisar justificar (art. 49 do Código de Defesa do Consumidor).

- O produto deve estar sem sinais de uso, com embalagem, manuais e acessórios.
- Fale com a gente pelo WhatsApp informando o número do pedido.
- Combinamos a coleta sem custo dentro da nossa área de entrega.
- O valor é devolvido integralmente, inclusive o frete, pelo mesmo meio de pagamento: estorno no cartão, Pix ou transferência.

## Produto com defeito

Se o produto apresentar defeito, você tem **90 dias** para reclamar (art. 26 do CDC), além da garantia do fabricante indicada na página de cada produto.

1. Entre em contato pelo WhatsApp com fotos ou vídeo do problema.
2. Para defeitos nos primeiros 7 dias, fazemos a troca direto com a loja.
3. Depois disso, orientamos o acionamento da assistência técnica autorizada do fabricante, que tem até 30 dias para resolver.
4. Se o problema não for resolvido nesse prazo, você pode escolher a troca, a devolução do valor ou o abatimento no preço.

## Avaria no transporte

Confira o produto no recebimento. Se a embalagem estiver danificada, recuse a entrega e nos avise. Se perceber o dano depois, fale com a gente em até 7 dias com fotos.

## Como pedir

Envie uma mensagem no WhatsApp da loja com o número do pedido e o motivo. Respondemos em até 1 dia útil.`,
  },
  {
    slug: "politica-de-privacidade",
    title: "Política de privacidade",
    content: `Esta política explica como a Tirvo trata os seus dados pessoais, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018, LGPD).

## Dados que coletamos

- **No pedido:** nome, WhatsApp, e-mail (opcional), CPF (opcional, para nota fiscal) e endereço de entrega.
- **No pagamento online:** os dados do cartão são digitados direto no ambiente da Stripe. A Tirvo não recebe nem guarda o número do cartão.
- **Na navegação:** informações técnicas como endereço IP, tipo de navegador e páginas visitadas, usadas para segurança e para melhorar o site.
- **Newsletter e notificações:** e-mail, se você se cadastrar, e a autorização do navegador para notificações, se você ativar.

## Para que usamos

- Processar, entregar e dar suporte aos seus pedidos.
- Calcular o frete pela localização do endereço.
- Conversar com você pelo WhatsApp sobre o pedido.
- Emitir nota fiscal e cumprir obrigações legais.
- Enviar ofertas, só se você autorizar, com descadastro a qualquer momento.

## WhatsApp

Ao finalizar o pedido, a mensagem é enviada por você, pelo seu WhatsApp, para o número da loja. As conversas seguem também os termos e a política de privacidade do WhatsApp.

## Compartilhamento

Compartilhamos dados apenas com quem precisa deles para concluir a compra: processador de pagamento (Stripe), serviços de mapas para calcular a distância, entregadores e, quando necessário, autoridades, conforme a lei. **Não vendemos dados pessoais.**

## Cookies e armazenamento

Usamos cookies e o armazenamento do navegador para manter o carrinho, a lista de favoritos e as suas preferências, como o tema claro ou escuro. Se a loja usar ferramentas de análise, elas são informadas aqui e podem ser bloqueadas no seu navegador.

## Seus direitos

Você pode pedir a qualquer momento: confirmação do tratamento, acesso, correção, anonimização, portabilidade ou exclusão dos seus dados, além de revogar consentimentos (art. 18 da LGPD). Alguns dados precisam ser guardados pelo prazo exigido em lei, como os de notas fiscais.

## Segurança e retenção

O site usa conexão criptografada (HTTPS), o acesso ao painel é restrito e protegido por senha e os dados são guardados apenas pelo tempo necessário para as finalidades acima.

## Contato

Para exercer seus direitos ou tirar dúvidas sobre privacidade, fale com a gente pelo WhatsApp ou pelo e-mail informado no rodapé do site.`,
  },
  {
    slug: "termos-de-uso",
    title: "Termos de uso",
    content: `Ao usar o site da Tirvo e fazer pedidos, você concorda com estes termos. Leia com atenção.

## Área de atendimento

Vendemos e entregamos somente em **Curitiba e região metropolitana**. Pedidos com endereço fora da área de entrega não podem ser concluídos, exceto com retirada na loja.

## Preços e disponibilidade

- Os preços, promoções e o frete são calculados pelo site no momento do pedido.
- Promoções e ofertas relâmpago valem enquanto durar o prazo ou o estoque.
- Se houver erro evidente de preço ou falta de estoque após o pedido, entraremos em contato para corrigir ou cancelar, com devolução integral de qualquer valor pago.

## Pedido e confirmação

O pedido é registrado quando você finaliza o checkout e é **confirmado pela equipe da loja** pelo WhatsApp. Em pagamentos online, a confirmação depende da aprovação do pagamento.

## Pagamento

Pagamentos online são processados pela Stripe. Pagamentos via Pix para a chave da loja devem ser feitos no valor exato e comprovados pelo WhatsApp. Na entrega, aceitamos dinheiro, cartão e Pix.

## Cupons

Cupons têm regras próprias (valor mínimo, validade, limite de uso, primeira compra) e não são cumulativos entre si. Podemos cancelar cupons usados de forma irregular.

## Uso do site

É proibido usar o site para fins ilícitos, tentar acessar áreas restritas ou interferir no funcionamento da loja. O conteúdo, as imagens e a marca Tirvo não podem ser copiados sem autorização.

## Trocas, devoluções e privacidade

Seguem as páginas [Trocas e devoluções](/pagina/trocas-e-devolucoes) e [Política de privacidade](/pagina/politica-de-privacidade).

## Alterações

Estes termos podem ser atualizados. A versão publicada no site é a que vale para novos pedidos.`,
  },
  {
    slug: "perguntas-frequentes",
    title: "Perguntas frequentes",
    content: `## Vocês entregam na minha cidade?

Entregamos em Curitiba e nas cidades da região metropolitana, como São José dos Pinhais, Colombo, Pinhais, Araucária, Almirante Tamandaré, Fazenda Rio Grande e Campo Largo. Informe o CEP no carrinho para confirmar.

## Como é calculado o frete?

Pela distância de rota entre a loja e o seu endereço: uma taxa de saída mais um valor por quilômetro. Quando o frete grátis está ativo, a entrega é por nossa conta dentro da distância e a partir do pedido mínimo informados no site.

## Em quanto tempo recebo?

Pedidos confirmados até as 14h em dias úteis saem no mesmo dia para Curitiba. Para a região metropolitana, o prazo é de até 24 horas úteis. Veja os detalhes em [Entregas e retirada](/pagina/entregas).

## Posso pagar na entrega?

Sim. Aceitamos dinheiro (com troco), cartão na maquininha e Pix no momento da entrega.

## Pagando com Pix eu tenho desconto?

Sim. O desconto do Pix é aplicado automaticamente no checkout quando você escolhe Pix, seja agora ou na entrega.

## O pagamento online é seguro?

Sim. O pagamento online é feito em ambiente da Stripe, uma das maiores processadoras de pagamento do mundo. Nós não recebemos os dados do seu cartão.

## Por que o pedido vai para o WhatsApp?

Para você falar direto com uma pessoa da loja, confirmar o horário de entrega e tirar dúvidas na hora. A mensagem já vai organizada, com itens, endereço e forma de pagamento.

## Como acompanho meu pedido?

Use a página **Acompanhar pedido**, no menu, com o código do pedido e o seu WhatsApp. Você também recebe as atualizações pelo WhatsApp.

## Os produtos têm garantia?

Todos os produtos são novos, com nota fiscal e garantia do fabricante. O prazo aparece na página de cada produto.

## Qual é a voltagem da chapinha, do babyliss ou do secador?

A voltagem (110V, 220V ou bivolt) aparece na página de cada produto. Quando há mais de uma opção, você escolhe antes de adicionar ao carrinho.

## O controle ou o headset funciona no meu videogame?

A compatibilidade (PC, PlayStation, Xbox, Nintendo Switch ou celular) aparece na descrição do produto. Na dúvida, pergunte no WhatsApp antes de comprar.

## Posso trocar se me arrepender?

Sim, em até 7 dias após o recebimento, com o produto sem uso e na embalagem original. Veja [Trocas e devoluções](/pagina/trocas-e-devolucoes).

## Tem aplicativo?

Tem. Você pode instalar a Tirvo no celular direto pelo navegador e ativar as notificações para receber ofertas. Veja em [Baixe o app](/app).`,
  },
];
