# Migracao do sistema para GitHub Pages + Supabase

Este projeto continua funcionando localmente como antes. A migracao foi preparada para copiar os dados do navegador para o Supabase e, depois, substituir aos poucos o `localStorage` pelas tabelas online.

## O que existe hoje

- `index.html`: tela principal, menu lateral, backup/restauracao e alguns conversores.
- `css/style.css`: estilo principal do sistema.
- `js/licitatorios.js`: modulo maior do sistema. Guarda processos, fornecedores, IRPs, atas, itens, publicacoes, aditivos, anexos e categorias.
- `js/tramites.js`: tramites internos e tramites gerais importados de TXT.
- `js/dashboard_chart.js`, `js/relatorios.js`, `js/impressao.js`: leem os mesmos dados para graficos, relatorios e impressao.
- `localStorage`: guarda dados estruturados.
- `IndexedDB`: guarda PDFs/anexos locais.

## Chaves locais encontradas

- `processosLicitatorios`
- `tramitesProcessos`
- `tramitesGeraisImportados`
- `irpsRegistroPreco`
- `fornecedoresCadastro`
- `mapaInteressadosSecretarias`
- `tiposProtocoloCadastro`
- `assuntosProtocoloCadastro`
- IndexedDB `processosLicitatoriosAnexosDB`, store `anexos`

## Entidades principais

- Processos licitatorios
- Blocos/fases do processo: SD, requisicao, ETP, termo de referencia, edital, licitacao, aviso de contratacao direta, cotacao, resultado, homologacao
- Itens do processo, cotacao, resultado/homologacao
- Fornecedores e pessoas vinculadas
- Credenciamentos
- IRPs
- Atas de registro de preco
- Itens da ata
- Publicacoes/extratos da ata
- Aditivos da ata
- Publicacoes/extratos de aditivos
- Tramites internos
- Tramites gerais importados por TXT
- Configuracoes/listas auxiliares
- Anexos/PDFs

## Arquivos criados para a migracao

- `supabase/schema.sql`: cria as tabelas, indices, triggers `updated_at` e policies iniciais.
- `js/supabase-config.js`: recebe a URL e a anon key publica do Supabase.
- `js/database.js`: camada inicial de acesso ao Supabase.
- `js/migracao-supabase.js`: copia os dados locais para o Supabase.
- `migracao-supabase.html`: pagina simples para executar a migracao no navegador.

## Passo a passo no Supabase

1. Crie um projeto no Supabase.
2. Abra o projeto e va em `SQL Editor`.
3. Cole o conteudo de `supabase/schema.sql`.
4. Clique em `Run`.
5. Va em `Project Settings > API`.
6. Copie:
   - `Project URL`
   - `anon public key`
7. Abra `js/supabase-config.js` e preencha:

```js
window.SUPABASE_CONFIG = {
  url: "https://SEU-PROJETO.supabase.co",
  anonKey: "SUA_ANON_KEY",
  schema: "public"
};
```

Nunca use a `service_role key` no navegador.

## Migrar os dados locais

1. Abra `migracao-supabase.html` no mesmo navegador onde os dados atuais estao salvos.
2. Clique em `Enviar dados locais para o Supabase`.
3. Aguarde a mensagem de conclusao.
4. Confira as tabelas no Supabase em `Table Editor`.

Os dados locais continuam no navegador. Nada e apagado.

## Publicar no GitHub Pages

1. Crie um repositorio no GitHub.
2. Envie estes arquivos para o repositorio.
3. No GitHub, va em `Settings > Pages`.
4. Em `Build and deployment`, escolha `Deploy from a branch`.
5. Escolha a branch principal e a pasta raiz.
6. Salve. O GitHub vai gerar um link do Pages.

## Observacao importante sobre seguranca

O `schema.sql` deixa policies abertas para teste com a anon key. Isso facilita validar o sistema no GitHub Pages, mas qualquer pessoa com o link e a chave publica pode gravar no banco.

Antes de usar oficialmente, o ideal e ativar login com Supabase Auth e trocar as policies para permitir acesso apenas a usuarios autenticados.

## Proximas etapas tecnicas

1. Testar a migracao em uma copia do projeto Supabase.
2. Validar processos, fornecedores, atas, aditivos e tramites importados.
3. Substituir `loadData()` e `saveData()` por chamadas assicronas do `js/database.js`.
4. Criar feedback visual de carregamento/salvamento nas telas principais.
5. Migrar PDFs/anexos do IndexedDB para Supabase Storage.
6. Manter o backup JSON como copia de seguranca.
