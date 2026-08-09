# Ambient Luz — Gestão de Propostas

## PASSO A PASSO PARA SUBIR NO VERCEL

### PASSO 1 — Criar conta no GitHub
1. Acesse: https://github.com
2. Clique em **Sign up**
3. Use seu e-mail ou clique em **Continue with Google**
4. Confirme o e-mail se pedir

### PASSO 2 — Criar repositório
1. Clique no botão **+** no canto superior direito
2. Clique em **New repository**
3. Nome: `ambient-luz-app`
4. Deixe como **Public**
5. Clique em **Create repository**

### PASSO 3 — Subir os arquivos
1. Na página do repositório, clique em **uploading an existing file**
2. Arraste a pasta `ambient-luz-vercel` inteira para a área
3. Clique em **Commit changes**

### PASSO 4 — Criar conta no Vercel
1. Acesse: https://vercel.com
2. Clique em **Start Deploying**
3. Clique em **Continue with GitHub**
4. Autorize o Vercel

### PASSO 5 — Conectar o repositório
1. Clique em **Add New Project**
2. Selecione o repositório `ambient-luz-app`
3. Clique em **Import**

### PASSO 6 — Adicionar a chave da API (IMPORTANTE)
1. Antes de clicar em Deploy, role a página até **Environment Variables**
2. Adicione:
   - Nome: `ANTHROPIC_API_KEY`
   - Valor: sua chave que começa com `sk-ant-...`
3. Clique em **Add**

### PASSO 7 — Publicar
1. Clique em **Deploy**
2. Aguarde ~2 minutos
3. Pronto! O site estará no ar com um link tipo `ambient-luz-app.vercel.app`

---

## COMO ATUALIZAR O APP NO FUTURO
1. Peça a mudança para o Claude
2. Baixe o arquivo `App.jsx` novo
3. Acesse seu repositório no GitHub
4. Clique em `src/App.jsx`
5. Clique no ícone de lápis (editar)
6. Cole o conteúdo novo
7. Clique em **Commit changes**
8. O Vercel atualiza automaticamente em ~1 minuto

