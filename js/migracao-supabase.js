// Ferramenta de migracao dos dados do navegador para o Supabase.
// Ela le os dados locais e envia uma copia para o banco online.
// Nada e apagado do localStorage ou IndexedDB.

(() => {
  function readLocal(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch { return fallback; }
  }

  function setStatus(message, type = "info") {
    const el = document.getElementById("migration_status");
    if (!el) return;
    el.className = `migration-status ${type}`;
    el.textContent = message;
  }

  async function migrarFornecedores(db, fornecedores) {
    for (const fornecedor of fornecedores) {
      await db.salvarFornecedor(fornecedor);
    }
  }

  async function migrarSecretarias(db) {
    const secretarias = [
      "AMHARC","AGETRAT","FUPHAN","FMAP","FUNPREV","SISP","SEMED","SEPRAD","SMSPDS",
      "PROCON","FCC","FUNEC","FUNDTUR","SMASC","SMDES","SEGES","SMS","SELIC"
    ];
    for (const sigla of secretarias) {
      await db.salvarSecretaria({ sigla, ativo: true });
    }
  }

  async function migrarTiposProtocolo(db, tipos) {
    const padrao = [
      "PROCESSO LICITATÓRIO",
      "SOLICITAÇÃO",
      "MANIFESTAÇÃO DE INTERESSE",
      "COMUNICAÇÃO INTERNA",
      "OFÍCIO"
    ].map(nome => ({ nome, ativo: true, padrao: true }));
    const mapa = new Map();
    [...padrao, ...(tipos || [])].forEach(tipo => {
      const nome = String(tipo?.nome || "").replace(/\s+/g, " ").trim().toUpperCase();
      if (nome) mapa.set(nome, { ...tipo, nome, ativo: tipo.ativo !== false });
    });
    for (const tipo of mapa.values()) {
      await db.salvarTipoProtocolo(tipo);
    }
  }

  async function migrarAssuntosProtocolo(db, assuntos) {
    const padrao = [];
    const padroesPorTipo = {
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
    Object.entries(padroesPorTipo).forEach(([tipo, nomes]) => {
      nomes.forEach(nome => padrao.push({ tipo, nome, ativo: true, padrao: true }));
    });

    const mapa = new Map();
    [...padrao, ...(assuntos || [])].forEach(assunto => {
      const tipo = String(assunto?.tipo || assunto?.tipoProtocolo || "").replace(/\s+/g, " ").trim().toUpperCase();
      const nome = String(assunto?.nome || "").replace(/\s+/g, " ").trim().toUpperCase();
      if (tipo && nome) mapa.set(`${tipo}::${nome}`, { ...assunto, tipo, nome, ativo: assunto.ativo !== false });
    });

    for (const assunto of mapa.values()) {
      await db.salvarAssuntoProtocolo(assunto);
    }
  }

  async function migrarListasConfiguracao(db, mapaSecretarias) {
    if (mapaSecretarias && Object.keys(mapaSecretarias).length) {
      await db.salvarAppSetting("mapaInteressadosSecretarias", mapaSecretarias);
    }
  }

  async function migrarIrps(db, irps) {
    for (const irp of irps || []) {
      await db.salvarIrpRegistroPreco(irp);
    }
  }

  async function migrarTudo() {
    if (!window.AppDatabase) throw new Error("js/database.js nao foi carregado.");
    const db = window.AppDatabase;

    const processos = readLocal("processosLicitatorios", []);
    const tramitesInternos = readLocal("tramitesProcessos", []);
    const tramitesGerais = readLocal("tramitesGeraisImportados", {});
    const irps = readLocal("irpsRegistroPreco", []);
    const fornecedores = readLocal("fornecedoresCadastro", []);
    const tipos = readLocal("tiposProtocoloCadastro", []);
    const assuntos = readLocal("assuntosProtocoloCadastro", []);
    const mapaSecretarias = readLocal("mapaInteressadosSecretarias", {});

    setStatus("Migrando configuracoes...", "info");
    await migrarListasConfiguracao(db, mapaSecretarias);

    setStatus("Migrando secretarias...", "info");
    await migrarSecretarias(db);

    setStatus("Migrando tipos de protocolo...", "info");
    await migrarTiposProtocolo(db, tipos);

    setStatus("Migrando assuntos de protocolo...", "info");
    await migrarAssuntosProtocolo(db, assuntos);

    setStatus("Migrando fornecedores...", "info");
    await migrarFornecedores(db, fornecedores);

    setStatus("Migrando IRPs...", "info");
    await migrarIrps(db, irps);

    for (let i = 0; i < processos.length; i++) {
      setStatus(`Migrando processos ${i + 1}/${processos.length}...`, "info");
      await db.saveProcessoCompleto(processos[i]);
    }

    if (tramitesInternos.length) {
      setStatus("Migrando tramites internos...", "info");
      await db.salvarTramitesInternos(tramitesInternos);
    }

    const entradasGerais = Object.entries(tramitesGerais);
    for (let i = 0; i < entradasGerais.length; i++) {
      const [numero, registro] = entradasGerais[i];
      const lista = Array.isArray(registro) ? registro : (registro?.tramites || []);
      setStatus(`Migrando tramites gerais ${i + 1}/${entradasGerais.length}...`, "info");
      await db.saveTramitesGerais(numero, lista);
    }

    setStatus(`Migracao concluida. Processos: ${processos.length}. Fornecedores: ${fornecedores.length}.`, "success");
  }

  window.migrarDadosLocaisParaSupabase = migrarTudo;

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("migration_start");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await migrarTudo();
      } catch (error) {
        console.error(error);
        setStatus(error.message || String(error), "error");
      } finally {
        btn.disabled = false;
      }
    });
  });
})();
