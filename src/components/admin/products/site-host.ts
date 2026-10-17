import { absoluteUrl } from "@/lib/utils";

/** Domínio da loja sem protocolo (ex.: tirvo.com.br), para as prévias de URL. */
export function siteHost() {
  return absoluteUrl("/").replace(/^https?:\/\//, "").replace(/\/+$/, "");
}
