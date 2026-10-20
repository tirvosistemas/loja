import type { AiProviderId } from "@/lib/settings";

// Provedores de IA aceitos no painel. Arquivo puro: usado nas Configurações (navegador) e no
// servidor. Os modelos mudam rápido, então o padrão é escolher sozinho pela lista do provedor
// (ver pickModel); o dono pode fixar um modelo nas Configurações.

export type AiProviderInfo = {
  id: AiProviderId;
  name: string;
  tag: string;
  text: string;
  keyField: "geminiKey" | "openaiKey" | "anthropicKey" | "deepseekKey" | "xaiKey" | "mistralKey" | "openrouterKey" | "customKey";
  keyHint: string;
  keyUrl: string | null;
  baseUrl: string;
  /** Modelo usado se a lista do provedor não responder. */
  fallbackModel: string;
};

export const AI_PROVIDERS: AiProviderInfo[] = [
  {
    id: "gemini",
    name: "Google Gemini",
    tag: "Tem plano grátis",
    text: "Lê bem fotos e textos em português. A chave do Google AI Studio tem cota grátis diária (com limite de pedidos por minuto).",
    keyField: "geminiKey",
    keyHint: "Começa com AIza.",
    keyUrl: "https://aistudio.google.com/apikey",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    fallbackModel: "gemini-flash-latest",
  },
  {
    id: "openai",
    name: "ChatGPT (OpenAI)",
    tag: "Pago por uso",
    text: "Os modelos do ChatGPT pela API da OpenAI. A assinatura do ChatGPT Plus não vale aqui: a API tem cobrança separada, com créditos.",
    keyField: "openaiKey",
    keyHint: "Começa com sk-.",
    keyUrl: "https://platform.openai.com/api-keys",
    baseUrl: "https://api.openai.com/v1",
    fallbackModel: "gpt-5-mini",
  },
  {
    id: "anthropic",
    name: "Claude (Anthropic)",
    tag: "Pago por uso",
    text: "Muito bom para ler caixa e manual e escrever descrições. Cobrança por uso, com créditos no Console da Anthropic.",
    keyField: "anthropicKey",
    keyHint: "Começa com sk-ant-.",
    keyUrl: "https://platform.claude.com/settings/keys",
    baseUrl: "https://api.anthropic.com",
    fallbackModel: "claude-sonnet-5-5",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    tag: "Pago, muito barato",
    text: "Custo bem baixo. Alguns modelos não leem fotos: nesse caso o texto é escrito só com o que você já preencheu.",
    keyField: "deepseekKey",
    keyHint: "Começa com sk-.",
    keyUrl: "https://platform.deepseek.com/api_keys",
    baseUrl: "https://api.deepseek.com/v1",
    fallbackModel: "deepseek-chat",
  },
  {
    id: "xai",
    name: "Grok (xAI)",
    tag: "Pago por uso",
    text: "Os modelos Grok, da xAI. Chave criada no console da xAI, com créditos.",
    keyField: "xaiKey",
    keyHint: "Começa com xai-.",
    keyUrl: "https://console.x.ai",
    baseUrl: "https://api.x.ai/v1",
    fallbackModel: "grok-4",
  },
  {
    id: "mistral",
    name: "Mistral",
    tag: "Tem plano grátis",
    text: "IA europeia com plano gratuito para testes (limites baixos). Lê fotos nos modelos Medium e Small.",
    keyField: "mistralKey",
    keyHint: "Chave do La Plateforme.",
    keyUrl: "https://console.mistral.ai/api-keys",
    baseUrl: "https://api.mistral.ai/v1",
    fallbackModel: "mistral-medium-latest",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    tag: "Vários modelos, alguns grátis",
    text: "Uma chave só para centenas de modelos (Gemini, GPT, Claude, Llama, Qwen…), inclusive gratuitos. Informe o modelo, ex.: google/gemini-3.5-flash.",
    keyField: "openrouterKey",
    keyHint: "Começa com sk-or-.",
    keyUrl: "https://openrouter.ai/settings/keys",
    baseUrl: "https://openrouter.ai/api/v1",
    fallbackModel: "openrouter/auto",
  },
  {
    id: "custom",
    name: "Outro provedor",
    tag: "Compatível com a API da OpenAI",
    text: "Para qualquer serviço que siga o padrão da OpenAI (Groq, Together, Qwen, Kimi, um servidor próprio…). Informe o endereço da API e o modelo.",
    keyField: "customKey",
    keyHint: "A chave do serviço escolhido.",
    keyUrl: null,
    baseUrl: "",
    fallbackModel: "",
  },
];

export function aiProvider(id: AiProviderId): AiProviderInfo {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0];
}

const SKIP = /(embed|tts|audio|realtime|transcri|whisper|image|imagine|dall|moderation|search|computer|codex|live|guard|ocr|speech|veo|lyria|robotics|learnlm|gemma|aqa)/i;

/**
 * Partes da versão para ordenar (gemini-3.5-flash → [3, 5]; claude-sonnet-5-5 → [5, 5];
 * grok-4-0709 → [4]). Data no fim e sufixos longos não contam como versão.
 */
function version(id: string) {
  const m = id.replace(/-\d{8}$/, "").match(/\d+(?:[.-]\d{1,2}(?!\d))*/);
  return m ? m[0].split(/[.-]/).map(Number) : [];
}

function compareVersions(a: number[], b: number[]) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

function newest(ids: string[]) {
  return [...ids].sort((a, b) => compareVersions(version(b), version(a)) || a.length - b.length)[0];
}

/**
 * Escolhe um modelo bom e barato da lista do provedor: o Flash mais novo do Gemini, o "mini"
 * mais novo da OpenAI e assim por diante. Sem lista ou sem candidato, usa o modelo reserva.
 */
export function pickModel(provider: AiProviderId, available: string[]): string {
  const info = aiProvider(provider);
  const ids = available.map((m) => m.replace(/^models\//, "")).filter((m) => !SKIP.test(m));
  const stable = (list: string[]) => {
    const s = list.filter((m) => !/(preview|exp|beta|alpha)/i.test(m));
    return s.length ? s : list;
  };
  let pick: string | undefined;
  switch (provider) {
    case "gemini": {
      if (ids.includes("gemini-flash-latest")) return "gemini-flash-latest";
      pick = newest(stable(ids.filter((m) => /^gemini-[\d.]+-flash(-\d+)?$/.test(m) || /^gemini-[\d.]+-flash-(preview|exp)/.test(m))));
      break;
    }
    case "openai":
      pick = newest(stable(ids.filter((m) => /^gpt-[\d.]+-mini$/.test(m)))) ?? newest(stable(ids.filter((m) => /^gpt-[\d.]+$/.test(m))));
      break;
    case "anthropic":
      pick = newest(ids.filter((m) => /^claude-sonnet-/.test(m))) ?? newest(ids.filter((m) => /^claude-/.test(m)));
      break;
    case "deepseek":
      pick = ids.find((m) => /flash/.test(m) && !/vision/.test(m)) ?? ids.find((m) => /chat/.test(m));
      break;
    case "xai":
      pick = newest(stable(ids.filter((m) => /^grok-[\d.]+(-fast)?(-\d+)?$/.test(m) && !/vision/.test(m))));
      break;
    case "mistral":
      pick = ids.find((m) => m === "mistral-medium-latest") ?? ids.find((m) => m === "mistral-small-latest");
      break;
    case "openrouter":
    case "custom":
      return info.fallbackModel;
  }
  return pick ?? info.fallbackModel;
}
