import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const app = express();
const port = Number(process.env.PORT || 3001);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(currentDir, "../dist");

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 6,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente." }
});

const slugSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/, "Identificador inválido.");
const leadSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(100),
  phone: z.string().transform((value) => value.replace(/\D/g, ""))
    .refine((value) => value.length >= 10 && value.length <= 13, "Informe um telefone com DDD válido."),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional().default(""),
  marketingOptIn: z.boolean().default(false),
  privacyAcknowledged: z.literal(true),
  privacyNoticeVersion: z.string().trim().max(30).optional().default("draft-2"),
  eventId: z.string().uuid(),
  partnerSlug: slugSchema,
  pagePath: z.string().trim().max(500).optional().default(""),
  campaignSource: z.string().trim().max(120).optional().default(""),
  campaignMedium: z.string().trim().max(120).optional().default(""),
  campaignName: z.string().trim().max(120).optional().default(""),
  campaignContent: z.string().trim().max(120).optional().default(""),
  campaignTerm: z.string().trim().max(120).optional().default(""),
  website: z.string().max(0).optional().default("")
});

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "streaming-leads-api" });
});

// Only configured partners are returned. The URL never supplies a raw Meta Pixel ID.
app.get("/api/config", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const requestedPartner = typeof req.query.partner === "string" ? req.query.partner.trim() : "";
  const defaultPartner = process.env.DEFAULT_PARTNER_SLUG || "";
  const partnerSlug = requestedPartner || defaultPartner;

  const parsedSlug = slugSchema.safeParse(partnerSlug);
  if (!parsedSlug.success) {
    return res.status(400).json({ active: false, error: "Identificador de campanha inválido." });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ active: false, error: "Campanha ainda não configurada." });
  }

  try {
    const { data, error } = await supabase
      .from("campaign_partners")
      .select("slug, public_name, meta_pixel_id, active")
      .eq("slug", parsedSlug.data)
      .eq("active", true)
      .maybeSingle();

    if (error) {
      console.error("Campaign config lookup failed:", error.code || "unknown");
      return res.status(503).json({ active: false, error: "Não foi possível carregar a campanha." });
    }
    if (!data) return res.status(404).json({ active: false });

    return res.json({
      active: true,
      partnerSlug: data.slug,
      publicName: data.public_name || null,
      pixelId: data.meta_pixel_id || null
    });
  } catch {
    return res.status(503).json({ active: false, error: "Não foi possível carregar a campanha." });
  }
});

app.post("/api/leads", leadLimiter, async (req, res) => {
  const origin = req.get("origin");
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: "Origem da solicitação não permitida." });
  }

  if (typeof req.body?.website === "string" && req.body.website.trim() !== "") {
    return res.status(422).json({ error: "Não foi possível validar o envio. Revise os campos e tente novamente." });
  }

  const parsed = leadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Confira os campos e tente enviar novamente.",
      fields: parsed.error.flatten().fieldErrors
    });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: "O formulário ainda está em configuração. Tente novamente mais tarde." });
  }
  if (process.env.NODE_ENV === "production" && !process.env.ALLOWED_ORIGINS) {
    return res.status(503).json({ error: "O formulário ainda está em configuração. Tente novamente mais tarde." });
  }

  const lead = parsed.data;
  try {
    const { data: partner, error: partnerError } = await supabase
      .from("campaign_partners")
      .select("id, slug")
      .eq("slug", lead.partnerSlug)
      .eq("active", true)
      .maybeSingle();

    if (partnerError || !partner) {
      if (partnerError) console.error("Lead campaign lookup failed:", partnerError.code || "unknown");
      return res.status(400).json({ error: "Esta campanha não está ativa. Confira o link com quem enviou a oferta." });
    }

    const record = {
      partner_id: partner.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email || null,
      message: null,
      marketing_opt_in: lead.marketingOptIn,
      marketing_opt_in_at: lead.marketingOptIn ? new Date().toISOString() : null,
      privacy_notice_version: lead.privacyNoticeVersion || "draft-2",
      privacy_notice_acknowledged_at: new Date().toISOString(),
      event_id: lead.eventId,
      page_path: lead.pagePath || null,
      campaign_source: lead.campaignSource || null,
      campaign_medium: lead.campaignMedium || null,
      campaign_name: lead.campaignName || null,
      campaign_content: lead.campaignContent || null,
      campaign_term: lead.campaignTerm || null
    };

    const { error } = await supabase.from("lead_submissions").insert(record);
    if (error) {
      console.error("Lead persistence failed:", error.code || "unknown");
      return res.status(500).json({ error: "Não foi possível salvar sua solicitação agora. Tente novamente." });
    }
    return res.status(201).json({ ok: true, eventId: lead.eventId });
  } catch {
    console.error("Lead persistence failed: unexpected server error");
    return res.status(500).json({ error: "Não foi possível salvar sua solicitação agora. Tente novamente." });
  }
});

app.use(express.static(distDir, { index: false }));
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(distDir, "index.html"), (error) => {
    if (error) next(error);
  });
});

app.use((error, _req, res, _next) => {
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ error: "A solicitação é muito grande." });
  }
  if (error instanceof SyntaxError) {
    return res.status(400).json({ error: "O formato da solicitação é inválido." });
  }
  console.error("Unhandled server error");
  return res.status(500).json({ error: "Erro interno. Tente novamente." });
});

app.listen(port, () => {
  console.log("Streaming leads server listening on port " + port);
});