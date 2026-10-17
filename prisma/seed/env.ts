import { existsSync } from "node:fs";
import path from "node:path";

// Carrega o .env da raiz quando o seed roda fora do Next (npx tsx prisma/seed.ts).
// Variáveis já definidas no ambiente (Docker, CI) têm prioridade.
const file = path.resolve(process.cwd(), ".env");
if (existsSync(file)) process.loadEnvFile(file);
