// Importador do backup JSON completo para Supabase.
// Nao altera o arquivo escolhido, nao apaga localStorage/IndexedDB e nunca usa chave secreta.

(() => {
  const STORAGE_BUCKET = "processos-anexos";
  const TABELAS_VALIDACAO = [
    "processos",
    "fornecedores",
    "fornecedor_pessoas",
    "secretarias",
    "tipos_protocolo",
    "assuntos_protocolo",
    "irps_registro_preco",
    "irp_itens",
    "processo_blocos",
    "processo_itens",
    "processo_publicacoes",
    "atas_registro_preco",
    "ata_itens",
    "ata_publicacoes",
    "ata_aditivos",
    "ata_aditivo_publicacoes",
    "tramites_internos",
    "tramites_gerais",
    "app_settings",
    "anexos"
  ];

  const state = {
    backup: null,
    plano: null,
    report: null,
    running: false
  };

  const $ = id => document.getElementById(id);

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function asObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function keyText(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
  }

  function localKey(prefix, value) {
    const raw = String(value || "").trim();
    return raw || `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function setStatus(message, type = "info") {
    const el = $("migration_status");
    if (!el) return;
    el.className = `migration-status ${type}`;
    el.textContent = message;
  }

  function logLine(message, data) {
    const line = data === undefined ? message : `${message} ${JSON.stringify(data, null, 2)}`;
    console.log(message, data || "");
    const el = $("migration_log");
    if (!el) return;
    el.textContent += `\n${line}`;
    el.scrollTop = el.scrollHeight;
  }

  function setButtons() {
    const hasBackup = !!state.backup;
    $("migration_analyze").disabled = !hasBackup || state.running;
    $("migration_simulate").disabled = !state.plano || state.running;
    $("migration_import").disabled = !state.plano || state.running;
    $("migration_report").disabled = !state.report;
  }

  function makeReport(mode) {
    return {
      modo: mode,
      iniciadoEm: new Date().toLocaleString("pt-BR"),
      finalizadoEm: "",
      resumoBackup: {},
      entidades: {},
      erros: [],
      avisos: [],
      orfaos: [],
      validacaoFinal: {},
      mapeamento: {
        processos: "licitatorios -> processos; campos nao normalizados preservados em extra",
        processo_blocos: "fasesAtivas, etapasConcluidas e campos prefixados dos blocos -> processo_blocos",
        processo_itens: "itensProcesso/cotItens/resultadoItens -> processo_itens",
        processo_publicacoes: "publicacoes -> processo_publicacoes",
        fornecedores: "fornecedoresCadastro e fornecedores das atas -> fornecedores",
        fornecedor_pessoas: "pessoas vinculadas -> fornecedor_pessoas",
        irps_registro_preco: "irpsRegistroPreco -> irps_registro_preco",
        irp_itens: "itens das IRPs -> irp_itens",
        atas_registro_preco: "atasRegistroPreco -> atas_registro_preco",
        ata_itens: "atasRegistroPreco[].itens -> ata_itens",
        ata_publicacoes: "atasRegistroPreco[].publicacoesExtrato -> ata_publicacoes",
        ata_aditivos: "atasRegistroPreco[].aditivos -> ata_aditivos",
        ata_aditivo_publicacoes: "atasRegistroPreco[].aditivos[].publicacoesExtrato -> ata_aditivo_publicacoes",
        tramites_internos: "tramites em array -> tramites_internos",
        tramites_gerais: "tramitesGeraisImportados ou tramites em objeto -> tramites_gerais",
        app_settings: "mapaInteressadosSecretarias -> app_settings",
        anexos: "anexosIndexedDB -> Supabase Storage e tabela anexos"
      }
    };
  }

  function entity(report, name, total = 0) {
    if (!report.entidades[name]) {
      report.entidades[name] = {
        total,
        processados: 0,
        inseridos: 0,
        atualizados: 0,
        existentes: 0,
        ignorados: 0,
        erros: 0
      };
    } else {
      report.entidades[name].total = total;
    }
    return report.entidades[name];
  }

  function countNested(processos) {
    const acc = {
      processo_blocos: processos.length * 11,
      processo_itens: 0,
      processo_publicacoes: 0,
      atas_registro_preco: 0,
      ata_itens: 0,
      ata_publicacoes: 0,
      ata_aditivos: 0,
      ata_aditivo_publicacoes: 0,
      fornecedores_atas: 0
    };

    processos.forEach(proc => {
      acc.processo_itens += asArray(proc.itensProcesso).length;
      acc.processo_itens += asArray(proc.cotItens).length;
      acc.processo_itens += asArray(proc.resultadoItens).length;
      acc.processo_publicacoes += asArray(proc.publicacoes).length;
      const atas = asArray(proc.atasRegistroPreco);
      acc.atas_registro_preco += atas.length;
      atas.forEach(ata => {
        if (ata?.fornecedorCnpj || ata?.fornecedorRazao) acc.fornecedores_atas++;
        acc.ata_itens += asArray(ata.itens).length;
        acc.ata_publicacoes += asArray(ata.publicacoesExtrato).length;
        const aditivos = asArray(ata.aditivos);
        acc.ata_aditivos += aditivos.length;
        aditivos.forEach(aditivo => {
          acc.ata_aditivo_publicacoes += asArray(aditivo.publicacoesExtrato).length;
        });
      });
    });
    return acc;
  }

  function getTramitesGerais(backup) {
    if (backup.tramitesGeraisImportados && typeof backup.tramitesGeraisImportados === "object" && !Array.isArray(backup.tramitesGeraisImportados)) {
      return backup.tramitesGeraisImportados;
    }
    return backup.tramites && typeof backup.tramites === "object" && !Array.isArray(backup.tramites) ? backup.tramites : {};
  }

  function getTramitesInternos(backup) {
    return Array.isArray(backup.tramites) ? backup.tramites : asArray(backup.tramitesInternos);
  }

  function coletarReferenciasAnexos(value, refs = new Set()) {
    if (!value || typeof value !== "object") return refs;
    if (Array.isArray(value)) {
      value.forEach(item => coletarReferenciasAnexos(item, refs));
      return refs;
    }
    const pareceAnexo = value.storage === "indexedDB" || value.storage === "supabase" || value.dataUrl || value.blob || value.storagePath || value.storage_path;
    if (pareceAnexo && value.id) refs.add(String(value.id));
    Object.values(value).forEach(item => coletarReferenciasAnexos(item, refs));
    return refs;
  }

  function detectarOrfaos(backup) {
    const processos = asArray(backup.licitatorios);
    const numerosProcesso = new Set(processos.map(p => String(p.numero || "").trim()).filter(Boolean));
    const anexosBackup = new Set(asArray(backup.anexosIndexedDB).map(a => String(a.id || "").trim()).filter(Boolean));
    const anexosReferenciados = coletarReferenciasAnexos(processos);
    const orfaos = [];

    getTramitesInternos(backup).forEach(tramite => {
      const numero = String(tramite.numeroProcesso || tramite.numero || "").trim();
      if (numero && !numerosProcesso.has(numero)) {
        orfaos.push({ tipo: "tramite_sem_processo", numeroProcesso: numero, registro: tramite.id || tramite.entrada || "" });
      }
    });

    Object.keys(getTramitesGerais(backup)).forEach(numero => {
      if (numero && !numerosProcesso.has(String(numero).trim())) {
        orfaos.push({ tipo: "tramite_geral_sem_processo", numeroProcesso: numero });
      }
    });

    anexosBackup.forEach(id => {
      if (!anexosReferenciados.has(id)) {
        orfaos.push({ tipo: "anexo_sem_referencia", anexoId: id });
      }
    });

    anexosReferenciados.forEach(id => {
      if (!anexosBackup.has(id)) {
        orfaos.push({ tipo: "referencia_de_anexo_sem_arquivo_no_backup", anexoId: id });
      }
    });

    processos.forEach(proc => {
      asArray(proc.atasRegistroPreco).forEach(ata => {
        if (!proc.id && !proc.numero) {
          orfaos.push({ tipo: "ata_sem_processo_identificavel", ata: `${ata?.numero || ""}/${ata?.ano || ""}` });
        }
        asArray(ata?.aditivos).forEach(aditivo => {
          if (!ata?.id && !ata?.numero) {
            orfaos.push({ tipo: "aditivo_sem_ata_identificavel", aditivo: aditivo?.numero || aditivo?.id || "" });
          }
        });
      });
    });

    return orfaos;
  }

  function coletarSecretarias(backup) {
    const siglas = new Set([
      "AMHARC","AGETRAT","FUPHAN","FMAP","FUNPREV","SISP","SEMED","SEPRAD","SMSPDS",
      "PROCON","FCC","FUNEC","FUNDTUR","SMASC","SMDES","SEGES","SMS","SELIC"
    ]);
    asArray(backup.licitatorios).forEach(proc => {
      if (proc.secretaria) siglas.add(String(proc.secretaria).trim());
    });
    Object.values(asObject(backup.mapaInteressadosSecretarias)).forEach(sigla => {
      if (sigla) siglas.add(String(sigla).trim());
    });
    return Array.from(siglas).filter(Boolean).sort();
  }

  function coletarTipos(backup) {
    const mapa = new Map();
    [
      "PROCESSO LICITATÓRIO",
      "SOLICITAÇÃO",
      "MANIFESTAÇÃO DE INTERESSE",
      "COMUNICAÇÃO INTERNA",
      "OFÍCIO"
    ].forEach(nome => mapa.set(keyText(nome), { nome, ativo: true, padrao: true }));
    asArray(backup.tiposProtocoloCadastro).forEach(tipo => {
      const nome = keyText(tipo?.nome || tipo);
      if (nome) mapa.set(nome, { ...(typeof tipo === "object" ? tipo : {}), nome, ativo: tipo?.ativo !== false });
    });
    asArray(backup.licitatorios).forEach(proc => {
      const nome = keyText(proc.tipoProtocolo);
      if (nome) mapa.set(nome, { nome, ativo: true, padrao: false });
    });
    return Array.from(mapa.values());
  }

  function coletarAssuntos(backup) {
    const mapa = new Map();
    const padroes = {
      "PROCESSO LICITATÓRIO": [
        "AQUISIÇÃO DE BENS",
        "CONTRATA MAIS BRASIL",
        "CREDENCIAMENTO",
        "PRESTAÇÃO DE SERVIÇOS",
        "OBRAS E SERVIÇOS DE ENGENHARIA",
        "LOCAÇÃO"
      ],
      "SOLICITAÇÃO": [
        "CADASTRO DE PRODUTO",
        "CADASTRO DE USUÁRIO NO SISTEMA",
        "REEQUILÍBRIO ECONÔMICO-FINANCEIRO"
      ]
    };
    Object.entries(padroes).forEach(([tipo, nomes]) => {
      nomes.forEach(nome => mapa.set(`${tipo}::${nome}`, { tipo, nome, ativo: true, padrao: true }));
    });
    asArray(backup.assuntosProtocoloCadastro).forEach(assunto => {
      const tipo = keyText(assunto?.tipo || assunto?.tipoProtocolo || "PROCESSO LICITATÓRIO");
      const nome = keyText(assunto?.nome || assunto);
      if (nome) mapa.set(`${tipo}::${nome}`, { ...(typeof assunto === "object" ? assunto : {}), tipo, nome, ativo: assunto?.ativo !== false });
    });
    asArray(backup.licitatorios).forEach(proc => {
      const tipo = keyText(proc.tipoProtocolo || "PROCESSO LICITATÓRIO");
      const nome = keyText(proc.assuntoProtocolo || proc.naturezaProcesso);
      if (nome) mapa.set(`${tipo}::${nome}`, { tipo, nome, ativo: true, padrao: false });
    });
    return Array.from(mapa.values());
  }

  function validarBackup(backup) {
    const erros = [];
    if (!backup || typeof backup !== "object") erros.push("O arquivo nao contem um objeto JSON.");
    if (!Array.isArray(backup?.licitatorios)) erros.push("Campo licitatorios ausente ou invalido.");
    if (backup?.tramites && typeof backup.tramites !== "object") erros.push("Campo tramites invalido.");
    return erros;
  }

  function montarPlano(backup) {
    const processos = asArray(backup.licitatorios);
    const fornecedores = asArray(backup.fornecedoresCadastro);
    const irps = asArray(backup.irpsRegistroPreco);
    const tramitesInternos = getTramitesInternos(backup);
    const tramitesGerais = getTramitesGerais(backup);
    const anexos = asArray(backup.anexosIndexedDB);
    const nested = countNested(processos);
    return {
      backup,
      processos,
      fornecedores,
      irps,
      tramitesInternos,
      tramitesGerais,
      anexos,
      secretarias: coletarSecretarias(backup),
      tipos: coletarTipos(backup),
      assuntos: coletarAssuntos(backup),
      mapaSecretarias: asObject(backup.mapaInteressadosSecretarias),
      nested,
      orfaos: detectarOrfaos(backup),
      totalOperacoes:
        processos.length + fornecedores.length + irps.length + tramitesInternos.length +
        Object.keys(tramitesGerais).length + anexos.length +
        coletarSecretarias(backup).length + coletarTipos(backup).length + coletarAssuntos(backup).length +
        (Object.keys(asObject(backup.mapaInteressadosSecretarias)).length ? 1 : 0)
    };
  }

  function resumoBackup(plano) {
    return {
      versaoBackup: plano.backup.versaoBackup || "",
      criadoEm: plano.backup.criadoEm || "",
      incluiAnexosIndexedDB: !!plano.backup.incluiAnexosIndexedDB,
      processos: plano.processos.length,
      fornecedoresCadastro: plano.fornecedores.length,
      fornecedoresDasAtas: plano.nested.fornecedores_atas,
      irpsRegistroPreco: plano.irps.length,
      tramitesInternos: plano.tramitesInternos.length,
      tramitesGerais: Object.keys(plano.tramitesGerais).length,
      anexosIndexedDB: plano.anexos.length,
      processoBlocosEstimados: plano.nested.processo_blocos,
      processoItens: plano.nested.processo_itens,
      processoPublicacoes: plano.nested.processo_publicacoes,
      atas: plano.nested.atas_registro_preco,
      ataItens: plano.nested.ata_itens,
      ataPublicacoes: plano.nested.ata_publicacoes,
      ataAditivos: plano.nested.ata_aditivos,
      ataAditivoPublicacoes: plano.nested.ata_aditivo_publicacoes,
      orfaosDetectados: plano.orfaos.length
    };
  }

  function renderSummary(plano) {
    const resumo = resumoBackup(plano);
    const panel = $("migration_summary");
    panel.hidden = false;
    panel.innerHTML = `
      <h2 style="margin:0 0 8px; font-size:17px">Resumo do backup</h2>
      <div class="muted">Versão: ${esc(resumo.versaoBackup || "nao informada")} • Criado em: ${esc(resumo.criadoEm || "nao informado")}</div>
      <div class="summary-grid">
        ${[
          ["Processos", resumo.processos],
          ["Fornecedores", resumo.fornecedoresCadastro],
          ["IRPs", resumo.irpsRegistroPreco],
          ["Trâmites internos", resumo.tramitesInternos],
          ["Trâmites gerais", resumo.tramitesGerais],
          ["Atas", resumo.atas],
          ["Itens", resumo.processoItens + resumo.ataItens],
          ["Anexos", resumo.anexosIndexedDB],
          ["Órfãos/avisos", resumo.orfaosDetectados]
        ].map(([label, value]) => `<div class="summary-tile"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join("")}
      </div>
      ${plano.orfaos.length ? `<div class="migration-status warning">Foram detectados ${plano.orfaos.length} possível(is) vínculo(s) órfão(s). Eles não serão apagados; consulte o relatório.</div>` : ""}
    `;
  }

  function renderEntities(report) {
    const wrap = $("migration_entities");
    if (!wrap) return;
    wrap.innerHTML = Object.entries(report.entidades).map(([name, item]) => {
      const badge = item.erros ? "badge-error" : (item.ignorados ? "badge-warn" : "badge-ok");
      const text = item.erros ? "com erros" : (item.processados >= item.total ? "ok" : "em andamento");
      return `
        <div class="entity-row">
          <div>
            <strong>${esc(name)}</strong>
            <div class="muted">Inseridos/atualizados: ${item.inseridos + item.atualizados} • Existentes/simulados: ${item.existentes} • Ignorados: ${item.ignorados}</div>
          </div>
          <span>${item.processados}/${item.total}</span>
          <span class="${badge}">${text}</span>
        </div>
      `;
    }).join("");
  }

  function setProgress(done, total) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    $("migration_progress").style.width = `${pct}%`;
    $("migration_progress_text").textContent = `${pct}% (${done}/${total})`;
  }

  function recordError(report, tabela, registro, payload, error) {
    const msg = error?.message || String(error);
    report.erros.push({ tabela, registro, payload, erro: msg });
    entity(report, tabela).erros++;
    console.error(`[MIGRAÇÃO][${tabela}][ERRO]`, { registro, payload, error });
  }

  async function runItem(report, tabela, total, payload, fn, options = {}) {
    const ent = entity(report, tabela, total);
    try {
      if (report.modo === "simulacao") {
        ent.existentes++;
        logLine(`[MIGRAÇÃO][${tabela}][SIMULAR]`, options.identificador || payload?.id || payload?.numero || "");
        return null;
      }
      console.log(`[MIGRAÇÃO][${tabela}][UPSERT]`, payload);
      const result = await fn();
      ent.atualizados++;
      console.log(`[MIGRAÇÃO][${tabela}][UPSERT_RESULT]`, result);
      return result;
    } catch (error) {
      ent.ignorados++;
      recordError(report, tabela, options.identificador || payload?.id || payload?.numero || "", payload, error);
      return null;
    } finally {
      ent.processados++;
      renderEntities(report);
    }
  }

  async function snapshotExistentes(db) {
    const snap = { processos: new Set(), fornecedores: new Set(), irps: new Set() };
    try {
      asArray(await db.loadProcessosCompletos()).forEach(p => {
        if (p.id) snap.processos.add(String(p.id));
        if (p.numero) snap.processos.add(String(p.numero));
      });
    } catch (error) {
      logLine("[MIGRAÇÃO][simulacao][AVISO] Nao foi possivel listar processos existentes.", error.message);
    }
    try {
      asArray(await db.listarFornecedores()).forEach(f => {
        if (f.id) snap.fornecedores.add(String(f.id));
        if (f.cnpj) snap.fornecedores.add(String(f.cnpj));
      });
    } catch (error) {
      logLine("[MIGRAÇÃO][simulacao][AVISO] Nao foi possivel listar fornecedores existentes.", error.message);
    }
    try {
      asArray(await db.listarIrpsRegistroPreco()).forEach(irp => {
        if (irp.id) snap.irps.add(String(irp.id));
        if (irp.numero || irp.ano) snap.irps.add(`${irp.numero || ""}/${irp.ano || ""}`);
      });
    } catch (error) {
      logLine("[MIGRAÇÃO][simulacao][AVISO] Nao foi possivel listar IRPs existentes.", error.message);
    }
    return snap;
  }

  async function executarMigracao(plano, mode) {
    if (!window.AppDatabase) throw new Error("js/database.js nao foi carregado.");
    const db = window.AppDatabase;
    await db.requireAuthenticatedUser();

    const report = makeReport(mode);
    report.resumoBackup = resumoBackup(plano);
    report.orfaos = [...plano.orfaos];
    state.report = report;

    $("migration_progress_panel").hidden = false;
    $("migration_log").textContent = mode === "simulacao" ? "Iniciando simulação..." : "Iniciando importação real...";
    setProgress(0, plano.totalOperacoes);
    setButtons();

    const snapshot = await snapshotExistentes(db);
    let done = 0;
    const tick = () => setProgress(++done, plano.totalOperacoes);

    entity(report, "app_settings", Object.keys(plano.mapaSecretarias).length ? 1 : 0);
    entity(report, "secretarias", plano.secretarias.length);
    entity(report, "tipos_protocolo", plano.tipos.length);
    entity(report, "assuntos_protocolo", plano.assuntos.length);
    entity(report, "fornecedores", plano.fornecedores.length);
    entity(report, "irps_registro_preco", plano.irps.length);
    entity(report, "processos", plano.processos.length);
    entity(report, "tramites_internos", plano.tramitesInternos.length);
    entity(report, "tramites_gerais", Object.keys(plano.tramitesGerais).length);
    entity(report, "anexos", plano.anexos.length);
    renderEntities(report);

    if (Object.keys(plano.mapaSecretarias).length) {
      await runItem(report, "app_settings", 1, { chave: "mapaInteressadosSecretarias" }, () => db.salvarAppSetting("mapaInteressadosSecretarias", plano.mapaSecretarias));
      tick();
    }

    for (const sigla of plano.secretarias) {
      await runItem(report, "secretarias", plano.secretarias.length, { sigla }, () => db.salvarSecretaria({ sigla, ativo: true }), { identificador: sigla });
      tick();
    }

    for (const tipo of plano.tipos) {
      await runItem(report, "tipos_protocolo", plano.tipos.length, tipo, () => db.salvarTipoProtocolo(tipo), { identificador: tipo.nome });
      tick();
    }

    for (const assunto of plano.assuntos) {
      await runItem(report, "assuntos_protocolo", plano.assuntos.length, assunto, () => db.salvarAssuntoProtocolo(assunto), { identificador: `${assunto.tipo || assunto.tipoProtocolo} / ${assunto.nome}` });
      tick();
    }

    for (const fornecedor of plano.fornecedores) {
      const id = fornecedor.id || fornecedor.cnpj || fornecedor.razaoSocial;
      if (snapshot.fornecedores.has(String(fornecedor.id)) || snapshot.fornecedores.has(String(fornecedor.cnpj))) {
        entity(report, "fornecedores").existentes++;
      }
      await runItem(report, "fornecedores", plano.fornecedores.length, fornecedor, () => db.salvarFornecedor(fornecedor), { identificador: id });
      tick();
    }

    for (const irp of plano.irps) {
      const id = irp.id || `${irp.numero || ""}/${irp.ano || ""}`;
      if (snapshot.irps.has(String(irp.id)) || snapshot.irps.has(`${irp.numero || ""}/${irp.ano || ""}`)) {
        entity(report, "irps_registro_preco").existentes++;
      }
      await runItem(report, "irps_registro_preco", plano.irps.length, irp, () => db.salvarIrpRegistroPreco(irp), { identificador: id });
      tick();
    }

    for (const anexo of plano.anexos) {
      await runItem(report, "anexos", plano.anexos.length, { id: anexo.id, nome: anexo.nome, tipo: anexo.tipo }, () => db.importarAnexoBackup(anexo, { bucket: STORAGE_BUCKET }), { identificador: anexo.id || anexo.nome });
      tick();
    }

    for (const processo of plano.processos) {
      const id = processo.id || processo.numero;
      if (snapshot.processos.has(String(processo.id)) || snapshot.processos.has(String(processo.numero))) {
        entity(report, "processos").existentes++;
      }
      await runItem(report, "processos", plano.processos.length, processo, () => db.saveProcessoCompleto(processo), { identificador: id });
      tick();
    }

    for (const tramite of plano.tramitesInternos) {
      await runItem(report, "tramites_internos", plano.tramitesInternos.length, tramite, async () => {
        const atuais = asArray(await db.listarTramitesInternos());
        const mapa = new Map(atuais.map(item => [item.id || item.local_id || `${item.numeroProcesso}_${item.entrada}`, item]));
        mapa.set(tramite.id || tramite.local_id || `${tramite.numeroProcesso}_${tramite.entrada}_${mapa.size}`, tramite);
        return db.salvarTramitesInternos(Array.from(mapa.values()));
      }, { identificador: tramite.id || tramite.numeroProcesso || tramite.numero });
      tick();
    }

    for (const [numero, registro] of Object.entries(plano.tramitesGerais)) {
      const lista = Array.isArray(registro) ? registro : asArray(registro?.tramites);
      await runItem(report, "tramites_gerais", Object.keys(plano.tramitesGerais).length, { numero, total: lista.length }, () => db.saveTramitesGerais(numero, lista), { identificador: numero });
      tick();
    }

    await validarFinal(db, report);
    report.finalizadoEm = new Date().toLocaleString("pt-BR");
    renderEntities(report);
    setStatus(mode === "simulacao"
      ? `Simulação concluída. Erros: ${report.erros.length}. Nenhum dado foi gravado.`
      : `Importação concluída. Erros: ${report.erros.length}. Confira o relatório final.`,
      report.erros.length ? "warning" : "success"
    );
    setButtons();
    return report;
  }

  async function validarFinal(db, report) {
    for (const tabela of TABELAS_VALIDACAO) {
      try {
        report.validacaoFinal[tabela] = await db.contarRegistros(tabela);
      } catch (error) {
        report.validacaoFinal[tabela] = `erro: ${error.message || error}`;
        report.avisos.push(`Nao foi possivel contar ${tabela}: ${error.message || error}`);
      }
    }

    const resumo = report.resumoBackup || {};
    const comparacoes = [
      ["processos", resumo.processos],
      ["fornecedores", resumo.fornecedoresCadastro],
      ["irps_registro_preco", resumo.irpsRegistroPreco],
      ["tramites_internos", resumo.tramitesInternos],
      ["anexos", resumo.anexosIndexedDB]
    ];
    comparacoes.forEach(([tabela, esperado]) => {
      const encontrado = report.validacaoFinal[tabela];
      if (typeof encontrado === "number" && encontrado < esperado) {
        report.avisos.push(`${tabela}: backup tinha ${esperado}, Supabase retornou ${encontrado}.`);
      }
    });
  }

  function analisarBackup(backup) {
    const erros = validarBackup(backup);
    if (erros.length) throw new Error(erros.join(" "));
    const plano = montarPlano(backup);
    state.plano = plano;
    renderSummary(plano);
    setStatus("Backup analisado. Execute a simulação antes da importação real.", "success");
    logLine("[MIGRAÇÃO][ANALISE]", resumoBackup(plano));
    return plano;
  }

  function baixarRelatorio() {
    if (!state.report) return;
    const blob = new Blob([JSON.stringify(state.report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_migracao_supabase_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function lerArquivo(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try { resolve(JSON.parse(reader.result)); }
        catch (error) { reject(error); }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  async function executarComEstado(mode) {
    if (!state.plano) throw new Error("Analise o backup antes de continuar.");
    if (mode === "importacao" && !confirm("Confirmar importação real para o Supabase? Nenhum dado local será apagado.")) return;
    state.running = true;
    setButtons();
    try {
      await executarMigracao(state.plano, mode);
    } finally {
      state.running = false;
      setButtons();
    }
  }

  window.migrarBackupJsonParaSupabase = executarMigracao;

  document.addEventListener("DOMContentLoaded", () => {
    const fileInput = $("migration_file");
    const analyzeBtn = $("migration_analyze");
    const simulateBtn = $("migration_simulate");
    const importBtn = $("migration_import");
    const reportBtn = $("migration_report");

    fileInput?.addEventListener("change", async () => {
      state.backup = null;
      state.plano = null;
      state.report = null;
      $("migration_summary").hidden = true;
      $("migration_progress_panel").hidden = true;
      $("migration_log").textContent = "Lendo arquivo...";
      try {
        const file = fileInput.files?.[0];
        if (!file) {
          setStatus("Selecione o arquivo JSON do backup completo.", "info");
          return;
        }
        state.backup = await lerArquivo(file);
        setStatus(`Arquivo carregado: ${file.name}. Clique em Analisar backup.`, "success");
        logLine("[MIGRAÇÃO][ARQUIVO_CARREGADO]", { nome: file.name, tamanho: file.size });
      } catch (error) {
        console.error("[MIGRAÇÃO][ARQUIVO][ERRO]", error);
        setStatus(`Erro ao ler JSON: ${error.message || error}`, "error");
      } finally {
        setButtons();
      }
    });

    analyzeBtn?.addEventListener("click", () => {
      try {
        analisarBackup(state.backup);
      } catch (error) {
        console.error("[MIGRAÇÃO][ANALISE][ERRO]", error);
        setStatus(error.message || String(error), "error");
      } finally {
        setButtons();
      }
    });

    simulateBtn?.addEventListener("click", async () => {
      try { await executarComEstado("simulacao"); }
      catch (error) {
        console.error("[MIGRAÇÃO][SIMULACAO][ERRO]", error);
        setStatus(error.message || String(error), "error");
      }
    });

    importBtn?.addEventListener("click", async () => {
      try { await executarComEstado("importacao"); }
      catch (error) {
        console.error("[MIGRAÇÃO][IMPORTACAO][ERRO]", error);
        setStatus(error.message || String(error), "error");
      }
    });

    reportBtn?.addEventListener("click", baixarRelatorio);
    setButtons();
  });
})();
