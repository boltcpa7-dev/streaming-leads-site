import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, ChevronRight, Gift, LockKeyhole, Sparkles, ShieldCheck, LoaderCircle, X } from "lucide-react";

type CookieChoice = "unknown" | "accepted" | "rejected";
type CampaignConfig = { active: boolean; partnerSlug?: string; pixelId?: string | null; publicName?: string | null };
type MetaFbq = ((...args: any[]) => void) & {
  callMethod?: (...args: any[]) => void;
  queue: any[][];
  loaded?: boolean;
  version?: string;
  push?: (...args: any[]) => void;
};

declare global {
  interface Window { fbq?: MetaFbq; }
}

function addMetaPixel(pixelId: string) {
  if (typeof window === "undefined" || window.fbq || !pixelId) return;
  const fbq = function (...args: any[]) {
    if (fbq.callMethod) fbq.callMethod.apply(fbq, args);
    else fbq.queue.push(args);
  } as MetaFbq;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.push = fbq;
  window.fbq = fbq;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  script.id = "meta-pixel-script";
  document.head.appendChild(script);
  fbq("init", pixelId);
  fbq("track", "PageView");
}

function captureUtm() {
  const params = new URLSearchParams(window.location.search);
  const read = (key: string) => (params.get(key) ?? "").slice(0, 120);
  return {
    campaignSource: read("utm_source"),
    campaignMedium: read("utm_medium"),
    campaignName: read("utm_campaign"),
    campaignContent: read("utm_content"),
    campaignTerm: read("utm_term")
  };
}

const demoNotices = [
  { number: "12", title: "Cadastros de exemplo", detail: "Número ilustrativo para demonstrar a animação." },
  { number: "08", title: "Solicitações de exemplo", detail: "Notificação fictícia; não representa atividade real." },
  { number: "21", title: "Bônus ilustrativos", detail: "Exemplo visual, sem dados de clientes." }
];

export default function App() {
  const [demoToastIndex, setDemoToastIndex] = useState<number | null>(null);
  const [cookieChoice, setCookieChoice] = useState<CookieChoice>("unknown");
  const [cookieLoaded, setCookieLoaded] = useState(false);
  const [config, setConfig] = useState<CampaignConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [showCookieSettings, setShowCookieSettings] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", marketingOptIn: false, privacyAcknowledged: false, website: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("site_cookie_choice");
    if (stored === "accepted" || stored === "rejected") setCookieChoice(stored);
    setCookieLoaded(true);

    const requestedSlug = new URLSearchParams(window.location.search).get("p") || "";
    const query = requestedSlug ? "?partner=" + encodeURIComponent(requestedSlug) : "";
    fetch("/api/config" + query, { headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Config unavailable");
        return response.json() as Promise<CampaignConfig>;
      })
      .then((value) => setConfig(value))
      .catch(() => setConfig({ active: false }))
      .finally(() => setConfigLoaded(true));
  }, []);

  useEffect(() => {
    if (!cookieLoaded || cookieChoice === "unknown" || submitted) {
      setDemoToastIndex(null);
      return;
    }
    let timer: number | undefined;
    let hideTimer: number | undefined;
    let first = true;
    const schedule = () => {
      const delay = first
        ? 9000 + Math.floor(Math.random() * 6000)
        : 180000 + Math.floor(Math.random() * 120001);
      first = false;
      timer = window.setTimeout(() => {
        setDemoToastIndex(Math.floor(Math.random() * demoNotices.length));
        hideTimer = window.setTimeout(() => setDemoToastIndex(null), 5200);
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
    };
  }, [cookieLoaded, cookieChoice, submitted]);

  useEffect(() => {
    if (!cookieLoaded || !configLoaded || cookieChoice !== "accepted" || !config?.active || !config.pixelId) return;
    addMetaPixel(config.pixelId);
  }, [cookieLoaded, configLoaded, cookieChoice, config]);

  function chooseCookies(choice: Exclude<CookieChoice, "unknown">) {
    const previous = window.localStorage.getItem("site_cookie_choice");
    window.localStorage.setItem("site_cookie_choice", choice);
    setCookieChoice(choice);
    setShowCookieSettings(false);
    if (previous === "accepted" && choice === "rejected") {
      document.cookie = "_fbp=; Max-Age=0; path=/; SameSite=Lax";
      document.cookie = "_fbc=; Max-Age=0; path=/; SameSite=Lax";
      window.location.reload();
    }
  }

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!configLoaded || !config?.active || !config.partnerSlug) {
      setError("Este link de bônus ainda está sendo configurado. Confira o link com quem enviou a oferta.");
      return;
    }
    setSubmitting(true);
    const eventId = window.crypto.randomUUID();
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          partnerSlug: config.partnerSlug,
          ...captureUtm(),
          eventId,
          privacyNoticeVersion: "draft-2",
          pagePath: window.location.pathname
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error || "Não conseguimos enviar agora. Revise os campos e tente novamente.");
        return;
      }
      setSubmitted(true);
      if (cookieChoice === "accepted" && window.fbq) {
        window.fbq("track", "Lead", {}, { eventID: result.eventId || eventId });
      }
    } catch {
      setError("Não foi possível conectar agora. Verifique sua internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="single-screen">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <header className="mini-header">
        <span className="privacy-shortcut"><ShieldCheck size={15} /> Cadastro protegido</span>
        <button className="cookie-settings-link" type="button" onClick={() => setShowCookieSettings(true)}>Cookies</button>
      </header>

      <section className="conversion-content" aria-labelledby="main-title">
        <div className="bonus-brand" aria-label="Seu bônus">
          <div className="bonus-emblem"><Gift size={27} strokeWidth={2.3} /></div>
          <div className="bonus-wordmark">SEU <span>BÔNUS</span><Sparkles className="brand-sparkle" size={18} /></div>
          <div className="brand-underline" />
        </div>
        <div className="hero-copy">
          <div className="micro-badge"><span className="pulse-dot" /> FORMULÁRIO DE INTERESSE</div>
          <h1 id="main-title">Preencha para receber <span>seu bônus</span></h1>
          <p>Informe seus dados para consultar a oferta e saber como resgatar seu benefício.</p>
        </div>

        <div className="form-panel">
          {!submitted ? (
            <form onSubmit={submitLead}>
              <div className="form-fields">
                <label className="input-shell">
                  <span>Seu nome</span>
                  <input autoComplete="name" name="name" placeholder="Como podemos te chamar?" minLength={2} maxLength={100} value={form.name} onChange={(e) => updateField("name", e.target.value)} required />
                </label>
                <label className="input-shell">
                  <span>WhatsApp com DDD</span>
                  <input autoComplete="tel" inputMode="tel" type="tel" name="phone" placeholder="(11) 99999-9999" minLength={10} maxLength={20} value={form.phone} onChange={(e) => updateField("phone", e.target.value)} required />
                </label>
                <label className="input-shell email-field">
                  <span>E-mail <small>opcional</small></span>
                  <input autoComplete="email" type="email" name="email" placeholder="voce@exemplo.com" maxLength={254} value={form.email} onChange={(e) => updateField("email", e.target.value)} />
                </label>
              </div>
              <div className="honeypot" aria-hidden="true">
                <label htmlFor="website">Deixe este campo vazio</label>
                <input id="website" autoComplete="off" tabIndex={-1} value={form.website} onChange={(e) => updateField("website", e.target.value)} />
              </div>
              <label className="consent-line">
                <input type="checkbox" checked={form.privacyAcknowledged} onChange={(e) => updateField("privacyAcknowledged", e.target.checked)} required />
                <span>Li o <a href="/privacidade.html" target="_blank" rel="noreferrer">Aviso de Privacidade</a> e solicito contato sobre esta oferta.</span>
              </label>
              <label className="consent-line optional-consent">
                <input type="checkbox" checked={form.marketingOptIn} onChange={(e) => updateField("marketingOptIn", e.target.checked)} />
                <span>Quero receber promoções futuras. Posso cancelar quando quiser.</span>
              </label>
              {error && <p className="inline-error" role="alert">{error}</p>}
              <button className="claim-button" type="submit" disabled={submitting || !configLoaded}>
                {submitting ? <><LoaderCircle className="spin" size={19} /> Enviando...</> : <>QUERO RECEBER MEU BÔNUS <ChevronRight size={20} strokeWidth={2.8} /></>}
              </button>
              <div className="safe-note"><LockKeyhole size={13} /> Seus dados são usados para responder à sua solicitação.</div>
            </form>
          ) : (
            <div className="success-panel" role="status">
              <div className="success-icon"><CheckCircle2 size={36} /></div>
              <div className="success-tag">SOLICITAÇÃO RECEBIDA</div>
              <h2>Pronto! Recebemos seus dados.</h2>
              <p>A equipe responsável pela oferta poderá entrar em contato para explicar as condições e os próximos passos para consultar seu bônus.</p>
              <p className="terms-note">O bônus depende das regras e da elegibilidade da campanha. Nenhuma contratação foi realizada.</p>
              <button type="button" className="reset-button" onClick={() => { setSubmitted(false); setForm({ name: "", phone: "", email: "", marketingOptIn: false, privacyAcknowledged: false, website: "" }); }}>Voltar ao formulário</button>
            </div>
          )}
        </div>
        <div className="offer-note">*Bônus sujeito às condições da campanha e à confirmação de elegibilidade.</div>
      </section>

      <footer className="mini-footer">
        <span>Oferta sujeita a condições.</span><span className="footer-divider">·</span>
        <a href="/termos.html">Termos</a><span className="footer-divider">·</span><a href="/privacidade.html">Privacidade</a>
      </footer>

      {demoToastIndex !== null && cookieChoice !== "unknown" && !submitted && (
        <aside className="demo-toast" role="status" aria-live="polite">
          <div className="demo-toast-icon"><Sparkles size={17} /></div>
          <div className="demo-toast-copy">
            <span className="demo-toast-label">SIMULAÇÃO · DADOS FICTÍCIOS</span>
            <strong><span className="demo-toast-number">{demoNotices[demoToastIndex].number}</span> {demoNotices[demoToastIndex].title}</strong>
            <small>{demoNotices[demoToastIndex].detail}</small>
          </div>
          <button type="button" className="demo-toast-close" aria-label="Fechar notificação demonstrativa" onClick={() => setDemoToastIndex(null)}><X size={14} /></button>
        </aside>
      )}

      {cookieLoaded && cookieChoice === "unknown" && (
        <div className="cookie-backdrop">
          <section className="cookie-panel" role="dialog" aria-modal="true" aria-labelledby="cookie-title">
            <button className="cookie-close" aria-label="Fechar aviso de cookies" type="button" onClick={() => chooseCookies("rejected")}><X size={17} /></button>
            <div className="cookie-icon"><LockKeyhole size={17} /></div>
            <h2 id="cookie-title">Você escolhe seus cookies</h2>
            <p>O Pixel da Meta para mensuração de anúncios só é carregado se você aceitar cookies de marketing. Sua escolha não altera o envio do formulário.</p>
            <div className="cookie-buttons">
              <button className="cookie-accept" type="button" onClick={() => chooseCookies("accepted")}>Aceitar marketing</button>
              <button className="cookie-reject" type="button" onClick={() => chooseCookies("rejected")}>Rejeitar</button>
            </div>
            <a href="/privacidade.html" className="cookie-link">Aviso de Privacidade</a>
          </section>
        </div>
      )}

      {showCookieSettings && (
        <div className="cookie-backdrop settings-backdrop">
          <section className="cookie-panel" role="dialog" aria-modal="true" aria-labelledby="cookie-settings-title">
            <button className="cookie-close" aria-label="Fechar preferências" type="button" onClick={() => setShowCookieSettings(false)}><X size={17} /></button>
            <div className="cookie-icon"><LockKeyhole size={17} /></div>
            <h2 id="cookie-settings-title">Preferências de cookies</h2>
            <p>Você pode permitir ou rejeitar cookies de marketing. Cookies essenciais continuam ativos para o funcionamento do site.</p>
            <div className="cookie-buttons">
              <button className="cookie-accept" type="button" onClick={() => chooseCookies("accepted")}>Aceitar marketing</button>
              <button className="cookie-reject" type="button" onClick={() => chooseCookies("rejected")}>Rejeitar marketing</button>
            </div>
            <a href="/privacidade.html" className="cookie-link">Aviso de Privacidade</a>
          </section>
        </div>
      )}
    </main>
  );
}