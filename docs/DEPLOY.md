# Deploy — Vercel + domínio avaloncargo.com.br

## 1. Vercel (uma vez)
1. Em https://vercel.com → **Add New → Project** → importar `Avalon-Cargo/comercial-avalon-app` (GitHub).
2. Framework preset: **Other**. Build command: vazio. Output directory: vazio (raiz). → **Deploy**.
3. A cada `git push` na `main` a Vercel publica automaticamente.

## 2. Domínio próprio
1. Vercel → Project → **Settings → Domains** → adicionar `cotacao.avaloncargo.com.br`.
2. No DNS de `avaloncargo.com.br` (quem administra o domínio), criar:
   - Tipo **CNAME** · Nome `cotacao` · Valor `cname.vercel-dns.com`
3. Aguardar propagação (minutos a algumas horas). HTTPS é automático.

## 3. Supabase — URLs de autenticação
Dashboard → **Authentication → URL Configuration**:
- Site URL: `https://cotacao.avaloncargo.com.br`
- Redirect URLs: `https://cotacao.avaloncargo.com.br/**` e `https://*.vercel.app/**`

Sem isso o link de "Esqueci minha senha" não volta para o app.

## 4. Novo usuário da equipe
Dashboard → **Authentication → Users → Add user** (e-mail + senha temporária, marcar *Auto confirm*).
O usuário nasce **inativo**; um gestor ativa em **Parâmetros → Equipe**. Trocar a senha pelo link "Esqueci minha senha".

## 5. Migrations
Aplicar os arquivos de `supabase/migrations/` em ordem no **SQL Editor**. Todo ajuste de banco entra como novo arquivo `000N_descricao.sql`.
