"use client";

import { useRef, useState, useTransition } from "react";
import { Crosshair, ExternalLink, Loader2, LocateFixed, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { relocateStoreAction, saveAddressSettings } from "@/app/admin/(panel)/configuracoes/actions";
import { Callout, NumberInput, SaveBar, Section, SettingsField, maskCep, useSettingsForm } from "./form-kit";

export type AddressFormValues = {
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  lat: number | null;
  lng: number | null;
  showOnSite: boolean;
  pickupEnabled: boolean;
  pickupInstructions: string;
};

function mapEmbed(lat: number, lng: number) {
  const bbox = [lng - 0.01, lat - 0.006, lng + 0.01, lat + 0.006].map((n) => n.toFixed(6)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export function AddressForm({ initial }: { initial: AddressFormValues }) {
  const f = useSettingsForm({ ...initial, cep: maskCep(initial.cep) }, saveAddressSettings, {
    onSaved: (data, values) => (data ? { ...values, ...data.address, cep: maskCep(data.address.cep) } : values),
  });
  const { values: v, set, patch, errors: e } = f;
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [locating, startLocate] = useTransition();
  const numberRef = useRef<HTMLInputElement>(null);
  const lastCep = useRef(initial.cep.replace(/\D/g, ""));
  const hasPoint = v.lat != null && v.lng != null;

  const fillFromCep = async (masked: string) => {
    const digits = masked.replace(/\D/g, "");
    if (digits.length !== 8 || digits === lastCep.current) return;
    lastCep.current = digits;
    setCepLoading(true);
    setCepError(null);
    try {
      const res = await fetch(`/api/cep/${digits}`);
      if (!res.ok) {
        if (res.status !== 404) lastCep.current = ""; // falha passageira: deixa tentar o mesmo CEP de novo
        setCepError(res.status === 404 ? "CEP não encontrado. Preencha o endereço manualmente." : "Não foi possível consultar o CEP agora.");
        return;
      }
      const info = (await res.json()) as { street: string; neighborhood: string; city: string; state: string };
      patch({
        street: info.street || v.street,
        neighborhood: info.neighborhood || v.neighborhood,
        city: info.city || v.city,
        state: info.state || v.state,
        // Endereço novo: as coordenadas antigas não valem mais.
        lat: null,
        lng: null,
      });
      requestAnimationFrame(() => numberRef.current?.focus());
    } catch {
      lastCep.current = "";
      setCepError("Não foi possível consultar o CEP agora.");
    } finally {
      setCepLoading(false);
    }
  };

  const relocate = () =>
    startLocate(async () => {
      if (f.dirty) {
        toast.error("Salve as alterações do endereço antes de localizar de novo.");
        return;
      }
      const r = await relocateStoreAction();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (r.data) f.commit({ lat: r.data.address.lat, lng: r.data.address.lng });
      toast.success(r.message ?? "Endereço localizado.");
    });

  return (
    <form onSubmit={f.submit} noValidate className="space-y-5">
      <Callout title="O frete é calculado a partir deste endereço">
        A distância até o cliente sai daqui (rota de carro ou linha reta, conforme a aba Frete). Confira no mapa se o ponto está certinho.
      </Callout>

      <Section title="Endereço da loja" description="De onde saem as entregas e onde o cliente retira.">
        <div className="grid gap-4 sm:grid-cols-6">
          <SettingsField name="cep" label="CEP" htmlFor="ad-cep" required error={e.cep ?? cepError ?? undefined} className="sm:col-span-2">
            <Input
              id="ad-cep"
              inputMode="numeric"
              autoComplete="postal-code"
              placeholder="80000-000"
              value={v.cep}
              onChange={(x) => {
                const m = maskCep(x.target.value);
                set("cep", m);
                if (m.replace(/\D/g, "").length < 8) setCepError(null);
                void fillFromCep(m);
              }}
              aria-invalid={!!(e.cep || cepError)}
              trailing={cepLoading ? <Loader2 className="mr-1.5 size-4 animate-spin text-subtle" aria-label="Buscando CEP" /> : undefined}
            />
          </SettingsField>
          <SettingsField name="street" label="Rua" htmlFor="ad-street" required error={e.street} className="sm:col-span-4">
            <Input id="ad-street" autoComplete="address-line1" value={v.street} onChange={(x) => set("street", x.target.value)} aria-invalid={!!e.street} />
          </SettingsField>
          <SettingsField name="number" label="Número" htmlFor="ad-number" required error={e.number} className="sm:col-span-2">
            <Input id="ad-number" ref={numberRef} value={v.number} maxLength={20} onChange={(x) => set("number", x.target.value)} aria-invalid={!!e.number} />
          </SettingsField>
          <SettingsField name="complement" label="Complemento" htmlFor="ad-comp" error={e.complement} className="sm:col-span-4">
            <Input id="ad-comp" autoComplete="address-line2" placeholder="Loja 2, fundos…" value={v.complement} onChange={(x) => set("complement", x.target.value)} aria-invalid={!!e.complement} />
          </SettingsField>
          <SettingsField name="neighborhood" label="Bairro" htmlFor="ad-nb" required error={e.neighborhood} className="sm:col-span-3">
            <Input id="ad-nb" value={v.neighborhood} onChange={(x) => set("neighborhood", x.target.value)} aria-invalid={!!e.neighborhood} />
          </SettingsField>
          <SettingsField name="city" label="Cidade" htmlFor="ad-city" required error={e.city} className="sm:col-span-2">
            <Input id="ad-city" autoComplete="address-level2" value={v.city} onChange={(x) => set("city", x.target.value)} aria-invalid={!!e.city} />
          </SettingsField>
          <SettingsField name="state" label="UF" htmlFor="ad-uf" required error={e.state} className="sm:col-span-1">
            <Input id="ad-uf" maxLength={2} autoComplete="address-level1" value={v.state} onChange={(x) => set("state", x.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} aria-invalid={!!e.state} />
          </SettingsField>
        </div>
      </Section>

      <Section
        title="Localização no mapa"
        description={hasPoint ? "Ponto usado como saída das entregas." : "Ao salvar, localizamos o endereço automaticamente."}
        action={
          <Button type="button" variant="secondary" size="sm" className="h-10 shrink-0" onClick={relocate} loading={locating}>
            <LocateFixed aria-hidden /> <span className="hidden sm:inline">Localizar novamente</span>
            <span className="sm:hidden">Localizar</span>
          </Button>
        }
      >
        {hasPoint ? (
          <div className="overflow-hidden rounded-xl border border-border bg-well">
            <iframe
              key={`${v.lat},${v.lng}`}
              title="Mapa com a localização da loja"
              src={mapEmbed(v.lat!, v.lng!)}
              className="block h-64 w-full sm:h-80"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-3.5 py-2.5 text-[13px]">
              <span className="tabular flex items-center gap-1.5 font-mono text-muted-foreground">
                <Crosshair className="size-3.5 text-primary" aria-hidden />
                {v.lat!.toFixed(6)}, {v.lng!.toFixed(6)}
              </span>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                Ver no Google Maps <ExternalLink className="size-3" aria-hidden />
              </a>
            </div>
          </div>
        ) : (
          <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-border-strong bg-elevated/40 px-6 py-12 text-center">
            <MapPin className="size-7 text-subtle" aria-hidden />
            <p className="text-sm font-medium">Endereço ainda não localizado</p>
            <p className="max-w-sm text-[13px] text-muted-foreground">Salve o endereço para localizarmos no mapa. Sem a localização, o frete por km não pode ser calculado.</p>
          </div>
        )}

        <details className="group rounded-xl border border-border px-4 py-3" open={!hasPoint && !!(e.lat || e.lng)}>
          <summary className="cursor-pointer select-none text-sm font-medium marker:text-subtle">Ajuste fino das coordenadas</summary>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Se o ponto ficou no lugar errado, abra o Google Maps, clique com o botão direito em cima da loja e copie os números (latitude, longitude).
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <SettingsField name="lat" label="Latitude" htmlFor="ad-lat" error={e.lat}>
              <NumberInput id="ad-lat" value={v.lat} allowEmpty min={-90} max={90} step={0.000001} placeholder="-25.4284" onChange={(n) => set("lat", n)} aria-invalid={!!e.lat} />
            </SettingsField>
            <SettingsField name="lng" label="Longitude" htmlFor="ad-lng" error={e.lng}>
              <NumberInput id="ad-lng" value={v.lng} allowEmpty min={-180} max={180} step={0.000001} placeholder="-49.2733" onChange={(n) => set("lng", n)} aria-invalid={!!e.lng} />
            </SettingsField>
          </div>
        </details>
      </Section>

      <Section title="Site e retirada">
        <Switch checked={v.showOnSite} onChange={(c) => set("showOnSite", c)} label="Mostrar endereço no site" description="Exibe o endereço no rodapé e na página de contato." />
        <Switch
          checked={v.pickupEnabled}
          onChange={(c) => set("pickupEnabled", c)}
          label="Permitir retirada na loja"
          description="O cliente pode escolher retirar o pedido em vez de receber por motoboy."
        />
        {v.pickupEnabled && (
          <SettingsField name="pickupInstructions" label="Instruções para retirada" htmlFor="ad-pickup" error={e.pickupInstructions} hint="Aparecem no checkout e na página do pedido.">
            <Textarea id="ad-pickup" rows={3} maxLength={300} value={v.pickupInstructions} onChange={(x) => set("pickupInstructions", x.target.value)} aria-invalid={!!e.pickupInstructions} />
          </SettingsField>
        )}
      </Section>

      <SaveBar dirty={f.dirty} pending={f.pending} onReset={f.reset} />
    </form>
  );
}
