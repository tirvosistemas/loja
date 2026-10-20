import { formatBRL, formatCep, formatPhone } from "./format";
import { freeShippingMinimum, freeShippingRule, freeShippingWhere } from "./shipping/free";
import { enabledPaymentMethods, stripeIsReady, type Settings } from "./settings";
import { PIX_METHODS } from "./constants";

// Páginas legais geradas com os dados reais da loja (Configurações): trocas (CDC), privacidade
// (LGPD), termos de uso e entregas. Texto de base, revisável no painel; não substitui um advogado.

export type LegalPageId = "trocas-e-devolucoes" | "politica-de-privacidade" | "termos-de-uso" | "entregas";

export const LEGAL_PAGES: { id: LegalPageId; title: string; summary: string }[] = [
  { id: "trocas-e-devolucoes", title: "Trocas e devoluções", summary: "Arrependimento em 7 dias, defeito, avaria e como pedir (Código de Defesa do Consumidor)." },
  { id: "politica-de-privacidade", title: "Política de privacidade", summary: "Dados coletados, uso, compartilhamento, cookies e direitos do cliente (LGPD)." },
  { id: "termos-de-uso", title: "Termos de uso", summary: "Área atendida, preços, confirmação do pedido, pagamento e cupons." },
  { id: "entregas", title: "Entregas e retirada", summary: "Como o frete é calculado, prazos, cidades atendidas e retirada na loja." },
];

export type LegalOptions = { returnDays: number; defectDays: number; replyBusinessDays: number };

const DEFAULTS: LegalOptions = { returnDays: 7, defectDays: 90, replyBusinessDays: 1 };

function companyBlock(s: Settings) {
  const st = s.store;
  const a = s.address;
  const lines: string[] = [];
  const name = st.legalName || st.name;
  lines.push(`**${name}**${st.cnpj ? ` · CNPJ ${st.cnpj}` : ""}`);
  if (a.street) lines.push(`${a.street}${a.number ? `, ${a.number}` : ""}${a.complement ? ` – ${a.complement}` : ""}${a.neighborhood ? ` – ${a.neighborhood}` : ""}, ${a.city}/${a.state}${a.cep ? ` · CEP ${formatCep(a.cep)}` : ""}`);
  const contact = [st.whatsapp ? `WhatsApp ${formatPhone(st.whatsapp.replace(/^55/, ""))}` : null, st.email ? `e-mail ${st.email}` : null].filter(Boolean).join(" · ");
  if (contact) lines.push(contact);
  if (st.businessHours) lines.push(`Atendimento: ${st.businessHours}`);
  return `## Dados da empresa\n\n${lines.join("  \n")}`;
}

function contactLine(s: Settings) {
  const st = s.store;
  if (st.whatsapp && st.email) return `pelo WhatsApp ${formatPhone(st.whatsapp.replace(/^55/, ""))} ou pelo e-mail ${st.email}`;
  if (st.whatsapp) return `pelo WhatsApp ${formatPhone(st.whatsapp.replace(/^55/, ""))}`;
  if (st.email) return `pelo e-mail ${st.email}`;
  return "pelos canais de contato informados no rodapé do site";
}

function areaText(s: Settings) {
  const sh = s.shipping;
  if (!sh.enabled) return "Neste momento não fazemos entregas; os pedidos são retirados na loja.";
  if (sh.restrictToAllowedCities && sh.allowedCities.length) {
    const list = sh.allowedCities.length > 12 ? `${sh.allowedCities.slice(0, 12).join(", ")} e outras cidades da região` : sh.allowedCities.join(", ");
    return `Entregamos nas cidades: ${list}${sh.maxDistanceKm ? `, até ${sh.maxDistanceKm} km da loja` : ""}.`;
  }
  return sh.maxDistanceKm ? `Entregamos em endereços até ${sh.maxDistanceKm} km da loja.` : "Entregamos em toda a região atendida pela loja.";
}

function paymentList(s: Settings) {
  const methods = enabledPaymentMethods(s);
  const out: string[] = [];
  if (methods.includes("ONLINE_STRIPE")) out.push("- **Pagamento online:** cartão de crédito, Pix ou boleto, em ambiente seguro da Stripe. A loja não recebe nem guarda os dados do cartão.");
  if (methods.includes("PIX_MANUAL")) out.push("- **Pix para a chave da loja:** pagamento na hora, com envio do comprovante pelo WhatsApp.");
  const onDelivery = [methods.includes("CASH_ON_DELIVERY") && "dinheiro", methods.includes("CARD_ON_DELIVERY") && "cartão na maquininha", methods.includes("PIX_ON_DELIVERY") && "Pix"].filter(Boolean);
  if (onDelivery.length) out.push(`- **Na entrega:** ${onDelivery.join(", ")}.`);
  // O desconto vale só para o Pix da chave da loja e o Pix na entrega (igual ao checkout).
  const pixLabel: Record<string, string> = { PIX_MANUAL: "Pix para a chave da loja", PIX_ON_DELIVERY: "Pix na entrega" };
  const withDiscount = PIX_METHODS.filter((m) => methods.includes(m)).map((m) => pixLabel[m]);
  if (s.payment.pixDiscountPercent > 0 && withDiscount.length)
    out.push(
      `- ${withDiscount.join(" e ")} ${withDiscount.length > 1 ? "têm" : "tem"} **${s.payment.pixDiscountPercent.toLocaleString("pt-BR")}% de desconto**, aplicado no checkout${methods.includes("ONLINE_STRIPE") ? " (não vale para o Pix do pagamento online)" : ""}.`,
    );
  return out.join("\n");
}

function trocas(s: Settings, o: LegalOptions) {
  const n = s.store.name;
  return `Queremos que você fique satisfeito com a compra na ${n}. Estas são as regras de troca e devolução, de acordo com o Código de Defesa do Consumidor (CDC).

## Arrependimento: ${o.returnDays} dias

Em compras feitas pela internet, você pode desistir em até **${o.returnDays} dias corridos** a partir do recebimento, sem precisar justificar (art. 49 do CDC).

- O produto deve voltar sem sinais de uso, com embalagem, manuais e acessórios.
- Avise ${contactLine(s)}, informando o número do pedido.
- Combinamos a devolução sem custo para você${s.shipping.enabled ? ", com coleta dentro da nossa área de entrega" : ""}.
- O valor é devolvido integralmente, inclusive o frete, pelo mesmo meio de pagamento (estorno no cartão, Pix ou transferência).

## Produto com defeito

Você pode reclamar de defeitos em até **30 dias** (produtos não duráveis) ou **${o.defectDays} dias** (produtos duráveis) a partir do recebimento (art. 26 do CDC), além da garantia do fabricante informada na página de cada produto. Se o defeito só se manifestar com o uso (vício oculto), o prazo conta a partir de quando ele aparecer (art. 26, §3º).

1. Fale com a gente ${contactLine(s)}, com fotos ou vídeo do problema.
2. Você pode entregar o produto à loja, que o encaminha à assistência técnica, ou levá-lo direto à assistência autorizada do fabricante.
3. O conserto deve ser feito em até 30 dias.
4. Se não for resolvido nesse prazo, você escolhe: troca por outro igual, devolução do valor ou abatimento no preço (art. 18, §1º, do CDC).

## Avaria no transporte

Confira o produto ao receber. Se a embalagem estiver danificada, recuse a entrega e avise na hora. Se perceber o dano depois, fale com a gente, com fotos, em até 30 dias (produtos não duráveis) ou ${o.defectDays} dias (duráveis) a partir do recebimento.

## Prazo de resposta

Respondemos os pedidos de troca e devolução em até ${o.replyBusinessDays} dia${o.replyBusinessDays > 1 ? "s" : ""} útil${o.replyBusinessDays > 1 ? "eis" : ""}.

${companyBlock(s)}`;
}

function privacidade(s: Settings) {
  const n = s.store.legalName || s.store.name;
  const stripe = stripeIsReady(s);
  const analytics = [s.integrations.googleAnalyticsId && "Google Analytics", s.integrations.metaPixelId && "Pixel da Meta (Facebook e Instagram)"].filter(Boolean);
  const partners = [stripe && "processador de pagamento (Stripe)", "serviços de mapas para calcular a distância de entrega", s.shipping.enabled && "entregadores", ...analytics.map((a) => `ferramentas de análise e anúncios (${a})`)].filter(Boolean);
  return `Esta política explica como **${n}**${s.store.cnpj ? ` (CNPJ ${s.store.cnpj})` : ""}, responsável pela loja ${s.store.name}, trata os seus dados pessoais, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018, LGPD).

## Dados que coletamos

- **No pedido:** nome, WhatsApp, e-mail (opcional), CPF (opcional, para nota fiscal) e endereço de entrega.${stripe ? "\n- **No pagamento online:** os dados do cartão são digitados direto no ambiente da Stripe. A loja não recebe nem guarda o número do cartão." : ""}
- **Na navegação:** dados técnicos como endereço IP, navegador e páginas visitadas, usados para segurança e para melhorar o site.
- **Newsletter e notificações:** e-mail, se você se cadastrar, e a autorização do navegador para notificações, se você ativar.

## Para que usamos

- Processar, entregar e dar suporte aos seus pedidos.
- Calcular o frete pela localização do endereço.
- Conversar com você pelo WhatsApp sobre o pedido.
- Emitir nota fiscal e cumprir obrigações legais.
- Enviar ofertas, só com a sua autorização, com descadastro a qualquer momento.

## Compartilhamento

Compartilhamos dados apenas com quem precisa deles para concluir a compra: ${partners.join(", ")} e, quando exigido, autoridades públicas. **Não vendemos dados pessoais.**

## Cookies

Usamos cookies e o armazenamento do navegador para manter o carrinho, os favoritos e as suas preferências.${analytics.length ? ` Também usamos ${analytics.join(" e ")} para medir visitas e anúncios, só depois que você clica em **Aceitar** no aviso de cookies. Para mudar a escolha, apague os dados deste site nas configurações do navegador.` : ""}

## Seus direitos

A qualquer momento, você pode pedir (art. 18 da LGPD):

- confirmação de que tratamos seus dados e acesso a eles;
- correção de dados incompletos, errados ou desatualizados;
- anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desacordo com a lei;
- portabilidade dos dados para outro fornecedor;
- eliminação dos dados tratados com o seu consentimento e revogação do consentimento;
- informação sobre com quem compartilhamos seus dados;
- informação sobre a possibilidade de não dar o consentimento e o que acontece se você não der.

Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD). Alguns dados precisam ser guardados pelo prazo exigido em lei, como os de notas fiscais.

## Segurança e retenção

O site usa conexão criptografada (HTTPS), o acesso ao painel é restrito e protegido por senha e os dados ficam guardados só pelo tempo necessário para as finalidades acima.

## Canal de atendimento ao titular (LGPD)

Para exercer seus direitos ou tirar dúvidas sobre privacidade, fale com a gente ${contactLine(s)}.

${companyBlock(s)}`;
}

function termos(s: Settings) {
  const n = s.store.name;
  return `Ao usar o site da ${n} e fazer pedidos, você concorda com estes termos.

## Área de atendimento

${areaText(s)}${s.address.pickupEnabled ? " Também é possível retirar o pedido na loja." : ""}

## Preços e disponibilidade

- Preços, promoções e frete são calculados pelo site no momento do pedido.
- Promoções e ofertas relâmpago valem enquanto durar o prazo ou o estoque.
- Em caso de erro evidente de preço ou falta de estoque depois do pedido, entraremos em contato para corrigir ou cancelar, com devolução integral de qualquer valor pago.

## Pedido e confirmação

O pedido é registrado quando você finaliza o checkout e é **confirmado pela equipe da loja** pelo WhatsApp.${stripeIsReady(s) ? " Em pagamentos online, a confirmação depende da aprovação do pagamento." : ""}

## Formas de pagamento

${paymentList(s)}

## Cupons

Cupons têm regras próprias (valor mínimo, validade, limite de uso, primeira compra) e não se somam entre si. Cupons usados de forma irregular podem ser cancelados.

## Uso do site

É proibido usar o site para fins ilícitos, tentar acessar áreas restritas ou atrapalhar o funcionamento da loja. Textos, imagens e a marca ${n} não podem ser copiados sem autorização.

## Trocas, devoluções e privacidade

Valem as páginas [Trocas e devoluções](/pagina/trocas-e-devolucoes) e [Política de privacidade](/pagina/politica-de-privacidade).

## Alterações

Estes termos podem ser atualizados; a versão publicada no site é a que vale para novos pedidos.

${companyBlock(s)}`;
}

function entregas(s: Settings) {
  const sh = s.shipping;
  const rule = freeShippingRule(sh);
  const free = rule ? `- **Frete grátis:** ${[freeShippingMinimum(rule), freeShippingWhere(rule)].filter(Boolean).join(", ")}.` : null;
  const a = s.address;
  return `${areaText(s)}

## Como o frete é calculado

${
  sh.enabled
    ? `O frete é calculado pela distância ${sh.distanceMode === "route" ? "de rota" : ""} entre a loja e o seu endereço, e aparece na hora no carrinho, assim que você informa o CEP.

- Taxa de saída de ${formatBRL(sh.baseFeeCents)} mais ${formatBRL(sh.pricePerKmCents)} por km${sh.minFeeCents ? `, com valor mínimo de ${formatBRL(sh.minFeeCents)}` : ""}.${sh.extraPerItemCents ? `\n- ${formatBRL(sh.extraPerItemCents)} a mais por unidade a partir da segunda.` : ""}${free ? `\n${free}` : ""}
- Alguns produtos têm frete grátis sempre, indicado na página do produto.`
    : "No momento as compras são retiradas na loja."
}

## Prazo

${sh.etaText || "O prazo aparece no checkout."} Avisamos pelo WhatsApp quando o pedido sair para entrega, e você acompanha em **Acompanhar pedido**.

## Recebimento

- Confira a embalagem na frente do entregador. Se houver avaria, recuse e avise na hora.
- Confira se modelo, cor e voltagem são os do pedido.
- Guarde a nota fiscal e a embalagem: elas facilitam a troca e a garantia.
${
  a.pickupEnabled
    ? `
## Retirada na loja

Escolha **Retirar na loja** no checkout. ${s.address.pickupInstructions}${a.street ? `\n\nEndereço: ${a.street}${a.number ? `, ${a.number}` : ""}${a.neighborhood ? ` – ${a.neighborhood}` : ""}, ${a.city}/${a.state}.` : ""}${s.store.businessHours ? `\n\nHorário: ${s.store.businessHours}.` : ""}`
    : ""
}

${companyBlock(s)}`;
}

export function buildLegalPage(id: LegalPageId, s: Settings, opts: Partial<LegalOptions> = {}): { slug: string; title: string; content: string } {
  const o = { ...DEFAULTS, ...opts };
  const title = LEGAL_PAGES.find((p) => p.id === id)!.title;
  const content = id === "trocas-e-devolucoes" ? trocas(s, o) : id === "politica-de-privacidade" ? privacidade(s) : id === "termos-de-uso" ? termos(s) : entregas(s);
  return { slug: id, title, content: content.replace(/\n{3,}/g, "\n\n").trim() };
}

/** O que falta nas Configurações para as páginas ficarem completas (exigido para lojas online). */
export function legalMissing(s: Settings) {
  const out: string[] = [];
  if (!s.store.legalName) out.push("razão social");
  if (!s.store.cnpj) out.push("CNPJ");
  if (!s.address.street) out.push("endereço");
  if (!s.store.email) out.push("e-mail"); // Decreto 7.962/2013, art. 2º, II: endereço eletrônico
  return out;
}
