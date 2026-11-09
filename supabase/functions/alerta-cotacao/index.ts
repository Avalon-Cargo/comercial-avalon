// Edge Function: alerta-cotacao
// Disparada por Database Webhook (INSERT em public.cotacoes).
// Envia e-mail para os endereços em parametros.empresa.email_alerta via Resend.
// Secrets necessários (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY      chave da conta Resend
//   ALERTA_FROM         ex.: "Avalon Cotações <cotacao@avaloncargo.com.br>" (domínio verificado no Resend)
//   APP_URL             ex.: https://cotacao.avaloncargo.com.br
//   WEBHOOK_SECRET      mesmo valor configurado no header x-webhook-secret do Database Webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EQUIP: Record<string, string> = {
  dry40: "Contêiner 40' DRY/HC", dry20: "Contêiner 20' DRY",
  reefer40: "Reefer 40'", reefer20: "Reefer 20'",
  opentop40: "Open Top 40'", opentop20: "Open Top 20'",
  flatrack40: "Flat Rack 40'", flatrack20: "Flat Rack 20'", solta: "Carga solta",
};
const OPER: Record<string, string> = { imp: "Importação", exp: "Exportação", cabotagem: "Cabotagem", nacional: "Transferência nacional" };

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  const secret = Deno.env.get("WEBHOOK_SECRET");
  if (secret && req.headers.get("x-webhook-secret") !== secret) return new Response("forbidden", { status: 403 });

  const payload = await req.json().catch(() => null);
  const c = payload?.record;
  if (!c || payload.type !== "INSERT") return new Response("ignored", { status: 200 });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: emp } = await sb.from("parametros").select("valor").eq("chave", "empresa").single();
  const destinos: string[] = emp?.valor?.email_alerta ?? [];
  if (!destinos.length) return new Response("sem destinatarios", { status: 200 });

  const app = Deno.env.get("APP_URL") ?? "";
  const fmtKg = (n: number | null) => n ? Number(n).toLocaleString("pt-BR") + " kg" : "—";
  const html = `
  <div style="font-family:Arial,sans-serif;color:#3f4043;max-width:600px">
    <div style="background:#9E1B32;color:#fff;padding:14px 18px;font-weight:800;letter-spacing:.5px">AVALON CARGO · Nova solicitação de cotação</div>
    <div style="padding:18px;border:1px solid #e6e4e2;border-top:0">
      <p style="margin:0 0 10px;font-size:18px"><b>${c.protocolo}</b> — ${c.empresa}</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:4px 12px 4px 0;color:#8a8b8e">Rota</td><td><b>${c.origem} → ${c.destino}</b></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#8a8b8e">Equipamento</td><td>${EQUIP[c.equipamento] ?? c.equipamento} × ${c.qtde ?? 1}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#8a8b8e">Operação</td><td>${OPER[c.operacao] ?? c.operacao ?? "—"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#8a8b8e">Mercadoria</td><td>${c.mercadoria ?? "—"} · ${fmtKg(c.peso_kg)}${c.imo ? " · <b style='color:#9E1B32'>IMO</b>" : ""}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#8a8b8e">Contato</td><td>${c.email ?? "—"} · ${c.fone ?? "—"}</td></tr>
        ${c.obs ? `<tr><td style="padding:4px 12px 4px 0;color:#8a8b8e">Obs.</td><td>${c.obs}</td></tr>` : ""}
      </table>
      ${app ? `<p style="margin:18px 0 0"><a href="${app}" style="background:#9E1B32;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:700">Abrir na Área Avalon</a></p>` : ""}
    </div>
  </div>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("ALERTA_FROM") ?? "Avalon Cotações <onboarding@resend.dev>",
      to: destinos,
      subject: `[Cotação] ${c.protocolo} · ${c.empresa} · ${c.origem} → ${c.destino}`,
      html,
    }),
  });
  const body = await r.text();
  await sb.from("eventos").insert({ cotacao_id: c.id, tipo: "alerta_email", detalhe: { ok: r.ok, destinos, resposta: body.slice(0, 300) } });
  return new Response(body, { status: r.ok ? 200 : 502 });
});
