"use client";

/**
 * Recarrega o endereço que a pessoa tentou abrir (a página offline aparece no lugar dele).
 * É um formulário GET sem action: funciona mesmo sem JavaScript (sem internet os scripts desta
 * página podem não estar no aparelho); com JavaScript, recarrega o endereço completo.
 */
export function RetryButton() {
  return (
    <form
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        window.location.reload();
      }}
    >
      <button type="submit" className="h-12 rounded-xl bg-primary px-6 font-medium text-primary-foreground transition hover:bg-primary-hover">
        Tentar de novo
      </button>
    </form>
  );
}
