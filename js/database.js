// Camada inicial de acesso ao Supabase.
// Esta camada ainda nao substitui o localStorage automaticamente; ela prepara
// a leitura/escrita online para a migracao gradual do sistema.

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
      window.__supabaseClient = window.supabase.createClient(cfg.url, cfg.anonKey, {
        db: { schema: cfg.schema || "public" }
      });
    }
    return window.__supabaseClient;
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

  async function upsertFornecedor(client, fornecedor) {
    if (!fornecedor) return null;
    const cnpj = fornecedor.cnpj || fornecedor.fornecedorCnpj || fornecedor.credCnpj || "";
    const local = fornecedor.id || fornecedor.fornecedorId || onlyDigits(cnpj);
    if (!cnpj && !fornecedor.razaoSocial && !fornecedor.razao && !fornecedor.fornecedorRazao) return null;
    const payload = {
      local_id: local || null,
      cnpj: cnpj || null,
      razao_social: fornecedor.razaoSocial || fornecedor.razao || fornecedor.fornecedorRazao || fornecedor.credRazao || "",
      nome_fantasia: fornecedor.nomeFantasia || fornecedor.fantasia || fornecedor.fornecedorFantasia || fornecedor.credFantasia || "",
      origem: fornecedor.origem || "",
      extra: fornecedor
    };
    const conflict = payload.cnpj ? "cnpj" : "local_id";
    const { data, error } = await client.from("fornecedores").upsert(payload, { onConflict: conflict }).select("id").single();
    if (error) throw error;
    return data?.id || null;
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
    const core = processoCore(processo);
    const { data: procSaved, error } = await client
      .from("processos")
      .upsert(core, { onConflict: "local_id" })
      .select("id")
      .single();
    if (error) throw error;

    const processoId = procSaved.id;
    await replaceRows(client, "processo_blocos", "processo_id", processoId, blocoEntries(processo, processoId));

    const itens = [
      ...(processo.itensProcesso || []).map((item, index) => itemRow(processoId, item, index, "processo")),
      ...(processo.cotItens || []).map((item, index) => itemRow(processoId, item, index, "cotacao")),
      ...(processo.resultadoItens || []).map((item, index) => itemRow(processoId, item, index, "resultado"))
    ];
    await replaceRows(client, "processo_itens", "processo_id", processoId, itens);

    const publicacoes = (processo.publicacoes || []).map(pub => ({
      processo_id: processoId,
      local_id: pub.id || null,
      bloco: pub.bloco || "",
      tipo: pub.tipo || "",
      titulo: pub.titulo || pub.nome || "",
      data_publicacao: parseDateBR(pub.data || pub.dataPublicacao),
      link: pub.link || pub.url || "",
      extra: pub
    }));
    await replaceRows(client, "processo_publicacoes", "processo_id", processoId, publicacoes);

    await replaceAtas(client, processoId, processo.atasRegistroPreco || []);
    return processoId;
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
        extra: ata
      }).select("id").single();
      if (error) throw error;
      const ataId = data.id;

      await replaceRows(client, "ata_itens", "ata_id", ataId, (ata.itens || []).map((item, index) => ({
        ata_id: ataId,
        ordem: Number(item.item || item.ordem || index + 1) || index + 1,
        codigo: item.codigo || "",
        descricao: item.descricao || "",
        unidade: item.unidade || "",
        quantidade: parseNumber(item.quantidade),
        valor_unitario: parseNumber(item.valorUnitario),
        valor_total: parseNumber(item.valorTotal),
        extra: item
      })));

      await replaceRows(client, "ata_publicacoes", "ata_id", ataId, (ata.publicacoesExtrato || []).map(pub => ({
        ata_id: ataId,
        local_id: pub.id || null,
        tipo: pub.tipo || "",
        titulo: pub.nome || pub.titulo || "",
        data_publicacao: parseDateBR(pub.data),
        link: pub.link || "",
        extra: pub
      })));

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
          extra: aditivo
        }).select("id").single();
        if (saved.error) throw saved.error;
        await replaceRows(client, "ata_aditivo_publicacoes", "aditivo_id", saved.data.id, (aditivo.publicacoesExtrato || []).map(pub => ({
          aditivo_id: saved.data.id,
          local_id: pub.id || null,
          tipo: pub.tipo || "",
          titulo: pub.nome || pub.titulo || "",
          data_publicacao: parseDateBR(pub.data),
          link: pub.link || "",
          extra: pub
        })));
      }
    }
  }

  async function saveTramitesGerais(numeroProcesso, tramites) {
    const client = requireClient();
    const processo = await client.from("processos").select("id").eq("numero", numeroProcesso).maybeSingle();
    if (processo.error) throw processo.error;
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
    if (!rows.length) return;
    const ins = await client.from("tramites_gerais").insert(rows);
    if (ins.error) throw ins.error;
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

  window.AppDatabase = {
    client: requireClient,
    parseDateBR,
    parseNumber,
    upsertFornecedor,
    saveProcessoCompleto,
    saveTramitesGerais,
    loadProcessosResumo
  };
})();
