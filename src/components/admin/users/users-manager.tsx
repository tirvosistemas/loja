"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Pencil, Plus, ShieldCheck, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AdminTable } from "@/components/admin/page-header";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { createUserAction, deleteUserAction, resetPasswordAction, updateUserAction } from "@/app/admin/(panel)/usuarios/actions";

export type Role = "OWNER" | "ADMIN" | "EDITOR";
export type UserRow = { id: string; name: string; email: string; role: Role; active: boolean; lastLoginAt: string | null; createdAt: string };

export const ROLE_INFO: Record<Role, { label: string; description: string; tone: "accent" | "info" | "neutral" }> = {
  OWNER: { label: "Dono", description: "Acesso total, inclusive usuários e outros donos.", tone: "accent" },
  ADMIN: { label: "Administrador", description: "Tudo, inclusive configurações e usuários, menos gerenciar donos.", tone: "info" },
  EDITOR: { label: "Editor", description: "Pedidos, catálogo e marketing. Não acessa configurações nem usuários.", tone: "neutral" },
};

function generatePassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function PasswordField({ id, value, onChange, error, label = "Senha" }: { id: string; value: string; onChange: (v: string) => void; error?: string; label?: string }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} htmlFor={id} required error={error} hint="Pelo menos 8 caracteres. Envie para a pessoa por um canal seguro.">
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Input
            id={id}
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!error}
            className="font-mono"
            trailing={
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar senha" : "Mostrar senha"} className="grid size-9 place-items-center rounded-lg text-subtle hover:bg-elevated hover:text-foreground">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            onChange(generatePassword());
            setShow(true);
          }}
        >
          <Wand2 aria-hidden /> Gerar
        </Button>
      </div>
    </Field>
  );
}

function RolePicker({ value, onChange, canOwner, error }: { value: Role; onChange: (r: Role) => void; canOwner: boolean; error?: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">Papel</legend>
      <div className="space-y-2">
        {(Object.keys(ROLE_INFO) as Role[]).map((r) => {
          const disabled = r === "OWNER" && !canOwner;
          return (
            <label
              key={r}
              className={cn(
                "flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors",
                value === r ? "border-primary bg-primary-soft" : "border-border hover:border-border-strong",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <input type="radio" name="role" value={r} checked={value === r} disabled={disabled} onChange={() => onChange(r)} className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{ROLE_INFO[r].label}</span>
                <span className="block text-[13px] text-muted-foreground">{disabled ? "Só um dono pode criar ou promover donos." : ROLE_INFO[r].description}</span>
              </span>
            </label>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
    </fieldset>
  );
}

type DialogState = { kind: "create" } | { kind: "edit"; user: UserRow } | { kind: "password"; user: UserRow } | null;

export function UsersManager({ users, currentUserId, currentRole }: { users: UserRow[]; currentUserId: string; currentRole: Role }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  // Mantém o conteúdo durante a animação de fechar.
  const [shown, setShown] = useState<NonNullable<DialogState>>({ kind: "create" });
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "EDITOR" as Role, active: true });
  const isOwner = currentRole === "OWNER";

  const open = (d: NonNullable<DialogState>) => {
    setErrors({});
    if (d.kind === "create") setForm({ name: "", email: "", password: "", role: "EDITOR", active: true });
    else setForm({ name: d.user.name, email: d.user.email, password: "", role: d.user.role, active: d.user.active });
    setDialog(d);
    setShown(d);
  };
  const close = () => setDialog(null);
  const canManage = (u: UserRow) => isOwner || u.role !== "OWNER";

  const submit = () =>
    start(async () => {
      if (!dialog) return;
      const r =
        dialog.kind === "create"
          ? await createUserAction({ name: form.name, email: form.email, password: form.password, role: form.role })
          : dialog.kind === "edit"
            ? await updateUserAction({ id: dialog.user.id, name: form.name, role: form.role, active: form.active })
            : await resetPasswordAction({ id: dialog.user.id, password: form.password });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Salvo.");
      close();
      router.refresh();
    });

  const title = shown.kind === "create" ? "Novo usuário" : shown.kind === "edit" ? "Editar usuário" : "Redefinir senha";

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => open({ kind: "create" })}>
          <Plus aria-hidden /> Novo usuário
        </Button>
      </div>

      <AdminTable className="hidden md:block">
        <thead>
          <tr>
            <th scope="col">Usuário</th>
            <th scope="col">Papel</th>
            <th scope="col">Situação</th>
            <th scope="col">Último acesso</th>
            <th scope="col" className="!text-right">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <p className="font-medium">
                  {u.name} {u.id === currentUserId && <span className="text-xs font-normal text-subtle">(você)</span>}
                </p>
                <p className="text-xs text-subtle">{u.email}</p>
              </td>
              <td>
                <Badge tone={ROLE_INFO[u.role].tone}>
                  {u.role === "OWNER" && <ShieldCheck aria-hidden />}
                  {ROLE_INFO[u.role].label}
                </Badge>
              </td>
              <td>{u.active ? <Badge tone="success">Ativo</Badge> : <Badge>Desativado</Badge>}</td>
              <td className="tabular text-[13px] text-muted-foreground">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Nunca entrou"}</td>
              <td>
                <RowActions user={u} self={u.id === currentUserId} canManage={canManage(u)} onEdit={() => open({ kind: "edit", user: u })} onPassword={() => open({ kind: "password", user: u })} />
              </td>
            </tr>
          ))}
        </tbody>
      </AdminTable>

      <ul className="space-y-2.5 md:hidden">
        {users.map((u) => (
          <li key={u.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {u.name} {u.id === currentUserId && <span className="text-xs font-normal text-subtle">(você)</span>}
                </p>
                <p className="truncate text-xs text-subtle">{u.email}</p>
              </div>
              <Badge tone={ROLE_INFO[u.role].tone}>{ROLE_INFO[u.role].label}</Badge>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {u.active ? "Ativo" : "Desativado"} · {u.lastLoginAt ? `entrou em ${formatDateTime(u.lastLoginAt)}` : "nunca entrou"}
              </p>
            </div>
            <div className="mt-3 border-t border-border pt-3">
              <RowActions user={u} self={u.id === currentUserId} canManage={canManage(u)} onEdit={() => open({ kind: "edit", user: u })} onPassword={() => open({ kind: "password", user: u })} />
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={!!dialog}
        onClose={close}
        title={title}
        description={shown.kind !== "create" ? shown.user.email : "A pessoa entra em /admin com o e-mail e a senha abaixo."}
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button type="submit" form="user-form" loading={pending}>
              {shown.kind === "create" ? "Criar usuário" : shown.kind === "password" ? "Redefinir senha" : "Salvar"}
            </Button>
          </>
        }
      >
        <form
          id="user-form"
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {shown.kind !== "password" && (
            <Field label="Nome" htmlFor="u-name" required error={errors.name}>
              <Input id="u-name" value={form.name} maxLength={80} autoComplete="off" onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!errors.name} />
            </Field>
          )}
          {shown.kind === "create" && (
            <Field label="E-mail" htmlFor="u-email" required error={errors.email}>
              <Input id="u-email" type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={!!errors.email} />
            </Field>
          )}
          {(shown.kind === "create" || shown.kind === "password") && (
            <PasswordField id="u-pass" label={shown.kind === "password" ? "Nova senha" : "Senha"} value={form.password} onChange={(p) => setForm({ ...form, password: p })} error={errors.password} />
          )}
          {shown.kind !== "password" && (
            <RolePicker
              value={form.role}
              onChange={(r) => setForm({ ...form, role: r })}
              canOwner={isOwner}
              error={errors.role}
            />
          )}
          {shown.kind === "edit" && (
            <Switch
              checked={form.active}
              onChange={(a) => setForm({ ...form, active: a })}
              disabled={shown.user.id === currentUserId}
              label="Acesso ativo"
              description={shown.user.id === currentUserId ? "Você não pode desativar a sua própria conta." : "Desativado, o usuário não consegue entrar no painel."}
            />
          )}
        </form>
      </Dialog>
    </>
  );
}

function RowActions({ user, self, canManage, onEdit, onPassword }: { user: UserRow; self: boolean; canManage: boolean; onEdit: () => void; onPassword: () => void }) {
  const router = useRouter();
  if (!canManage) return <p className="text-right text-xs text-subtle">Só um dono pode alterar</p>;
  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="sm" className="h-10 sm:h-9" onClick={onEdit}>
        <Pencil aria-hidden /> Editar
      </Button>
      {!self && (
        <Button variant="ghost" size="sm" className="h-10 sm:h-9" onClick={onPassword}>
          <KeyRound aria-hidden /> Senha
        </Button>
      )}
      {!self && (
        <ConfirmButton
          variant="danger-ghost"
          size="sm"
          className="h-10 sm:h-9"
          aria-label={`Excluir ${user.name}`}
          title={`Excluir ${user.name}?`}
          description="A pessoa perde o acesso ao painel na hora. Os pedidos e registros continuam."
          successMessage="Usuário excluído."
          onConfirm={async () => {
            const r = await deleteUserAction(user.id);
            if (r.ok) router.refresh();
            return r;
          }}
        >
          <Trash2 aria-hidden />
          <span className="sr-only sm:not-sr-only">Excluir</span>
        </ConfirmButton>
      )}
    </div>
  );
}
