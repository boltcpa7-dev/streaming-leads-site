import { FormEvent, useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Headphones,
  LoaderCircle,
  LockKeyhole,
  MonitorPlay,
  Play,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tv,
  X
} from "lucide-react";

type CookieChoice = "unknown" | "accepted" | "rejected";
type Interest = "planos" | "dispositivos" | "catalogo" | "outro";
type Attribution = {
  campaignSource: string;
  campaignMedium: string;
  campaignName: string;
  campaignContent: string;
  campaignTerm: string;
};

type MetaFbq = ((...args: any[]) => void) & {
  callMethod?: (...args: any[]) => void;
  queue: any[][];
  loaded?: boolean;
  version?: string;
  push?: (...args: any[]) => void;
};

declare global {
  interface Window {
    fbq?: MetaFbq;
  }
}

const emptyAttribution: Attribution = {
  campaignSource: "",
  campaignMedium: "",
  campaignName: "",
  campaignContent: "",
  campaignTerm: ""
};

const interestLabels: Record<Interest, string> = {
  planos: "Planos e valores",
  dispositivos: "Dispositivos compatíveis",
  catalogo: "Catálogo e disponibilidade",
  outro: "Outra dúvida"
};

function addMetaPixel(pixelId: string) {
  if (typeof window === "undefined" || window.fbq) return;

  const fbq = function (...args: any[]) {
    if (fbq.callMethod) {
      fbq.callMethod.apply(fbq, args);
    } else {
      fbq.queue.push(args);
    }
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

function readAttribution(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const value = (key: string) => (params.get(key) ?? "").slice(0, 120);
  return {
    campaignSource: value("utm_source"),
    campaignMedium: value("utm_medium"),
    campaignName: value("utm_campaign"),
    campaignContent: value("utm_content"),
    campaignTerm: value("utm_term")
  };
}

export default function App() {
  const [cookieChoice, setCookieChoice] = useState<CookieChoice>("unknown");
  const [cookieLoaded, setCookieLoaded] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [attribution, setAttribution] = useState<Attribution>(emptyAttribution);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    interest: "planos" as Interest,
    message: "",
    marketingOptIn: false,
    privacyAcknowledged: false,
    website: ""
  });

  useEffect(() => {
    const stored = window.localStorage.getItem("site_cookie_choice");
    if (stored === "accepted" || stored === "rejected") {
      setCookieChoice(stored);
    }
    setAttribution(readAttribution());
    setCookieLoaded(true);
  }, []);

  useEffect(() => {
    if (!cookieLoaded || cookieChoice !== "accepted") return;
    const pixelId = import.meta.env.VITE_META_PIXEL_ID?.trim();
    if (pixelId) addMetaPixel(pixelId);
  }, [cookieChoice, cookieLoaded]);

  function chooseCookies(choice: Exclude<CookieChoice, "unknown">) {
    const previousChoice = window.localStorage.getItem("site_cookie_choice");
    window.localStorage.setItem("site_cookie_choice", choice);
    setShowPreferences(false);

    // If marketing consent is withdrawn, stop client-side tracking on a fresh page load.
    if (previousChoice === "accepted" && choice === "rejected") {
      document.cookie = "_fbp=; Max-Age=0; path=/; SameSite=Lax";
      document.cookie = "_fbc=; Max-Age=0; path=/; SameSite=Lax";
      window.location.reload();
      return;
    }
    setCookieChoice(choice);
  }

  function updateForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const eventId = window.crypto.randomUUID();
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ...attribution,
          eventId,
          privacyNoticeVersion: "draft-1",
          pagePath: window.location.pathname
        })
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(result.error ?? "Não conseguimos enviar seus dados. Confira os campos e tente novamente.");
        return;
      }

      setSubmitted(true);

      // Do not send the Meta event unless marketing cookies were explicitly accepted.
      // No name, phone, email or message is sent as event parameters.
      if (cookieChoice === "accepted" && window.fbq) {
        window.fbq("track", "Lead", {}, { eventID: result.eventId ?? eventId });
      }
    } catch {
      setError("Não foi possível conectar agora. Verifique sua internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  const faqs = [
    {
      question: "Como recebo as informações?",
      answer: "Depois de enviar o formulário, nossa equipe poderá entrar em contato pelo canal informado para explicar o combo, valores e condições. Enviar o formulário não obriga você a contratar."
    },
    {
      question: "O combo funciona na minha TV ou celular?",
      answer: "A compatibilidade depende do aplicativo, do sistema operacional e do dispositivo. Informe sua dúvida no formulário para receber orientações antes de contratar."
    },
    {
      question: "O que está incluído no combo?",
      answer: "A oferta informada reúne acesso a Netflix, HBO, Paramount+, mais de 1.000 canais ao vivo e mais de 300.000 conteúdos. A disponibilidade exata, os aplicativos incluídos, os dispositivos compatíveis e as condições dependem do plano contratado; confirme esses detalhes com o atendimento antes de pagar."
    },
    {
      question: "Meus dados serão usados para publicidade?",
      answer: "Usaremos seus dados para responder ao pedido que você enviar. Mensagens promocionais futuras são opcionais e dependem da sua escolha. Consulte o Aviso de Privacidade para saber como exercer seus direitos."
    }
  ];

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="Página inicial">
          <span className="brand-mark"><Play size={17} fill="currentColor" /></span>
          <span>seu<span className="brand-accent">combo</span></span>
        </a>
        <nav className="desktop-nav" aria-label="Navegação principal">
          <a href="#vantagens">Como funciona</a>
          <a href="#perguntas">Perguntas frequentes</a>
        </nav>
        <a className="button button-small button-outline header-cta" href="#lead">
          Quero saber mais <ArrowUpRight size={16} />
        </a>
      </header>

      <section className="hero section-shell" id="inicio">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={15} /> SUA PRÓXIMA EXPERIÊNCIA COMEÇA AQUI</div>
          <h1>Seu combo de entretenimento, <span>tudo em um só lugar.</span></h1>
          <p className="hero-description">
            Conheça o combo com Netflix, HBO, Paramount+, mais de 1.000 canais ao vivo e mais de 300.000 conteúdos. Envie seus dados para consultar preço, disponibilidade, compatibilidade e condições antes de contratar.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#lead">Receber informações <ArrowRight size={18} /></a>
            <a className="text-link" href="#vantagens">Veja como funciona <ArrowDown size={16} /></a>
          </div>
          <div className="trust-row">
            <span><ShieldCheck size={17} /> Informação transparente</span>
            <span><LockKeyhole size={16} /> Seus dados protegidos</span>
          </div>
        </div>

        <div className="hero-art" aria-label="Ilustração abstrata de telas e entretenimento">
          <div className="art-glow" />
          <div className="art-ring art-ring-one" />
          <div className="art-ring art-ring-two" />
          <div className="screen screen-back"><div className="screen-shape shape-purple" /><div className="screen-line" /><div className="screen-line short" /></div>
          <div className="screen screen-main">
            <div className="screen-topline"><span className="live-dot" /> EXPERIÊNCIAS PARA DESCOBRIR</div>
            <div className="play-tile"><Play size={27} fill="currentColor" /></div>
            <div className="art-pills"><span>Filmes</span><span>Séries</span><span>Ao vivo*</span></div>
          </div>
          <div className="floating-card floating-card-top"><span className="floating-icon"><MonitorPlay size={18} /></span><span><strong>Várias telas</strong><small>Consulte compatibilidade</small></span><CheckCircle2 className="floating-check" size={19} /></div>
          <div className="floating-card floating-card-bottom"><span className="device-icon"><Smartphone size={19} /></span><span><strong>Do seu jeito</strong><small>Conheça as opções</small></span></div>
          <span className="art-footnote">*Consulte disponibilidade e condições.</span>
        </div>
      </section>

      <section className="proof-strip">
        <div className="proof-item"><Check size={18} /><span>Informações claras</span></div>
        <div className="proof-item"><Check size={18} /><span>Ajuda para escolher</span></div>
        <div className="proof-item"><Check size={18} /><span>Sem obrigação de contratar</span></div>
      </section>

      <section className="benefits section-shell" id="vantagens">
        <div className="section-heading">
          <div className="eyebrow">UMA ESCOLHA MAIS TRANQUILA</div>
          <h2>Mais opções de entretenimento no seu dia a dia.</h2>
          <p>Consulte o combo que reúne Netflix, HBO, Paramount+, canais ao vivo e um catálogo amplo. Confirme com a equipe os itens incluídos, valores e compatibilidade antes de contratar.</p>
        </div>
        <div className="benefit-grid">
          <article className="benefit-card">
            <div className="icon-box purple"><MonitorPlay size={23} /></div>
            <h3>Um combo, várias opções</h3>
            <p>Consulte as condições de acesso aos serviços de streaming e ao catálogo incluído no plano disponível.</p>
            <span className="card-number">01</span>
          </article>
          <article className="benefit-card">
            <div className="icon-box green"><Tv size={23} /></div>
            <h3>Mais de 1.000 canais ao vivo*</h3>
            <p>Consulte a grade, a disponibilidade regional e os dispositivos compatíveis antes de contratar.</p>
            <span className="card-number">02</span>
          </article>
          <article className="benefit-card">
            <div className="icon-box orange"><CircleHelp size={23} /></div>
            <h3>Mais de 300.000 conteúdos*</h3>
            <p>Consulte os conteúdos atualmente disponíveis e as condições de acesso com a equipe de atendimento.</p>
            <span className="card-number">03</span>
          </article>
        </div>
      </section>

      <section className="steps-band">
        <div className="section-shell steps-inner">
          <div className="steps-intro">
            <div className="eyebrow">É SIMPLES</div>
            <h2>Três passos.<br /><span>Mais clareza.</span></h2>
            <p>Conte o que você procura e receba orientação para tomar uma decisão informada.</p>
          </div>
          <div className="steps-list">
            <div className="step"><span className="step-index">1</span><div><h3>Preencha o formulário</h3><p>Informe seus dados de contato e o assunto que deseja consultar.</p></div></div>
            <div className="step"><span className="step-index">2</span><div><h3>Receba uma resposta</h3><p>A equipe entra em contato para esclarecer sua solicitação.</p></div></div>
            <div className="step"><span className="step-index">3</span><div><h3>Avalie com calma</h3><p>Confira os detalhes e decida se deseja continuar.</p></div></div>
          </div>
        </div>
      </section>

      <section className="lead-section section-shell" id="lead">
        <div className="lead-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> FALE COM A NOSSA EQUIPE</div>
          <h2>Quer conhecer o combo completo?</h2>
          <p>Deixe seus dados para consultar valores, funcionamento, disponibilidade dos serviços incluídos e condições da oferta. Nossa equipe responde à sua solicitação sem compromisso.</p>
          <div className="lead-note"><ShieldCheck size={20} /><span><strong>Transparência em primeiro lugar.</strong><br />Você pode solicitar informações sem compromisso e escolher separadamente se deseja receber novidades promocionais.</span></div>
          <div className="contact-points"><span><CheckCircle2 size={16} /> Atendimento sobre sua solicitação</span><span><CheckCircle2 size={16} /> Sem obrigação de contratar</span></div>
        </div>

        <div className="form-card">
          {!submitted ? (
            <>
              <div className="form-card-heading"><div><span className="form-step">FORMULÁRIO DE INTERESSE</span><h3>Receba informações</h3></div><div className="form-lock"><LockKeyhole size={19} /></div></div>
              <p className="form-subtitle">Preencha os campos abaixo. Os campos com * são obrigatórios.</p>
              <form onSubmit={submitLead} noValidate>
                <div className="honeypot" aria-hidden="true">
                  <label htmlFor="website">Não preencha este campo</label>
                  <input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => updateForm("website", e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="name">Nome completo *</label>
                  <input id="name" name="name" autoComplete="name" placeholder="Como podemos te chamar?" minLength={2} maxLength={100} value={form.name} onChange={(e) => updateForm("name", e.target.value)} required />
                </div>
                <div className="field">
                  <label htmlFor="phone">WhatsApp com DDD *</label>
                  <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="(11) 99999-9999" minLength={10} maxLength={20} value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} required />
                </div>
                <div className="field">
                  <label htmlFor="email">E-mail <span className="optional">(opcional)</span></label>
                  <input id="email" name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" maxLength={254} value={form.email} onChange={(e) => updateForm("email", e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="interest">O que você quer saber? *</label>
                  <div className="select-wrap"><select id="interest" name="interest" value={form.interest} onChange={(e) => updateForm("interest", e.target.value as Interest)} required>
                    {Object.entries(interestLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                  </select><ChevronDown size={17} /></div>
                </div>
                <div className="field">
                  <label htmlFor="message">Sua dúvida <span className="optional">(opcional)</span></label>
                  <textarea id="message" name="message" rows={3} maxLength={600} placeholder="Conte um pouco mais sobre o que procura..." value={form.message} onChange={(e) => updateForm("message", e.target.value)} />
                </div>
                <label className="check-row">
                  <input type="checkbox" checked={form.privacyAcknowledged} onChange={(e) => updateForm("privacyAcknowledged", e.target.checked)} required />
                  <span>Li o <a href="/privacidade.html" target="_blank" rel="noreferrer">Aviso de Privacidade</a> e solicito contato para responder à minha consulta. *</span>
                </label>
                <label className="check-row marketing-check">
                  <input type="checkbox" checked={form.marketingOptIn} onChange={(e) => updateForm("marketingOptIn", e.target.checked)} />
                  <span>Quero receber ofertas e novidades por WhatsApp ou e-mail. Sei que posso cancelar a qualquer momento.</span>
                </label>
                {error && <div className="form-error" role="alert">{error}</div>}
                <button className="button button-primary submit-button" type="submit" disabled={submitting}>
                  {submitting ? <><LoaderCircle size={18} className="spin" /> Enviando...</> : <>Quero receber informações <ArrowRight size={18} /></>}
                </button>
                <p className="form-legal">Não envie senhas, dados de pagamento ou informações sensíveis neste formulário.</p>
              </form>
            </>
          ) : (
            <div className="success-state" role="status">
              <div className="success-icon"><CheckCircle2 size={34} /></div>
              <span className="form-step">SOLICITAÇÃO ENVIADA</span>
              <h3>Obrigado pelo interesse!</h3>
              <p>Seus dados foram recebidos. Nossa equipe poderá entrar em contato para responder à sua solicitação.</p>
              <p className="success-small">Nenhuma contratação foi realizada neste envio.</p>
              <button className="button button-outline" type="button" onClick={() => { setSubmitted(false); setForm((previous) => ({ ...previous, name: "", phone: "", email: "", message: "", privacyAcknowledged: false, website: "" })); }}>Enviar outra solicitação</button>
            </div>
          )}
        </div>
      </section>

      <section className="faq-section section-shell" id="perguntas">
        <div className="faq-intro"><div className="eyebrow">AINDA TEM DÚVIDAS?</div><h2>Perguntas frequentes.</h2><p>Confira informações gerais ou envie uma pergunta no formulário.</p><a href="#lead" className="text-link">Falar com a equipe <ArrowRight size={16} /></a></div>
        <div className="faq-list">
          {faqs.map((faq, index) => (
            <article className={"faq-item" + (openFaq === index ? " open" : "")} key={faq.question}>
              <button type="button" className="faq-question" onClick={() => setOpenFaq(openFaq === index ? null : index)} aria-expanded={openFaq === index}>
                <span>{faq.question}</span><ChevronDown size={19} />
              </button>
              {openFaq === index && <p className="faq-answer">{faq.answer}</p>}
            </article>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-main section-shell">
          <div className="footer-brand">
            <a className="brand" href="#inicio"><span className="brand-mark"><Play size={17} fill="currentColor" /></span><span>stream<span className="brand-accent">line</span></span></a>
            <p>Netflix, HBO, Paramount+ e mais opções de entretenimento. Consulte condições.</p>
          </div>
          <div className="footer-links"><a href="/privacidade.html">Aviso de Privacidade</a><a href="/termos.html">Termos de Uso</a><button type="button" onClick={() => { setShowPreferences(true); setCookieChoice("unknown"); }}>Preferências de cookies</button></div>
        </div>
        <div className="footer-bottom section-shell"><span>© {new Date().getFullYear()} Streamline. Todos os direitos reservados.</span><span>Confirme os detalhes e a disponibilidade antes de contratar.</span></div>
      </footer>

      {cookieLoaded && cookieChoice === "unknown" && (
        <div className="cookie-backdrop">
          <section className="cookie-panel" role="dialog" aria-modal="true" aria-labelledby="cookie-title">
            <button className="cookie-close" aria-label="Fechar preferências" onClick={() => {
              setShowPreferences(false);
              const stored = window.localStorage.getItem("site_cookie_choice");
              if (stored === "accepted" || stored === "rejected") {
                setCookieChoice(stored);
              } else {
                window.localStorage.setItem("site_cookie_choice", "rejected");
                setCookieChoice("rejected");
              }
            }}><X size={18} /></button>
            <div className="cookie-icon"><LockKeyhole size={19} /></div>
            <h2 id="cookie-title">{showPreferences ? "Preferências de cookies" : "Você escolhe como usar cookies"}</h2>
            <p>Usamos armazenamento essencial para lembrar sua escolha. O Pixel da Meta, usado para mensuração de anúncios, só é carregado se você aceitar cookies de marketing. Você pode mudar de ideia depois.</p>
            <div className="cookie-buttons">
              <button className="button button-primary" onClick={() => chooseCookies("accepted")}>Aceitar cookies de marketing</button>
              <button className="button button-outline" onClick={() => chooseCookies("rejected")}>Rejeitar cookies de marketing</button>
            </div>
            <a href="/privacidade.html" className="cookie-link">Saiba mais no Aviso de Privacidade</a>
          </section>
        </div>
      )}
    </main>
  );
}