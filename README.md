# Streaming Leads Site

Landing page responsiva para solicitações de contato, com API Node/Express, armazenamento privado no Supabase e Pixel da Meta condicionado à escolha de cookies de marketing.

## Status

Protótipo inicial na branch feature/landing-page. Não está pronto para campanhas ou produção até concluir as etapas de configuração abaixo. O repositório é público: não commite dados pessoais, tokens, chaves ou arquivos .env.

## Stack

- React + TypeScript + Vite
- Node.js + Express para receber e validar leads
- Zod para validação do servidor
- Supabase/Postgres como armazenamento
- Pixel da Meta carregado somente após a escolha afirmativa para cookies de marketing
- UTM: utm_source, utm_medium, utm_campaign, utm_content e utm_term
- Base preparada para armazenar event_id e possibilitar deduplicação futura; a API de Conversões (CAPI) ainda não envia eventos neste protótipo

## Rodar localmente

1. Instale Node.js 20.19 ou superior e npm.
2. Duplique .env.example para .env.
3. Preencha SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e ALLOWED_ORIGINS.
4. No painel do Supabase, revise e execute supabase/schema.sql.
5. Instale dependências com npm install.
6. Execute npm run dev.
7. Acesse o endereço local mostrado pelo Vite (normalmente http://localhost:5173).

Sem o Supabase configurado, o layout pode ser explorado, mas o formulário não salva leads e responde com erro de configuração. Nunca informe a chave service role em variáveis com prefixo VITE_.

## Variáveis de ambiente

- VITE_META_PIXEL_ID: ID público do Pixel. Deixe vazio até configurar o Pixel correto e revisar o consentimento.
- SUPABASE_URL: URL do projeto Supabase (somente servidor).
- SUPABASE_SERVICE_ROLE_KEY: chave privilegiada, somente servidor. Nunca incluir no frontend.
- ALLOWED_ORIGINS: origens exatas permitidas, separadas por vírgula; inclua o domínio final ao publicar.
- PORT: porta do servidor (padrão 3001).

## Dados e segurança

- A API valida dados no servidor, limita JSON a 16 KB, aplica rate limit básico e verifica um campo honeypot.
- O banco tem RLS ativado e não cria políticas públicas; inserções são feitas pelo servidor com a service-role key.
- A aplicação não armazena endereço IP nem envia nome, telefone, e-mail ou mensagem como parâmetros de evento da Meta.
- A opção de receber promoções é separada do pedido de contato e opcional.
- A escolha de cookies fica no navegador; o Pixel só é carregado após aceitação explícita. Revise a implementação e o mecanismo de revogação antes de produção.
- O rate limit em memória serve apenas como proteção inicial em uma instância Node. Use proteção de borda/serviço apropriado e CAPTCHA acessível se a operação exigir.
- Defina política de acesso administrativo, rotina de backups, retenção e exclusão dos leads e canal para solicitações de titulares antes de uso real.

## Eventos da Meta

No protótipo:
- PageView: após aceitar cookies de marketing, se VITE_META_PIXEL_ID estiver definido.
- Lead: somente depois de a API confirmar o armazenamento e se cookies de marketing tiverem sido aceitos.
- event_id: gerado pelo navegador e registrado no banco para viabilizar integração com CAPI mais tarde.

Não há envio pela CAPI implementado. Antes de ativá-la, defina o evento e a base legal aplicável, respeite a preferência do titular, mantenha o token somente no servidor, use o mesmo event_id para deduplicar e valide os eventos no Gerenciador de Eventos. Não envie campos pessoais sensíveis.

## Antes de publicar (obrigatório)

- Confirmar autorizações de distribuição/revenda de cada conteúdo, canal e marca citados. Esta versão não usa logotipos nem afirma números de catálogo.
- Substituir os textos provisórios de public/privacidade.html e public/termos.html, preencher identidade do controlador e revisar com responsável jurídico/privacidade.
- Configurar e testar o aviso de cookies, recusa, alteração/revogação da preferência e comportamento do Pixel.
- Configurar variáveis apenas no provedor de hospedagem, ALLOWED_ORIGINS e HTTPS.
- Executar npm run typecheck e npm run build; testar envio válido, campos inválidos, honeypot, limites de envio, ausência de Supabase e celular.
- Validar eventos no Meta Events Manager e confirmar que não estão duplicados.
- Configurar acesso restrito à base, backups, retenção e processo de exclusão.
- Confirmar termos de uso do provedor, política da Meta e requisitos legais que se aplicam ao negócio.

## Hospedagem

Esta versão é servida por um processo Node/Express que também hospeda o build do Vite. Use uma plataforma compatível com servidor Node persistente, configure as variáveis de ambiente e os comandos npm install, npm run build e npm start. Em ambientes com múltiplas instâncias, use rate limit compartilhado ou uma proteção de borda.
