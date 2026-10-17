import path from "node:path";
import { describe, expect, it } from "vitest";
import { clientIp } from "@/lib/rate-limit";
import { isPushEndpoint } from "@/lib/validators";
import { resolveUploadPath, uploadRoot } from "@/lib/uploads";

describe("clientIp", () => {
  it("usa o X-Real-IP do Caddy mesmo se o visitante inventar outros cabeçalhos", () => {
    const h = new Headers({ "x-real-ip": "200.1.2.3", "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "9.9.9.9" });
    expect(clientIp(h)).toBe("200.1.2.3");
  });

  it("cai para o primeiro X-Forwarded-For e depois para 'local'", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "10.0.0.1, 172.16.0.1" }))).toBe("10.0.0.1");
    expect(clientIp(new Headers())).toBe("local");
  });
});

describe("isPushEndpoint", () => {
  it("aceita os serviços de push dos navegadores", () => {
    for (const ep of [
      "https://fcm.googleapis.com/fcm/send/abc:APA91b",
      "https://updates.push.services.mozilla.com/wpush/v2/gAAAA",
      "https://web.push.apple.com/QGuQyavXutnMH",
      "https://wns2-par02p.notify.windows.com/w/?token=BQYAAA",
      "https://fcm.googleapis.com:443/fcm/send/x",
    ]) {
      expect(isPushEndpoint(ep), ep).toBe(true);
    }
  });

  it("recusa endereços internos, IPs e protocolos sem TLS", () => {
    for (const ep of [
      "http://fcm.googleapis.com/fcm/send/x",
      "https://127.0.0.1/x",
      "https://2130706433/x",
      "https://0x7f.1/x",
      "https://[::1]/x",
      "https://localhost/x",
      "https://mysql/x",
      "https://app.internal/x",
      "https://fcm.googleapis.com:8443/x",
      "https://user:pass@fcm.googleapis.com/x",
      "javascript:alert(1)",
      "não é url",
    ]) {
      expect(isPushEndpoint(ep), ep).toBe(false);
    }
  });
});

describe("resolveUploadPath", () => {
  it("fica sempre dentro da pasta de uploads", () => {
    const root = uploadRoot();
    expect(resolveUploadPath("products/2026/10/abc-sm.webp")).toBe(path.join(root, "products/2026/10/abc-sm.webp"));
    expect(resolveUploadPath("../.env")).toBeNull();
    expect(resolveUploadPath("products/../../package.json")).toBeNull();
    expect(resolveUploadPath("/etc/passwd")).toBeNull();
    expect(resolveUploadPath("")).toBeNull();
  });
});
