// Copia um pacote do node_modules com todas as suas dependências (mesmas versões do
// package-lock), para levar à imagem final só o necessário. Usado no Dockerfile:
//
//   node docker/collect-deps.cjs <destino/node_modules> prisma sharp
//
// O Next (output "standalone") já copia o que o site usa; aqui entram a CLI do Prisma
// (para "migrate deploy" ao iniciar) e o sharp com os binários da plataforma.

const fs = require("node:fs");
const path = require("node:path");

const [dest, ...roots] = process.argv.slice(2);
if (!dest || !roots.length) {
  console.error("uso: node docker/collect-deps.cjs <destino> <pacote> [pacote...]");
  process.exit(1);
}

const base = path.resolve("node_modules");
const seen = new Set();

/** Resolução do Node: procura em node_modules subindo a partir da pasta do pacote. */
function resolve(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, "node_modules", name);
    if (fs.existsSync(path.join(candidate, "package.json"))) return candidate;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

function visit(pkgDir) {
  if (seen.has(pkgDir)) return;
  seen.add(pkgDir);
  const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, "package.json"), "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.optionalDependencies };
  for (const name of Object.keys(deps)) {
    const found = resolve(name, pkgDir);
    if (found) visit(found); // opcionais de outras plataformas não estão instalados: tudo bem
  }
}

for (const name of roots) {
  const dir = resolve(name, path.dirname(base));
  if (!dir) {
    console.error(`pacote não encontrado: ${name}`);
    process.exit(1);
  }
  visit(dir);
}

// Pacotes aninhados (pkg/node_modules/dep) já vêm junto com a pasta do pacote pai.
const dirs = [...seen].filter((d) => ![...seen].some((o) => o !== d && d.startsWith(o + path.sep)));
for (const dir of dirs) {
  const rel = path.relative(base, dir);
  fs.cpSync(dir, path.join(dest, rel), { recursive: true, dereference: false });
}
console.log(`${seen.size} pacotes copiados para ${dest}`);
