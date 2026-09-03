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

  async function migrarListasConfiguracao(client, tipos, assuntos, mapaSecretarias) {
    for (const tipo of tipos || []) {
      const res = await client.from("tipos_protocolo").upsert({
        nome: tipo.nome || "",
        ativo: tipo.ativo !== false,
        padrao: !!tipo.padrao
      }, { onConflict: "nome" });
      if (res.error) throw res.error;
    }

    for (const assunto of assuntos || []) {
      if (!assunto?.tipo || !assunto?.nome) continue;
      const res = await client.from("assuntos_protocolo").upsert({
        tipo_nome: assunto.tipo,
        nome: assunto.nome,
        ativo: assunto.ativo !== false,
        padrao: !!assunto.padrao
      }, { onConflict: "tipo_nome,nome" });
      if (res.error) throw res.error;
    }

    if (mapaSecretarias && Object.keys(mapaSecretarias).length) {
      const res = await client.from("app_settings").upsert({
        chave: "mapaInteressadosSecretarias",
        valor: mapaSecretarias
      }, { onConflict: "chave" });
      if (res.error) throw res.error;
    }
  }

  async function migrarIrps(client, irps) {
    for (const irp of irps || []) {
      const saved = await client.from("irps_registro_preco").upsert({
        local_id: irp.id || `${irp.numero || ""}_${irp.ano || ""}`,
        numero: irp.numero || "",
        ano: irp.ano || "",
        objeto: irp.objeto || "",
        secretaria: irp.secretaria || "",
        extra: irp
      }, { onConflict: "local_id" }).select("id").single();
      if (saved.error) throw saved.error;

      const del = await client.from("irp_itens").delete().eq("irp_id", saved.data.id);
      if (del.error) throw del.error;
      const itens = (irp.itens || []).map((item, index) => ({
        irp_id: saved.data.id,
        ordem: Number(item.item || item.ordem || index + 1) || index + 1,
        codigo: item.codigo || "",
        descricao: item.descricao || "",
        unidade: item.unidade || "",
        quantidade: window.AppDatabase.parseNumber(item.quantidade),
        valor_unitario: window.AppDatabase.parseNumber(item.valorUnitario),
        valor_total: window.AppDatabase.parseNumber(item.valorTotal),
        extra: item
      }));
      if (itens.length) {
        const ins = await client.from("irp_itens").insert(itens);
        if (ins.error) throw ins.error;
      }
    }
  }

  async function migrarTudo() {
    if (!window.AppDatabase) throw new Error("js/database.js nao foi carregado.");
    const db = window.AppDatabase;
    const client = db.client();

    const processos = readLocal("processosLicitatorios", []);
    const tramitesInternos = readLocal("tramitesProcessos", []);
    const tramitesGerais = readLocal("tramitesGeraisImportados", {});
    const irps = readLocal("irpsRegistroPreco", []);
    const fornecedores = readLocal("fornecedoresCadastro", []);
    const tipos = readLocal("tiposProtocoloCadastro", []);
    const assuntos = readLocal("assuntosProtocoloCadastro", []);
    const mapaSecretarias = readLocal("mapaInteressadosSecretarias", {});

    setStatus("Migrando configuracoes...", "info");
    await migrarListasConfiguracao(client, tipos, assuntos, mapaSecretarias);

    setStatus("Migrando secretarias...", "info");
    await migrarSecretarias(db);

    setStatus("Migrando fornecedores...", "info");
    await migrarFornecedores(db, fornecedores);

    setStatus("Migrando IRPs...", "info");
    await migrarIrps(client, irps);

    for (let i = 0; i < processos.length; i++) {
      setStatus(`Migrando processos ${i + 1}/${processos.length}...`, "info");
      await db.saveProcessoCompleto(processos[i]);
    }

    const rowsInternos = tramitesInternos.map(t => ({
      local_id: t.id || null,
      numero_processo: t.numero || t.numeroProcesso || "",
      entrada: t.entrada || "",
      data_entrada: db.parseDateBR(t.dataEntrada),
      motivo: t.motivo || "",
      secretaria: t.secretaria || "",
      objeto: t.objeto || "",
      responsavel: t.responsavel || "",
      tipo: t.tipo || "",
      status: t.status || "",
      destino: t.destino || "",
      historico: t.historico || [],
      extra: t
    }));
    if (rowsInternos.length) {
      setStatus("Migrando tramites internos...", "info");
      const del = await client.from("tramites_internos").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (del.error) throw del.error;
      const ins = await client.from("tramites_internos").insert(rowsInternos);
      if (ins.error) throw ins.error;
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
