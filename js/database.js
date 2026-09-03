// Camada inicial de acesso ao Supabase.
// Esta camada centraliza o acesso online e evita espalhar chamadas Supabase
// pelos modulos da interface.

(() => {
  const MONEY_FIELDS = new Set(["valorEstimado", "resultadoValorHomologado"]);

  function requireClient() {
    if (!window.isSupabaseConfigured?.()) {
      throw new Error("Supabase ainda nao configurado. Preencha js/supabase-config.js.");
    }
    if (!window.supabase?.createClient) {
      throw new Error("Biblioteca Supabase nao carregada. Inclua @supabase/supabase-js antes de js/database.js.");
    }
    if (!window.__supabaseClient) {
      const cfg = window.SUPABASE_CONFIG;
      window.__supabaseClient = window.supabase.createClient(cfg.url, cfg.publishableKey, {
        db: { schema: cfg.schema || "public" }
      });
    }
    return window.__supabaseClient;
  }

  async function requireAuthenticatedUser() {
    const client = requireClient();
    const { data, error } = await client.auth.getUser();
    if (error) {
      console.error("[Supabase Auth] Erro ao confirmar usuario autenticado:", error);
      throw error;
    }
    if (!data?.user?.id) {
      throw new Error("Usuario autenticado nao encontrado. Faca login antes de gravar processos.");
    }
    return data.user;
  }

  function onlyDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function parseNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const clean = String(value)
      .replace(/[R$\s.]/g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "");
    const num = Number(clean);
    return Number.isFinite(num) ? num : null;
  }

  function parseDateBR(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    return `${match[3]}-${match[2]}-${match[1]}`;
  }

  function parseTime(value) {
    const match = String(value || "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;
    return `${String(match[1]).padStart(2, "0")}:${match[2]}:${match[3] || "00"}`;
  }

  function formatDateBR(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : raw;
  }

  function formatDateTimeBR(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || "");
    return date.toLocaleString("pt-BR");
  }

  function localId(prefix, fallback = "") {
    return String(fallback || `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`);
  }

  function processoCore(processo) {
    return {
      local_id: localId("proc", processo.id),
      numero: processo.numero || "",
      data_criacao: parseDateBR(processo.dataCriacao),
      objeto: processo.objeto || "",
      descricao_completa: processo.descricaoCompleta || "",
      secretaria: processo.secretaria || "",
      interessado_original: processo.interessadoOriginal || "",
      tipo_protocolo: processo.tipoProtocolo || "",
      natureza_processo: processo.naturezaProcesso || "",
      assunto_protocolo: processo.assuntoProtocolo || "",
      registro_precos: processo.registroPrecos || "",
      tipo_registro_preco: processo.tipoRegistroPreco || "",
      tipo_adesao_registro: processo.tipoAdesaoRegistro || "",
      processo_gerador_local_id: processo.processoGerador || "",
      ata_registro_preco_local_id: processo.ataRegistroPrecoId || "",
      modalidade_licitacao: processo.modalidadeLicitacao || processo.trModalidade || processo.editalForma || "",
      tipo_licitacao: processo.tipoLicitacao || "",
      situacao: processo.situacao || "",
      fase: processo.fase || "",
      volumes: processo.volumes || "",
      observacao: processo.observacao || "",
      valor_estimado: parseNumber(processo.trValorEstimado || processo.valorEstimado),
      valor_homologado: parseNumber(processo.resultadoValorHomologado),
      extra: processo
    };
  }

  function blocoEntries(processo, processoId) {
    const blocos = {
      fases: {
        fasesAtivas: processo.fasesAtivas || [],
        etapasConcluidas: processo.etapasConcluidas || {}
      },
      solicitacao_demanda: pickPrefix(processo, "sd"),
      estudo_tecnico_preliminar: pickPrefix(processo, "etp"),
      termo_referencia: pickPrefix(processo, "tr"),
      edital: pickPrefix(processo, "edital"),
      licitacao: pickPrefix(processo, "licitacao"),
      aviso_contratacao_direta: pickPrefix(processo, "avisoContratacaoDireta"),
      cotacao: pickPrefix(processo, "cot"),
      resultado: {
        resultadoValorHomologado: processo.resultadoValorHomologado || "",
        resultadoItens: processo.resultadoItens || []
      },
      homologacao: {
        resultadoValorHomologado: processo.resultadoValorHomologado || "",
        resultadoItens: processo.resultadoItens || []
      },
      credenciamento: pickPrefix(processo, "cred")
    };
    return Object.entries(blocos).map(([bloco, dados]) => ({ processo_id: processoId, bloco, dados }));
  }

  function pickPrefix(obj, prefix) {
    const out = {};
    Object.entries(obj || {}).forEach(([key, value]) => {
      if (key.startsWith(prefix)) out[key] = value;
    });
    return out;
  }

  function fornecedorPayload(fornecedor) {
    const cnpj = fornecedor?.cnpj || fornecedor?.fornecedorCnpj || fornecedor?.credCnpj || "";
    const local = fornecedor?.id || fornecedor?.fornecedorId || onlyDigits(cnpj);
    return {
      local_id: localId("forn", local),
      cnpj: cnpj || null,
      razao_social: fornecedor?.razaoSocial || fornecedor?.razao || fornecedor?.fornecedorRazao || fornecedor?.credRazao || "",
      nome_fantasia: fornecedor?.nomeFantasia || fornecedor?.fantasia || fornecedor?.fornecedorFantasia || fornecedor?.credFantasia || "",
      origem: fornecedor?.origem || "",
      extra: fornecedor || {}
    };
  }

  function pessoaFornecedorPayload(fornecedorId, pessoa) {
    return {
      fornecedor_id: fornecedorId,
      local_id: pessoa?.id || pessoa?.local_id || localId("pessoa"),
      nome: pessoa?.nome || "",
      cpf: pessoa?.cpf || "",
      tipo: pessoa?.tipoVinculo || pessoa?.tipo || pessoa?.tipo_vinculo || "",
      situacao: pessoa?.ativo === false ? "INATIVO" : (pessoa?.situacao || "ATIVO"),
      observacao: pessoa?.observacao || "",
      extra: pessoa || {}
    };
  }

  function pessoaFornecedorFromRow(row) {
    const extra = row?.extra && typeof row.extra === "object" ? { ...row.extra } : {};
    const situacao = row.situacao || extra.situacao || "";
    return {
      ...extra,
      id: row.local_id || extra.id || row.id,
      supabaseId: row.id,
      nome: row.nome || extra.nome || "",
      cpf: row.cpf || extra.cpf || "",
      tipoVinculo: row.tipo || extra.tipoVinculo || extra.tipo || "",
      observacao: row.observacao || extra.observacao || "",
      ativo: situacao ? normalizarTexto(situacao) !== "INATIVO" : extra.ativo !== false,
      criadoEm: extra.criadoEm || formatDateTimeBR(row.created_at),
      atualizadoEm: extra.atualizadoEm || formatDateTimeBR(row.updated_at)
    };
  }

  function normalizarTexto(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
  }

  function fornecedorFromRow(row, pessoasRelacionadas) {
    const extra = row?.extra && typeof row.extra === "object" ? { ...row.extra } : {};
    const pessoas = Array.isArray(pessoasRelacionadas) && pessoasRelacionadas.length
      ? pessoasRelacionadas
      : (Array.isArray(row?.fornecedor_pessoas) && row.fornecedor_pessoas.length ? row.fornecedor_pessoas.map(pessoaFornecedorFromRow) : (Array.isArray(extra.pessoas) ? extra.pessoas : []));
    return {
      ...extra,
      id: row.local_id || extra.id || row.id,
      supabaseId: row.id,
      cnpj: row.cnpj || extra.cnpj || "",
      razaoSocial: row.razao_social || extra.razaoSocial || extra.razao || "",
      nomeFantasia: row.nome_fantasia || extra.nomeFantasia || extra.fantasia || "",
      origem: row.origem || extra.origem || "",
      criadoEm: extra.criadoEm || formatDateTimeBR(row.created_at),
      atualizadoEm: extra.atualizadoEm || formatDateTimeBR(row.updated_at),
      pessoas
    };
  }

  function logSupabaseFornecedor(operacao, detalhes) {
    console.log(`[SUPABASE][fornecedores][${operacao}]`, detalhes);
  }

  function secretariaFromRow(row) {
    return {
      id: row.id,
      sigla: row.sigla || "",
      nome: row.nome || "",
      ativo: row.ativo !== false,
      criadoEm: formatDateTimeBR(row.created_at),
      atualizadoEm: formatDateTimeBR(row.updated_at)
    };
  }

  function logSupabaseSecretaria(operacao, detalhes) {
    console.log(`[SUPABASE][secretarias][${operacao}]`, detalhes);
  }

  function tipoProtocoloFromRow(row) {
    return {
      id: row.id,
      nome: row.nome || "",
      ativo: row.ativo !== false,
      padrao: !!row.padrao,
      criadoEm: formatDateTimeBR(row.created_at),
      atualizadoEm: formatDateTimeBR(row.updated_at)
    };
  }

  function logSupabaseTipoProtocolo(operacao, detalhes) {
    console.log(`[SUPABASE][tipos_protocolo][${operacao}]`, detalhes);
  }

  function assuntoProtocoloFromRow(row) {
    return {
      id: row.id,
      tipo: row.tipo_nome || "",
      tipoProtocoloId: row.tipo_protocolo_id || "",
      nome: row.nome || "",
      ativo: row.ativo !== false,
      padrao: !!row.padrao,
      criadoEm: formatDateTimeBR(row.created_at),
      atualizadoEm: formatDateTimeBR(row.updated_at)
    };
  }

  function logSupabaseAssuntoProtocolo(operacao, detalhes) {
    console.log(`[SUPABASE][assuntos_protocolo][${operacao}]`, detalhes);
  }

  async function obterTipoProtocoloIdPorNome(client, nome) {
    const tipoNome = String(nome || "").replace(/\s+/g, " ").trim().toUpperCase();
    if (!tipoNome) return null;
    const { data, error } = await client
      .from("tipos_protocolo")
      .select("id")
      .eq("nome", tipoNome)
      .maybeSingle();
    if (error) throw error;
    return data?.id || null;
  }

  async function listarAssuntosProtocolo(tipoNome = "") {
    const client = requireClient();
    await requireAuthenticatedUser();
    const tipoFiltro = String(tipoNome || "").replace(/\s+/g, " ").trim().toUpperCase();
    logSupabaseAssuntoProtocolo("SELECT", { tabela: "assuntos_protocolo", tipo: tipoFiltro || null });
    let query = client
      .from("assuntos_protocolo")
      .select("*")
      .eq("ativo", true)
      .order("tipo_nome", { ascending: true })
      .order("nome", { ascending: true });
    if (tipoFiltro) query = query.eq("tipo_nome", tipoFiltro);
    const { data, error } = await query;
    logSupabaseAssuntoProtocolo("SELECT_RESULT", { data, error });
    if (error) throw error;
    return (data || []).map(assuntoProtocoloFromRow);
  }

  async function salvarAssuntoProtocolo(assunto) {
    const client = requireClient();
    await requireAuthenticatedUser();
    const payload = {
      tipo_nome: String(assunto?.tipo || assunto?.tipoProtocolo || assunto?.tipo_nome || "").replace(/\s+/g, " ").trim().toUpperCase(),
      nome: String(assunto?.nome || "").replace(/\s+/g, " ").trim().toUpperCase(),
      ativo: assunto?.ativo !== false,
      padrao: !!assunto?.padrao,
      tipo_protocolo_id: null
    };
    if (!payload.tipo_nome) throw new Error("Informe o tipo do protocolo para cadastrar o assunto.");
    if (!payload.nome) throw new Error("Informe o nome do assunto do protocolo.");
    payload.tipo_protocolo_id = await obterTipoProtocoloIdPorNome(client, payload.tipo_nome);

    logSupabaseAssuntoProtocolo("UPSERT", { tabela: "assuntos_protocolo", payload });
    const { data, error } = await client
      .from("assuntos_protocolo")
      .upsert(payload, { onConflict: "tipo_nome,nome" })
      .select("*")
      .single();
    logSupabaseAssuntoProtocolo("UPSERT_RESULT", { data, error });
    if (error) throw error;
    return assuntoProtocoloFromRow(data);
  }

  async function excluirAssuntoProtocolo(tipoNome, nome) {
    const client = requireClient();
    await requireAuthenticatedUser();
    const payload = {
      tipo_nome: String(tipoNome || "").replace(/\s+/g, " ").trim().toUpperCase(),
      nome: String(nome || "").replace(/\s+/g, " ").trim().toUpperCase()
    };
    if (!payload.tipo_nome || !payload.nome) throw new Error("Informe tipo e assunto para excluir.");
    logSupabaseAssuntoProtocolo("DELETE", { tabela: "assuntos_protocolo", payload });
    const { data, error } = await client
      .from("assuntos_protocolo")
      .update({ ativo: false })
      .eq("tipo_nome", payload.tipo_nome)
      .eq("nome", payload.nome)
      .select("*")
      .single();
    logSupabaseAssuntoProtocolo("DELETE_RESULT", { data, error });
    if (error) throw error;
    return assuntoProtocoloFromRow(data);
  }

  async function listarTiposProtocolo() {
    const client = requireClient();
    await requireAuthenticatedUser();
    logSupabaseTipoProtocolo("SELECT", { tabela: "tipos_protocolo" });
    const { data, error } = await client
      .from("tipos_protocolo")
      .select("*")
      .eq("ativo", true)
      .order("nome", { ascending: true });
    logSupabaseTipoProtocolo("SELECT_RESULT", { data, error });
    if (error) throw error;
    return (data || []).map(tipoProtocoloFromRow);
  }

  async function salvarTipoProtocolo(tipo) {
    const client = requireClient();
    await requireAuthenticatedUser();
    const payload = {
      nome: String(tipo?.nome || "").replace(/\s+/g, " ").trim().toUpperCase(),
      ativo: tipo?.ativo !== false,
      padrao: !!tipo?.padrao
    };
    if (!payload.nome) throw new Error("Informe o nome do tipo de protocolo.");
    logSupabaseTipoProtocolo("UPSERT", { tabela: "tipos_protocolo", payload });
    const { data, error } = await client
      .from("tipos_protocolo")
      .upsert(payload, { onConflict: "nome" })
      .select("*")
      .single();
    logSupabaseTipoProtocolo("UPSERT_RESULT", { data, error });
    if (error) throw error;
    return tipoProtocoloFromRow(data);
  }

  async function excluirTipoProtocolo(nome) {
    const client = requireClient();
    await requireAuthenticatedUser();
    const payload = { nome: String(nome || "").replace(/\s+/g, " ").trim().toUpperCase(), ativo: false };
    if (!payload.nome) throw new Error("Informe o nome do tipo de protocolo.");
    logSupabaseTipoProtocolo("DELETE", { tabela: "tipos_protocolo", payload });
    const { data, error } = await client
      .from("tipos_protocolo")
      .update({ ativo: false })
      .eq("nome", payload.nome)
      .select("*")
      .single();
    logSupabaseTipoProtocolo("DELETE_RESULT", { data, error });
    if (error) throw error;
    return tipoProtocoloFromRow(data);
  }

  async function listarSecretarias() {
    const client = requireClient();
    await requireAuthenticatedUser();
    logSupabaseSecretaria("SELECT", { tabela: "secretarias" });
    const { data, error } = await client
      .from("secretarias")
      .select("*")
      .eq("ativo", true)
      .order("sigla", { ascending: true });
    logSupabaseSecretaria("SELECT_RESULT", { data, error });
    if (error) throw error;
    return (data || []).map(secretariaFromRow);
  }

  async function salvarSecretaria(secretaria) {
    const client = requireClient();
    await requireAuthenticatedUser();
    const payload = {
      sigla: String(secretaria?.sigla || "").trim().toUpperCase(),
      nome: secretaria?.nome || null,
      ativo: secretaria?.ativo !== false
    };
    if (!payload.sigla) throw new Error("Informe a sigla da secretaria.");
    logSupabaseSecretaria("UPSERT", { tabela: "secretarias", payload });
    const { data, error } = await client
      .from("secretarias")
      .upsert(payload, { onConflict: "sigla" })
      .select("*")
      .single();
    logSupabaseSecretaria("UPSERT_RESULT", { data, error });
    if (error) throw error;
    return secretariaFromRow(data);
  }

  async function excluirSecretaria(sigla) {
    const client = requireClient();
    await requireAuthenticatedUser();
    const payload = { sigla: String(sigla || "").trim().toUpperCase(), ativo: false };
    if (!payload.sigla) throw new Error("Informe a sigla da secretaria.");
    logSupabaseSecretaria("DELETE", { tabela: "secretarias", payload });
    const { data, error } = await client
      .from("secretarias")
      .update({ ativo: false })
      .eq("sigla", payload.sigla)
      .select("*")
      .single();
    logSupabaseSecretaria("DELETE_RESULT", { data, error });
    if (error) throw error;
    return secretariaFromRow(data);
  }

  async function listarFornecedores() {
    const client = requireClient();
    await requireAuthenticatedUser();
    logSupabaseFornecedor("SELECT", { tabela: "fornecedores" });
    const { data, error } = await client
      .from("fornecedores")
      .select("*")
      .order("razao_social", { ascending: true });
    logSupabaseFornecedor("SELECT_RESULT", { data, error });
    if (error) throw error;
    const fornecedores = data || [];
    const pessoasPorFornecedor = await listarPessoasPorFornecedorIds(client, fornecedores.map(f => f.id));
    return fornecedores.map(row => fornecedorFromRow(row, pessoasPorFornecedor.get(row.id) || []));
  }

  async function listarPessoasPorFornecedorIds(client, fornecedorIds) {
    const ids = Array.from(new Set(fornecedorIds || [])).filter(Boolean);
    const mapa = new Map();
    if (!ids.length) return mapa;
    console.log("[SUPABASE][fornecedor_pessoas][SELECT]", { tabela: "fornecedor_pessoas", fornecedorIds: ids });
    const { data, error } = await client
      .from("fornecedor_pessoas")
      .select("*")
      .in("fornecedor_id", ids)
      .order("nome", { ascending: true });
    console.log("[SUPABASE][fornecedor_pessoas][SELECT_RESULT]", { data, error });
    if (error) throw error;
    (data || []).forEach(row => {
      const lista = mapa.get(row.fornecedor_id) || [];
      lista.push(pessoaFornecedorFromRow(row));
      mapa.set(row.fornecedor_id, lista);
    });
    return mapa;
  }

  async function substituirPessoasFornecedor(client, fornecedorId, pessoas) {
    const normalizadas = Array.isArray(pessoas) ? pessoas : [];
    console.log("[SUPABASE][fornecedor_pessoas][DELETE]", { tabela: "fornecedor_pessoas", fornecedorId });
    const del = await client.from("fornecedor_pessoas").delete().eq("fornecedor_id", fornecedorId);
    console.log("[SUPABASE][fornecedor_pessoas][DELETE_RESULT]", { data: del.data, error: del.error });
    if (del.error) throw del.error;

    const rows = normalizadas
      .map(pessoa => pessoaFornecedorPayload(fornecedorId, pessoa))
      .filter(row => row.nome);
    if (!rows.length) return [];

    console.log("[SUPABASE][fornecedor_pessoas][INSERT]", { tabela: "fornecedor_pessoas", payload: rows });
    const { data, error } = await client
      .from("fornecedor_pessoas")
      .insert(rows)
      .select("*");
    console.log("[SUPABASE][fornecedor_pessoas][INSERT_RESULT]", { data, error });
    if (error) throw error;
    return (data || []).map(pessoaFornecedorFromRow);
  }

  async function listarPessoasFornecedor(fornecedorLocalId) {
    const client = requireClient();
    await requireAuthenticatedUser();
    const alvo = await client
      .from("fornecedores")
      .select("id")
      .eq("local_id", fornecedorLocalId)
      .single();
    if (alvo.error) throw alvo.error;
    const mapa = await listarPessoasPorFornecedorIds(client, [alvo.data.id]);
    return mapa.get(alvo.data.id) || [];
  }

  async function salvarFornecedor(fornecedor) {
    const client = requireClient();
    await requireAuthenticatedUser();
    const payload = fornecedorPayload(fornecedor);
    const conflict = payload.cnpj ? "cnpj" : "local_id";
    logSupabaseFornecedor("UPSERT", { tabela: "fornecedores", payload, conflict });
    const { data, error } = await client
      .from("fornecedores")
      .upsert(payload, { onConflict: conflict })
      .select("*")
      .single();
    logSupabaseFornecedor("UPSERT_RESULT", { data, error });
    if (error) throw error;
    const pessoas = await substituirPessoasFornecedor(client, data.id, fornecedor?.pessoas || []);
    return fornecedorFromRow(data, pessoas);
  }

  async function excluirFornecedor(localIdFornecedor) {
    const client = requireClient();
    await requireAuthenticatedUser();
    logSupabaseFornecedor("DELETE", { tabela: "fornecedores", localId: localIdFornecedor });
    const { data, error } = await client
      .from("fornecedores")
      .delete()
      .eq("local_id", localIdFornecedor)
      .select("id, local_id")
      .single();
    logSupabaseFornecedor("DELETE_RESULT", { data, error });
    if (error) throw error;

    const check = await client
      .from("fornecedores")
      .select("id")
      .eq("local_id", localIdFornecedor)
      .maybeSingle();
    if (check.error) throw check.error;
    if (check.data) throw new Error("Nao foi possivel confirmar a exclusao do fornecedor no Supabase.");
    return true;
  }

  async function upsertFornecedor(client, fornecedor) {
    if (!fornecedor) return null;
    const cnpj = fornecedor.cnpj || fornecedor.fornecedorCnpj || fornecedor.credCnpj || "";
    if (!cnpj && !fornecedor.razaoSocial && !fornecedor.razao && !fornecedor.fornecedorRazao) return null;
    const payload = fornecedorPayload(fornecedor);
    const conflict = payload.cnpj ? "cnpj" : "local_id";
    logSupabaseFornecedor("UPSERT", { tabela: "fornecedores", payload, conflict });
    const { data, error } = await client.from("fornecedores").upsert(payload, { onConflict: conflict }).select("id").single();
    logSupabaseFornecedor("UPSERT_RESULT", { data, error });
    if (error) throw error;
    return data?.id || null;
  }

  async function salvarAnexoMeta(client, arquivo, origem = "") {
    if (!arquivo || typeof arquivo !== "object") return null;
    const local = arquivo.id || arquivo.local_id || arquivo.localId || `${origem}_${arquivo.nome || arquivo.name || ""}_${arquivo.tamanho || arquivo.size || ""}`;
    if (!String(local || "").trim() && !arquivo.nome && !arquivo.name) return null;
    const anexoLocalId = localId("anexo", local);
    const existente = await client
      .from("anexos")
      .select("id, storage_bucket, storage_path")
      .eq("local_id", anexoLocalId)
      .maybeSingle();
    if (existente.error) throw existente.error;
    const payload = {
      local_id: anexoLocalId,
      nome: arquivo.nome || arquivo.name || "",
      tipo: arquivo.tipo || arquivo.type || "",
      tamanho: arquivo.tamanho || arquivo.size || null,
      storage_bucket: arquivo.storageBucket || arquivo.storage_bucket || existente.data?.storage_bucket || "",
      storage_path: arquivo.storagePath || arquivo.storage_path || existente.data?.storage_path || arquivo.id || "",
      origem,
      extra: arquivo
    };
    console.log("[SUPABASE][anexos][UPSERT]", { payload });
    const { data, error } = await client
      .from("anexos")
      .upsert(payload, { onConflict: "local_id" })
      .select("id")
      .single();
    console.log("[SUPABASE][anexos][UPSERT_RESULT]", { data, error });
    if (error) throw error;
    return data?.id || null;
  }

  function dataUrlToBlob(dataUrl, fallbackType = "application/octet-stream") {
    const [header, body] = String(dataUrl || "").split(",");
    if (!body) return null;
    const tipo = header.match(/data:([^;]+)/)?.[1] || fallbackType;
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: tipo });
  }

  function safeStorageName(value) {
    return String(value || "anexo")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.\-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 140) || "anexo";
  }

  async function importarAnexoBackup(anexo, options = {}) {
    const client = requireClient();
    await requireAuthenticatedUser();
    const bucket = options.bucket || "processos-anexos";
    const origem = options.origem || "backup_json";
    const local = anexo?.id || anexo?.local_id || anexo?.localId;
    if (!local) throw new Error("Anexo sem ID local no backup.");

    const anexoLocalId = localId("anexo", local);
    const nome = anexo.nome || anexo.name || `${anexoLocalId}.pdf`;
    const tipo = anexo.tipo || anexo.type || "application/octet-stream";
    let storagePath = anexo.storagePath || anexo.storage_path || "";

    if (anexo.dataUrl) {
      const blob = dataUrlToBlob(anexo.dataUrl, tipo);
      if (!blob) throw new Error(`Nao foi possivel converter o anexo ${anexoLocalId}.`);
      storagePath = storagePath || `backup/${anexoLocalId}/${safeStorageName(nome)}`;
      console.log("[MIGRAÇÃO][anexos][STORAGE_UPLOAD]", { bucket, storagePath, nome, tipo });
      const upload = await client.storage
        .from(bucket)
        .upload(storagePath, blob, { contentType: tipo, upsert: true });
      console.log("[MIGRAÇÃO][anexos][STORAGE_RESULT]", { data: upload.data, error: upload.error });
      if (upload.error) throw upload.error;
    }

    const extra = { ...(anexo || {}) };
    delete extra.dataUrl;

    const payload = {
      local_id: anexoLocalId,
      nome,
      tipo,
      tamanho: anexo.tamanho || anexo.size || null,
      storage_bucket: storagePath ? bucket : (anexo.storageBucket || anexo.storage_bucket || ""),
      storage_path: storagePath || "",
      origem,
      extra
    };
    console.log("[MIGRAÇÃO][anexos][UPSERT]", { payload });
    const { data, error } = await client
      .from("anexos")
      .upsert(payload, { onConflict: "local_id" })
      .select("*")
      .single();
    console.log("[MIGRAÇÃO][anexos][UPSERT_RESULT]", { data, error });
    if (error) throw error;
    return data;
  }

  async function contarRegistros(tabela) {
    const client = requireClient();
    await requireAuthenticatedUser();
    const { count, error } = await client
      .from(tabela)
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    return count || 0;
  }

  function anexoFromRow(row) {
    if (!row) return null;
    const extra = row.extra && typeof row.extra === "object" ? { ...row.extra } : {};
    return {
      ...extra,
      id: row.local_id || extra.id || row.id,
      supabaseId: row.id,
      nome: row.nome || extra.nome || "",
      tipo: row.tipo || extra.tipo || "",
      tamanho: row.tamanho ?? extra.tamanho ?? null,
      storage: extra.storage || (row.storage_path ? "supabase" : extra.storage || ""),
      storageBucket: row.storage_bucket || extra.storageBucket || "",
      storagePath: row.storage_path || extra.storagePath || ""
    };
  }

  function itemFromRow(row) {
    const extra = row?.extra && typeof row.extra === "object" ? { ...row.extra } : {};
    return {
      ...extra,
      id: row.local_id || extra.id || row.id,
      item: extra.item || row.ordem || "",
      codigo: row.codigo || extra.codigo || "",
      descricao: row.descricao || extra.descricao || extra.nome || extra.produto || "",
      unidade: row.unidade || extra.unidade || extra.unidadeMedida || "",
      quantidade: row.quantidade ?? extra.quantidade ?? extra.qtd ?? "",
      valorUnitario: row.valor_unitario ?? extra.valorUnitario ?? extra.unitario ?? extra.valor ?? "",
      valorTotal: row.valor_total ?? extra.valorTotal ?? extra.total ?? "",
      situacao: row.situacao || extra.situacao || "",
      origem: row.origem || extra.origem || ""
    };
  }

  function tableItemFromRow(row) {
    if (Array.isArray(row.extra?.raw)) return row.extra.raw;
    const extra = row?.extra && typeof row.extra === "object" ? row.extra : {};
    if (Array.isArray(extra)) return extra;
    return [
      row.codigo || extra.codigo || "",
      row.descricao || extra.descricao || "",
      row.unidade || extra.unidade || "",
      row.quantidade ?? extra.quantidade ?? "",
      row.valor_unitario ?? extra.valorUnitario ?? "",
      row.valor_total ?? extra.valorTotal ?? ""
    ];
  }

  function publicacaoProcessoFromRow(row, anexosPorId) {
    const extra = row?.extra && typeof row.extra === "object" ? { ...row.extra } : {};
    const anexo = anexosPorId?.get(row.anexo_id) || extra.anexo || null;
    return {
      ...extra,
      id: row.local_id || extra.id || row.id,
      bloco: row.bloco || extra.bloco || "",
      tipo: row.tipo || extra.tipo || "",
      titulo: row.titulo || extra.titulo || extra.nome || "",
      data: formatDateBR(row.data_publicacao) || extra.data || extra.dataPublicacao || "",
      dataPublicacao: formatDateBR(row.data_publicacao) || extra.dataPublicacao || extra.data || "",
      link: row.link || extra.link || extra.url || "",
      anexo
    };
  }

  function publicacaoAtaFromRow(row, anexosPorId) {
    const extra = row?.extra && typeof row.extra === "object" ? { ...row.extra } : {};
    const pdf = anexosPorId?.get(row.anexo_id) || extra.pdf || null;
    return {
      ...extra,
      id: row.local_id || extra.id || row.id,
      tipo: row.tipo || extra.tipo || "",
      nome: row.titulo || extra.nome || extra.titulo || "",
      titulo: row.titulo || extra.titulo || extra.nome || "",
      data: formatDateBR(row.data_publicacao) || extra.data || "",
      link: row.link || extra.link || "",
      pdf
    };
  }

  function aditivoAtaFromRow(row, publicacoes, anexosPorId) {
    const extra = row?.extra && typeof row.extra === "object" ? { ...row.extra } : {};
    const pdf = anexosPorId?.get(row.anexo_id) || extra.pdf || null;
    return {
      ...extra,
      id: row.local_id || extra.id || row.id,
      numero: row.numero || extra.numero || "",
      objetoAditivado: row.objeto_aditivado || extra.objetoAditivado || "",
      alteraVigencia: row.altera_vigencia ?? extra.alteraVigencia ?? false,
      vigencia: row.vigencia || extra.vigencia || "",
      dataAssinatura: formatDateBR(row.data_assinatura) || extra.dataAssinatura || "",
      publicacao: formatDateBR(row.data_publicacao) || extra.publicacao || "",
      pdf,
      publicacoesExtrato: publicacoes || []
    };
  }

  function ataRegistroPrecoFromRow(row, filhos = {}, anexosPorId = new Map(), fornecedoresPorId = new Map()) {
    const extra = row?.extra && typeof row.extra === "object" ? { ...row.extra } : {};
    const fornecedor = fornecedoresPorId.get(row.fornecedor_id);
    return {
      ...extra,
      id: row.local_id || extra.id || row.id,
      supabaseId: row.id,
      numero: row.numero || extra.numero || "",
      ano: row.ano || extra.ano || "",
      unidadeOrcamentaria: row.unidade_orcamentaria || extra.unidadeOrcamentaria || "",
      objeto: row.objeto || extra.objeto || "",
      objetoResumido: row.objeto_resumido || extra.objetoResumido || "",
      modalidade: row.modalidade || extra.modalidade || "",
      dataAssinatura: formatDateBR(row.data_assinatura) || extra.dataAssinatura || "",
      dataExtrato: formatDateBR(row.data_extrato) || extra.dataExtrato || "",
      vigenciaInicio: formatDateBR(row.vigencia_inicio) || extra.vigenciaInicio || "",
      vigenciaFim: formatDateBR(row.vigencia_fim) || extra.vigenciaFim || "",
      vigencia: row.vigencia_atual || extra.vigencia || "",
      linkPncp: row.link_pncp || extra.linkPncp || "",
      fornecedorCnpj: fornecedor?.cnpj || extra.fornecedorCnpj || "",
      fornecedorRazao: fornecedor?.razaoSocial || extra.fornecedorRazao || "",
      fornecedorFantasia: fornecedor?.nomeFantasia || extra.fornecedorFantasia || "",
      nomePdfAta: row.nome_pdf_ata || extra.nomePdfAta || "",
      nomePdfExtrato: row.nome_pdf_extrato || extra.nomePdfExtrato || "",
      pdfAta: anexosPorId.get(row.pdf_ata_anexo_id) || extra.pdfAta || null,
      pdfExtrato: anexosPorId.get(row.pdf_extrato_anexo_id) || extra.pdfExtrato || null,
      itens: filhos.itens || [],
      publicacoesExtrato: filhos.publicacoes || [],
      aditivos: filhos.aditivos || []
    };
  }

  async function replaceRows(client, table, foreignKey, parentId, rows) {
    const del = await client.from(table).delete().eq(foreignKey, parentId);
    if (del.error) throw del.error;
    if (!rows.length) return;
    const ins = await client.from(table).insert(rows);
    if (ins.error) throw ins.error;
  }

  async function saveProcessoCompleto(processo) {
    const client = requireClient();
    const user = await requireAuthenticatedUser();
    const core = processoCore(processo);

    console.log("[Supabase processos] antes do INSERT/UPDATE em public.processos", {
      userId: user.id,
      payload: core
    });

    const { data: procSaved, error } = await client
      .from("processos")
      .upsert(core, { onConflict: "local_id" })
      .select("id")
      .single();

    console.log("[Supabase processos] depois do INSERT/UPDATE em public.processos", {
      data: procSaved,
      error
    });

    if (error) throw error;

    const processoId = procSaved.id;
    await replaceRows(client, "processo_blocos", "processo_id", processoId, blocoEntries(processo, processoId));

    const itens = [
      ...(processo.itensProcesso || []).map((item, index) => itemRow(processoId, item, index, "processo")),
      ...(processo.cotItens || []).map((item, index) => itemRow(processoId, item, index, "cotacao")),
      ...(processo.resultadoItens || []).map((item, index) => itemRow(processoId, item, index, "resultado"))
    ];
    await replaceRows(client, "processo_itens", "processo_id", processoId, itens);

    const publicacoes = [];
    for (const pub of processo.publicacoes || []) {
      let anexoId = await salvarAnexoMeta(client, pub.anexo, `processo_publicacao:${processo.numero || ""}`);
      for (const meio of Object.values(pub.meios || {})) {
        const meioAnexoId = await salvarAnexoMeta(client, meio?.anexo, `processo_publicacao_meio:${processo.numero || ""}:${meio?.label || ""}`);
        if (!anexoId && meioAnexoId) anexoId = meioAnexoId;
      }
      publicacoes.push({
        processo_id: processoId,
        local_id: pub.id || null,
        bloco: pub.bloco || "",
        tipo: pub.tipo || "",
        titulo: pub.titulo || pub.nome || "",
        data_publicacao: parseDateBR(pub.data || pub.dataPublicacao),
        link: pub.link || pub.url || "",
        anexo_id: anexoId,
        extra: pub
      });
    }
    await replaceRows(client, "processo_publicacoes", "processo_id", processoId, publicacoes);

    await replaceAtas(client, processoId, processo.atasRegistroPreco || []);

    const verificado = await client
      .from("processos")
      .select("*")
      .eq("id", processoId)
      .single();
    if (verificado.error) throw verificado.error;
    if (!verificado.data?.id) throw new Error("Nao foi possivel confirmar a gravacao do processo no Supabase.");
    return processoFromRow(verificado.data);
  }

  function itemRow(processoId, item, index, origem) {
    return {
      processo_id: processoId,
      local_id: item.id || null,
      origem,
      ordem: Number(item.item || item.ordem || index + 1) || index + 1,
      codigo: item.codigo || "",
      descricao: item.descricao || item.nome || item.produto || "",
      unidade: item.unidade || item.unidadeMedida || "",
      quantidade: parseNumber(item.quantidade || item.qtd),
      valor_unitario: parseNumber(item.valorUnitario || item.unitario || item.valor),
      valor_total: parseNumber(item.valorTotal || item.total),
      situacao: item.situacao || "",
      extra: item
    };
  }

  async function replaceAtas(client, processoId, atas) {
    const old = await client.from("atas_registro_preco").delete().eq("processo_id", processoId);
    if (old.error) throw old.error;

    for (const ata of atas) {
      const fornecedorId = await upsertFornecedor(client, {
        cnpj: ata.fornecedorCnpj,
        razaoSocial: ata.fornecedorRazao,
        nomeFantasia: ata.fornecedorFantasia,
        origem: `ATA ${ata.numero || ""}/${ata.ano || ""}`.trim()
      });
      const { data, error } = await client.from("atas_registro_preco").insert({
        processo_id: processoId,
        local_id: localId("ata", ata.id),
        numero: ata.numero || "",
        ano: ata.ano || "",
        unidade_orcamentaria: ata.unidadeOrcamentaria || "",
        objeto: ata.objeto || "",
        objeto_resumido: ata.objetoResumido || "",
        modalidade: ata.modalidade || "",
        data_assinatura: parseDateBR(ata.dataAssinatura),
        data_extrato: parseDateBR(ata.dataExtrato),
        vigencia_inicio: parseDateBR(ata.vigenciaInicio),
        vigencia_fim: parseDateBR(ata.vigenciaFim),
        vigencia_atual: ata.vigencia || "",
        link_pncp: ata.linkPncp || "",
        fornecedor_id: fornecedorId,
        nome_pdf_ata: ata.nomePdfAta || "",
        nome_pdf_extrato: ata.nomePdfExtrato || "",
        pdf_ata_anexo_id: await salvarAnexoMeta(client, ata.pdfAta, `ata:${ata.numero || ""}/${ata.ano || ""}`),
        pdf_extrato_anexo_id: await salvarAnexoMeta(client, ata.pdfExtrato, `ata_extrato:${ata.numero || ""}/${ata.ano || ""}`),
        extra: ata
      }).select("id").single();
      if (error) throw error;
      const ataId = data.id;

      await replaceRows(client, "ata_itens", "ata_id", ataId, (ata.itens || []).map((item, index) => {
        const row = Array.isArray(item) ? item : [
          item?.codigo || "",
          item?.descricao || "",
          item?.unidade || "",
          item?.quantidade || "",
          item?.valorUnitario || item?.valor_unitario || "",
          item?.valorTotal || item?.valor_total || ""
        ];
        return {
        ata_id: ataId,
        ordem: index,
        codigo: row[0] || "",
        descricao: row[1] || "",
        unidade: row[2] || "",
        quantidade: index === 0 ? null : parseNumber(row[3]),
        valor_unitario: index === 0 ? null : parseNumber(row[4]),
        valor_total: index === 0 ? null : parseNumber(row[5]),
        extra: { raw: row, original: item || null }
      };
      }));

      const publicacoesAta = [];
      for (const pub of ata.publicacoesExtrato || []) {
        publicacoesAta.push({
          ata_id: ataId,
          local_id: pub.id || null,
          tipo: pub.tipo || "",
          titulo: pub.nome || pub.titulo || "",
          data_publicacao: parseDateBR(pub.data),
          link: pub.link || "",
          anexo_id: await salvarAnexoMeta(client, pub.pdf, `ata_publicacao:${ata.numero || ""}/${ata.ano || ""}`),
          extra: pub
        });
      }
      await replaceRows(client, "ata_publicacoes", "ata_id", ataId, publicacoesAta);

      for (const aditivo of ata.aditivos || []) {
        const saved = await client.from("ata_aditivos").insert({
          ata_id: ataId,
          local_id: aditivo.id || null,
          numero: aditivo.numero || "",
          objeto_aditivado: aditivo.objetoAditivado || "",
          altera_vigencia: !!aditivo.alteraVigencia,
          vigencia: aditivo.vigencia || "",
          data_assinatura: parseDateBR(aditivo.dataAssinatura),
          data_publicacao: parseDateBR(aditivo.publicacao),
          anexo_id: await salvarAnexoMeta(client, aditivo.pdf, `ata_aditivo:${ata.numero || ""}/${ata.ano || ""}`),
          extra: aditivo
        }).select("id").single();
        if (saved.error) throw saved.error;
        const publicacoesAditivo = [];
        for (const pub of aditivo.publicacoesExtrato || []) {
          publicacoesAditivo.push({
            aditivo_id: saved.data.id,
            local_id: pub.id || null,
            tipo: pub.tipo || "",
            titulo: pub.nome || pub.titulo || "",
            data_publicacao: parseDateBR(pub.data),
            link: pub.link || "",
            anexo_id: await salvarAnexoMeta(client, pub.pdf, `ata_aditivo_publicacao:${ata.numero || ""}/${ata.ano || ""}`),
            extra: pub
          });
        }
        await replaceRows(client, "ata_aditivo_publicacoes", "aditivo_id", saved.data.id, publicacoesAditivo);
      }
    }
  }

  async function saveTramitesGerais(numeroProcesso, tramites) {
    const client = requireClient();
    await requireAuthenticatedUser();
    const processo = await client.from("processos").select("id").eq("numero", numeroProcesso).maybeSingle();
    if (processo.error) throw processo.error;
    console.log("[SUPABASE][tramites_gerais][REPLACE][ANTES]", { numeroProcesso, tramites });
    const del = await client.from("tramites_gerais").delete().eq("numero_processo", numeroProcesso);
    if (del.error) throw del.error;
    const rows = (tramites || []).map(t => ({
      processo_id: processo.data?.id || null,
      numero_processo: numeroProcesso,
      item: String(t.item || ""),
      data_tramite: parseDateBR(t.data),
      hora_tramite: parseTime(t.hora),
      recebido: t.recebido || "",
      origem: t.origem || "",
      setor_atual: t.atual || t.setorAtual || "",
      relator: t.relator || "",
      parecer: t.parecer || "",
      descricao_parecer: t.descricao || "",
      extra: t
    }));
    if (!rows.length) return [];
    const ins = await client.from("tramites_gerais").insert(rows).select("*");
    console.log("[SUPABASE][tramites_gerais][REPLACE][DEPOIS]", { data: ins.data, error: ins.error });
    if (ins.error) throw ins.error;
    return ins.data || [];
  }

  async function listarTramitesGerais() {
    const client = requireClient();
    await requireAuthenticatedUser();
    console.log("[SUPABASE][tramites_gerais][SELECT][ANTES]");
    const { data, error } = await client
      .from("tramites_gerais")
      .select("*")
      .order("numero_processo", { ascending: true })
      .order("item", { ascending: true });
    console.log("[SUPABASE][tramites_gerais][SELECT][DEPOIS]", { data, error });
    if (error) throw error;
    const mapa = {};
    (data || []).forEach(row => {
      const numero = row.numero_processo || "";
      if (!numero) return;
      if (!mapa[numero]) mapa[numero] = { atualizadoEm: "", tramites: [] };
      mapa[numero].tramites.push({
        ...(row.extra || {}),
        item: row.item || "",
        data: formatDateBR(row.data_tramite) || row.extra?.data || "",
        hora: row.hora_tramite || row.extra?.hora || "",
        recebido: row.recebido || row.extra?.recebido || "",
        origem: row.origem || row.extra?.origem || "",
        atual: row.setor_atual || row.extra?.atual || row.extra?.setorAtual || "",
        setorAtual: row.setor_atual || row.extra?.setorAtual || row.extra?.atual || "",
        relator: row.relator || row.extra?.relator || "",
        parecer: row.parecer || row.extra?.parecer || "",
        descricao: row.descricao_parecer || row.extra?.descricao || ""
      });
      mapa[numero].atualizadoEm = row.updated_at || mapa[numero].atualizadoEm;
    });
    return mapa;
  }

  function tramiteInternoPayload(tramite, processoId = null) {
    return {
      local_id: tramite.id || localId("tramite"),
      processo_id: processoId,
      numero_processo: tramite.numero || tramite.numeroProcesso || "",
      entrada: String(tramite.entrada || ""),
      data_entrada: parseDateBR(tramite.dataEntrada),
      motivo: tramite.motivo || "",
      secretaria: tramite.secretaria || "",
      objeto: tramite.objeto || "",
      responsavel: tramite.responsavel || "",
      tipo: tramite.tipo || tramite.tipoTramite || "",
      status: tramite.status || "",
      destino: tramite.destino || "",
      historico: Array.isArray(tramite.historico) ? tramite.historico : [],
      extra: tramite
    };
  }

  function tramiteInternoFromRow(row) {
    const extra = row?.extra && typeof row.extra === "object" ? { ...row.extra } : {};
    return {
      ...extra,
      id: row.local_id || extra.id || row.id,
      supabaseId: row.id,
      numero: row.numero_processo || extra.numero || extra.numeroProcesso || "",
      entrada: row.entrada || extra.entrada || "",
      dataEntrada: row.data_entrada || extra.dataEntrada || "",
      motivo: row.motivo || extra.motivo || "",
      secretaria: row.secretaria || extra.secretaria || "",
      objeto: row.objeto || extra.objeto || "",
      responsavel: row.responsavel || extra.responsavel || "",
      tipo: row.tipo || extra.tipo || extra.tipoTramite || "",
      status: row.status || extra.status || "",
      destino: row.destino || extra.destino || "",
      historico: Array.isArray(row.historico) ? row.historico : (Array.isArray(extra.historico) ? extra.historico : [])
    };
  }

  async function listarTramitesInternos() {
    const client = requireClient();
    await requireAuthenticatedUser();
    console.log("[SUPABASE][tramites_internos][SELECT][ANTES]");
    const { data, error } = await client
      .from("tramites_internos")
      .select("*")
      .order("created_at", { ascending: false });
    console.log("[SUPABASE][tramites_internos][SELECT][DEPOIS]", { data, error });
    if (error) throw error;
    return (data || []).map(tramiteInternoFromRow);
  }

  async function salvarTramitesInternos(tramites) {
    const client = requireClient();
    await requireAuthenticatedUser();
    const processos = await client.from("processos").select("id, numero");
    if (processos.error) throw processos.error;
    const processoPorNumero = new Map((processos.data || []).map(p => [p.numero, p.id]));
    const rows = (tramites || []).map(t => tramiteInternoPayload(t, processoPorNumero.get(t.numero || t.numeroProcesso) || null));
    console.log("[SUPABASE][tramites_internos][REPLACE][ANTES]", { rows });
    const del = await client.from("tramites_internos").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (del.error) throw del.error;
    if (!rows.length) return [];
    const ins = await client.from("tramites_internos").insert(rows).select("*");
    console.log("[SUPABASE][tramites_internos][REPLACE][DEPOIS]", { data: ins.data, error: ins.error });
    if (ins.error) throw ins.error;
    return (ins.data || []).map(tramiteInternoFromRow);
  }

  async function obterAppSetting(chave, fallback = null) {
    const client = requireClient();
    await requireAuthenticatedUser();
    const { data, error } = await client
      .from("app_settings")
      .select("valor")
      .eq("chave", chave)
      .maybeSingle();
    console.log("[SUPABASE][app_settings][SELECT_RESULT]", { chave, data, error });
    if (error) throw error;
    return data?.valor ?? fallback;
  }

  async function salvarAppSetting(chave, valor) {
    const client = requireClient();
    await requireAuthenticatedUser();
    const payload = { chave, valor: valor || {} };
    console.log("[SUPABASE][app_settings][UPSERT]", { payload });
    const { data, error } = await client
      .from("app_settings")
      .upsert(payload, { onConflict: "chave" })
      .select("*")
      .single();
    console.log("[SUPABASE][app_settings][UPSERT_RESULT]", { data, error });
    if (error) throw error;
    return data?.valor ?? valor;
  }

  async function loadProcessosResumo() {
    const client = requireClient();
    const { data, error } = await client
      .from("processos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  function processoFromRow(row) {
    const extra = row?.extra && typeof row.extra === "object" ? { ...row.extra } : {};
    return {
      ...extra,
      id: row.local_id || extra.id || row.id,
      supabaseId: row.id,
      numero: row.numero || extra.numero || "",
      dataCriacao: formatDateBR(row.data_criacao) || extra.dataCriacao || "",
      objeto: row.objeto || extra.objeto || "",
      descricaoCompleta: row.descricao_completa || extra.descricaoCompleta || "",
      secretaria: row.secretaria || extra.secretaria || "",
      interessadoOriginal: row.interessado_original || extra.interessadoOriginal || "",
      tipoProtocolo: row.tipo_protocolo || extra.tipoProtocolo || "",
      naturezaProcesso: row.natureza_processo || extra.naturezaProcesso || "",
      assuntoProtocolo: row.assunto_protocolo || extra.assuntoProtocolo || "",
      registroPrecos: row.registro_precos || extra.registroPrecos || "",
      tipoRegistroPreco: row.tipo_registro_preco || extra.tipoRegistroPreco || "",
      tipoAdesaoRegistro: row.tipo_adesao_registro || extra.tipoAdesaoRegistro || "",
      processoGerador: row.processo_gerador_local_id || extra.processoGerador || "",
      ataRegistroPrecoId: row.ata_registro_preco_local_id || extra.ataRegistroPrecoId || "",
      modalidadeLicitacao: row.modalidade_licitacao || extra.modalidadeLicitacao || "",
      tipoLicitacao: row.tipo_licitacao || extra.tipoLicitacao || "",
      situacao: row.situacao || extra.situacao || "",
      fase: row.fase || extra.fase || "",
      volumes: row.volumes || extra.volumes || "",
      observacao: row.observacao || extra.observacao || "",
      valorEstimado: row.valor_estimado ?? extra.valorEstimado ?? null,
      resultadoValorHomologado: row.valor_homologado ?? extra.resultadoValorHomologado ?? "",
      novo: false
    };
  }

  function agruparPor(rows, key) {
    const mapa = new Map();
    (rows || []).forEach(row => {
      const valor = row?.[key];
      if (!valor) return;
      if (!mapa.has(valor)) mapa.set(valor, []);
      mapa.get(valor).push(row);
    });
    return mapa;
  }

  async function selecionarPorIds(client, tabela, coluna, ids, order = null) {
    const valores = Array.from(new Set(ids || [])).filter(Boolean);
    if (!valores.length) return [];
    const CHUNK_SIZE = 80;
    const all = [];
    for (let i = 0; i < valores.length; i += CHUNK_SIZE) {
      const lote = valores.slice(i, i + CHUNK_SIZE);
      let query = client.from(tabela).select("*").in(coluna, lote);
      if (order) query = query.order(order, { ascending: true });
      const { data, error } = await query;
      console.log(`[SUPABASE][${tabela}][SELECT_RESULT]`, {
        lote: `${i + 1}-${Math.min(i + CHUNK_SIZE, valores.length)}/${valores.length}`,
        total: data?.length || 0,
        error
      });
      if (error) {
        error.message = `${tabela}: ${error.message || "erro ao consultar registros relacionados"}`;
        throw error;
      }
      all.push(...(data || []));
    }
    return all;
  }

  async function carregarAnexosPorIds(client, ids) {
    const rows = await selecionarPorIds(client, "anexos", "id", ids);
    const mapa = new Map();
    rows.forEach(row => mapa.set(row.id, anexoFromRow(row)));
    return mapa;
  }

  async function carregarFornecedoresPorIds(client, ids) {
    const rows = await selecionarPorIds(client, "fornecedores", "id", ids);
    const mapa = new Map();
    rows.forEach(row => mapa.set(row.id, fornecedorFromRow(row, [])));
    return mapa;
  }

  function aplicarBlocosProcesso(processo, blocos) {
    (blocos || []).forEach(row => {
      const dados = row.dados && typeof row.dados === "object" ? row.dados : {};
      if (row.bloco === "fases") {
        processo.fasesAtivas = Array.isArray(dados.fasesAtivas) ? dados.fasesAtivas : processo.fasesAtivas;
        processo.etapasConcluidas = dados.etapasConcluidas || processo.etapasConcluidas || {};
        return;
      }
      if (row.bloco === "resultado" || row.bloco === "homologacao") {
        if (dados.resultadoValorHomologado !== undefined) processo.resultadoValorHomologado = dados.resultadoValorHomologado;
        if (Array.isArray(dados.resultadoItens) && !Array.isArray(processo.resultadoItens)) processo.resultadoItens = dados.resultadoItens;
        return;
      }
      Object.assign(processo, dados);
    });
  }

  async function loadProcessosCompletos() {
    const client = requireClient();
    const { data, error } = await client
      .from("processos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const processosRows = data || [];
    const processos = processosRows.map(processoFromRow);
    const processoIds = processosRows.map(row => row.id);
    if (!processoIds.length) return processos;

    console.log("[SUPABASE][processos][LOAD_COMPLETO][AUXILIARES]", { processoIds });
    const [blocos, itens, publicacoes, atas] = await Promise.all([
      selecionarPorIds(client, "processo_blocos", "processo_id", processoIds),
      selecionarPorIds(client, "processo_itens", "processo_id", processoIds, "ordem"),
      selecionarPorIds(client, "processo_publicacoes", "processo_id", processoIds),
      selecionarPorIds(client, "atas_registro_preco", "processo_id", processoIds)
    ]);

    const ataIds = atas.map(row => row.id);
    const [ataItens, ataPublicacoes, ataAditivos] = await Promise.all([
      selecionarPorIds(client, "ata_itens", "ata_id", ataIds, "ordem"),
      selecionarPorIds(client, "ata_publicacoes", "ata_id", ataIds),
      selecionarPorIds(client, "ata_aditivos", "ata_id", ataIds)
    ]);
    const aditivoIds = ataAditivos.map(row => row.id);
    const aditivoPublicacoes = await selecionarPorIds(client, "ata_aditivo_publicacoes", "aditivo_id", aditivoIds);

    const anexoIds = [
      ...publicacoes.map(row => row.anexo_id),
      ...atas.flatMap(row => [row.pdf_ata_anexo_id, row.pdf_extrato_anexo_id]),
      ...ataPublicacoes.map(row => row.anexo_id),
      ...ataAditivos.map(row => row.anexo_id),
      ...aditivoPublicacoes.map(row => row.anexo_id)
    ].filter(Boolean);
    const fornecedoresIds = atas.map(row => row.fornecedor_id).filter(Boolean);
    const [anexosPorId, fornecedoresPorId] = await Promise.all([
      carregarAnexosPorIds(client, anexoIds),
      carregarFornecedoresPorIds(client, fornecedoresIds)
    ]);

    const blocosPorProcesso = agruparPor(blocos, "processo_id");
    const itensPorProcesso = agruparPor(itens, "processo_id");
    const publicacoesPorProcesso = agruparPor(publicacoes, "processo_id");
    const atasPorProcesso = agruparPor(atas, "processo_id");
    const ataItensPorAta = agruparPor(ataItens, "ata_id");
    const ataPublicacoesPorAta = agruparPor(ataPublicacoes, "ata_id");
    const aditivosPorAta = agruparPor(ataAditivos, "ata_id");
    const publicacoesPorAditivo = agruparPor(aditivoPublicacoes, "aditivo_id");

    processos.forEach(processo => {
      const processoRow = processosRows.find(row => row.local_id === processo.id || row.id === processo.supabaseId);
      if (!processoRow) return;
      aplicarBlocosProcesso(processo, blocosPorProcesso.get(processoRow.id) || []);

      const itensProcesso = itensPorProcesso.get(processoRow.id) || [];
      const porOrigem = agruparPor(itensProcesso, "origem");
      if (porOrigem.has("processo")) processo.itensProcesso = porOrigem.get("processo").map(itemFromRow);
      if (porOrigem.has("cotacao")) processo.cotItens = porOrigem.get("cotacao").map(itemFromRow);
      if (porOrigem.has("resultado")) processo.resultadoItens = porOrigem.get("resultado").map(itemFromRow);

      const pubs = publicacoesPorProcesso.get(processoRow.id) || [];
      if (pubs.length) processo.publicacoes = pubs.map(row => publicacaoProcessoFromRow(row, anexosPorId));

      const atasDoProcesso = atasPorProcesso.get(processoRow.id) || [];
      if (atasDoProcesso.length) {
        processo.atasRegistroPreco = atasDoProcesso.map(ataRow => {
          const aditivos = (aditivosPorAta.get(ataRow.id) || []).map(aditivoRow => aditivoAtaFromRow(
            aditivoRow,
            (publicacoesPorAditivo.get(aditivoRow.id) || []).map(pub => publicacaoAtaFromRow(pub, anexosPorId)),
            anexosPorId
          ));
          return ataRegistroPrecoFromRow(ataRow, {
            itens: (ataItensPorAta.get(ataRow.id) || []).map(tableItemFromRow),
            publicacoes: (ataPublicacoesPorAta.get(ataRow.id) || []).map(pub => publicacaoAtaFromRow(pub, anexosPorId)),
            aditivos
          }, anexosPorId, fornecedoresPorId);
        });
      }
    });

    return processos;
  }

  async function deleteProcessoCompleto(localId) {
    const client = requireClient();
    await requireAuthenticatedUser();
    const alvo = await client
      .from("processos")
      .select("id, local_id, numero")
      .eq("local_id", localId)
      .single();
    if (alvo.error) throw alvo.error;

    const deleted = await client
      .from("processos")
      .delete()
      .eq("id", alvo.data.id)
      .select("id")
      .single();
    if (deleted.error) throw deleted.error;

    const check = await client
      .from("processos")
      .select("id")
      .eq("id", alvo.data.id)
      .maybeSingle();
    if (check.error) throw check.error;
    if (check.data) throw new Error("Nao foi possivel confirmar a exclusao do processo no Supabase.");
    return true;
  }

  async function deleteProcessosCompletos(localIds) {
    const ids = Array.from(new Set(localIds || [])).filter(Boolean);
    for (const id of ids) {
      await deleteProcessoCompleto(id);
    }
    return ids.length;
  }

  function irpItemPayload(irpId, item, index) {
    const row = Array.isArray(item) ? item : [
      item?.codigo || "",
      item?.descricao || "",
      item?.unidade || "",
      item?.quantidade || "",
      item?.valorUnitario || item?.valor_unitario || "",
      item?.valorTotal || item?.valor_total || ""
    ];
    return {
      irp_id: irpId,
      ordem: index,
      codigo: row[0] || "",
      descricao: row[1] || "",
      unidade: row[2] || "",
      quantidade: index === 0 ? null : parseNumber(row[3]),
      valor_unitario: index === 0 ? null : parseNumber(row[4]),
      valor_total: index === 0 ? null : parseNumber(row[5]),
      extra: {
        raw: row,
        original: item || null
      }
    };
  }

  function irpItemFromRow(row = {}) {
    if (Array.isArray(row.extra?.raw)) return row.extra.raw;
    return [
      row.codigo || "",
      row.descricao || "",
      row.unidade || "",
      row.quantidade ?? "",
      row.valor_unitario ?? "",
      row.valor_total ?? ""
    ];
  }

  function irpRegistroPrecoPayload(irp = {}) {
    const { itens, ...extra } = irp;
    return {
      local_id: localId("irp", irp.id || `${irp.numero || ""}_${irp.ano || ""}`),
      numero: irp.numero || "",
      ano: irp.ano || "",
      objeto: irp.objeto || "",
      secretaria: irp.secretaria || "",
      extra
    };
  }

  function irpRegistroPrecoFromRow(row = {}, itensRelacionados = []) {
    const extra = row.extra || {};
    const itens = Array.isArray(itensRelacionados) && itensRelacionados.length
      ? itensRelacionados.map(irpItemFromRow)
      : (Array.isArray(extra.itens) ? extra.itens : []);
    return {
      ...extra,
      id: row.local_id || extra.id || row.id,
      supabaseId: row.id,
      numero: row.numero || extra.numero || "",
      ano: row.ano || extra.ano || "",
      objeto: row.objeto || extra.objeto || "",
      secretaria: row.secretaria || extra.secretaria || "",
      itens,
      criadoEm: extra.criadoEm || formatDateTimeBR(row.created_at),
      atualizadoEm: extra.atualizadoEm || formatDateTimeBR(row.updated_at)
    };
  }

  async function listarItensIrpPorIds(irpIds) {
    const ids = Array.from(new Set(irpIds || [])).filter(Boolean);
    if (!ids.length) return new Map();
    console.log("[SUPABASE][irp_itens][SELECT][ANTES]", { irpIds: ids });
    const result = await requireClient()
      .from("irp_itens")
      .select("*")
      .in("irp_id", ids)
      .order("ordem", { ascending: true });
    console.log("[SUPABASE][irp_itens][SELECT][DEPOIS]", {
      data: result.data,
      error: result.error
    });
    if (result.error) throw result.error;
    const mapa = new Map();
    (result.data || []).forEach(row => {
      if (!mapa.has(row.irp_id)) mapa.set(row.irp_id, []);
      mapa.get(row.irp_id).push(row);
    });
    return mapa;
  }

  async function substituirItensIrp(irpId, itens = []) {
    console.log("[SUPABASE][irp_itens][REPLACE][ANTES]", { irpId, itens });
    const del = await requireClient()
      .from("irp_itens")
      .delete()
      .eq("irp_id", irpId);
    if (del.error) throw del.error;

    const payload = (Array.isArray(itens) ? itens : [])
      .map((item, index) => irpItemPayload(irpId, item, index))
      .filter(item => {
        const raw = item.extra?.raw || [];
        return raw.some(cell => String(cell ?? "").trim());
      });

    if (payload.length) {
      const ins = await requireClient()
        .from("irp_itens")
        .insert(payload)
        .select("*");
      console.log("[SUPABASE][irp_itens][REPLACE][DEPOIS]", {
        data: ins.data,
        error: ins.error
      });
      if (ins.error) throw ins.error;
    } else {
      console.log("[SUPABASE][irp_itens][REPLACE][DEPOIS]", {
        data: [],
        error: null
      });
    }

    const confirmacao = await requireClient()
      .from("irp_itens")
      .select("*")
      .eq("irp_id", irpId)
      .order("ordem", { ascending: true });
    console.log("[SUPABASE][irp_itens][REPLACE][CONFIRMACAO]", {
      data: confirmacao.data,
      error: confirmacao.error
    });
    if (confirmacao.error) throw confirmacao.error;
    return confirmacao.data || [];
  }

  async function listarIrpsRegistroPreco() {
    await requireAuthenticatedUser();
    console.log("[SUPABASE][irps_registro_preco][SELECT][ANTES]");
    const result = await requireClient()
      .from("irps_registro_preco")
      .select("*")
      .order("ano", { ascending: false })
      .order("numero", { ascending: true });
    console.log("[SUPABASE][irps_registro_preco][SELECT][DEPOIS]", {
      data: result.data,
      error: result.error
    });
    if (result.error) throw result.error;
    const itensPorIrp = await listarItensIrpPorIds((result.data || []).map(row => row.id));
    return (result.data || []).map(row => irpRegistroPrecoFromRow(row, itensPorIrp.get(row.id) || []));
  }

  async function salvarIrpRegistroPreco(irp) {
    await requireAuthenticatedUser();
    const payload = irpRegistroPrecoPayload(irp);
    console.log("[SUPABASE][irps_registro_preco][UPSERT][ANTES]", payload);
    const result = await requireClient()
      .from("irps_registro_preco")
      .upsert(payload, { onConflict: "local_id" })
      .select("*")
      .single();
    console.log("[SUPABASE][irps_registro_preco][UPSERT][DEPOIS]", {
      data: result.data,
      error: result.error
    });
    if (result.error) throw result.error;
    const itensConfirmados = await substituirItensIrp(result.data.id, irp.itens || []);

    const check = await requireClient()
      .from("irps_registro_preco")
      .select("*")
      .eq("id", result.data.id)
      .single();
    console.log("[SUPABASE][irps_registro_preco][UPSERT][CONFIRMACAO]", {
      data: check.data,
      error: check.error
    });
    if (check.error) throw check.error;
    return irpRegistroPrecoFromRow(check.data, itensConfirmados);
  }

  async function excluirIrpRegistroPreco(localIdIrp) {
    await requireAuthenticatedUser();
    console.log("[SUPABASE][irps_registro_preco][DELETE][ANTES]", { local_id: localIdIrp });
    const alvo = await requireClient()
      .from("irps_registro_preco")
      .select("id")
      .eq("local_id", localIdIrp)
      .maybeSingle();
    if (alvo.error) throw alvo.error;
    if (!alvo.data?.id) return false;

    const deleted = await requireClient()
      .from("irps_registro_preco")
      .delete()
      .eq("id", alvo.data.id)
      .select("id")
      .single();
    console.log("[SUPABASE][irps_registro_preco][DELETE][DEPOIS]", {
      data: deleted.data,
      error: deleted.error
    });
    if (deleted.error) throw deleted.error;

    const check = await requireClient()
      .from("irps_registro_preco")
      .select("id")
      .eq("id", alvo.data.id)
      .maybeSingle();
    console.log("[SUPABASE][irps_registro_preco][DELETE][CONFIRMACAO]", {
      data: check.data,
      error: check.error
    });
    if (check.error) throw check.error;
    if (check.data) throw new Error("Nao foi possivel confirmar a exclusao da IRP no Supabase.");
    return true;
  }

  window.AppDatabase = {
    client: requireClient,
    requireAuthenticatedUser,
    parseDateBR,
    parseNumber,
    listarSecretarias,
    salvarSecretaria,
    excluirSecretaria,
    listarTiposProtocolo,
    salvarTipoProtocolo,
    excluirTipoProtocolo,
    listarAssuntosProtocolo,
    salvarAssuntoProtocolo,
    excluirAssuntoProtocolo,
    listarFornecedores,
    listarPessoasFornecedor,
    salvarFornecedor,
    excluirFornecedor,
    upsertFornecedor,
    saveProcessoCompleto,
    deleteProcessoCompleto,
    deleteProcessosCompletos,
    listarIrpsRegistroPreco,
    salvarIrpRegistroPreco,
    excluirIrpRegistroPreco,
    saveTramitesGerais,
    listarTramitesGerais,
    listarTramitesInternos,
    salvarTramitesInternos,
    importarAnexoBackup,
    contarRegistros,
    obterAppSetting,
    salvarAppSetting,
    loadProcessosResumo,
    loadProcessosCompletos
  };
})();
