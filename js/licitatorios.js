// js/licitatorios.js
// Módulo Processos Licitatórios — Cadastro + Edição detalhada (localStorage + Importar/Exportar JSON)

(() => {
  const STORAGE_KEY = 'processosLicitatorios';
  const SECRETARIA_MAP_KEY = 'mapaInteressadosSecretarias';
  const FORNECEDORES_KEY = 'fornecedoresCadastro';
  const TIPOS_PROTOCOLO_KEY = 'tiposProtocoloCadastro';
  const ASSUNTOS_PROTOCOLO_KEY = 'assuntosProtocoloCadastro';
  const IRP_STORAGE_KEY = 'irpsRegistroPreco';

  const TIPOS_PROTOCOLO_PADRAO = [
    "PROCESSO LICITATÓRIO",
    "SOLICITAÇÃO",
    "MANIFESTAÇÃO DE INTERESSE",
    "COMUNICAÇÃO INTERNA",
    "OFÍCIO"
  ];

  const ASSUNTOS_PROTOCOLO_PADRAO = {
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

  const SECRETARIAS = [
    "AMHARC","AGETRAT","FUPHAN","FMAP","FUNPREV","SISP","SEMED","SEPRAD","SMSPDS",
    "PROCON","FCC","FUNEC","FUNDTUR","SMASC","SMDES","SEGES","SMS","SELIC"
  ];

  /* ---------- Storage helpers ---------- */
  function loadData() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch (e) { console.error('Erro ao carregar dados:', e); return []; }
  }
  function saveData(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function loadSecretariaMap() {
    try { return JSON.parse(localStorage.getItem(SECRETARIA_MAP_KEY) || '{}'); }
    catch (e) { console.error('Erro ao carregar mapa de secretarias:', e); return {}; }
  }

  function saveSecretariaMap(map) {
    localStorage.setItem(SECRETARIA_MAP_KEY, JSON.stringify(map));
  }

  function loadFornecedores() {
    try { return JSON.parse(localStorage.getItem(FORNECEDORES_KEY) || '[]'); }
    catch (e) { console.error('Erro ao carregar fornecedores:', e); return []; }
  }

  function saveFornecedores(items) {
    localStorage.setItem(FORNECEDORES_KEY, JSON.stringify(items));
  }

  function normalizarCadastro(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function loadTiposProtocolo() {
    let salvos = [];
    try { salvos = JSON.parse(localStorage.getItem(TIPOS_PROTOCOLO_KEY) || '[]'); }
    catch (e) { console.error('Erro ao carregar tipos de protocolo:', e); }

    const map = new Map();
    TIPOS_PROTOCOLO_PADRAO.forEach(nome => {
      map.set(normalizarCadastro(nome), {
        id: normalizarCadastro(nome),
        nome,
        ativo: true,
        padrao: true
      });
    });
    salvos.forEach(tipo => {
      const key = normalizarCadastro(tipo.nome);
      if (!key) return;
      map.set(key, {
        id: tipo.id || key,
        nome: tipo.nome,
        ativo: tipo.ativo !== false,
        padrao: !!tipo.padrao,
        criadoEm: tipo.criadoEm,
        atualizadoEm: tipo.atualizadoEm
      });
    });
    return [...map.values()];
  }

  function saveTiposProtocolo(items) {
    localStorage.setItem(TIPOS_PROTOCOLO_KEY, JSON.stringify(items));
  }

  function loadAssuntosProtocolo() {
    let salvos = [];
    try { salvos = JSON.parse(localStorage.getItem(ASSUNTOS_PROTOCOLO_KEY) || '[]'); }
    catch (e) { console.error('Erro ao carregar assuntos de protocolo:', e); }

    const map = new Map();
    Object.entries(ASSUNTOS_PROTOCOLO_PADRAO).forEach(([tipo, assuntos]) => {
      assuntos.forEach(nome => {
        const key = `${normalizarCadastro(tipo)}::${normalizarCadastro(nome)}`;
        map.set(key, {
          id: key,
          tipo,
          nome,
          ativo: true,
          padrao: true
        });
      });
    });
    salvos.forEach(assunto => {
      const tipo = assunto.tipo || assunto.tipoProtocolo || '';
      const key = `${normalizarCadastro(tipo)}::${normalizarCadastro(assunto.nome)}`;
      if (!normalizarCadastro(tipo) || !normalizarCadastro(assunto.nome)) return;
      map.set(key, {
        id: assunto.id || key,
        tipo,
        nome: assunto.nome,
        ativo: assunto.ativo !== false,
        padrao: !!assunto.padrao,
        criadoEm: assunto.criadoEm,
        atualizadoEm: assunto.atualizadoEm
      });
    });
    return [...map.values()];
  }

  function saveAssuntosProtocolo(items) {
    localStorage.setItem(ASSUNTOS_PROTOCOLO_KEY, JSON.stringify(items));
  }

  function upsertTipoProtocolo(nome) {
    const clean = String(nome || '').replace(/\s+/g, ' ').trim().toUpperCase();
    if (!clean) return '';
    const tipos = loadTiposProtocolo();
    const existente = tipos.find(t => normalizarCadastro(t.nome) === normalizarCadastro(clean));
    if (existente) return existente.nome;
    tipos.push({
      id: genId(),
      nome: clean,
      ativo: true,
      criadoEm: new Date().toLocaleString('pt-BR'),
      atualizadoEm: new Date().toLocaleString('pt-BR')
    });
    saveTiposProtocolo(tipos);
    return clean;
  }

  function upsertAssuntoProtocolo(tipo, nome) {
    const tipoClean = String(tipo || '').replace(/\s+/g, ' ').trim().toUpperCase();
    const nomeClean = String(nome || '').replace(/\s+/g, ' ').trim().toUpperCase();
    if (!tipoClean || !nomeClean) return '';
    const assuntos = loadAssuntosProtocolo();
    const existente = assuntos.find(a =>
      normalizarCadastro(a.tipo) === normalizarCadastro(tipoClean) &&
      normalizarCadastro(a.nome) === normalizarCadastro(nomeClean)
    );
    if (existente) return existente.nome;
    assuntos.push({
      id: genId(),
      tipo: tipoClean,
      nome: nomeClean,
      ativo: true,
      criadoEm: new Date().toLocaleString('pt-BR'),
      atualizadoEm: new Date().toLocaleString('pt-BR')
    });
    saveAssuntosProtocolo(assuntos);
    return nomeClean;
  }

  function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function formatCnpj(value) {
    let v = onlyDigits(value).slice(0, 14);
    v = v.replace(/^(\d{2})(\d)/, '$1.$2');
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
    v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
    v = v.replace(/(\d{4})(\d)/, '$1-$2');
    return v;
  }

  function formatCpf(value) {
    let v = onlyDigits(value).slice(0, 11);
    v = v.replace(/^(\d{3})(\d)/, '$1.$2');
    v = v.replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
    v = v.replace(/\.(\d{3})(\d)/, '.$1-$2');
    return v;
  }

  function normalizarPessoasFornecedor(pessoas) {
    return Array.isArray(pessoas) ? pessoas.map(p => ({
      id: p.id || genId(),
      nome: p.nome || '',
      cpf: p.cpf || '',
      tipoVinculo: p.tipoVinculo || p.tipo_vinculo || '',
      observacao: p.observacao || '',
      ativo: p.ativo !== false,
      criadoEm: p.criadoEm || p.created_at || new Date().toLocaleString('pt-BR'),
      atualizadoEm: p.atualizadoEm || p.updated_at || new Date().toLocaleString('pt-BR')
    })) : [];
  }

  function upsertFornecedor(info) {
    const cnpjDigits = onlyDigits(info?.cnpj);
    if (!cnpjDigits) return null;

    const fornecedores = loadFornecedores();
    const idx = fornecedores.findIndex(f => onlyDigits(f.cnpj) === cnpjDigits);
    const atual = idx >= 0 ? fornecedores[idx] : {};
    const fornecedor = {
      id: atual.id || genId(),
      cnpj: formatCnpj(info.cnpj),
      razaoSocial: (info.razaoSocial || atual.razaoSocial || '').trim(),
      nomeFantasia: (info.nomeFantasia || atual.nomeFantasia || '').trim(),
      origem: info.origem || atual.origem || '',
      pessoas: normalizarPessoasFornecedor(info.pessoas || atual.pessoas),
      atualizadoEm: new Date().toLocaleString('pt-BR'),
      criadoEm: atual.criadoEm || new Date().toLocaleString('pt-BR')
    };

    if (idx >= 0) fornecedores[idx] = fornecedor;
    else fornecedores.unshift(fornecedor);

    saveFornecedores(fornecedores);
    return fornecedor;
  }

  function buscarFornecedorPorCnpj(cnpj) {
    const digits = onlyDigits(cnpj);
    if (!digits) return null;
    return loadFornecedores().find(f => onlyDigits(f.cnpj) === digits) || null;
  }

  function fornecedorIdPorCnpj(cnpj) {
    return buscarFornecedorPorCnpj(cnpj)?.id || "";
  }

  function renderPessoaVinculadaSelect(fornecedor, select, status) {
    if (!select) return;
    const atual = select.value;
    const pessoas = normalizarPessoasFornecedor(fornecedor?.pessoas)
      .filter(p => p.ativo !== false);

    select.innerHTML = '<option value="">-- nenhuma pessoa vinculada --</option>';
    pessoas.forEach(pessoa => {
      const option = document.createElement('option');
      option.value = pessoa.id;
      option.textContent = `${pessoa.nome}${pessoa.tipoVinculo ? ' - ' + pessoa.tipoVinculo : ''}`;
      option.dataset.nome = pessoa.nome;
      option.dataset.tipo = pessoa.tipoVinculo;
      select.appendChild(option);
    });

    if ([...select.options].some(option => option.value === atual)) {
      select.value = atual;
    }

    if (status) {
      status.textContent = fornecedor
        ? (pessoas.length ? `${pessoas.length} pessoa(s) vinculada(s) disponível(is).` : 'Fornecedor sem pessoas vinculadas ativas.')
        : 'Informe o CNPJ para carregar pessoas vinculadas.';
    }
  }

  function dadosPessoaSelecionada(select) {
    if (!select || !select.value) {
      return {
        pessoaVinculadaId: '',
        pessoaVinculadaNome: '',
        pessoaVinculadaTipo: ''
      };
    }

    const option = select.options?.[select.selectedIndex];
    return {
      pessoaVinculadaId: select.value,
      pessoaVinculadaNome: option?.dataset?.nome || option?.textContent?.split(' - ')[0] || '',
      pessoaVinculadaTipo: option?.dataset?.tipo || option?.textContent?.split(' - ').slice(1).join(' - ') || ''
    };
  }

  function registrarFornecedorDoProcesso(item) {
    if (!item) return null;
    let fornecedorRegistrado = null;

    if (item.credCnpj) {
      fornecedorRegistrado = upsertFornecedor({
        cnpj: item.credCnpj,
        razaoSocial: item.credRazao,
        nomeFantasia: item.credFantasia,
        origem: `PROCESSO ${item.numero || ''}`.trim()
      });
    }

    if (item.cnpj) {
      fornecedorRegistrado = upsertFornecedor({
        cnpj: item.cnpj,
        razaoSocial: item.fornecedor,
        nomeFantasia: item.fornecedor,
        origem: `PROCESSO ${item.numero || ''}`.trim()
      });
    }

    (item.resultadoItens || []).forEach(resItem => {
      if (onlyDigits(resItem.cnpj).length === 14) {
        fornecedorRegistrado = upsertFornecedor({
          cnpj: resItem.cnpj,
          razaoSocial: resItem.razaoSocial,
          nomeFantasia: resItem.nomeFantasia,
          origem: `RESULTADO DO PROCESSO ${item.numero || ''}`.trim()
        });
        resItem.fornecedorId = fornecedorRegistrado?.id || resItem.fornecedorId || "";
      }
    });

    return fornecedorRegistrado;
  }

    function renderItensAtaDraft() {
      const lista = container.querySelector('#lic_ata_itens_lista');
      const status = container.querySelector('#lic_ata_item_status');
      if (!lista) return;

      lista.innerHTML = itensAtaDraft.length ? `
        ${renderTabelaItensAta(itensAtaDraft, 12)}
      ` : `<div class="empty">Nenhum item cadastrado para esta ata.</div>`;
      if (status) {
        const colunas = itensAtaDraft.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
        status.textContent = itensAtaDraft.length
          ? `${contarItensTabela(itensAtaDraft)} item(s) importado(s). Primeira linha usada como cabeçalho. ${itensAtaDraft.length} linha(s) no arquivo.`
          : 'Nenhum item importado.';
      }
    }

    function normalizarItensAta(items) {
      if (!Array.isArray(items)) return [];
      return items.map(item => Array.isArray(item)
        ? item
        : [
            item.codigo || '',
            item.descricao || '',
            item.unidade || '',
            item.quantidade || '',
            item.valorUnitario || '',
            item.valorTotal || ''
          ]
      );
    }

    function contarItensTabela(items) {
      return Math.max((Array.isArray(items) ? items.length : 0) - 1, 0);
    }

    function chaveItemAta(row) {
      return (Array.isArray(row) ? row : [])
        .map(cell => String(cell ?? '').replace(/\s+/g, ' ').trim().toUpperCase())
        .join('|');
    }

    function mapaItensAtaUsados(atas, ataIgnorada = {}) {
      const mapa = new Map();
      (Array.isArray(atas) ? atas : []).forEach((ata, ataIndex) => {
        const ignorarPorId = ataIgnorada.id && ata?.id === ataIgnorada.id;
        const ignorarPorIndex = Number.isInteger(ataIgnorada.index) && ataIgnorada.index >= 0 && ataIndex === ataIgnorada.index;
        if (ignorarPorId || ignorarPorIndex) return;
        normalizarItensAta(ata?.itens).slice(1).forEach((row, rowIndex) => {
          const key = chaveItemAta(row);
          if (!key) return;
          mapa.set(key, {
            ata,
            ataIndex,
            row,
            itemIndex: rowIndex + 1
          });
        });
      });
      return mapa;
    }

    function encontrarItemAtaDuplicado(atas, itens, ataIgnorada = {}) {
      const usados = mapaItensAtaUsados(atas, ataIgnorada);
      for (const row of normalizarItensAta(itens).slice(1)) {
        const key = chaveItemAta(row);
        if (key && usados.has(key)) return usados.get(key);
      }
      return null;
    }

    function itensAtaForaDaIrp(irp, itensAta) {
      const linhasAta = normalizarItensAta(itensAta).slice(1).filter(row => chaveItemAta(row));
      const itensIrp = normalizarItensAta(irp?.itens).slice(1);
      if (!itensIrp.length) return linhasAta;
      const permitidos = new Set(itensIrp.map(chaveItemAta).filter(Boolean));
      return linhasAta.filter(row => {
        const key = chaveItemAta(row);
        return key && !permitidos.has(key);
      });
    }

    function resumoItemAta(row) {
      const partes = (Array.isArray(row) ? row : [])
        .map(cell => String(cell ?? '').trim())
        .filter(Boolean)
        .slice(0, 3);
      return partes.join(' - ') || 'Item sem descrição';
    }

    function buscarIrpCompativelComItens(itensAta) {
      let irps = [];
      try {
        irps = JSON.parse(localStorage.getItem(IRP_STORAGE_KEY) || '[]');
      } catch (error) {
        console.error('Erro ao buscar IRP compatível com itens da ata:', error);
        return null;
      }
      const linhasAta = normalizarItensAta(itensAta).slice(1).filter(row => chaveItemAta(row));
      if (!linhasAta.length) return null;
      return irps.find(irp => {
        const itensIrp = normalizarItensAta(irp?.itens).slice(1);
        if (!itensIrp.length) return false;
        const permitidos = new Set(itensIrp.map(chaveItemAta).filter(Boolean));
        return linhasAta.every(row => permitidos.has(chaveItemAta(row)));
      }) || null;
    }

    function validarItensAtaNaIrp(irp, itensAta, mensagemSemIrp = 'Vincule uma IRP ao processo gerador antes de importar ou salvar itens da ata.') {
      const linhasAta = normalizarItensAta(itensAta);
      if (linhasAta.length <= 1) return true;
      if (!irp) {
        alert(mensagemSemIrp);
        return false;
      }
      const itensIrp = normalizarItensAta(irp?.itens);
      const qtdIrp = Math.max(itensIrp.length - 1, 0);
      if (!qtdIrp) {
        alert(`A IRP vinculada (${irp.numero || ''}/${irp.ano || ''}) não possui itens cadastrados. Importe primeiro os itens da IRP/processo gerador.`);
        return false;
      }
      const fora = itensAtaForaDaIrp(irp, linhasAta);
      if (!fora.length) return true;
      const exemplos = fora.slice(0, 5).map((row, idx) => `${idx + 1}. ${resumoItemAta(row)}`).join('\n');
      alert(`A ata possui ${fora.length} item(s) que não constam na IRP vinculada (${qtdIrp} item(s) cadastrados na IRP).\n\n${exemplos}${fora.length > 5 ? '\n...' : ''}\n\nAjuste o arquivo TXT ou selecione os itens diretamente pela IRP.`);
      return false;
    }

    function renderTabelaItensAta(items, limite = Infinity) {
      const linhas = normalizarItensAta(items);
      if (!linhas.length) return `<div class="empty">Nenhum item cadastrado.</div>`;

      const colunas = linhas.reduce((max, row) => Math.max(max, row.length), 0);
      const sample = linhas.slice(0, limite);
      return `
        <div style="overflow:auto;max-height:320px">
          <table>
            <tbody>
              ${sample.map((row, rowIndex) => `
                <tr>
                  ${Array.from({ length: colunas }, (_, colIndex) => rowIndex === 0
                    ? `<th>${escHtml(row[colIndex] || '')}</th>`
                    : `<td>${escHtml(row[colIndex] || '')}</td>`
                  ).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${linhas.length > sample.length ? `<div class="muted" style="margin-top:6px">Prévia limitada às primeiras ${sample.length} linhas.</div>` : ''}
      `;
    }

    function renderProcessosFornecedor(fornecedor) {
      const lista = container.querySelector('#forn_processos_lista');
      if (!lista) return;

      const processos = processosVinculadosFornecedor(fornecedor);
      lista.innerHTML = processos.length ? `
        <div style="overflow:auto;max-height:260px">
          <table>
            <thead>
              <tr>
                <th>Nº Processo</th>
                <th>Objeto</th>
                <th>Pessoa Vinculada</th>
                <th>Tipo</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              ${processos.map(p => `
                <tr>
                  <td><strong>${esc(p.numero || "")}</strong></td>
                  <td>${esc(p.objeto || "")}</td>
                  <td>${esc(p.pessoaVinculadaNome || "")}</td>
                  <td>${esc(p.pessoaVinculadaTipo || "")}</td>
                  <td>${esc(p.dataCriacao || "")}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">Nenhum processo vinculado a este fornecedor.</div>`;
    }

    function abrirVisualizacaoFornecedor(fornecedor) {
      if (!fornecedor) return;
      const pessoas = normalizarPessoasFornecedor(fornecedor.pessoas);
      const processos = processosVinculadosFornecedor(fornecedor);
      const dlg = container.querySelector('#fornecedor_view_dlg');
      const body = container.querySelector('#fornecedor_view_body');

      body.innerHTML = `
        <div class="grid">
          <div>
            <strong>CNPJ</strong><br>
            ${esc(fornecedor.cnpj || "")}
          </div>
          <div>
            <strong>Atualizado em</strong><br>
            ${esc(fornecedor.atualizadoEm || "")}
          </div>
          <div style="grid-column:1/-1">
            <strong>Razão Social</strong><br>
            ${esc(fornecedor.razaoSocial || "")}
          </div>
          <div style="grid-column:1/-1">
            <strong>Nome Fantasia</strong><br>
            ${esc(fornecedor.nomeFantasia || "")}
          </div>
        </div>

        <hr>
        <h3 style="margin:0 0 10px 0">Processos Vinculados</h3>
        ${processos.length ? `
          <div style="overflow:auto;max-height:280px">
            <table>
              <thead>
                <tr>
                  <th>Nº Processo</th>
                  <th>Objeto</th>
                  <th>Pessoa Vinculada</th>
                  <th>Tipo</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                ${processos.map(p => `
                  ${(() => {
                    const vinculo = dadosVinculoFornecedorNoProcesso(p, fornecedor);
                    return `
                  <tr>
                    <td><strong>${esc(p.numero || "")}</strong></td>
                    <td>${esc(p.objeto || "")}</td>
                    <td>${esc(vinculo.pessoa || "")}</td>
                    <td>${esc(vinculo.tipo || "")}</td>
                    <td>${esc(p.dataCriacao || "")}</td>
                  </tr>
                    `;
                  })()}
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty">Nenhum processo vinculado a este fornecedor.</div>`}

        <hr>
        <h3 style="margin:0 0 10px 0">Pessoas Vinculadas</h3>
        ${pessoas.length ? `
          <div style="overflow:auto;max-height:280px">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Tipo de Vínculo</th>
                  <th>Situação</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                ${pessoas.map(p => `
                  <tr>
                    <td><strong>${esc(p.nome || "")}</strong></td>
                    <td>${esc(p.cpf || "")}</td>
                    <td>${esc(p.tipoVinculo || "")}</td>
                    <td>${p.ativo === false ? "INATIVO" : "ATIVO"}</td>
                    <td>${esc(p.observacao || "")}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty">Nenhuma pessoa vinculada cadastrada para este fornecedor.</div>`}
      `;

      dlg.showModal();
    }

  function normalizarChaveInteressado(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function genId() { return String(Date.now()) + Math.floor(Math.random()*1000); }

  /* ---------- Formatting / limpeza ---------- */
  function fmtDate(iso) {
    if (!iso) return '';
    // Passthrough: we store dataCriacao as dd/mm/yyyy as requested
    return iso;
  }


  /* ---------- Toast ---------- */
  function showToast(msg, ttl = 2200) {
    const wrap = document.getElementById('toasts') || (() => {
      const w = document.createElement('div');
      w.id = 'toasts';
      w.style.position = 'fixed';
      w.style.bottom = '10px';
      w.style.right = '10px';
      w.style.zIndex = '9999';
      document.body.appendChild(w);
      return w;
    })();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    el.style.background = 'var(--primary,#2f6fed)';
    el.style.color = '#fff';
    el.style.padding = '8px 12px';
    el.style.marginTop = '8px';
    el.style.borderRadius = '8px';
    wrap.appendChild(el);
    setTimeout(() => el.remove(), ttl);
  }

  /* ---------- Download helper ---------- */
  function downloadFile(filename, data) {
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const ANEXOS_DB_NAME = 'processosLicitatoriosAnexosDB';
  const ANEXOS_DB_VERSION = 1;
  const ANEXOS_STORE = 'anexos';

  function abrirBancoAnexos() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(ANEXOS_DB_NAME, ANEXOS_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(ANEXOS_STORE)) {
          db.createObjectStore(ANEXOS_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function salvarAnexoIndexedDB(input, atual = null) {
    const file = input?.files?.[0];
    if (!file) return atual || null;

    const id = atual?.id || genId();
    const registro = {
      id,
      nome: file.name,
      tipo: file.type || 'application/pdf',
      tamanho: file.size,
      atualizadoEm: new Date().toLocaleString('pt-BR'),
      criadoEm: atual?.criadoEm || new Date().toLocaleString('pt-BR'),
      blob: file
    };

    const db = await abrirBancoAnexos();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(ANEXOS_STORE, 'readwrite');
      tx.objectStore(ANEXOS_STORE).put(registro);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    return {
      id,
      storage: 'indexedDB',
      nome: registro.nome,
      tipo: registro.tipo,
      tamanho: registro.tamanho,
      criadoEm: registro.criadoEm,
      atualizadoEm: registro.atualizadoEm
    };
  }

  async function salvarArquivoIndexedDB(file, atual = null) {
    if (!file) return atual || null;

    const id = atual?.id || genId();
    const registro = {
      id,
      nome: file.name,
      tipo: file.type || 'application/pdf',
      tamanho: file.size,
      atualizadoEm: new Date().toLocaleString('pt-BR'),
      criadoEm: atual?.criadoEm || new Date().toLocaleString('pt-BR'),
      blob: file
    };

    const db = await abrirBancoAnexos();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(ANEXOS_STORE, 'readwrite');
      tx.objectStore(ANEXOS_STORE).put(registro);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    return {
      id,
      storage: 'indexedDB',
      nome: registro.nome,
      tipo: registro.tipo,
      tamanho: registro.tamanho,
      criadoEm: registro.criadoEm,
      atualizadoEm: registro.atualizadoEm
    };
  }

  function blobParaDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function abrirVisualizadorPdf(dataUrl, nome = 'documento.pdf') {
    let dlg = document.getElementById('dlg_visualizador_pdf');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'dlg_visualizador_pdf';
      dlg.style.width = 'min(980px,96vw)';
      dlg.style.height = 'min(760px,92vh)';
      dlg.innerHTML = `
        <div class="modal-head">
          <strong id="pdf_view_title">Documento</strong>
          <div style="display:flex;gap:8px;align-items:center">
            <a id="pdf_view_download" class="btn" href="#" download>Baixar</a>
            <button id="pdf_view_close" class="btn ghost" type="button">Fechar</button>
          </div>
        </div>
        <div class="modal-body" style="height:calc(100% - 64px);padding:0">
          <iframe id="pdf_view_frame" title="Visualizador de PDF" style="width:100%;height:100%;border:0"></iframe>
        </div>
      `;
      document.body.appendChild(dlg);
      dlg.querySelector('#pdf_view_close').addEventListener('click', () => dlg.close());
    }

    dlg.querySelector('#pdf_view_title').textContent = nome || 'Documento';
    const download = dlg.querySelector('#pdf_view_download');
    download.href = dataUrl;
    download.download = nome || 'documento.pdf';
    dlg.querySelector('#pdf_view_frame').srcdoc = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <style>
          html, body { margin:0; width:100%; height:100%; background:#f8fafc; }
          object, iframe { width:100%; height:100%; border:0; }
          .fallback { font-family:Arial,sans-serif; padding:24px; color:#0f172a; }
          .fallback a { color:#2563eb; font-weight:700; }
        </style>
      </head>
      <body>
        <object data="${dataUrl}" type="application/pdf">
          <div class="fallback">
            Não foi possível exibir o PDF neste navegador.
            <a href="${dataUrl}" download="${escapeAttr(nome || 'documento.pdf')}">Baixar arquivo</a>
          </div>
        </object>
      </body>
      </html>
    `;

    dlg.onclose = () => {
      dlg.querySelector('#pdf_view_frame').srcdoc = '';
    };

    dlg.showModal();
  }

  async function visualizarAnexoIndexedDB(id) {
    const db = await abrirBancoAnexos();
    const registro = await new Promise((resolve, reject) => {
      const tx = db.transaction(ANEXOS_STORE, 'readonly');
      const request = tx.objectStore(ANEXOS_STORE).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();

    if (!registro?.blob) {
      alert('Anexo não encontrado no armazenamento local deste navegador.');
      return;
    }

    const dataUrl = await blobParaDataUrl(registro.blob);
    abrirVisualizadorPdf(dataUrl, registro.nome || 'anexo.pdf');
  }

  function escapeAttr(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function linkAnexoPdf(arquivo, label, className = 'btn') {
    if (!arquivo) return '';
    const classAttr = className ? ` class="${escapeAttr(className)}"` : '';
    if (arquivo.id && arquivo.storage === 'indexedDB') {
      return `<button type="button"${classAttr} data-anexo-id="${escapeAttr(arquivo.id)}" data-anexo-nome="${escapeAttr(arquivo.nome || label)}">${escapeAttr(label)}</button>`;
    }
    if (arquivo.dataUrl) {
      return `<button type="button"${classAttr} data-anexo-url="${escapeAttr(arquivo.dataUrl)}" data-anexo-nome="${escapeAttr(arquivo.nome || label)}">${escapeAttr(label)}</button>`;
    }
    return '';
  }

  function dataUrlParaBlob(dataUrl) {
    const [header, base64] = String(dataUrl || '').split(',');
    const tipo = header.match(/data:([^;]+)/)?.[1] || 'application/pdf';
    const bin = atob(base64 || '');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: tipo });
  }

  async function migrarAnexoBase64ParaIndexedDB(arquivo) {
    if (!arquivo?.dataUrl || arquivo.storage === 'indexedDB') return arquivo || null;
    const id = arquivo.id || genId();
    const blob = dataUrlParaBlob(arquivo.dataUrl);
    const registro = {
      id,
      nome: arquivo.nome || 'anexo.pdf',
      tipo: arquivo.tipo || blob.type || 'application/pdf',
      tamanho: blob.size,
      criadoEm: arquivo.criadoEm || new Date().toLocaleString('pt-BR'),
      atualizadoEm: new Date().toLocaleString('pt-BR'),
      blob
    };

    const db = await abrirBancoAnexos();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(ANEXOS_STORE, 'readwrite');
      tx.objectStore(ANEXOS_STORE).put(registro);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    return {
      id,
      storage: 'indexedDB',
      nome: registro.nome,
      tipo: registro.tipo,
      tamanho: registro.tamanho,
      criadoEm: registro.criadoEm,
      atualizadoEm: registro.atualizadoEm
    };
  }

  async function migrarAnexosBase64ParaIndexedDB() {
    if (!window.indexedDB) return;
    let houveMudancaProcessos = false;
    let houveMudancaIrps = false;

    const processos = loadData();
    for (const processo of processos) {
      for (const publicacao of (Array.isArray(processo.publicacoes) ? processo.publicacoes : [])) {
        const meios = publicacao.meios || {};
        for (const meio of Object.values(meios)) {
          const anexo = await migrarAnexoBase64ParaIndexedDB(meio?.anexo);
          if (meio && anexo !== meio.anexo) { meio.anexo = anexo; houveMudancaProcessos = true; }
        }
      }

      for (const ata of (Array.isArray(processo.atasRegistroPreco) ? processo.atasRegistroPreco : [])) {
        const pdfAta = await migrarAnexoBase64ParaIndexedDB(ata.pdfAta);
        if (pdfAta !== ata.pdfAta) { ata.pdfAta = pdfAta; houveMudancaProcessos = true; }

        const pdfExtrato = await migrarAnexoBase64ParaIndexedDB(ata.pdfExtrato);
        if (pdfExtrato !== ata.pdfExtrato) { ata.pdfExtrato = pdfExtrato; houveMudancaProcessos = true; }

        for (const publicacaoExtrato of (Array.isArray(ata.publicacoesExtrato) ? ata.publicacoesExtrato : [])) {
          const pdf = await migrarAnexoBase64ParaIndexedDB(publicacaoExtrato.pdf);
          if (pdf !== publicacaoExtrato.pdf) { publicacaoExtrato.pdf = pdf; houveMudancaProcessos = true; }
        }

        for (const aditivo of (Array.isArray(ata.aditivos) ? ata.aditivos : [])) {
          const pdf = await migrarAnexoBase64ParaIndexedDB(aditivo.pdf);
          if (pdf !== aditivo.pdf) { aditivo.pdf = pdf; houveMudancaProcessos = true; }
          for (const publicacaoExtrato of (Array.isArray(aditivo.publicacoesExtrato) ? aditivo.publicacoesExtrato : [])) {
            const pubPdf = await migrarAnexoBase64ParaIndexedDB(publicacaoExtrato.pdf);
            if (pubPdf !== publicacaoExtrato.pdf) { publicacaoExtrato.pdf = pubPdf; houveMudancaProcessos = true; }
          }
        }
      }
    }

    let irps = [];
    try { irps = JSON.parse(localStorage.getItem(IRP_STORAGE_KEY) || '[]'); }
    catch (e) { irps = []; }
    for (const irp of irps) {
      const pdfPublicacao = await migrarAnexoBase64ParaIndexedDB(irp.pdfPublicacao);
      if (pdfPublicacao !== irp.pdfPublicacao) { irp.pdfPublicacao = pdfPublicacao; houveMudancaIrps = true; }

      const pdfCiAbertura = await migrarAnexoBase64ParaIndexedDB(irp.pdfCiAbertura);
      if (pdfCiAbertura !== irp.pdfCiAbertura) { irp.pdfCiAbertura = pdfCiAbertura; houveMudancaIrps = true; }
    }

    if (houveMudancaProcessos) saveData(processos);
    if (houveMudancaIrps) localStorage.setItem(IRP_STORAGE_KEY, JSON.stringify(irps));
    if (houveMudancaProcessos || houveMudancaIrps) {
      showToast('Anexos antigos migrados para IndexedDB.');
    }
  }

  if (!window.__anexosIndexedDbHandler) {
    window.__anexosIndexedDbHandler = true;
    document.addEventListener('click', async (event) => {
      const btn = event.target.closest('[data-anexo-id], [data-anexo-url]');
      if (!btn) return;
      event.preventDefault();
      try {
        if (btn.dataset.anexoId) {
          await visualizarAnexoIndexedDB(btn.dataset.anexoId);
        } else if (btn.dataset.anexoUrl) {
          abrirVisualizadorPdf(btn.dataset.anexoUrl, btn.dataset.anexoNome || 'anexo.pdf');
        }
      } catch (error) {
        console.error('Erro ao visualizar anexo:', error);
        alert('Não foi possível visualizar o anexo.');
      }
    });
  }

  setTimeout(() => {
    migrarAnexosBase64ParaIndexedDB().catch(error => {
      console.error('Erro ao migrar anexos para IndexedDB:', error);
    });
  }, 500);


  /* ---------- util: roman numerals 1..50 ---------- */
  function toRoman(n) {
    const map = [
      {v:50,s:'L'},{v:40,s:'XL'},{v:10,s:'X'},{v:9,s:'IX'},{v:5,s:'V'},{v:4,s:'IV'},{v:1,s:'I'}
    ];
    let out='';
    let num = n;
    for (const m of map) {
      while (num >= m.v) { out += m.s; num -= m.v; }
    }
    return out;
  }
  const ROMAN_OPTIONS = Array.from({length:50}, (_,i) => ({n:i+1, r: toRoman(i+1)}));

  /* ---------- util: currency BRL format & parse ---------- */
  function formatBRLDisplay(value) {
    if (value === '' || value === null || value === undefined || Number.isNaN(Number(value))) return '';
    // value is number (e.g., 12345.5)
    const num = Number(value);
    // use Intl for robust formatting but ensure comma decimal
    try {
      return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    } catch (e) {
      // fallback manual
      const s = (num.toFixed(2)).replace('.', ',');
      // thousand separator
      return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }
  }
  function parseBRLToNumber(str) {
    if (str === null || str === undefined) return null;
    const s = String(str).trim();
    if (!s) return null;
    // remove thousand separators and convert comma to dot
    const cleaned = s.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g,'');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  /* ---------- initLicitatorios (UI) ---------- */
  function initLicitatorios(container) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) throw new Error('Container inválido');

    container.innerHTML = `
      <section class="wrap">
        <header style="display:flex;flex-direction:column;gap:12px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <h2 style="margin:0 0 6px 0">Processos Licitatórios</h2>
              <div class="muted">Cadastre e gerencie processos</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;position:relative">
              <div id="lic_import_wrapper" style="position:relative">
                <button id="lic_import" class="btn">📥 Importar ▾</button>
                <!-- Submenu escondido -->
                <div id="lic_import_menu" style="display:none;position:absolute;right:0;top:42px;background:var(--panel,#fff);border:1px solid var(--line,#e5e9f2);border-radius:8px;box-shadow:var(--shadow,0 6px 20px rgba(0,0,0,0.08));padding:8px;min-width:160px;z-index:50">
                  <button class="btn" id="lic_import_json">Importar JSON</button>
                  <button class="btn" id="lic_import_etiqueta">Importar Etiqueta</button>

                </div>
              </div>
              <button id="lic_export" class="btn">📤 Exportar</button>
              <button id="lic_add" class="btn primary">＋ Novo processo</button>
              <input type="file" id="lic_file_input" accept="application/json" style="display:none">
              <input type="file" id="lic_etiqueta_input" accept=".txt,text/plain" multiple style="display:none">
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <input id="lic_filter_geral" class="input" placeholder="Buscar por qualquer informação do processo" style="flex:1;min-width:280px">
            <select id="lic_filter_secretaria" class="select" style="max-width:220px">
              <option value="">Todas as secretarias</option>
              ${SECRETARIAS.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
            <select id="lic_filter_tipo_protocolo" class="select" style="max-width:240px">
              <option value="">Todos os tipos</option>
              ${loadTiposProtocolo().filter(t => t.ativo !== false).map(t => `<option value="${t.nome}">${t.nome}</option>`).join('')}
            </select>
            <select id="lic_filter_assunto_protocolo" class="select" style="max-width:260px">
              <option value="">Todos os assuntos</option>
            </select>
            <select id="lic_filter_registro_precos" class="select" style="max-width:190px">
              <option value="">Registro de Preços</option>
              <option value="sim">SIM</option>
              <option value="nao">NÃO</option>
            </select>
            <button id="lic_delete_selected" class="btn" style="background:var(--danger,#d33);border-color:var(--danger,#d33);color:#fff" disabled>🗑 Excluir selecionados</button>
          </div>
        </header>

        <div class="card" style="overflow:auto">
          <table id="lic_tbl">
            <thead>
              <tr>
                <th class="select-col">
                  <label class="select-all-label">
                    <input type="checkbox" id="lic_select_all">
                    Selecionar tudo
                  </label>
                </th>
                <th>N° PROCESSO</th>
                <th>OBJETO</th>
                <th>SECRETARIA</th>
                <th>DATA DE CRIAÇÃO</th>
                <th></th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
          <div id="lic_empty" class="empty">0–0 de 0</div>
        </div>
      </section>

      <!-- Modais (cadastro + edição) -->
      <dialog id="lic_dlg" style="min-width:480px">
        <div class="modal-head">
          <strong id="lic_title">Novo processo</strong>
          <button id="lic_close" class="btn ghost">Fechar</button>
        </div>
        <div class="modal-body">
          <form id="lic_form">
            <input type="hidden" id="lic_idx">
            <input type="hidden" id="lic_interessado_original">
<div class="tabs">
  <button type="button" class="tab active" data-tab="geral">GERAL</button>
  <button type="button" class="tab" data-tab="tipo">TIPO DE PROCESSO</button>
  <button type="button" class="tab" data-tab="demais">DEMAIS INFORMAÇÕES</button>
  <button type="button" class="tab" data-tab="publicacoes">PUBLICAÇÕES</button>
  <button type="button" class="tab" data-tab="situacao">SITUAÇÃO DO PROCESSO</button>
</div>

    <div class="tab-content active" id="tab-geral">
    <div class="grid">
        <div class="field">
              <label>N° do processo</label>
              <input id="lic_numero" class="input" required placeholder="22164/2024">
        </div>

        <div class="field">
              <label>Data de criação</label>
              <input id="lic_dataCriacao" class="input" type="text" placeholder="15/05/2023" required>
        </div>

        <div class="field" style="grid-column:1/-1">
              <label>Objeto</label>
              <input id="lic_objeto" class="input" placeholder="Objeto do processo">
        </div>

        <div class="field">
              <label>Secretaria</label>
              <select id="lic_secretaria" class="select">
              <option value="">-- selecione --</option>
              ${SECRETARIAS.map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
              <button type="button" id="lic_assoc_secretaria" class="btn" style="margin-top:6px;display:none">Associar interessado à secretaria</button>
        </div>

        <div class="field" style="grid-column:1/-1">
              <label>Descrição completa do objeto</label>
              <textarea id="lic_descricaoCompleta" class="input" rows="4" placeholder="Descrição completa..."></textarea>
        </div>

        <div class="field">
              <label>Volumes</label>
              <select id="lic_volumes" class="select">
              <option value="">-- --</option>
              ${ROMAN_OPTIONS.map(o=>`<option value="${o.n}">${o.r} (${o.n})</option>`).join('')}
              </select>
        </div>

        <div class="field" style="grid-column:1/-1">
              <label>Observação</label>
              <textarea id="lic_observacao" class="input" rows="3" placeholder="Observações..."></textarea>
        </div>

    </div>
    </div>




<div class="tab-content" id="tab-tipo">

<div class="grid">

<div class="field" style="grid-column:1/-1">
<label>Tipo de Protocolo</label>

<select id="lic_tipo_processo" class="select">
<option value="">-- selecione --</option>
${loadTiposProtocolo().filter(t => t.ativo !== false).map(t => `<option value="${t.nome}">${t.nome}</option>`).join('')}
<option value="OUTROS">OUTROS</option>
</select>
</div>

<div class="field" id="novo_tipo_protocolo_container" style="grid-column:1/-1;display:none">
<label>Novo Tipo de Protocolo</label>
<input id="lic_novo_tipo_protocolo" class="input" placeholder="EX: NOTIFICAÇÃO">
</div>

<div class="field" id="natureza_processo_container" style="grid-column:1/-1;display:none">
<label>Natureza</label>
<select id="lic_natureza_processo" class="select">
<option value="">-- selecione --</option>
<option value="NORMAL">NORMAL</option>
<option value="REGISTRO DE PREÇO">REGISTRO DE PREÇO</option>
<option value="CREDENCIAMENTO">CREDENCIAMENTO</option>
<option value="ADESÃO">ADESÃO</option>
<option value="CONTRATA MAIS BRASIL">CONTRATA MAIS BRASIL</option>
</select>
</div>

<div class="field" id="assunto_protocolo_container" style="grid-column:1/-1;display:none">
<label>Tipo de Objeto</label>
<select id="lic_assunto_protocolo" class="select">
<option value="">-- selecione --</option>
</select>
</div>

<div class="field" id="novo_assunto_protocolo_container" style="grid-column:1/-1;display:none">
<label>Novo Tipo de Objeto</label>
<input id="lic_novo_assunto_protocolo" class="input" placeholder="EX: SOLICITAÇÃO DE CERTIFICADO DIGITAL">
</div>

<div class="field" id="registro_precos_protocolo_container" style="grid-column:1/-1;display:none">
<label>Registro de Preços</label>
<select id="lic_registro_precos" class="select">
<option value="">-- selecione --</option>
<option value="sim">SIM</option>
<option value="nao">NÃO</option>
</select>
</div>

</div>


<div id="tipo_licitacao_campos" style="display:none">

<div class="grid">

<div class="field" style="display:none">
<label>Modalidade</label>

<select class="select" id="lic_tipo_modalidade">
<option value="">-- selecione --</option>
<option value="pregao">Pregão</option>
<option value="concorrencia">Concorrência</option>
<option value="leilao">Leilão</option>
<option value="concurso">Concurso</option>
</select>

</div>

<div id="registro_preco_tipo" style="display:none">

<div id="irp_registro_container" style="display:none;margin-top:12px">
<label>Intenção de Registro de Preço</label>
<select id="lic_irp_registro_preco" class="select">
<option value="">-- selecione uma IRP cadastrada --</option>
</select>
<div class="muted" style="font-size:12px;margin-top:6px">Selecione a IRP vinculada a este processo gerador.</div>
</div>

<div id="atas_registro_container" style="display:none;margin-top:12px">
<label>Atas de Registro de Preço</label>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
<button type="button" id="lic_atas_add" class="btn">+ Incluir Ata</button>
<button type="button" id="lic_atas_view" class="btn" onclick="event.preventDefault(); event.stopPropagation(); window.__visualizarAtasProcesso?.();">Visualizar Atas</button>
</div>
<div id="lic_atas_status" class="muted" style="font-size:12px;margin-top:6px">Nenhuma ata cadastrada.</div>
<div id="lic_atas_preview" style="margin-top:8px;display:none;overflow:auto;max-height:220px"></div>
<div id="lic_ata_inline_panel" class="card" style="display:none;position:fixed;top:4vh;left:50%;transform:translateX(-50%);width:min(920px,94vw);max-height:90vh;overflow:auto;z-index:10050;background:#fff;padding:16px;border:1px solid var(--border,#dbe3ef);box-shadow:0 24px 80px rgba(15,23,42,.28);margin:0">
<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">
<strong id="lic_ata_inline_titulo">Nova Ata de Registro de Preço</strong>
<button type="button" id="lic_ata_inline_close" class="btn">Fechar</button>
</div>
<input type="hidden" id="lic_ata_inline_idx">
<div class="grid">
<div class="field"><label>N°</label><input id="lic_ata_inline_numero" class="input"></div>
<div class="field"><label>ANO</label><input id="lic_ata_inline_ano" class="input" inputmode="numeric" maxlength="4"></div>
<div class="field" style="grid-column:1/-1"><label>UNIDADE ORÇAMENTÁRIA</label><input id="lic_ata_inline_unidade" class="input"></div>
<div class="field" style="grid-column:1/-1"><label>OBJETO</label><textarea id="lic_ata_inline_objeto" class="input" rows="3"></textarea></div>
<div class="field" style="grid-column:1/-1"><label>OBJETO RESUMIDO</label><input id="lic_ata_inline_objeto_resumido" class="input"></div>
<div class="field"><label>MODALIDADE</label><input id="lic_ata_inline_modalidade" class="input"></div>
<div class="field"><label>DATA DE ASSINATURA</label><input id="lic_ata_inline_assinatura" class="input" placeholder="DD/MM/AAAA" maxlength="10"></div>
<div class="field"><label>INÍCIO DA VIGÊNCIA</label><input id="lic_ata_inline_vig_inicio" class="input" placeholder="DD/MM/AAAA" maxlength="10"></div>
<div class="field"><label>TÉRMINO DA VIGÊNCIA</label><input id="lic_ata_inline_vig_fim" class="input" placeholder="DD/MM/AAAA" maxlength="10"></div>
<div class="field" style="grid-column:1/-1"><label>LINK PNCP</label><input id="lic_ata_inline_pncp" class="input" type="url" placeholder="https://..."></div>
<div class="field"><label>CNPJ DO FORNECEDOR</label><input id="lic_ata_inline_cnpj" class="input" placeholder="00.000.000/0000-00"></div>
<div class="field"><label>RAZÃO SOCIAL DO FORNECEDOR</label><input id="lic_ata_inline_fornecedor" class="input"></div>
<div class="field" style="grid-column:1/-1"><label>NOME FANTASIA DO FORNECEDOR</label><input id="lic_ata_inline_fantasia" class="input"></div>
<div class="field"><label>PDF DA ATA</label><input id="lic_ata_inline_pdf" class="input" type="file" accept="application/pdf,.pdf"><div id="lic_ata_inline_pdf_status" class="muted" style="font-size:12px;margin-top:4px"></div></div>
<div class="field"><label>PDF DO EXTRATO NO DIÁRIO OFICIAL</label><input id="lic_ata_inline_pdf_extrato" class="input" type="file" accept="application/pdf,.pdf"><div id="lic_ata_inline_pdf_extrato_status" class="muted" style="font-size:12px;margin-top:4px"></div></div>
<div class="field" style="grid-column:1/-1">
<label>Itens da Ata</label>
<div style="display:flex;gap:8px;flex-wrap:wrap">
<button type="button" id="lic_ata_inline_import_itens" class="btn">Importar TXT de Itens</button>
<button type="button" id="lic_ata_inline_select_irp" class="btn">Selecionar itens da IRP</button>
<button type="button" id="lic_ata_inline_limpar_itens" class="btn">Limpar Itens</button>
<input id="lic_ata_inline_itens_file" type="file" accept=".txt,text/plain,.tsv" style="display:none">
</div>
<div id="lic_ata_inline_itens_status" class="muted" style="font-size:12px;margin-top:6px">Nenhum item importado.</div>
<div id="lic_ata_inline_itens_preview" style="margin-top:8px;display:none;overflow:auto;max-height:220px"></div>
<div id="lic_ata_inline_irp_selector" class="card" style="display:none;box-shadow:none;margin-top:10px;padding:10px">
<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">
<strong>Itens da IRP vinculada</strong>
<button type="button" id="lic_ata_inline_irp_cancel" class="btn">Fechar seleção</button>
</div>
<div id="lic_ata_inline_irp_selector_status" class="muted" style="font-size:12px;margin-bottom:8px"></div>
<div id="lic_ata_inline_irp_selector_lista" style="overflow:auto;max-height:300px"></div>
<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">
<button type="button" id="lic_ata_inline_irp_select_all" class="btn">Selecionar todos</button>
<button type="button" id="lic_ata_inline_irp_apply" class="btn primary">Usar itens selecionados</button>
</div>
</div>
</div>
</div>
<div class="modal-actions">
<button type="button" id="lic_ata_inline_cancel" class="btn">Cancelar</button>
<button type="button" id="lic_ata_inline_save" class="btn primary">Salvar ata</button>
</div>
</div>
</div>

<div id="adesao_tipo_container" style="display:none;margin-top:12px">
<label>Tipo de Adesão</label>
<div class="opcoes-registro">
<label class="opcao-card">
<input type="radio" name="tipo_adesao_registro" value="interna">
<span>Adesão Interna</span>
</label>
<label class="opcao-card">
<input type="radio" name="tipo_adesao_registro" value="externa">
<span>Adesão Externa</span>
</label>
</div>
</div>

<div id="processo_gerador_container" style="display:none;margin-top:10px">

<div class="grid">

<div class="field" id="processo_gerador_vinculo" style="grid-column:1/-1">
<label>Referente ao processo gerador da ata</label>
<select id="lic_processo_gerador" class="select">
<option value="">-- selecione o processo --</option>
</select>
</div>

<div class="field" style="grid-column:1/-1">
<label>ATA</label>
<select id="lic_ata_vinculada" class="select">
<option value="">-- selecione a ata cadastrada --</option>
</select>
</div>

<div class="field" style="grid-column:1/-1">
<label>Fornecedor</label>
<input id="lic_fornecedor" class="input" placeholder="Empresa LTDA" readonly>
</div>

<div class="field">
<label>CNPJ</label>
<input id="lic_cnpj" class="input" placeholder="00.000.000/0000-00" readonly>
</div>

<div class="field" style="grid-column:1/-1">
<label>Pessoa Vinculada</label>
<div style="display:flex;gap:8px;flex-wrap:wrap">
<select id="lic_pessoa_vinculada" class="select" style="flex:1;min-width:260px">
<option value="">-- nenhuma pessoa vinculada --</option>
</select>
<button type="button" id="lic_add_pessoa_vinculada" class="btn">+ Cadastrar pessoa</button>
</div>
<div id="lic_pessoa_vinculada_status" class="muted" style="font-size:12px;margin-top:6px">Informe o CNPJ para carregar pessoas vinculadas.</div>
</div>

</div>
</div> <!-- processo_gerador_container -->

</div> <!-- registro_preco_tipo -->

</div> <!-- grid -->

</div> <!-- tipo_licitacao_campos -->

<div id="credenciamento_campos" style="display:none;margin-top:12px">

<div class="grid">

<div class="field" style="grid-column:1/-1">
<label>Tipo de Credenciamento</label>
<select id="lic_cred_tipo" class="select">
<option value="">-- selecione --</option>
<option value="principal">Processo de Credenciamento</option>
<option value="contratacao">Processo de Contratação</option>
</select>
</div>

<div class="field" id="cred_numero_container">
<label>Nº/Ano do Credenciamento</label>
<input id="lic_cred_numero" class="input" placeholder="01/2026">
</div>

<div id="cred_itens_container" style="grid-column:1/-1">
<div class="field">
<label>Itens do Edital</label>
<div style="display:flex;gap:8px;flex-wrap:wrap">
<button type="button" id="lic_cred_import_itens" class="btn">Importar TXT de Itens</button>
<button type="button" id="lic_cred_limpar_itens" class="btn">Limpar itens</button>
</div>
<input type="file" id="lic_cred_itens_file" accept=".txt,.tsv" style="display:none">
<div id="lic_cred_itens_status" class="muted" style="font-size:12px;margin-top:6px">Nenhum item importado.</div>
<div id="lic_cred_itens_preview" style="margin-top:8px;display:none;overflow:auto;max-height:220px"></div>
</div>
</div>

<div class="field" id="cred_principal_container" style="grid-column:1/-1;display:none">
<label>Pertence ao Credenciamento</label>
<select id="lic_cred_principal" class="select">
<option value="">-- selecione o credenciamento --</option>
</select>
</div>

<div id="cred_contratacao_campos" style="grid-column:1/-1;display:none">
<div class="grid">
<div class="field">
<label>CNPJ do Credenciado</label>
<input id="lic_cred_cnpj" class="input" placeholder="00.000.000/0000-00">
</div>
<div class="field" style="grid-column:1/-1">
<label>Razão Social</label>
<input id="lic_cred_razao" class="input" placeholder="CLÍNICA MÉDICA LIFE LTDA">
</div>
<div class="field" style="grid-column:1/-1">
<label>Nome Fantasia</label>
<input id="lic_cred_fantasia" class="input" placeholder="CLÍNICA LIFE">
</div>
<div class="field" style="grid-column:1/-1">
<label>Pessoa Vinculada</label>
<div style="display:flex;gap:8px;flex-wrap:wrap">
<select id="lic_cred_pessoa_vinculada" class="select" style="flex:1;min-width:260px">
<option value="">-- nenhuma pessoa vinculada --</option>
</select>
<button type="button" id="lic_cred_add_pessoa_vinculada" class="btn">+ Cadastrar pessoa</button>
</div>
<div id="lic_cred_pessoa_vinculada_status" class="muted" style="font-size:12px;margin-top:6px">Informe o CNPJ para carregar pessoas vinculadas.</div>
</div>
<div class="field" style="grid-column:1/-1">
<label>Itens da Contratação</label>
<div style="display:flex;gap:8px;flex-wrap:wrap">
<button type="button" id="lic_cred_select_itens" class="btn">Selecionar itens</button>
<button type="button" id="lic_cred_limpar_itens_contratacao" class="btn">Limpar itens selecionados</button>
</div>
<div id="lic_cred_itens_contratacao_status" class="muted" style="font-size:12px;margin-top:6px">Nenhum item selecionado.</div>
<div id="lic_cred_itens_contratacao_preview" style="margin-top:8px;display:none;overflow:auto;max-height:220px"></div>
</div>
</div>
</div>

</div>

</div>

</div> <!-- tab-tipo -->




<div class="tab-content" id="tab-demais">

<div class="fases-config-card">
<div>
<strong>Fases deste processo</strong>
<div class="muted" style="font-size:12px;margin-top:4px">Adicione apenas os blocos que serão utilizados neste processo.</div>
</div>
<div class="fases-add-row">
<select id="lic_fase_add_select" class="select">
<option value="">-- selecione uma fase --</option>
</select>
<button type="button" id="lic_fase_add_btn" class="btn">+ Adicionar fase</button>
</div>
<div id="lic_fases_ativas" class="fases-ativas-list"></div>
</div>

<div class="fase-bloco fechado" data-etapa="sd">

<div class="fase-titulo" data-fase="sd">
<span>SOLICITAÇÃO DE DEMANDA</span>
<span class="fase-acoes"><label class="etapa-check" title="Marcar etapa como concluída"><input type="checkbox" data-etapa-check="sd"><span></span></label><span class="fase-toggle">▼</span></span>
</div>

<div class="fase-conteudo" id="fase-sd">

<div class="grid">

<div class="field">
<label>N° SD</label>
<input id="lic_sd_numero" class="input" placeholder="001/2025">
</div>

<div class="field" style="grid-column:1/-1">
<label>Unidade Demandante</label>
<input id="lic_sd_unidade" class="input" placeholder="Unidade responsável">
</div>

<div class="field">
<label>Elaborado por</label>
<input id="lic_sd_elaborado" class="input" placeholder="Responsável">
</div>

<div class="field">
<label>Fonte de Recurso</label>

<div style="display:flex;gap:12px">

<label><input type="checkbox" id="lic_sd_rec_municipal"> Municipal</label>
<label><input type="checkbox" id="lic_sd_rec_estadual"> Estadual</label>
<label><input type="checkbox" id="lic_sd_rec_federal"> Federal</label>

</div>

</div>

<div class="field">
<label>Ficha</label>
<input id="lic_sd_ficha" class="input" placeholder="2378">
</div>

<div class="field">
<label>Sub Elemento</label>
<input id="lic_sd_sub_elemento" class="input" placeholder="3.3.90.39.00">
</div>

<div class="field">
<label>Instrumento Vinculativo</label>
<input id="lic_sd_instrumento" class="input" placeholder="Autorização de Fornecimento">
</div>

<div class="field">
<label>Autoridade Competente</label>
<input id="lic_sd_autoridade" class="input" placeholder="Responsável">
</div>

</div>   <!-- grid -->
</div>   <!-- fase-conteudo -->
</div>   <!-- fase-bloco -->



<div class="fase-bloco fechado" data-etapa="etp">

<div class="fase-titulo">
<span>ESTUDO TÉCNICO PRELIMINAR</span>
<span class="fase-acoes"><label class="etapa-check" title="Marcar etapa como concluída"><input type="checkbox" data-etapa-check="etp"><span></span></label><span class="fase-toggle">▼</span></span>
</div>

<div class="fase-conteudo">

<div class="grid">

<div class="field">
<label>Elaborado por</label>
<input id="lic_etp_elaborado" class="input" placeholder="Responsável">
</div>

<div class="field">
<label>Forma da contratação</label>
<select id="lic_etp_forma" class="select">
<option value="">-- selecione --</option>
<option value="eletronica">Eletrônica</option>
<option value="presencial">Presencial</option>
</select>
</div>

<div class="field">
<label>Quantidade de itens</label>

<div style="display:flex;gap:8px">

<input id="lic_etp_qtd_itens" class="input" type="number" min="1" style="max-width:120px">

<button type="button" id="lic_btn_itens" class="btn">
Ver Itens
</button>

</div>

</div>


<div class="field">
<label>Metodologia</label>
<select id="lic_etp_metodologia" class="select">
<option value="">-- selecione --</option>
<option value="media">Média</option>
<option value="mediana">Mediana</option>
<option value="menor">Menor preço</option>
<option value="maior">Maior preço</option>
</select>
</div>

<div class="field">
<label>Valor estimado</label>
<input id="lic_etp_valor_estimado" class="input" placeholder="0,00">
</div>

</div>

</div>
</div>



<div class="fase-bloco fechado" data-etapa="requisicao">

<div class="fase-titulo">
<span>REQUISIÇÃO</span>
<span class="fase-acoes"><label class="etapa-check" title="Marcar etapa como concluída"><input type="checkbox" data-etapa-check="requisicao"><span></span></label><span class="fase-toggle">▼</span></span>
</div>

<div class="fase-conteudo">

<div id="req_container"></div>

<div style="margin-top:10px">

<label>Inserir outra requisição?</label>

<select id="lic_req_add" class="select">
<option value="nao">Não</option>
<option value="sim">Sim</option>
</select>

</div>

</div>
</div>



<div class="fase-bloco fechado" data-etapa="cotacao">

<div class="fase-titulo">
<span>COTAÇÃO</span>
<span class="fase-acoes"><label class="etapa-check" title="Marcar etapa como concluída"><input type="checkbox" data-etapa-check="cotacao"><span></span></label><span class="fase-toggle">▼</span></span>
</div>

<div class="fase-conteudo">

<div class="grid">

<div class="field">
<label>Realizada por</label>
<input id="lic_cot_realizado" class="input" placeholder="Ex: Marcio">
</div>

</div>

<!-- PESQUISAS / ITENS -->
<div style="margin-top:14px">
<strong>ITENS COTADOS</strong>
</div>

<div id="cot_container" style="margin-top:10px"></div>

<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
<button type="button" id="btnAbrirCotacaoItens" class="btn">Abrir itens da cotação</button>
</div>

<!-- RESULTADOS -->
<div class="grid" style="margin-top:14px">

<div class="field">
<label>Tipo de cálculo</label>
<select id="lic_cot_tipo" class="select">
<option value="media">Média</option>
<option value="mediana">Mediana</option>
<option value="menor_preco">Menor Preço</option>
<option value="maior_preco">Maior Preço</option>
</select>
</div>

<div class="field">
<label>Resultado da Cotação</label>
<input id="lic_cot_media" class="input" readonly>
</div>

<div class="field" style="display:none">
<label>Quantidade</label>
<input id="lic_cot_qtd" class="input" type="number">
</div>

<div class="field" style="display:none">
<label>Valor total</label>
<input id="lic_cot_total" class="input" readonly>
</div>

<div class="field">
<label>Quadro de cotação</label>
<input id="lic_cot_quadro" class="input" placeholder="Ex: 508/25">
</div>

</div>

</div>
</div>



<div class="fase-bloco fechado" data-etapa="tr">

<div class="fase-titulo">
<span>TERMO DE REFERÊNCIA</span>
<span class="fase-acoes"><label class="etapa-check" title="Marcar etapa como concluída"><input type="checkbox" data-etapa-check="tr"><span></span></label><span class="fase-toggle">▼</span></span>
</div>

<div class="fase-conteudo">

<div class="grid">

<div class="field">
<label>Elaborado por</label>
<input id="lic_tr_elaborado" class="input" placeholder="Responsável">
</div>

<div class="field">
<label>Aprovador por</label>
<input id="lic_tr_aprovador" class="input" placeholder="Autoridade competente">
</div>

</div>

<div style="margin-top:14px">

<strong style="font-size:14px">CRITÉRIO DE SELEÇÃO DO FORNECEDOR</strong>

</div>

<div class="grid" style="margin-top:10px">

<div class="field" style="grid-column:1/-1">
<label>OBSERVAÇÃO</label>
<input id="lic_tr_obs" class="input" placeholder="Ex: Licitação será dividida em um único item">
</div>

<div class="field">
<label>Forma de Contratação / Modalidade</label>
<select id="lic_tr_modalidade" class="select">
<option value="">-- selecione --</option>
<option value="Pregão">Pregão</option>
<option value="Concorrência">Concorrência</option>
<option value="Concurso">Concurso</option>
<option value="Leilão">Leilão</option>
<option value="Dispensa de Licitação">Dispensa de Licitação</option>
<option value="Inexigibilidade">Inexigibilidade</option>
</select>
</div>

<div class="field">
<label>Fundamentado</label>
<input id="lic_tr_fundamento" class="input" placeholder="Art. 75, inciso II">
</div>

<div class="field">
<label>Critério de julgamento</label>
<select id="lic_tr_criterio" class="select">
<option value="">-- selecione --</option>
<option value="MENOR PREÇO UNITÁRIO">MENOR PREÇO UNITÁRIO</option>
<option value="MENOR PREÇO GLOBAL">MENOR PREÇO GLOBAL</option>
<option value="TÉCNICA E PREÇO">TÉCNICA E PREÇO</option>
<option value="TÉCNICA E PREÇO GLOBAL">TÉCNICA E PREÇO GLOBAL</option>
<option value="MAIOR DESCONTO">MAIOR DESCONTO</option>
<option value="MAIOR DESCONTO GLOBAL">MAIOR DESCONTO GLOBAL</option>
<option value="MENOR ACRÉSCIMO">MENOR ACRÉSCIMO</option>
<option value="MENOR ACRÉSCIMO GLOBAL">MENOR ACRÉSCIMO GLOBAL</option>
<option value="MAIOR PREÇO UNITÁRIO">MAIOR PREÇO UNITÁRIO</option>
<option value="MAIOR PREÇO GLOBAL">MAIOR PREÇO GLOBAL</option>
<option value="MELHOR TÉCNICA">MELHOR TÉCNICA</option>
<option value="MELHOR TÉCNICA GLOBAL">MELHOR TÉCNICA GLOBAL</option>
</select>
</div>

<div class="field">
<label>Regime de execução</label>
<input id="lic_tr_regime" class="input" placeholder="Unitário">
</div>

</div>

<div class="grid" style="margin-top:14px">

<div class="field">
<label>Unidade Orçamentária</label>
<input id="lic_tr_unidade" class="input" placeholder="77 - SEPRAD">
</div>

<div class="field">
<label>Valor estimado</label>
<input id="lic_tr_valor_estimado" class="input" placeholder="0,00">
</div>

</div>

</div>
</div>


<div class="fase-bloco fechado" data-etapa="edital">

<div class="fase-titulo">
<span>EDITAL</span>
<span class="fase-acoes"><label class="etapa-check" title="Marcar etapa como concluída"><input type="checkbox" data-etapa-check="edital"><span></span></label><span class="fase-toggle">▼</span></span>
</div>

<div class="fase-conteudo">

<div class="grid">

<div class="field">
<label>Forma de Contratação</label>
<select id="lic_edital_forma" class="select">
<option value="">-- selecione --</option>
<option value="PREGÃO ELETRÔNICO">PREGÃO ELETRÔNICO</option>
<option value="PREGÃO PRESENCIAL">PREGÃO PRESENCIAL</option>
<option value="CONCORRÊNCIA ELETRÔNICA">CONCORRÊNCIA ELETRÔNICA</option>
<option value="CONCORRÊNCIA PRESENCIAL">CONCORRÊNCIA PRESENCIAL</option>
<option value="CONCURSO">CONCURSO</option>
<option value="LEILÃO ELETRÔNICO">LEILÃO ELETRÔNICO</option>
<option value="LEILÃO PRESENCIAL">LEILÃO PRESENCIAL</option>
<option value="CREDENCIAMENTO">CREDENCIAMENTO</option>
</select>
</div>

<div class="field">
<label>Número</label>
<input id="lic_edital_numero" class="input" placeholder="Ex: 16/2025">
</div>

<div class="field">
<label>Valor estimado</label>
<input id="lic_edital_valor_estimado" class="input" placeholder="0,00">
</div>

<div class="field">
<label>Critério de julgamento</label>
<select id="lic_edital_criterio" class="select">
<option value="">-- selecione --</option>
<option value="MENOR PREÇO UNITÁRIO">MENOR PREÇO UNITÁRIO</option>
<option value="MENOR PREÇO GLOBAL">MENOR PREÇO GLOBAL</option>
<option value="TÉCNICA E PREÇO">TÉCNICA E PREÇO</option>
<option value="TÉCNICA E PREÇO GLOBAL">TÉCNICA E PREÇO GLOBAL</option>
<option value="MAIOR DESCONTO">MAIOR DESCONTO</option>
<option value="MAIOR DESCONTO GLOBAL">MAIOR DESCONTO GLOBAL</option>
<option value="MENOR ACRÉSCIMO">MENOR ACRÉSCIMO</option>
<option value="MENOR ACRÉSCIMO GLOBAL">MENOR ACRÉSCIMO GLOBAL</option>
<option value="MAIOR PREÇO UNITÁRIO">MAIOR PREÇO UNITÁRIO</option>
<option value="MAIOR PREÇO GLOBAL">MAIOR PREÇO GLOBAL</option>
<option value="MELHOR TÉCNICA">MELHOR TÉCNICA</option>
<option value="MELHOR TÉCNICA GLOBAL">MELHOR TÉCNICA GLOBAL</option>
</select>
</div>

<div class="field">
<label>Modo de disputa</label>
<select id="lic_edital_modo_disputa" class="select">
<option value="">-- selecione --</option>
<option value="ABERTO">ABERTO</option>
<option value="FECHADO">FECHADO</option>
<option value="ABERTO E FECHADO">ABERTO E FECHADO</option>
<option value="FECHADO E ABERTO">FECHADO E ABERTO</option>
<option value="NÃO SE APLICA">NÃO SE APLICA</option>
</select>
</div>

<div class="field">
<label>Data da sessão</label>
<input id="lic_edital_data_sessao" class="input" placeholder="DD/MM/AAAA">
</div>

<div class="field">
<label>Horário inicial da sessão (horário de Brasília)</label>
<input id="lic_edital_hora_sessao_inicio" class="input" placeholder="HH:MM">
</div>

<div class="field">
<label>Horário final da sessão (horário de Brasília)</label>
<input id="lic_edital_hora_sessao_fim" class="input" placeholder="HH:MM">
</div>

<div class="field">
<label>Data de início de recebimento de propostas</label>
<input id="lic_edital_data_inicio" class="input" placeholder="DD/MM/AAAA">
</div>

<div class="field">
<label>Horário de início (horário de Brasília)</label>
<input id="lic_edital_hora_inicio" class="input" placeholder="HH:MM">
</div>

<div class="field">
<label>Data fim de recebimento de propostas</label>
<input id="lic_edital_data_fim" class="input" placeholder="DD/MM/AAAA">
</div>

<div class="field">
<label>Horário fim (horário de Brasília)</label>
<input id="lic_edital_hora_fim" class="input" placeholder="HH:MM">
</div>

<div class="field" style="grid-column:1/-1">
<label>Observação</label>
<textarea id="lic_edital_obs" class="input" rows="3"></textarea>
</div>

</div>

</div>
</div>


<div class="fase-bloco fechado" data-etapa="licitacao">

<div class="fase-titulo">
<span>LICITAÇÃO</span>
<span class="fase-acoes"><label class="etapa-check" title="Marcar etapa como concluída"><input type="checkbox" data-etapa-check="licitacao"><span></span></label><span class="fase-toggle">▼</span></span>
</div>

<div class="fase-conteudo">

<div class="grid">

<div class="field" style="grid-column:1/-1">
<label>Pregoeiro</label>
<input id="lic_licitacao_pregoeiro" class="input" list="lic_pregoeiros_lista" placeholder="Digite o nome do pregoeiro">
<datalist id="lic_pregoeiros_lista"></datalist>
</div>

<div class="field" style="grid-column:1/-1">
<label>Observação</label>
<textarea id="lic_licitacao_obs" class="input" rows="3"></textarea>
</div>

</div>

</div>
</div>

<div class="fase-bloco fechado" data-etapa="aviso_contratacao_direta">

<div class="fase-titulo">
<span>AVISO DE CONTRATAÇÃO DIRETA</span>
<span class="fase-acoes"><label class="etapa-check" title="Marcar etapa como concluída"><input type="checkbox" data-etapa-check="aviso_contratacao_direta"><span></span></label><span class="fase-toggle">▼</span></span>
</div>

<div class="fase-conteudo">

<div class="grid">

<div class="field">
<label>Forma de Contratação</label>
<select id="lic_aviso_cd_forma" class="select">
<option value="">-- selecione --</option>
<option value="DISPENSA ELETRÔNICA">DISPENSA ELETRÔNICA</option>
<option value="DISPENSA TRADICIONAL">DISPENSA TRADICIONAL</option>
</select>
</div>

<div class="field">
<label>Número</label>
<input id="lic_aviso_cd_numero" class="input" placeholder="Ex: 16/2025">
</div>

<div class="field">
<label>Agente de Contratação</label>
<input id="lic_aviso_cd_agente" class="input" placeholder="Digite o nome do agente de contratação">
</div>

<div class="field">
<label>Valor estimado</label>
<input id="lic_aviso_cd_valor_estimado" class="input" placeholder="0,00">
</div>

<div class="field">
<label>Critério de julgamento</label>
<select id="lic_aviso_cd_criterio" class="select">
<option value="">-- selecione --</option>
<option value="MENOR PREÇO UNITÁRIO">MENOR PREÇO UNITÁRIO</option>
<option value="MENOR PREÇO GLOBAL">MENOR PREÇO GLOBAL</option>
<option value="TÉCNICA E PREÇO">TÉCNICA E PREÇO</option>
<option value="TÉCNICA E PREÇO GLOBAL">TÉCNICA E PREÇO GLOBAL</option>
<option value="MAIOR DESCONTO">MAIOR DESCONTO</option>
<option value="MAIOR DESCONTO GLOBAL">MAIOR DESCONTO GLOBAL</option>
<option value="MENOR ACRÉSCIMO">MENOR ACRÉSCIMO</option>
<option value="MENOR ACRÉSCIMO GLOBAL">MENOR ACRÉSCIMO GLOBAL</option>
<option value="MAIOR PREÇO UNITÁRIO">MAIOR PREÇO UNITÁRIO</option>
<option value="MAIOR PREÇO GLOBAL">MAIOR PREÇO GLOBAL</option>
<option value="MELHOR TÉCNICA">MELHOR TÉCNICA</option>
<option value="MELHOR TÉCNICA GLOBAL">MELHOR TÉCNICA GLOBAL</option>
</select>
</div>

<div class="field">
<label>Data da sessão</label>
<input id="lic_aviso_cd_data_sessao" class="input" placeholder="DD/MM/AAAA">
</div>

<div class="field">
<label>Horário inicial da sessão (horário de Brasília)</label>
<input id="lic_aviso_cd_hora_sessao_inicio" class="input" placeholder="HH:MM">
</div>

<div class="field">
<label>Horário final da sessão (horário de Brasília)</label>
<input id="lic_aviso_cd_hora_sessao_fim" class="input" placeholder="HH:MM">
</div>

<div class="field">
<label>Data de início de recebimento de propostas</label>
<input id="lic_aviso_cd_data_inicio" class="input" placeholder="DD/MM/AAAA">
</div>

<div class="field">
<label>Horário de início (horário de Brasília)</label>
<input id="lic_aviso_cd_hora_inicio" class="input" placeholder="HH:MM">
</div>

<div class="field">
<label>Data fim de recebimento de propostas</label>
<input id="lic_aviso_cd_data_fim" class="input" placeholder="DD/MM/AAAA">
</div>

<div class="field">
<label>Horário fim (horário de Brasília)</label>
<input id="lic_aviso_cd_hora_fim" class="input" placeholder="HH:MM">
</div>

</div>

</div>
</div>

<div class="fase-bloco fechado" data-etapa="resultado">

<div class="fase-titulo">
<span>RESULTADO</span>
<span class="fase-acoes"><label class="etapa-check" title="Marcar etapa como concluída"><input type="checkbox" data-etapa-check="resultado"><span></span></label><span class="fase-toggle">▼</span></span>
</div>

<div class="fase-conteudo">
<div class="grid">
<div class="field">
<label>Valor homologado</label>
<input id="lic_resultado_valor_homologado" class="input" readonly>
</div>
</div>
<div style="margin-top:0">
<strong>ITENS DO RESULTADO</strong>
</div>
<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
<button type="button" id="btnImportResultadoItens" class="btn">Receber itens cadastrados</button>
<button type="button" id="btnLimparResultadoItens" class="btn">Limpar itens</button>
</div>
<div id="resultado_itens_container" style="margin-top:10px"></div>
</div>
</div>

<div class="fase-bloco fechado" data-etapa="homologacao">

<div class="fase-titulo">
<span>HOMOLOGAÇÃO</span>
<span class="fase-acoes"><label class="etapa-check" title="Marcar etapa como concluída"><input type="checkbox" data-etapa-check="homologacao"><span></span></label><span class="fase-toggle">▼</span></span>
</div>

<div class="fase-conteudo">
<div class="grid">
<div class="field">
<label>Valor homologado</label>
<input id="lic_homologacao_valor_homologado" class="input" readonly>
</div>
<div class="field">
<label>Filtrar por situação</label>
<select id="lic_homologacao_filtro_situacao" class="select" data-ignore-etapa-check="true">
<option value="">Todas</option>
<option value="ACEITO">ACEITO</option>
<option value="DESERTO">DESERTO</option>
</select>
</div>
</div>
<div id="homologacao_itens_container" class="homologacao-table-wrap" style="margin-top:10px"></div>
</div>
</div>


</div> <!-- tab-demais -->




<div class="tab-content" id="tab-publicacoes">

<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
<strong>Publicações do processo</strong>
<button type="button" id="lic_pub_add" class="btn">+ Inserir Publicação</button>
</div>

<div id="lic_publicacoes_container" style="display:grid;gap:12px">
<div class="empty">Nenhuma publicação cadastrada.</div>
</div>

<div class="lic-pub-pncp-box">
<label>Publicação no PNCP</label>
<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
<input id="lic_publicacao_pncp_link" class="input" type="url" placeholder="https://..." style="flex:1;min-width:260px">
<a id="lic_publicacao_pncp_abrir" class="btn" href="#" target="_blank" rel="noopener" style="display:none">Abrir PNCP</a>
</div>
<div class="muted" style="font-size:12px;margin-top:6px">Informe aqui o link da publicação no PNCP referente ao processo.</div>
</div>

</div>

<div class="tab-content" id="tab-situacao">

<div class="grid">

<div class="field">
<label>Situação</label>
<input id="lic_situacao" class="input">
</div>

<div class="field">
<label>Fase</label>
<input id="lic_fase" class="input">
</div>

</div>

</div>

      

<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">

<button type="button" id="btnExcluir" class="btn" 
style="background:#c62828;color:#fff;display:none">
Excluir
</button>

<button type="button" id="lic_cancel" class="btn">Cancelar</button>

<button type="submit" id="lic_save" class="btn primary">Salvar</button>

</div>

</form>
</div>
</dialog>

      <dialog id="lic_assoc_dlg" style="min-width:420px">
        <div class="modal-head">
          <strong>Associar interessado</strong>
          <button id="lic_assoc_close" class="btn ghost">Fechar</button>
        </div>
        <div class="modal-body">
          <div class="field" style="margin-bottom:12px">
            <label>Interessado original</label>
            <div id="lic_assoc_interessado" class="card" style="box-shadow:none;padding:10px;font-size:13px"></div>
          </div>
          <div class="field">
            <label>Secretaria correspondente</label>
            <select id="lic_assoc_select" class="select">
              <option value="">-- selecione --</option>
              ${SECRETARIAS.map(s => `<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="modal-foot">
          <button id="lic_assoc_cancel" class="btn">Cancelar</button>
          <button id="lic_assoc_save" class="btn primary">Salvar associação</button>
        </div>
      </dialog>

      <dialog id="lic_cred_select_itens_dlg" style="width:92vw;max-width:1100px">
        <div class="modal-head">
          <strong>Selecionar itens do credenciamento</strong>
          <button id="lic_cred_select_itens_close" class="btn ghost">Fechar</button>
        </div>
        <div class="modal-body">
          <div id="lic_cred_select_itens_body"></div>
        </div>
        <div class="modal-foot">
          <button id="lic_cred_select_itens_cancel" class="btn">Cancelar</button>
          <button id="lic_cred_select_itens_save" class="btn primary">Salvar itens selecionados</button>
        </div>
      </dialog>









      <dialog id="lic_ata_dlg" style="width:min(900px,94vw)">
        <div class="modal-head">
          <strong>Ata de Registro de Preço</strong>
          <button id="lic_ata_close" class="btn ghost">Fechar</button>
        </div>
        <div class="modal-body">
          <form id="lic_ata_form">
            <input type="hidden" id="lic_ata_idx">
            <div class="grid">
              <div class="field"><label>N°</label><input id="lic_ata_rp_numero" class="input" required></div>
              <div class="field"><label>ANO</label><input id="lic_ata_rp_ano" class="input" required></div>
              <div class="field" style="grid-column:1/-1"><label>UNIDADE ORÇAMENTÁRIA</label><input id="lic_ata_rp_unidade" class="input"></div>
              <div class="field" style="grid-column:1/-1"><label>OBJETO</label><textarea id="lic_ata_rp_objeto" class="input" rows="3"></textarea></div>
              <div class="field" style="grid-column:1/-1"><label>OBJETO RESUMIDO</label><input id="lic_ata_rp_objeto_resumido" class="input"></div>
              <div class="field"><label>MODALIDADE</label><input id="lic_ata_rp_modalidade" class="input"></div>
              <div class="field"><label>DATA DE ASSINATURA</label><input id="lic_ata_rp_assinatura" class="input" placeholder="DD/MM/AAAA"></div>
              <div class="field"><label>INÍCIO DA VIGÊNCIA</label><input id="lic_ata_rp_vig_inicio" class="input" placeholder="DD/MM/AAAA"></div>
              <div class="field"><label>TÉRMINO DA VIGÊNCIA</label><input id="lic_ata_rp_vig_fim" class="input" placeholder="DD/MM/AAAA"></div>
              <div class="field" style="grid-column:1/-1"><label>LINK PNCP</label><input id="lic_ata_rp_pncp" class="input" type="url" placeholder="https://..."></div>
              <div class="field"><label>CNPJ DO FORNECEDOR</label><input id="lic_ata_rp_cnpj" class="input" placeholder="00.000.000/0000-00"></div>
              <div class="field"><label>RAZÃO SOCIAL DO FORNECEDOR</label><input id="lic_ata_rp_fornecedor" class="input"></div>
              <div class="field" style="grid-column:1/-1"><label>NOME FANTASIA DO FORNECEDOR</label><input id="lic_ata_rp_fantasia" class="input"></div>
              <div class="field">
                <label>PDF DA ATA</label>
                <input id="lic_ata_rp_pdf" class="input" type="file" accept="application/pdf,.pdf">
                <div id="lic_ata_rp_pdf_status" class="muted" style="font-size:12px;margin-top:4px"></div>
              </div>
              <div class="field">
                <label>PDF DO EXTRATO NO DIÁRIO OFICIAL</label>
                <input id="lic_ata_rp_pdf_extrato" class="input" type="file" accept="application/pdf,.pdf">
                <div id="lic_ata_rp_pdf_extrato_status" class="muted" style="font-size:12px;margin-top:4px"></div>
              </div>
            </div>
            <hr>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">
              <strong>Itens da Ata</strong>
              <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
                <button type="button" id="lic_ata_item_import" class="btn">Importar TXT de Itens</button>
                <button type="button" id="lic_ata_item_clear" class="btn">Limpar itens</button>
              </div>
            </div>
            <input type="file" id="lic_ata_item_file" accept=".txt,.tsv" style="display:none">
            <div id="lic_ata_item_status" class="muted" style="font-size:12px;margin-bottom:8px">Nenhum item importado.</div>
            <div id="lic_ata_itens_lista"></div>
            <hr>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">
              <strong>Aditivos</strong>
              <button type="button" id="lic_ata_aditivo_add" class="btn">+ Incluir Aditivo</button>
            </div>
            <div id="lic_ata_aditivos_lista"></div>
            <div class="modal-actions">
              <button type="button" id="lic_ata_delete" class="btn danger">Excluir ata</button>
              <button type="button" id="lic_ata_cancel" class="btn">Cancelar</button>
              <button type="submit" class="btn primary">Salvar ata</button>
            </div>
          </form>
        </div>
      </dialog>

      <dialog id="lic_atas_view_dlg" style="width:min(1100px,94vw)">
        <div class="modal-head">
          <strong>Atas de Registro de Preço</strong>
          <button id="lic_atas_view_close" class="btn ghost">Fechar</button>
        </div>
        <div class="modal-body" id="lic_atas_view_body"></div>
      </dialog>

      <dialog id="lic_ata_item_dlg" style="width:min(620px,94vw)">
        <div class="modal-head">
          <strong>Item da Ata</strong>
          <button id="lic_ata_item_close" class="btn ghost">Fechar</button>
        </div>
        <div class="modal-body">
          <form id="lic_ata_item_form">
            <input type="hidden" id="lic_ata_item_idx">
            <div class="grid">
              <div class="field"><label>CÓDIGO</label><input id="lic_ata_item_codigo" class="input"></div>
              <div class="field" style="grid-column:1/-1"><label>DESCRIÇÃO</label><textarea id="lic_ata_item_descricao" class="input" rows="3" required></textarea></div>
              <div class="field"><label>UNIDADE</label><input id="lic_ata_item_unidade" class="input"></div>
              <div class="field"><label>QUANTIDADE</label><input id="lic_ata_item_quantidade" class="input"></div>
              <div class="field"><label>VALOR UNITÁRIO</label><input id="lic_ata_item_valor_unitario" class="input" placeholder="0,00"></div>
              <div class="field"><label>VALOR TOTAL</label><input id="lic_ata_item_valor_total" class="input" placeholder="0,00"></div>
            </div>
            <div class="modal-actions">
              <button type="button" id="lic_ata_item_delete" class="btn danger">Excluir item</button>
              <button type="button" id="lic_ata_item_cancel" class="btn">Cancelar</button>
              <button type="submit" class="btn primary">Salvar item</button>
            </div>
          </form>
        </div>
      </dialog>

      <dialog id="lic_aditivo_dlg" style="width:min(620px,94vw)">
        <div class="modal-head">
          <strong>Aditivo da Ata</strong>
          <button id="lic_aditivo_close" class="btn ghost">Fechar</button>
        </div>
        <div class="modal-body">
          <form id="lic_aditivo_form">
            <input type="hidden" id="lic_aditivo_idx">
            <div class="grid">
              <div class="field"><label>NÚMERO DO ADITIVO</label><input id="lic_aditivo_numero" class="input" required></div>
              <div class="field"><label>VIGÊNCIA DO NOVO ADITIVO</label><input id="lic_aditivo_vigencia" class="input" placeholder="DD/MM/AAAA A DD/MM/AAAA"></div>
              <div class="field"><label>DATA DE ASSINATURA</label><input id="lic_aditivo_assinatura" class="input" placeholder="DD/MM/AAAA"></div>
              <div class="field"><label>PUBLICAÇÃO</label><input id="lic_aditivo_publicacao" class="input" placeholder="DD/MM/AAAA"></div>
              <div class="field" style="grid-column:1/-1">
                <label>PDF DO ADITIVO</label>
                <input id="lic_aditivo_pdf" class="input" type="file" accept="application/pdf,.pdf">
                <div id="lic_aditivo_pdf_status" class="muted" style="font-size:12px;margin-top:4px"></div>
              </div>
            </div>
            <div class="modal-actions">
              <button type="button" id="lic_aditivo_delete" class="btn danger">Excluir aditivo</button>
              <button type="button" id="lic_aditivo_cancel" class="btn">Cancelar</button>
              <button type="submit" class="btn primary">Salvar aditivo</button>
            </div>
          </form>
        </div>
      </dialog>

      <dialog id="lic_edit" style="min-width:640px">
        <div style="background:var(--primary);padding:14px;border-radius:12px 12px 0 0;color:#fff;display:flex;justify-content:space-between;align-items:center;">
          <strong id="lic_edit_title" style="color:#fff">Editar processo</strong>
          <button id="lic_edit_close" class="btn ghost" style="background:transparent;border-color:transparent;color:#fff">Fechar</button>
        </div>
        <div class="modal-body" style="padding-top:12px">
          <form id="lic_edit_form">
            <input type="hidden" id="lic_edit_idx">
            <div class="grid">
              <div class="field">
                <label>N° do processo</label>
                <input id="lic_edit_numero" class="input" required>
              </div>
              <div class="field">
                <label>Data de criação</label>
                <input id="lic_edit_dataCriacao" class="input" type="text" required>
              </div>
              <div class="field" style="grid-column:1/-1">
                <label>Objeto</label>
                <input id="lic_edit_objeto" class="input">
              </div>
              <div class="field">
                <label>Secretaria</label>
                <select id="lic_edit_secretaria" class="select">
                  <option value="">-- selecione --</option>
                  ${SECRETARIAS.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
              </div>

              <!-- NOVOS CAMPOS (edição) -->
              <div class="field" style="grid-column:1/-1">
                <label>Descrição completa do objeto</label>
                <textarea id="lic_edit_descricaoCompleta" class="input" rows="3"></textarea>
              </div>

            

              <div class="field" style="grid-column:1/-1">
                <label>Observação</label>
                <textarea id="lic_edit_observacao" class="input" rows="2"></textarea>
              </div>

              <div class="field">
                <label>Volumes</label>
                <select id="lic_edit_volumes" class="select">
                  <option value="">-- --</option>
                  ${ROMAN_OPTIONS.map(o=>`<option value="${o.n}">${o.r} (${o.n})</option>`).join('')}
                </select>
              </div>

              <div class="field">
                <label>Valor Estimado (R$)</label>
                <input id="lic_edit_valorEstimado" class="input" placeholder="0,00">
              </div>

              <div class="field" style="grid-column:1/-1">
                <label>Recurso</label>
                <div style="display:flex;gap:12px;align-items:center">
                  <label><input type="checkbox" id="lic_edit_recurso_municipal"> Municipal</label>
                  <label><input type="checkbox" id="lic_edit_recurso_estadual"> Estadual</label>
                  <label><input type="checkbox" id="lic_edit_recurso_federal"> Federal</label>
                </div>
              </div>

              <div class="field">
                <label>Modalidade</label>
                <input id="lic_edit_modalidade" class="input">
              </div>

              <div class="field">
                <label>Situação</label>
                <input id="lic_edit_situacao" class="input">
              </div>

              <div class="field">
                <label>Fase</label>
                <input id="lic_edit_fase" class="input">
              </div>

            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
              <button type="button" id="lic_edit_delete" class="btn" style="background:var(--danger,#d33);border-color:var(--danger,#d33);color:#fff">Excluir</button>
              <button type="button" id="lic_edit_cancel" class="btn">Cancelar</button>
              <button type="submit" id="lic_edit_save" class="btn primary">Salvar alterações</button>
            </div>
          </form>
        </div>
      </dialog>

      <!-- Modal de Visualização (opção 'Ver') -->
      <dialog id="lic_view" class="process-view-dialog">
        <div class="process-view-shell">
          <div class="process-view-head">
            <div>
              <span class="process-view-kicker">Visualização do processo</span>
              <strong id="view_head_title">Detalhes do processo</strong>
            </div>
            <div class="process-view-actions">
              <button id="btnPrint" class="btn">Imprimir</button>
                            <button id="lic_view_maximize" class="btn">Maximizar</button>
<button id="lic_view_close" class="btn ghost">Fechar</button>
            </div>
          </div>
          <div class="modal-body process-view-body" id="view_body"></div>
        </div>
      </dialog>
      <dialog id="lic_itens_modal" style="min-width:600px">

<div class="modal-head">
<strong>Itens do processo</strong>
<button id="lic_itens_close" class="btn ghost">Fechar</button>
</div>

<div class="modal-body">

<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
<button id="lic_item_import" class="btn" type="button">Importar TXT de Itens</button>
<button id="lic_item_add" class="btn primary">+ Adicionar item</button>
<input id="lic_item_file" type="file" accept=".txt,text/plain" style="display:none">
</div>

<table style="width:100%" id="lic_tbl_itens">
<thead>
<tr>
<th>Item</th>
<th>Valor Unitário</th>
<th>Quantidade</th>
<th>Unidade</th>
<th></th>
</tr>
</thead>

<tbody></tbody>

</table>

</div>

</dialog>

<dialog id="lic_item_form_modal" style="min-width:420px">

<div class="modal-head">
<strong id="lic_item_form_title">Novo Item</strong>
<button id="lic_item_form_close" class="btn ghost">Fechar</button>
</div>

<div class="modal-body">

<div class="grid">

<div class="field" style="grid-column:1/-1">
<label>Descrição do item</label>
<input id="lic_item_desc" class="input">
</div>

<div class="field">
<label>Valor unitário</label>
<input id="lic_item_valor" class="input" placeholder="0,00">
</div>

<div class="field">
<label>Quantidade</label>
<input id="lic_item_qtd" class="input" type="number">
</div>

<div class="field">
<label>Unidade de medida</label>
<input id="lic_item_unidade" class="input" placeholder="UN">
</div>

</div>

<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
<button id="lic_item_cancel" class="btn">Cancelar</button>
<button id="lic_item_save" class="btn primary">Salvar Item</button>
</div>

</div>

</dialog>
<dialog id="lic_cot_itens_dlg" style="width:92vw;max-width:1120px">

<div class="modal-head">
<strong>Itens da Cotação</strong>
<button id="lic_cot_itens_close" class="btn ghost">Fechar</button>
</div>

<div class="modal-body" style="max-height:75vh;overflow:auto">

<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
<button type="button" id="btnImportCotacaoEtp" class="btn">Importar itens do ETP</button>
<button type="button" id="btnAddCotacao" class="btn primary">+ Adicionar item</button>
</div>

<div id="cot_itens_modal_body"></div>

</div>

</dialog>
    `;

    // --- Referências DOM ---
    const tblBody = container.querySelector('#lic_tbl tbody');
    const emptyEl = container.querySelector('#lic_empty');
    const fGeral = container.querySelector('#lic_filter_geral');
    const fSecretaria = container.querySelector('#lic_filter_secretaria');
    const fTipoProtocolo = container.querySelector('#lic_filter_tipo_protocolo');
    const fAssuntoProtocolo = container.querySelector('#lic_filter_assunto_protocolo');
    const fRegistroPrecos = container.querySelector('#lic_filter_registro_precos');
    const selectAll = container.querySelector('#lic_select_all');
    const deleteSelectedBtn = container.querySelector('#lic_delete_selected');
    const addBtn = container.querySelector('#lic_add');
    const importBtn = container.querySelector('#lic_import');
    const importMenu = container.querySelector('#lic_import_menu');
    const importJsonBtn = container.querySelector('#lic_import_json');
    const importEtiquetaBtn = container.querySelector('#lic_import_etiqueta');

    const exportBtn = container.querySelector('#lic_export');
    const fileInput = container.querySelector('#lic_file_input');
    const etiquetaInput = container.querySelector('#lic_etiqueta_input');

    const dlg = container.querySelector('#lic_dlg');
    const dlgClose = container.querySelector('#lic_close');
    const dlgCancel = container.querySelector('#lic_cancel');
    const form = container.querySelector('#lic_form');
    const btnExcluir = container.querySelector('#btnExcluir');
    const listaPregoeiros = container.querySelector('#lic_pregoeiros_lista');

    function atualizarSugestoesPregoeiros() {
      if (!listaPregoeiros) return;
      const nomes = [...new Set(loadData()
        .map(p => String(p.licitacaoPregoeiro || '').trim())
        .filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'pt-BR'));
      listaPregoeiros.innerHTML = nomes
        .map(nome => `<option value="${escHtml(nome)}"></option>`)
        .join('');
    }

    const dlgEdit = container.querySelector('#lic_edit');
    const dlgEditClose = container.querySelector('#lic_edit_close');
    const dlgEditCancel = container.querySelector('#lic_edit_cancel');
    const dlgEditDelete = container.querySelector('#lic_edit_delete');
    const formEdit = container.querySelector('#lic_edit_form');

    const dlgView = container.querySelector('#lic_view');
    const btnPrint = container.querySelector('#btnPrint');
    const btnViewMaximize = container.querySelector('#lic_view_maximize');
    const dlgViewClose = container.querySelector('#lic_view_close');
    function restaurarVisualizacaoProcesso() {
      dlgView.classList.remove('maximized');
      if (btnViewMaximize) btnViewMaximize.textContent = 'Maximizar';
    }
    btnViewMaximize?.addEventListener('click', () => {
      const maximizado = dlgView.classList.toggle('maximized');
      btnViewMaximize.textContent = maximizado ? 'Restaurar' : 'Maximizar';
    });
    dlgViewClose.onclick = () => {
      restaurarVisualizacaoProcesso();
      dlgView.close();
    };

    const atasRegistroContainer = container.querySelector('#atas_registro_container');
    const btnAtasAdd = container.querySelector('#lic_atas_add');
    const btnAtasView = container.querySelector('#lic_atas_view');
    const atasStatus = container.querySelector('#lic_atas_status');
    const atasPreview = container.querySelector('#lic_atas_preview');
    const dlgAta = container.querySelector('#lic_ata_dlg');
    const formAta = container.querySelector('#lic_ata_form');
    const dlgAtaItem = container.querySelector('#lic_ata_item_dlg');
    const formAtaItem = container.querySelector('#lic_ata_item_form');
    const dlgAditivo = container.querySelector('#lic_aditivo_dlg');
    const formAditivo = container.querySelector('#lic_aditivo_form');
    const dlgAtasView = container.querySelector('#lic_atas_view_dlg');
    let atasRegistroPreco = [];
    let itensAtaDraft = [];
    let catAtaEditProcessoId = '';
    let catAtaEditAtaId = '';
    let catAtaEditAtaIndex = -1;
    let itensAtaInlineDraft = [];
    let aditivosAtaDraft = [];
    let ataAtualIdx = "";

    function arquivoParaBase64(input, atual) {
      return salvarAnexoIndexedDB(input, atual);
    }

    function linkArquivoPdf(arquivo, label) {
      return linkAnexoPdf(arquivo, label);
    }

    function aplicarMascaraData(campo) {
      if (!campo) return;
      campo.addEventListener('input', () => {
        let v = campo.value.replace(/\D/g, '').slice(0, 8);
        v = v.replace(/^(\d{2})(\d)/, '$1/$2');
        v = v.replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
        campo.value = v;
      });
    }

    function aplicarMascaraPeriodoData(campo) {
      if (!campo) return;
      campo.addEventListener('input', () => {
        let v = campo.value.replace(/\D/g, '').slice(0, 16);
        const inicio = v.slice(0, 8)
          .replace(/^(\d{2})(\d)/, '$1/$2')
          .replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
        const fimRaw = v.slice(8);
        const fim = fimRaw
          .replace(/^(\d{2})(\d)/, '$1/$2')
          .replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
        campo.value = fimRaw ? `${inicio} A ${fim}` : inicio;
      });
    }

    function abrirDialogInterno(dialog, parentDialog = null) {
      if (!dialog) return;
      if (dialog.open) return;
      const parent = parentDialog ||
        (dialog === dlgAta || dialog === dlgAtasView ? dlg :
        (dialog === dlgAtaItem || dialog === dlgAditivo ? dlgAta : null));
      if (parent?.open) {
        if (!dialog.dataset.reabrirDialog) dialog.dataset.reabrirDialog = parent.id;
        parent.close();
      }
      try {
        dialog.showModal();
      } catch (error) {
        dialog.show();
      }
    }

    function fecharDialogInterno(dialog) {
      if (!dialog) return;
      const retornoId = dialog.dataset.reabrirDialog || "";
      delete dialog.dataset.reabrirDialog;
      if (dialog.open) dialog.close();
      if (!retornoId) return;
      setTimeout(() => {
        const retorno = document.getElementById(retornoId);
        if (retorno && !retorno.open) abrirDialogInterno(retorno);
      }, 0);
    }

    function preencherFornecedorAtaPorCnpj() {
      const cnpj = container.querySelector('#lic_ata_rp_cnpj');
      if (!cnpj || onlyDigits(cnpj.value).length !== 14) return;
      const fornecedor = buscarFornecedorPorCnpj(cnpj.value);
      if (!fornecedor) return;
      cnpj.value = formatCnpj(fornecedor.cnpj);
      container.querySelector('#lic_ata_rp_fornecedor').value = fornecedor.razaoSocial || fornecedor.nomeFantasia || '';
      container.querySelector('#lic_ata_rp_fantasia').value = fornecedor.nomeFantasia || '';
      showToast(`Fornecedor localizado: ${fornecedor.razaoSocial || fornecedor.nomeFantasia || fornecedor.cnpj}`);
    }

    function atualizarTotalItemAta() {
      const qtd = parseBRLToNumber(container.querySelector('#lic_ata_item_quantidade')?.value) || 0;
      const unitario = parseBRLToNumber(container.querySelector('#lic_ata_item_valor_unitario')?.value) || 0;
      const total = qtd * unitario;
      if (total > 0) {
        container.querySelector('#lic_ata_item_valor_total').value = total.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      }
    }

    function renderItensAtaInline() {
      const status = container.querySelector('#lic_ata_inline_itens_status');
      const preview = container.querySelector('#lic_ata_inline_itens_preview');
      if (!status || !preview) return;
      const linhas = normalizarItensAta(itensAtaInlineDraft);
      if (!linhas.length) {
        status.textContent = 'Nenhum item importado.';
        preview.style.display = 'none';
        preview.innerHTML = '';
        return;
      }
      const colunas = linhas.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
      status.textContent = `${contarItensTabela(linhas)} item(s) importado(s). Primeira linha usada como cabeçalho. ${linhas.length} linha(s) no arquivo.`;
      preview.style.display = '';
      preview.innerHTML = renderTabelaItensAta(linhas, 12);
    }

    function irpAtualDoProcesso() {
      const irpId = fld?.irpRegistroPreco?.value || '';
      try {
        const irps = JSON.parse(localStorage.getItem(IRP_STORAGE_KEY) || '[]');
        return irps.find(irp => irp.id === irpId) || null;
      } catch (error) {
        console.error('Erro ao carregar IRP vinculada ao processo:', error);
        return null;
      }
    }

    function esconderSeletorItensIrpAta() {
      const painel = container.querySelector('#lic_ata_inline_irp_selector');
      if (painel) painel.style.display = 'none';
    }

    function abrirSeletorItensIrpAta() {
      const painel = container.querySelector('#lic_ata_inline_irp_selector');
      const status = container.querySelector('#lic_ata_inline_irp_selector_status');
      const lista = container.querySelector('#lic_ata_inline_irp_selector_lista');
      if (!painel || !status || !lista) return;

      const irp = irpAtualDoProcesso();
      if (!irp) {
        alert('Este processo ainda não possui uma IRP vinculada. Selecione a Intenção de Registro de Preço antes de escolher os itens.');
        return;
      }

      const linhas = normalizarItensAta(irp.itens);
      const cabecalho = linhas[0] || [];
      const itens = linhas.slice(1).filter(row => Array.isArray(row) && row.some(cell => String(cell || '').trim()));
      if (!itens.length) {
        alert('A IRP vinculada não possui itens cadastrados.');
        return;
      }

      const idxAtual = container.querySelector('#lic_ata_inline_idx')?.value;
      const ataAtual = idxAtual !== '' ? atasRegistroPreco[Number(idxAtual)] : null;
      const usadosOutrasAtas = mapaItensAtaUsados(atasRegistroPreco, {
        id: ataAtual?.id || '',
        index: idxAtual !== '' ? Number(idxAtual) : -1
      });
      const selecionadosAtuais = new Set(normalizarItensAta(itensAtaInlineDraft).slice(1).map(chaveItemAta).filter(Boolean));
      const colunas = Math.max(cabecalho.length, ...itens.map(row => row.length));
      const bloqueados = itens.filter(row => usadosOutrasAtas.has(chaveItemAta(row))).length;
      status.textContent = `IRP ${irp.numero || ''}/${irp.ano || ''} - ${itens.length} item(s) disponível(is). ${bloqueados ? `${bloqueados} já usado(s) em outra ata deste processo.` : ''}`;
      lista.innerHTML = `
        <table>
          <thead>
            <tr>
              <th></th>
              ${Array.from({ length: colunas }, (_, colIndex) => `<th>${escHtml(cabecalho[colIndex] || `Coluna ${colIndex + 1}`)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${itens.map((row, idx) => {
              const key = chaveItemAta(row);
              const usado = usadosOutrasAtas.get(key);
              const checked = selecionadosAtuais.has(key) || !!usado;
              const disabled = usado ? 'disabled' : '';
              const title = usado ? ` title="Já usado na ata ${escHtml(usado.ata?.numero || '')}/${escHtml(usado.ata?.ano || '')}"` : '';
              return `
                <tr class="${usado ? 'row-muted' : ''}">
                  <td><input type="checkbox" data-irp-ata-item="${idx + 1}" ${checked ? 'checked' : ''} ${disabled}${title}></td>
                  ${Array.from({ length: colunas }, (_, colIndex) => `<td>${escHtml(row[colIndex] || '')}</td>`).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
      painel.dataset.irpItens = JSON.stringify(linhas);
      painel.style.display = 'block';
    }

    function aplicarItensSelecionadosIrpAta() {
      const painel = container.querySelector('#lic_ata_inline_irp_selector');
      if (!painel) return;
      let linhas = [];
      try {
        linhas = JSON.parse(painel.dataset.irpItens || '[]');
      } catch (error) {
        console.error('Erro ao ler itens da IRP selecionada:', error);
        linhas = [];
      }
      const selecionados = [...painel.querySelectorAll('[data-irp-ata-item]:checked:not(:disabled)')]
        .map(input => Number(input.dataset.irpAtaItem))
        .filter(index => Number.isInteger(index) && index > 0 && linhas[index]);
      if (!selecionados.length) return alert('Selecione ao menos um item da IRP.');
      if (itensAtaInlineDraft.length && !confirm('Substituir os itens atuais da ata pelos itens selecionados da IRP?')) return;

      itensAtaInlineDraft = [linhas[0] || [], ...selecionados.map(index => linhas[index])];
      renderItensAtaInline();
      esconderSeletorItensIrpAta();
      showToast(`${selecionados.length} item(s) da IRP adicionados à ata.`);
    }

    function fecharAtaInline() {
      esconderSeletorItensIrpAta();
      const painel = container.querySelector('#lic_ata_inline_panel');
      if (painel) painel.style.display = 'none';
    }

    function preencherFornecedorAtaInlinePorCnpj() {
      const cnpj = container.querySelector('#lic_ata_inline_cnpj');
      if (!cnpj || onlyDigits(cnpj.value).length !== 14) return;
      const fornecedor = buscarFornecedorPorCnpj(cnpj.value);
      if (!fornecedor) return;
      cnpj.value = formatCnpj(fornecedor.cnpj);
      container.querySelector('#lic_ata_inline_fornecedor').value = fornecedor.razaoSocial || fornecedor.nomeFantasia || '';
      container.querySelector('#lic_ata_inline_fantasia').value = fornecedor.nomeFantasia || '';
      showToast(`Fornecedor localizado: ${fornecedor.razaoSocial || fornecedor.nomeFantasia || fornecedor.cnpj}`);
    }

    function abrirAtaInline(index = "") {
      const painel = container.querySelector('#lic_ata_inline_panel');
      if (!painel) return abrirAta(index);
      const ata = index !== "" ? atasRegistroPreco[index] : null;
      itensAtaInlineDraft = normalizarItensAta(ata?.itens);
      container.querySelector('#lic_ata_inline_titulo').textContent = ata ? 'Editar Ata de Registro de Preço' : 'Nova Ata de Registro de Preço';
      container.querySelector('#lic_ata_inline_idx').value = index;
      container.querySelector('#lic_ata_inline_numero').value = ata?.numero || '';
      container.querySelector('#lic_ata_inline_ano').value = ata?.ano || '';
      container.querySelector('#lic_ata_inline_unidade').value = ata?.unidadeOrcamentaria || '';
      container.querySelector('#lic_ata_inline_objeto').value = ata?.objeto || '';
      container.querySelector('#lic_ata_inline_objeto_resumido').value = ata?.objetoResumido || '';
      container.querySelector('#lic_ata_inline_modalidade').value = ata?.modalidade || '';
      container.querySelector('#lic_ata_inline_assinatura').value = ata?.dataAssinatura || '';
      container.querySelector('#lic_ata_inline_vig_inicio').value = ata?.vigenciaInicio || '';
      container.querySelector('#lic_ata_inline_vig_fim').value = ata?.vigenciaFim || '';
      container.querySelector('#lic_ata_inline_pncp').value = ata?.linkPncp || '';
      container.querySelector('#lic_ata_inline_cnpj').value = ata?.fornecedorCnpj || '';
      container.querySelector('#lic_ata_inline_fornecedor').value = ata?.fornecedorRazao || '';
      container.querySelector('#lic_ata_inline_fantasia').value = ata?.fornecedorFantasia || '';
      container.querySelector('#lic_ata_inline_pdf').value = '';
      container.querySelector('#lic_ata_inline_pdf_extrato').value = '';
      container.querySelector('#lic_ata_inline_pdf_status').textContent = ata?.pdfAta?.nome ? `Arquivo atual: ${ata.pdfAta.nome}` : '';
      container.querySelector('#lic_ata_inline_pdf_extrato_status').textContent = ata?.pdfExtrato?.nome ? `Arquivo atual: ${ata.pdfExtrato.nome}` : '';
      renderItensAtaInline();
      esconderSeletorItensIrpAta();
      painel.style.display = 'block';
      painel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    async function salvarAtaInline() {
      const idx = container.querySelector('#lic_ata_inline_idx').value;
      const atual = idx !== "" ? atasRegistroPreco[Number(idx)] : {};
      let pdfAta = null;
      let pdfExtrato = null;
      try {
        pdfAta = await arquivoParaBase64(container.querySelector('#lic_ata_inline_pdf'), atual?.pdfAta);
        pdfExtrato = await arquivoParaBase64(container.querySelector('#lic_ata_inline_pdf_extrato'), atual?.pdfExtrato);
      } catch (error) {
        console.error('Erro ao salvar anexos da ata:', error);
        return alert('Não foi possível salvar os PDFs da ata no IndexedDB. Verifique se o navegador permite armazenamento local para este arquivo.');
      }

      if (!validarItensAtaNaIrp(irpAtualDoProcesso(), itensAtaInlineDraft)) return;

      const duplicado = encontrarItemAtaDuplicado(atasRegistroPreco, itensAtaInlineDraft, {
        id: atual?.id || '',
        index: idx !== '' ? Number(idx) : -1
      });
      if (duplicado) {
        return alert(`Este item já está vinculado à ata ${duplicado.ata?.numero || ''}/${duplicado.ata?.ano || ''} deste processo. Remova o item duplicado antes de salvar.`);
      }

      const ata = {
        id: atual?.id || genId(),
        numero: container.querySelector('#lic_ata_inline_numero').value.trim(),
        ano: container.querySelector('#lic_ata_inline_ano').value.trim(),
        unidadeOrcamentaria: container.querySelector('#lic_ata_inline_unidade').value.trim(),
        objeto: container.querySelector('#lic_ata_inline_objeto').value.trim(),
        objetoResumido: container.querySelector('#lic_ata_inline_objeto_resumido').value.trim(),
        modalidade: container.querySelector('#lic_ata_inline_modalidade').value.trim(),
        dataAssinatura: container.querySelector('#lic_ata_inline_assinatura').value.trim(),
        vigenciaInicio: container.querySelector('#lic_ata_inline_vig_inicio').value.trim(),
        vigenciaFim: container.querySelector('#lic_ata_inline_vig_fim').value.trim(),
        linkPncp: container.querySelector('#lic_ata_inline_pncp').value.trim(),
        fornecedorCnpj: container.querySelector('#lic_ata_inline_cnpj').value.trim(),
        fornecedorRazao: container.querySelector('#lic_ata_inline_fornecedor').value.trim(),
        fornecedorFantasia: container.querySelector('#lic_ata_inline_fantasia').value.trim(),
        pdfAta,
        pdfExtrato,
        itens: itensAtaInlineDraft,
        aditivos: Array.isArray(atual?.aditivos) ? atual.aditivos : [],
        atualizadoEm: new Date().toLocaleString('pt-BR'),
        criadoEm: atual?.criadoEm || new Date().toLocaleString('pt-BR')
      };

      if (!ata.numero || !ata.ano) return alert('Informe o número e o ano da ata.');
      if (ata.fornecedorCnpj) {
        upsertFornecedor({
          cnpj: ata.fornecedorCnpj,
          razaoSocial: ata.fornecedorRazao,
          nomeFantasia: ata.fornecedorFantasia,
          origem: `ATA ${ata.numero || ''}/${ata.ano || ''}`.trim()
        });
      }

      if (idx !== "") atasRegistroPreco[Number(idx)] = ata;
      else atasRegistroPreco.push(ata);
      renderAtasPreview();
      fecharAtaInline();
      showToast('Ata adicionada. Salve o processo para gravar as alterações.');
    }

    function renderAtasPreview() {
      const total = atasRegistroPreco.length;
      atasStatus.textContent = total ? `${total} ata(s) cadastrada(s).` : 'Nenhuma ata cadastrada.';
      atasPreview.style.display = total ? 'block' : 'none';
      atasPreview.innerHTML = total ? `
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Ano</th>
              <th>Objeto Resumido</th>
              <th>Fornecedor</th>
              <th>Vigência</th>
              <th>Itens</th>
              <th>Aditivos</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${atasRegistroPreco.map((ata, index) => `
              <tr>
                <td><strong>${escHtml(ata.numero)}</strong></td>
                <td>${escHtml(ata.ano)}</td>
                <td>${escHtml(ata.objetoResumido)}</td>
                <td>${escHtml(ata.fornecedorRazao || ata.fornecedorFantasia || '')}</td>
                <td>${escHtml(ata.vigenciaInicio)} a ${escHtml(ata.vigenciaFim)}</td>
                <td>${contarItensTabela(ata.itens)}</td>
                <td>${Array.isArray(ata.aditivos) ? ata.aditivos.length : 0}</td>
                <td><button type="button" class="btn" data-edit-ata="${index}">Editar</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '';

      atasPreview.querySelectorAll('[data-edit-ata]').forEach(btn => {
        btn.onclick = () => abrirAtaInline(Number(btn.dataset.editAta));
      });
    }

    function renderAditivosDraft() {
      const lista = container.querySelector('#lic_ata_aditivos_lista');
      if (!lista) return;

      lista.innerHTML = aditivosAtaDraft.length ? `
        <table>
          <thead>
            <tr>
              <th>Número</th>
              <th>Vigência</th>
              <th>Assinatura</th>
              <th>Publicação</th>
              <th>PDF</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${aditivosAtaDraft.map((aditivo, index) => `
              <tr>
                <td><strong>${escHtml(aditivo.numero)}</strong></td>
                <td>${escHtml(aditivo.vigencia)}</td>
                <td>${escHtml(aditivo.dataAssinatura)}</td>
                <td>${escHtml(aditivo.publicacao)}</td>
                <td>${aditivo.pdf?.nome ? escHtml(aditivo.pdf.nome) : ''}</td>
                <td><button type="button" class="btn" data-edit-aditivo="${index}">Editar</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : `<div class="empty">Nenhum aditivo cadastrado para esta ata.</div>`;

      lista.querySelectorAll('[data-edit-aditivo]').forEach(btn => {
        btn.onclick = () => abrirAditivo(Number(btn.dataset.editAditivo));
      });
    }

    function abrirAta(index = "") {
      const ata = index !== "" ? atasRegistroPreco[index] : null;
      ataAtualIdx = index;
      itensAtaDraft = normalizarItensAta(ata?.itens);
      aditivosAtaDraft = Array.isArray(ata?.aditivos) ? ata.aditivos.map(a => ({...a})) : [];
      formAta.reset();
      container.querySelector('#lic_ata_idx').value = index;
      container.querySelector('#lic_ata_rp_numero').value = ata?.numero || '';
      container.querySelector('#lic_ata_rp_ano').value = ata?.ano || '';
      container.querySelector('#lic_ata_rp_unidade').value = ata?.unidadeOrcamentaria || '';
      container.querySelector('#lic_ata_rp_objeto').value = ata?.objeto || '';
      container.querySelector('#lic_ata_rp_objeto_resumido').value = ata?.objetoResumido || '';
      container.querySelector('#lic_ata_rp_modalidade').value = ata?.modalidade || '';
      container.querySelector('#lic_ata_rp_assinatura').value = ata?.dataAssinatura || '';
      container.querySelector('#lic_ata_rp_vig_inicio').value = ata?.vigenciaInicio || '';
      container.querySelector('#lic_ata_rp_vig_fim').value = ata?.vigenciaFim || '';
      container.querySelector('#lic_ata_rp_pncp').value = ata?.linkPncp || '';
      container.querySelector('#lic_ata_rp_cnpj').value = ata?.fornecedorCnpj || '';
      container.querySelector('#lic_ata_rp_fornecedor').value = ata?.fornecedorRazao || '';
      container.querySelector('#lic_ata_rp_fantasia').value = ata?.fornecedorFantasia || '';
      container.querySelector('#lic_ata_rp_pdf_status').textContent = ata?.pdfAta?.nome ? `Arquivo atual: ${ata.pdfAta.nome}` : '';
      container.querySelector('#lic_ata_rp_pdf_extrato_status').textContent = ata?.pdfExtrato?.nome ? `Arquivo atual: ${ata.pdfExtrato.nome}` : '';
      container.querySelector('#lic_ata_delete').style.display = ata ? '' : 'none';
      renderItensAtaDraft();
      renderAditivosDraft();
      abrirDialogInterno(dlgAta);
    }

    function abrirItemAta(index = "") {
      const item = index !== "" ? itensAtaDraft[index] : null;
      formAtaItem.reset();
      container.querySelector('#lic_ata_item_idx').value = index;
      container.querySelector('#lic_ata_item_codigo').value = item?.codigo || '';
      container.querySelector('#lic_ata_item_descricao').value = item?.descricao || '';
      container.querySelector('#lic_ata_item_unidade').value = item?.unidade || '';
      container.querySelector('#lic_ata_item_quantidade').value = item?.quantidade || '';
      container.querySelector('#lic_ata_item_valor_unitario').value = item?.valorUnitario || '';
      container.querySelector('#lic_ata_item_valor_total').value = item?.valorTotal || '';
      container.querySelector('#lic_ata_item_delete').style.display = item ? '' : 'none';
      abrirDialogInterno(dlgAtaItem);
    }

    function abrirAditivo(index = "") {
      const aditivo = index !== "" ? aditivosAtaDraft[index] : null;
      formAditivo.reset();
      container.querySelector('#lic_aditivo_idx').value = index;
      container.querySelector('#lic_aditivo_numero').value = aditivo?.numero || '';
      container.querySelector('#lic_aditivo_vigencia').value = aditivo?.vigencia || '';
      container.querySelector('#lic_aditivo_assinatura').value = aditivo?.dataAssinatura || '';
      container.querySelector('#lic_aditivo_publicacao').value = aditivo?.publicacao || '';
      container.querySelector('#lic_aditivo_pdf_status').textContent = aditivo?.pdf?.nome ? `Arquivo atual: ${aditivo.pdf.nome}` : '';
      container.querySelector('#lic_aditivo_delete').style.display = aditivo ? '' : 'none';
      abrirDialogInterno(dlgAditivo);
    }

    function renderAtasView() {
      const body = container.querySelector('#lic_atas_view_body');
      body.innerHTML = atasRegistroPreco.length ? `
        ${atasRegistroPreco.map(ata => `
          <div class="card" style="box-shadow:none;margin-bottom:12px">
            <h3 style="margin-top:0">Ata ${escHtml(ata.numero)}/${escHtml(ata.ano)}</h3>
            <div><strong>Unidade Orçamentária:</strong> ${escHtml(ata.unidadeOrcamentaria)}</div>
            <div><strong>Objeto:</strong> ${escHtml(ata.objeto)}</div>
            <div><strong>Objeto Resumido:</strong> ${escHtml(ata.objetoResumido)}</div>
            <div><strong>Modalidade:</strong> ${escHtml(ata.modalidade)}</div>
            <div><strong>Assinatura:</strong> ${escHtml(ata.dataAssinatura)}</div>
            <div><strong>Vigência:</strong> ${escHtml(ata.vigenciaInicio)} a ${escHtml(ata.vigenciaFim)}</div>
            <div><strong>Fornecedor:</strong> ${escHtml(ata.fornecedorRazao)} ${ata.fornecedorCnpj ? `- ${escHtml(ata.fornecedorCnpj)}` : ''}</div>
            <div><strong>Nome Fantasia:</strong> ${escHtml(ata.fornecedorFantasia)}</div>
            <div><strong>PNCP:</strong> ${ata.linkPncp ? `<a href="${escHtml(ata.linkPncp)}" target="_blank">Abrir link</a>` : ''}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
              ${linkArquivoPdf(ata.pdfAta, 'Ver PDF da Ata')}
              ${linkArquivoPdf(ata.pdfExtrato, 'Ver PDF do Extrato')}
            </div>
            <h4>Itens da Ata</h4>
            ${Array.isArray(ata.itens) && ata.itens.length ? `
              ${renderTabelaItensAta(ata.itens, Infinity)}
            ` : `<div class="empty">Nenhum item cadastrado.</div>`}
            <h4>Aditivos</h4>
            ${Array.isArray(ata.aditivos) && ata.aditivos.length ? `
              <table>
                <thead><tr><th>Número</th><th>Vigência</th><th>Assinatura</th><th>Publicação</th><th>PDF</th></tr></thead>
                <tbody>
                  ${ata.aditivos.map(aditivo => `
                    <tr>
                      <td>${escHtml(aditivo.numero)}</td>
                      <td>${escHtml(aditivo.vigencia)}</td>
                      <td>${escHtml(aditivo.dataAssinatura)}</td>
                      <td>${escHtml(aditivo.publicacao)}</td>
                      <td>${linkArquivoPdf(aditivo.pdf, 'Ver PDF')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : `<div class="empty">Nenhum aditivo cadastrado.</div>`}
          </div>
        `).join('')}
      ` : `<div class="empty">Nenhuma ata cadastrada.</div>`;
      abrirDialogInterno(dlgAtasView);
    }
    

    window.__abrirAtaProcesso = () => abrirAtaInline();
    window.__visualizarAtasProcesso = () => renderAtasView();

    btnAtasAdd?.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      abrirAtaInline();
    });

    btnAtasView?.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      renderAtasView();
    });

    container.querySelector('#lic_ata_inline_close')?.addEventListener('click', fecharAtaInline);
    container.querySelector('#lic_ata_inline_cancel')?.addEventListener('click', fecharAtaInline);
    container.querySelector('#lic_ata_inline_save')?.addEventListener('click', salvarAtaInline);
    container.querySelector('#lic_ata_inline_import_itens')?.addEventListener('click', () => {
      const input = container.querySelector('#lic_ata_inline_itens_file');
      if (input) {
        input.value = '';
        input.click();
      }
    });
    container.querySelector('#lic_ata_inline_select_irp')?.addEventListener('click', abrirSeletorItensIrpAta);
    container.querySelector('#lic_ata_inline_irp_cancel')?.addEventListener('click', esconderSeletorItensIrpAta);
    container.querySelector('#lic_ata_inline_irp_apply')?.addEventListener('click', aplicarItensSelecionadosIrpAta);
    container.querySelector('#lic_ata_inline_irp_select_all')?.addEventListener('click', () => {
      const checks = [...container.querySelectorAll('#lic_ata_inline_irp_selector [data-irp-ata-item]:not(:disabled)')];
      const marcar = checks.some(input => !input.checked);
      checks.forEach(input => input.checked = marcar);
    });
    container.querySelector('#lic_ata_inline_itens_file')?.addEventListener('change', async () => {
      const input = container.querySelector('#lic_ata_inline_itens_file');
      const file = input?.files?.[0];
      if (!file) return;
      const texto = await file.text();
      const itensImportados = parseItensEditalTxt(texto);
      if (!itensImportados.length) {
        input.value = '';
        return alert('Não encontrei dados no TXT selecionado.');
      }
      itensAtaInlineDraft = itensImportados;
      input.value = '';
      renderItensAtaInline();
      showToast(`${contarItensTabela(itensImportados)} item(s) importado(s) do TXT.`);
    });
    container.querySelector('#lic_ata_inline_limpar_itens')?.addEventListener('click', () => {
      if (itensAtaInlineDraft.length && !confirm('Limpar os itens importados desta ata?')) return;
      itensAtaInlineDraft = [];
      renderItensAtaInline();
    });
    ['#lic_ata_inline_assinatura', '#lic_ata_inline_vig_inicio', '#lic_ata_inline_vig_fim'].forEach(sel => {
      aplicarMascaraData(container.querySelector(sel));
    });
    const campoCnpjAtaInline = container.querySelector('#lic_ata_inline_cnpj');
    campoCnpjAtaInline?.addEventListener('input', () => {
      campoCnpjAtaInline.value = formatCnpj(campoCnpjAtaInline.value);
      if (onlyDigits(campoCnpjAtaInline.value).length === 14) preencherFornecedorAtaInlinePorCnpj();
    });
    campoCnpjAtaInline?.addEventListener('blur', preencherFornecedorAtaInlinePorCnpj);


    const dlgItens = container.querySelector('#lic_itens_modal');
const btnItens = container.querySelector('#lic_btn_itens');
const btnItensClose = container.querySelector('#lic_itens_close');
const tblItens = container.querySelector('#lic_tbl_itens tbody');
const btnAddItem = container.querySelector('#lic_item_add');
const btnImportItem = container.querySelector('#lic_item_import');
const fileImportItem = container.querySelector('#lic_item_file');

const dlgItemForm = container.querySelector('#lic_item_form_modal');
const tituloItemForm = container.querySelector('#lic_item_form_title');
const btnItemFormClose = container.querySelector('#lic_item_form_close');
const btnItemCancel = container.querySelector('#lic_item_cancel');
const btnItemSave = container.querySelector('#lic_item_save');

const fldItemDesc = container.querySelector('#lic_item_desc');
const fldItemValor = container.querySelector('#lic_item_valor');
const fldItemQtd = container.querySelector('#lic_item_qtd');
const fldItemUnidade = container.querySelector('#lic_item_unidade');
let itemProcessoEditIndex = -1;

btnItens.onclick = () => {
renderItens();
dlgItens.showModal();
};

btnItensClose.onclick = () => dlgItens.close();

btnImportItem.onclick = () => fileImportItem.click();
fileImportItem.addEventListener('change', async () => {
  const file = fileImportItem.files?.[0];
  if (!file) return;
  try {
    const texto = await file.text();
    const importados = itensProcessoDoTxt(texto);
    if (!importados.length) return alert('Nenhum item encontrado no TXT selecionado.');
    if (itensProcesso.length && !confirm('Substituir os itens atuais pelos itens importados do TXT?')) return;
    itensProcesso = importados;
    renderItens();
    calcularValorEstimado();
    const campoQtdItens = container.querySelector('#lic_etp_qtd_itens');
    if (campoQtdItens) campoQtdItens.value = itensProcesso.length;
    showToast(`${itensProcesso.length} item(s) importado(s).`);
  } catch (error) {
    console.error(error);
    alert('Não foi possível importar o TXT de itens. Verifique o arquivo e tente novamente.');
  } finally {
    fileImportItem.value = '';
  }
});

container.querySelector('#lic_ata_close').onclick = () => fecharDialogInterno(dlgAta);
container.querySelector('#lic_ata_cancel').onclick = () => fecharDialogInterno(dlgAta);
container.querySelector('#lic_atas_view_close').onclick = () => fecharDialogInterno(dlgAtasView);
container.querySelector('#lic_ata_item_import').onclick = () => container.querySelector('#lic_ata_item_file').click();
container.querySelector('#lic_ata_item_file').addEventListener('change', async () => {
  const file = container.querySelector('#lic_ata_item_file').files[0];
  if (!file) return;
  const texto = await file.text();
  itensAtaDraft = parseItensEditalTxt(texto);
  container.querySelector('#lic_ata_item_file').value = '';
  renderItensAtaDraft();
});
container.querySelector('#lic_ata_item_clear').onclick = () => {
  if (itensAtaDraft.length && !confirm('Limpar os itens importados desta ata?')) return;
  itensAtaDraft = [];
  renderItensAtaDraft();
};
container.querySelector('#lic_ata_item_close').onclick = () => fecharDialogInterno(dlgAtaItem);
container.querySelector('#lic_ata_item_cancel').onclick = () => fecharDialogInterno(dlgAtaItem);
container.querySelector('#lic_ata_aditivo_add').onclick = () => abrirAditivo();
container.querySelector('#lic_aditivo_close').onclick = () => fecharDialogInterno(dlgAditivo);
container.querySelector('#lic_aditivo_cancel').onclick = () => fecharDialogInterno(dlgAditivo);

[
  '#lic_ata_rp_assinatura',
  '#lic_ata_rp_vig_inicio',
  '#lic_ata_rp_vig_fim',
  '#lic_aditivo_assinatura',
  '#lic_aditivo_publicacao'
].forEach(sel => aplicarMascaraData(container.querySelector(sel)));
aplicarMascaraPeriodoData(container.querySelector('#lic_aditivo_vigencia'));

const campoCnpjAta = container.querySelector('#lic_ata_rp_cnpj');
campoCnpjAta.addEventListener('input', () => {
  campoCnpjAta.value = formatCnpj(campoCnpjAta.value);
  if (onlyDigits(campoCnpjAta.value).length === 14) preencherFornecedorAtaPorCnpj();
});
campoCnpjAta.addEventListener('blur', preencherFornecedorAtaPorCnpj);

container.querySelector('#lic_ata_item_quantidade').addEventListener('input', atualizarTotalItemAta);
container.querySelector('#lic_ata_item_valor_unitario').addEventListener('input', atualizarTotalItemAta);

container.querySelector('#lic_ata_delete').onclick = () => {
  const idx = container.querySelector('#lic_ata_idx').value;
  if (idx === "" || !confirm('Excluir esta ata?')) return;
  atasRegistroPreco.splice(Number(idx), 1);
  renderAtasPreview();
  fecharDialogInterno(dlgAta);
};

container.querySelector('#lic_ata_item_delete').onclick = () => {
  const idx = container.querySelector('#lic_ata_item_idx').value;
  if (idx === "" || !confirm('Excluir este item?')) return;
  itensAtaDraft.splice(Number(idx), 1);
  renderItensAtaDraft();
  fecharDialogInterno(dlgAtaItem);
};

container.querySelector('#lic_aditivo_delete').onclick = () => {
  const idx = container.querySelector('#lic_aditivo_idx').value;
  if (idx === "" || !confirm('Excluir este aditivo?')) return;
  aditivosAtaDraft.splice(Number(idx), 1);
  renderAditivosDraft();
  fecharDialogInterno(dlgAditivo);
};

formAta.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const idx = container.querySelector('#lic_ata_idx').value;
  const atual = idx !== "" ? atasRegistroPreco[Number(idx)] : {};
  let pdfAta = null;
  let pdfExtrato = null;
  try {
    pdfAta = await arquivoParaBase64(container.querySelector('#lic_ata_rp_pdf'), atual?.pdfAta);
    pdfExtrato = await arquivoParaBase64(container.querySelector('#lic_ata_rp_pdf_extrato'), atual?.pdfExtrato);
  } catch (error) {
    console.error('Erro ao salvar anexos da ata:', error);
    return alert('Não foi possível salvar os PDFs da ata no IndexedDB. Verifique se o navegador permite armazenamento local para este arquivo.');
  }
  if (!validarItensAtaNaIrp(irpAtualDoProcesso(), itensAtaDraft)) return;

  const duplicado = encontrarItemAtaDuplicado(atasRegistroPreco, itensAtaDraft, {
    id: atual?.id || '',
    index: idx !== '' ? Number(idx) : -1
  });
  if (duplicado) {
    return alert(`Este item já está vinculado à ata ${duplicado.ata?.numero || ''}/${duplicado.ata?.ano || ''} deste processo. Remova o item duplicado antes de salvar.`);
  }

  const ata = {
    id: atual?.id || genId(),
    numero: container.querySelector('#lic_ata_rp_numero').value.trim(),
    ano: container.querySelector('#lic_ata_rp_ano').value.trim(),
    unidadeOrcamentaria: container.querySelector('#lic_ata_rp_unidade').value.trim(),
    objeto: container.querySelector('#lic_ata_rp_objeto').value.trim(),
    objetoResumido: container.querySelector('#lic_ata_rp_objeto_resumido').value.trim(),
    modalidade: container.querySelector('#lic_ata_rp_modalidade').value.trim(),
    dataAssinatura: container.querySelector('#lic_ata_rp_assinatura').value.trim(),
    vigenciaInicio: container.querySelector('#lic_ata_rp_vig_inicio').value.trim(),
    vigenciaFim: container.querySelector('#lic_ata_rp_vig_fim').value.trim(),
    linkPncp: container.querySelector('#lic_ata_rp_pncp').value.trim(),
    fornecedorCnpj: container.querySelector('#lic_ata_rp_cnpj').value.trim(),
    fornecedorRazao: container.querySelector('#lic_ata_rp_fornecedor').value.trim(),
    fornecedorFantasia: container.querySelector('#lic_ata_rp_fantasia').value.trim(),
    pdfAta,
    pdfExtrato,
    itens: itensAtaDraft,
    aditivos: aditivosAtaDraft,
    atualizadoEm: new Date().toLocaleString('pt-BR'),
    criadoEm: atual?.criadoEm || new Date().toLocaleString('pt-BR')
  };

  if (!ata.numero || !ata.ano) return alert('Informe o número e o ano da ata.');
  if (ata.fornecedorCnpj) {
    upsertFornecedor({
      cnpj: ata.fornecedorCnpj,
      razaoSocial: ata.fornecedorRazao,
      nomeFantasia: ata.fornecedorFantasia,
      origem: `ATA ${ata.numero || ''}/${ata.ano || ''}`.trim()
    });
  }
  if (idx !== "") atasRegistroPreco[Number(idx)] = ata;
  else atasRegistroPreco.push(ata);
  renderAtasPreview();
  fecharDialogInterno(dlgAta);
  showToast('Ata adicionada. Salve o processo para gravar as alterações.');
});

formAtaItem.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const idx = container.querySelector('#lic_ata_item_idx').value;
  const atual = idx !== "" ? itensAtaDraft[Number(idx)] : {};
  const item = {
    id: atual?.id || genId(),
    codigo: container.querySelector('#lic_ata_item_codigo').value.trim(),
    descricao: container.querySelector('#lic_ata_item_descricao').value.trim(),
    unidade: container.querySelector('#lic_ata_item_unidade').value.trim(),
    quantidade: container.querySelector('#lic_ata_item_quantidade').value.trim(),
    valorUnitario: container.querySelector('#lic_ata_item_valor_unitario').value.trim(),
    valorTotal: container.querySelector('#lic_ata_item_valor_total').value.trim(),
    atualizadoEm: new Date().toLocaleString('pt-BR'),
    criadoEm: atual?.criadoEm || new Date().toLocaleString('pt-BR')
  };

  if (!item.descricao) return alert('Informe a descrição do item.');
  if (idx !== "") itensAtaDraft[Number(idx)] = item;
  else itensAtaDraft.push(item);
  renderItensAtaDraft();
  fecharDialogInterno(dlgAtaItem);
});

formAditivo.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const idx = container.querySelector('#lic_aditivo_idx').value;
  const atual = idx !== "" ? aditivosAtaDraft[Number(idx)] : {};
  let pdf = null;
  try {
    pdf = await arquivoParaBase64(container.querySelector('#lic_aditivo_pdf'), atual?.pdf);
  } catch (error) {
    console.error('Erro ao salvar PDF do aditivo:', error);
    return alert('Não foi possível salvar o PDF do aditivo no IndexedDB. Verifique se o navegador permite armazenamento local para este arquivo.');
  }
  const aditivo = {
    id: atual?.id || genId(),
    numero: container.querySelector('#lic_aditivo_numero').value.trim(),
    vigencia: container.querySelector('#lic_aditivo_vigencia').value.trim(),
    dataAssinatura: container.querySelector('#lic_aditivo_assinatura').value.trim(),
    publicacao: container.querySelector('#lic_aditivo_publicacao').value.trim(),
    pdf,
    atualizadoEm: new Date().toLocaleString('pt-BR'),
    criadoEm: atual?.criadoEm || new Date().toLocaleString('pt-BR')
  };

  if (!aditivo.numero) return alert('Informe o número do aditivo.');
  if (idx !== "") aditivosAtaDraft[Number(idx)] = aditivo;
  else aditivosAtaDraft.push(aditivo);
  renderAditivosDraft();
  fecharDialogInterno(dlgAditivo);
});

    const fld = {
      idx: container.querySelector('#lic_idx'),
      interessadoOriginal: container.querySelector('#lic_interessado_original'),
      numero: container.querySelector('#lic_numero'),
      dataCriacao: container.querySelector('#lic_dataCriacao'),
      objeto: container.querySelector('#lic_objeto'),
      secretaria: container.querySelector('#lic_secretaria'),

      // novos
      descricaoCompleta: container.querySelector('#lic_descricaoCompleta'),
      
      observacao: container.querySelector('#lic_observacao'),
      volumes: container.querySelector('#lic_volumes'),
      
      situacao: container.querySelector('#lic_situacao'),
      fase: container.querySelector('#lic_fase'),
      tipoProcesso: container.querySelector('#lic_tipo_processo'),
      novoTipoProtocolo: container.querySelector('#lic_novo_tipo_protocolo'),
      naturezaProcesso: container.querySelector('#lic_natureza_processo'),
      assuntoProtocolo: container.querySelector('#lic_assunto_protocolo'),
      novoAssuntoProtocolo: container.querySelector('#lic_novo_assunto_protocolo'),
      registroPrecos: container.querySelector('#lic_registro_precos'),
      irpRegistroPreco: container.querySelector('#lic_irp_registro_preco'),
      credTipo: container.querySelector('#lic_cred_tipo'),
      credNumero: container.querySelector('#lic_cred_numero'),
      credPrincipal: container.querySelector('#lic_cred_principal'),
      credCnpj: container.querySelector('#lic_cred_cnpj'),
      credRazao: container.querySelector('#lic_cred_razao'),
      credFantasia: container.querySelector('#lic_cred_fantasia')
    };

    const credItensContainer = container.querySelector('#cred_itens_container');
    const credItensFile = container.querySelector('#lic_cred_itens_file');
    const btnCredImportItens = container.querySelector('#lic_cred_import_itens');
    const btnCredLimparItens = container.querySelector('#lic_cred_limpar_itens');
    const credItensStatus = container.querySelector('#lic_cred_itens_status');
    const credItensPreview = container.querySelector('#lic_cred_itens_preview');
    let credItens = [];
    const btnCredSelectItens = container.querySelector('#lic_cred_select_itens');
    const btnCredLimparItensContratacao = container.querySelector('#lic_cred_limpar_itens_contratacao');
    const credItensContratacaoStatus = container.querySelector('#lic_cred_itens_contratacao_status');
    const credItensContratacaoPreview = container.querySelector('#lic_cred_itens_contratacao_preview');
    const dlgCredSelectItens = container.querySelector('#lic_cred_select_itens_dlg');
    const credSelectItensBody = container.querySelector('#lic_cred_select_itens_body');
    const credSelectItensClose = container.querySelector('#lic_cred_select_itens_close');
    const credSelectItensCancel = container.querySelector('#lic_cred_select_itens_cancel');
    const credSelectItensSave = container.querySelector('#lic_cred_select_itens_save');
    let credItensContratacao = [];
    let etapasConcluidas = {};
    const fasesDisponiveisProcesso = [
      { id: "sd", nome: "SOLICITAÇÃO DE DEMANDA" },
      { id: "etp", nome: "ESTUDO TÉCNICO PRELIMINAR" },
      { id: "requisicao", nome: "REQUISIÇÃO" },
      { id: "cotacao", nome: "COTAÇÃO" },
      { id: "tr", nome: "TERMO DE REFERÊNCIA" },
      { id: "edital", nome: "EDITAL" },
      { id: "licitacao", nome: "LICITAÇÃO" },
      { id: "aviso_contratacao_direta", nome: "AVISO DE CONTRATAÇÃO DIRETA" },
      { id: "resultado", nome: "RESULTADO" },
      { id: "homologacao", nome: "HOMOLOGAÇÃO" }
    ];
    let fasesAtivasProcesso = [];
    const faseAddSelect = container.querySelector('#lic_fase_add_select');
    const faseAddBtn = container.querySelector('#lic_fase_add_btn');
    const fasesAtivasList = container.querySelector('#lic_fases_ativas');

    const btnAssocSecretaria = container.querySelector('#lic_assoc_secretaria');
    const dlgAssoc = container.querySelector('#lic_assoc_dlg');
    const assocClose = container.querySelector('#lic_assoc_close');
    const assocCancel = container.querySelector('#lic_assoc_cancel');
    const assocSave = container.querySelector('#lic_assoc_save');
    const assocInteressado = container.querySelector('#lic_assoc_interessado');
    const assocSelect = container.querySelector('#lic_assoc_select');




btnAddItem.onclick = ()=>{

itemProcessoEditIndex = -1;
tituloItemForm.textContent = "Novo Item";
fldItemDesc.value = "";
fldItemValor.value = "";
fldItemQtd.value = "";
fldItemUnidade.value = "";

dlgItemForm.showModal();

};

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseItensEditalTxt(texto) {
  return String(texto || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(line => {
      const linha = String(line || '').trim();
      const separador = linha.includes('\t') ? '\t'
        : linha.includes(';') ? ';'
        : linha.includes('|') ? '|'
        : null;
      const celulas = separador ? linha.split(separador) : [linha];
      return celulas.map(cell => cell.replace(/\s+/g, ' ').trim());
    })
    .filter(row => row.some(cell => cell));
}

function indiceColunaItemProcesso(header, nomes) {
  return header.findIndex(cell => nomes.some(nome => normalizarCadastro(cell).includes(normalizarCadastro(nome))));
}

function itensProcessoDoTxt(texto) {
  const linhas = parseItensEditalTxt(texto);
  if (!linhas.length) return [];
  const primeiraLinha = linhas[0].map(cell => normalizarCadastro(cell)).join(' ');
  const possuiCabecalho = /(ITEM|DESCRICAO|DESCRIÇÃO|PRODUTO|SERVICO|SERVIÇO|QUANTIDADE|QTDE|UNIDADE|VALOR)/i.test(primeiraLinha);
  const header = possuiCabecalho ? linhas[0] : [];
  const dados = possuiCabecalho ? linhas.slice(1) : linhas;

  const idxDesc = possuiCabecalho ? indiceColunaItemProcesso(header, ["DESCRIÇÃO", "DESCRICAO", "PRODUTO", "SERVIÇO", "SERVICO", "OBJETO"]) : 0;
  const idxValor = possuiCabecalho ? indiceColunaItemProcesso(header, ["VALOR UNITÁRIO", "VALOR UNITARIO", "VL UNIT", "PREÇO", "PRECO"]) : 1;
  const idxQtd = possuiCabecalho ? indiceColunaItemProcesso(header, ["QUANTIDADE", "QTDE", "QTD"]) : 2;
  const idxUnidade = possuiCabecalho ? indiceColunaItemProcesso(header, ["UNIDADE", "UN.", "UNID", "MEDIDA"]) : 3;

  return dados.map(row => ({
    descricao: String(row[idxDesc >= 0 ? idxDesc : 0] || "").trim(),
    valor: String(row[idxValor >= 0 ? idxValor : 1] || "").trim(),
    quantidade: String(row[idxQtd >= 0 ? idxQtd : 2] || "").trim(),
    unidade: String(row[idxUnidade >= 0 ? idxUnidade : 3] || "").trim()
  })).filter(item => item.descricao || item.valor || item.quantidade || item.unidade);
}

function validarArquivoItensImportado(items, contexto = 'arquivo TXT') {
  const linhas = normalizarItensAta(items);
  if (!linhas.length) {
    alert(`Não encontrei dados no ${contexto}. Verifique se o arquivo não está vazio.`);
    return false;
  }
  if (linhas.length <= 1) {
    alert(`O ${contexto} possui apenas o cabeçalho. Inclua ao menos uma linha de item abaixo do nome das colunas.`);
    return false;
  }
  const colunas = linhas.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
  if (colunas <= 1) {
    alert(`O ${contexto} foi lido com apenas uma coluna. Exporte pelo Conversor de Itens ou use um TXT separado por TAB, ponto e vírgula (;) ou barra vertical (|).`);
    return false;
  }
  return true;
}

function renderCredItensPreview() {
  if (!credItens.length) {
    credItensStatus.textContent = 'Nenhum item importado.';
    credItensPreview.style.display = 'none';
    credItensPreview.innerHTML = '';
    return;
  }

  const colunas = credItens.reduce((max, row) => Math.max(max, row.length), 0);
  credItensStatus.textContent = `${credItens.length} linha(s) e ${colunas} coluna(s) importadas.`;
  const sample = credItens.slice(0, 10);

  credItensPreview.style.display = 'block';
  credItensPreview.innerHTML = `
    <table>
      <tbody>
        ${sample.map((row, index) => `
          <tr>
            ${Array.from({ length: colunas }, (_, i) => index === 0
              ? `<th>${escHtml(row[i] || '')}</th>`
              : `<td>${escHtml(row[i] || '')}</td>`
            ).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${credItens.length > sample.length ? `<div class="muted" style="margin-top:6px">Prévia limitada às primeiras ${sample.length} linhas.</div>` : ''}
  `;
}

btnCredImportItens.onclick = () => credItensFile.click();

credItensFile.addEventListener('change', async () => {
  const file = credItensFile.files[0];
  if (!file) return;
  const texto = await file.text();
  credItens = parseItensEditalTxt(texto);
  credItensFile.value = '';
  renderCredItensPreview();
});

btnCredLimparItens.onclick = () => {
  if (credItens.length && !confirm('Limpar os itens importados deste credenciamento?')) return;
  credItens = [];
  renderCredItensPreview();
};

function renderCredItensContratacaoPreview() {
  if (!credItensContratacao.length) {
    credItensContratacaoStatus.textContent = 'Nenhum item selecionado.';
    credItensContratacaoPreview.style.display = 'none';
    credItensContratacaoPreview.innerHTML = '';
    return;
  }

  const colunas = credItensContratacao.reduce((max, row) => Math.max(max, row.length), 0);
  const itensSelecionados = credItensContratacao.length > 1 ? credItensContratacao.length - 1 : credItensContratacao.length;
  credItensContratacaoStatus.textContent = `${itensSelecionados} item(ns) selecionado(s).`;
  const sample = credItensContratacao.slice(0, 8);

  credItensContratacaoPreview.style.display = 'block';
  credItensContratacaoPreview.innerHTML = `
    <table>
      <tbody>
        ${sample.map((row, index) => `
          <tr>
            ${Array.from({ length: colunas }, (_, i) => index === 0
              ? `<th>${escHtml(row[i] || '')}</th>`
              : `<td>${escHtml(row[i] || '')}</td>`
            ).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${credItensContratacao.length > sample.length ? `<div class="muted" style="margin-top:6px">Prévia limitada às primeiras ${sample.length} linhas.</div>` : ''}
  `;
}

function getCredenciamentoPrincipalSelecionado() {
  return data.find(p => p.id === fld.credPrincipal.value);
}

function abrirSelecaoItensContratacao() {
  const principal = getCredenciamentoPrincipalSelecionado();
  const itens = Array.isArray(principal?.credItens) ? principal.credItens : [];

  if (!principal) {
    alert('Selecione primeiro o credenciamento ao qual este processo pertence.');
    return;
  }

  if (!itens.length) {
    alert('O credenciamento selecionado ainda não possui itens do edital importados.');
    return;
  }

  const colunas = itens.reduce((max, row) => Math.max(max, row.length), 0);
  const selecionados = new Set(
    credItensContratacao.slice(1).map(row => JSON.stringify(row))
  );

  credSelectItensBody.innerHTML = `
    <div class="muted" style="margin-bottom:10px">
      ${itens.length} linha(s) disponíveis em ${principal.credNumero || principal.numero || ''}.
    </div>
    <div style="overflow:auto;max-height:68vh">
      <table>
        <tbody>
          ${itens.map((row, rowIndex) => `
            <tr>
              <td style="width:48px;text-align:center">
                ${rowIndex === 0 ? '' : `<input type="checkbox" data-cred-item-row="${rowIndex}" ${selecionados.has(JSON.stringify(row)) ? 'checked' : ''}>`}
              </td>
              ${Array.from({ length: colunas }, (_, colIndex) => rowIndex === 0
                ? `<th>${escHtml(row[colIndex] || '')}</th>`
                : `<td>${escHtml(row[colIndex] || '')}</td>`
              ).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  dlgCredSelectItens.showModal();
}

btnCredSelectItens.onclick = abrirSelecaoItensContratacao;
credSelectItensClose.onclick = credSelectItensCancel.onclick = () => dlgCredSelectItens.close();

credSelectItensSave.onclick = () => {
  const principal = getCredenciamentoPrincipalSelecionado();
  const itens = Array.isArray(principal?.credItens) ? principal.credItens : [];
  const selecionados = Array.from(credSelectItensBody.querySelectorAll('[data-cred-item-row]:checked'))
    .map(check => itens[Number(check.dataset.credItemRow)])
    .filter(Boolean);

  credItensContratacao = selecionados.length ? [itens[0], ...selecionados] : [];
  renderCredItensContratacaoPreview();
  dlgCredSelectItens.close();
};

btnCredLimparItensContratacao.onclick = () => {
  if (credItensContratacao.length && !confirm('Limpar os itens selecionados desta contratação?')) return;
  credItensContratacao = [];
  renderCredItensContratacaoPreview();
};

btnItemSave.onclick = ()=>{

const descricao = fldItemDesc.value.trim();
const valor = fldItemValor.value;
const quantidade = fldItemQtd.value;
const unidade = fldItemUnidade.value;

if(!descricao) return alert("Informe a descrição do item");

const itemProcesso = {
descricao,
valor,
quantidade,
unidade
};

if (itemProcessoEditIndex >= 0) {
  itensProcesso[itemProcessoEditIndex] = itemProcesso;
} else {
  itensProcesso.push(itemProcesso);
}

itemProcessoEditIndex = -1;

renderItens();
calcularValorEstimado();

dlgItemForm.close();

const campoQtdItens = container.querySelector('#lic_etp_qtd_itens');
if(campoQtdItens) campoQtdItens.value = itensProcesso.length;

};

btnItemFormClose.onclick = ()=> dlgItemForm.close();
btnItemCancel.onclick = ()=> dlgItemForm.close();

fldItemValor.addEventListener("input",(e)=>{

let value = e.target.value.replace(/\D/g,'');

if(value===""){
e.target.value="";
return;
}

const numero = parseFloat(value)/100;

e.target.value = numero.toLocaleString('pt-BR',{
minimumFractionDigits:2,
maximumFractionDigits:2
});

});

function calcularValorEstimado(){

let total = 0;

itensProcesso.forEach(item => {

let valor = item.valor || "0";

valor = valor.replace(/\./g,'').replace(',','.');

valor = parseFloat(valor) || 0;

let qtd = parseFloat(item.quantidade) || 0;

total += valor * qtd;

});

const campoEstimado = container.querySelector('#lic_etp_valor_estimado');

if(campoEstimado){

campoEstimado.value = total.toLocaleString('pt-BR',{
minimumFractionDigits:2,
maximumFractionDigits:2
});

}

}



    const fldEdit = {
      idx: container.querySelector('#lic_edit_idx'),
      numero: container.querySelector('#lic_edit_numero'),
      dataCriacao: container.querySelector('#lic_edit_dataCriacao'),
      objeto: container.querySelector('#lic_edit_objeto'),
      secretaria: container.querySelector('#lic_edit_secretaria'),

      // novos
      descricaoCompleta: container.querySelector('#lic_edit_descricaoCompleta'),
      
      observacao: container.querySelector('#lic_edit_observacao'),
      volumes: container.querySelector('#lic_edit_volumes'),
      valorEstimado: container.querySelector('#lic_edit_valorEstimado'),
      recurso_municipal: container.querySelector('#lic_edit_recurso_municipal'),
      recurso_estadual: container.querySelector('#lic_edit_recurso_estadual'),
      recurso_federal: container.querySelector('#lic_edit_recurso_federal'),
      modalidade: container.querySelector('#lic_edit_modalidade'),
      situacao: container.querySelector('#lic_edit_situacao'),
      fase: container.querySelector('#lic_edit_fase')
    };

    const viewFields = {
      numero: container.querySelector('#view_numero'),
      secretaria: container.querySelector('#view_secretaria'),
      dataCriacao: container.querySelector('#view_dataCriacao'),
      objeto: container.querySelector('#view_objeto'),

      // novos
      descricaoCompleta: container.querySelector('#view_descricaoCompleta'),
      
      observacao: container.querySelector('#view_observacao'),
      volumes: container.querySelector('#view_volumes'),
      valorEstimado: container.querySelector('#view_valorEstimado'),
      recurso: container.querySelector('#view_recurso'),
      modalidade: container.querySelector('#view_modalidade'),
      situacao: container.querySelector('#view_situacao'),
      fase: container.querySelector('#view_fase')
    };

    // dados principais
    let data = loadData();
    let filtered = data.slice();
    let itensProcesso = [];
    const selectedProcessos = new Set();
    const TIPOS_PUBLICACAO_PROCESSO = [
      "AVISO DE LICITAÇÃO",
      "AVISO DE CONTRATAÇÃO DIRETA",
      "EXTRATO DO CONTRATO",
      "AVISO DE RESULTADO",
      "AVISO DE HOMOLOGAÇÃO / ADJUDICAÇÃO",
      "AVISO DE SUSPENSÃO",
      "AUTORIZAÇÃO DA AUTORIDADE COMPETENTE",
      "RETIFICAÇÃO"
    ];

    const MEIOS_PUBLICACAO_PROCESSO = [
      { id: "diarioMunicipio", label: "DIÁRIO OFICIAL DO MUNICÍPIO" },
      { id: "diarioEstado", label: "DIÁRIO OFICIAL DO ESTADO" },
      { id: "diarioUniao", label: "DIÁRIO OFICIAL DA UNIÃO" },
      { id: "jornal", label: "JORNAL" }
    ];

    let publicacoesProcesso = [];

    function atualizarBotaoPncpPublicacao() {
      const input = container.querySelector('#lic_publicacao_pncp_link');
      const btn = container.querySelector('#lic_publicacao_pncp_abrir');
      if (!input || !btn) return;
      const link = input.value.trim();
      btn.style.display = link ? 'inline-flex' : 'none';
      btn.href = link || '#';
    }

    function novaPublicacaoProcesso() {
      return { id: genId(), tipo: "", meios: {}, __editing: true, __open: true };
    }

    function meioPublicacaoAtivo(dados) {
      return !!(dados?.ativo || dados?.data || dados?.anexo || dados?.arquivoPendente);
    }

    function resumoMeiosPublicacao(meios = {}) {
      const ativos = MEIOS_PUBLICACAO_PROCESSO
        .map(meio => ({ meio, dados: meios[meio.id] || {} }))
        .filter(item => meioPublicacaoAtivo(item.dados));

      if (!ativos.length) return '<div class="empty">Nenhum meio informado.</div>';

      return ativos.map(({ meio, dados }) => `
        <div class="lic-pub-summary-meio">
          <div class="lic-pub-summary-meio-info">
            <strong>${meio.label}</strong>
            <span>Data: ${escapeAttr(dados.data || '')}</span>
          </div>
          <div class="lic-pub-summary-anexo">
            ${dados.anexo ? linkAnexoPdf(dados.anexo, dados.anexo.nome || 'Visualizar anexo') : (dados.arquivoPendente ? `<span class="muted">${escapeAttr(dados.arquivoPendente.name || 'Anexo selecionado')}</span>` : '<span class="muted">Sem anexo</span>')}
          </div>
        </div>
      `).join('');
    }

    function sincronizarPublicacaoCard(card) {
      const index = Number(card?.dataset.pubIndex);
      if (!Number.isInteger(index) || !publicacoesProcesso[index]) return true;

      const atual = publicacoesProcesso[index];
      const tipo = card.querySelector('.lic-pub-tipo')?.value || '';
      const meios = {};

      for (const meio of MEIOS_PUBLICACAO_PROCESSO) {
        const marcado = !!card.querySelector(`.lic-pub-meio-check[data-meio="${meio.id}"]`)?.checked;
        if (!marcado) continue;

        const dataPub = card.querySelector(`.lic-pub-data[data-meio="${meio.id}"]`)?.value || '';
        const inputAnexo = card.querySelector(`.lic-pub-anexo[data-meio="${meio.id}"]`);
        const anexoAnterior = atual.meios?.[meio.id]?.anexo || null;
        const arquivoPendente = inputAnexo?.files?.[0] || atual.meios?.[meio.id]?.arquivoPendente || null;
        meios[meio.id] = { ativo: true, label: meio.label, data: dataPub.trim(), anexo: anexoAnterior, arquivoPendente };
      }

      publicacoesProcesso[index] = { ...atual, tipo, meios };
      return true;
    }

    function validarPublicacao(pub) {
      if (!pub.tipo) return 'Selecione o tipo da publicação.';
      const meiosAtivos = MEIOS_PUBLICACAO_PROCESSO.filter(meio => meioPublicacaoAtivo(pub.meios?.[meio.id]));
      if (!meiosAtivos.length) return 'Marque pelo menos um meio de publicação.';

      for (const meio of meiosAtivos) {
        const dados = pub.meios?.[meio.id] || {};
        if (!String(dados.data || '').trim()) return `Informe a data da publicação para ${meio.label}.`;
        if (!dados.anexo && !dados.arquivoPendente) return `Informe o anexo da publicação para ${meio.label}.`;
      }
      return '';
    }

    async function finalizarPublicacaoProcesso(index, card) {
      sincronizarPublicacaoCard(card);
      const pub = publicacoesProcesso[index];
      const erro = validarPublicacao(pub);
      if (erro) {
        alert(erro);
        return;
      }

      try {
        const meios = {};
        for (const meio of MEIOS_PUBLICACAO_PROCESSO) {
          const dados = pub.meios?.[meio.id] || {};
          if (!meioPublicacaoAtivo(dados)) continue;
          const anexo = await salvarArquivoIndexedDB(dados.arquivoPendente, dados.anexo || null);
          meios[meio.id] = { ativo: true, label: meio.label, data: String(dados.data || '').trim(), anexo };
        }
        publicacoesProcesso[index] = { id: pub.id || genId(), tipo: pub.tipo, meios, __editing: false, __open: true };
        renderPublicacoesProcesso();
      } catch (error) {
        console.error('Erro ao salvar anexo da publicação:', error);
        alert('Não foi possível salvar o anexo da publicação. Verifique o armazenamento local do navegador.');
      }
    }

    function renderPublicacoesProcesso() {
      const lista = container.querySelector('#lic_publicacoes_container');
      if (!lista) return;

      if (!publicacoesProcesso.length) {
        lista.innerHTML = '<div class="empty">Nenhuma publicação cadastrada.</div>';
        return;
      }

      lista.innerHTML = publicacoesProcesso.map((pub, index) => {
        const meios = pub.meios || {};
        const qtdMeios = MEIOS_PUBLICACAO_PROCESSO.filter(meio => meioPublicacaoAtivo(meios[meio.id])).length;
        if (!pub.__editing) {
          const aberto = !!pub.__open;
          return `
            <div class="lic-publicacao-resumo ${aberto ? 'aberta' : ''}" data-pub-index="${index}">
              <div class="lic-pub-summary-head lic-pub-toggle" role="button" tabindex="0" title="Clique para ${aberto ? 'ocultar' : 'visualizar'} os detalhes">
                <div class="lic-pub-title-area">
                  <span class="lic-pub-arrow">${aberto ? '▾' : '▸'}</span>
                  <div>
                    <span class="lic-pub-chip">${qtdMeios} MEIO(S)</span>
                    <strong>${escapeAttr(pub.tipo || 'PUBLICAÇÃO')}</strong>
                  </div>
                </div>
                <div class="lic-pub-actions">
                  <button type="button" class="btn lic-pub-edit">Editar</button>
                  <button type="button" class="btn lic-pub-remove">Remover</button>
                </div>
              </div>
              <div class="lic-pub-summary-grid" style="display:${aberto ? 'grid' : 'none'}">${resumoMeiosPublicacao(meios)}</div>
            </div>
          `;
        }

        const meiosHtml = MEIOS_PUBLICACAO_PROCESSO.map(meio => {
          const dados = meios[meio.id] || {};
          const marcado = meioPublicacaoAtivo(dados);
          const statusAnexo = dados.arquivoPendente
            ? `Selecionado: ${escapeAttr(dados.arquivoPendente.name || '')}`
            : (dados.anexo ? linkAnexoPdf(dados.anexo, dados.anexo.nome || 'Visualizar anexo') : 'Nenhum anexo selecionado.');
          return `
            <div class="lic-pub-meio-edit" data-meio="${meio.id}">
              <label class="lic-pub-meio-check-label">
                <input type="checkbox" class="lic-pub-meio-check" data-meio="${meio.id}" ${marcado ? 'checked' : ''}>
                <span>${meio.label}</span>
              </label>
              <div class="lic-pub-meio-detalhes" style="display:${marcado ? 'grid' : 'none'}">
                <div class="field">
                  <label>Data da publicação</label>
                  <input class="input lic-pub-data" data-meio="${meio.id}" placeholder="DD/MM/AAAA" maxlength="10" value="${escapeAttr(dados.data || '')}">
                </div>
                <div class="field">
                  <label>Anexo da publicação</label>
                  <input class="input lic-pub-anexo" data-meio="${meio.id}" type="file" accept="application/pdf,.pdf">
                  <div class="muted lic-pub-anexo-status" style="font-size:12px;margin-top:4px">${statusAnexo}</div>
                </div>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="lic-publicacao-form" data-pub-index="${index}">
            <div class="lic-pub-form-head">
              <div class="field" style="flex:1;margin:0">
                <label>Tipo de publicação</label>
                <select class="select lic-pub-tipo">
                  <option value="">-- selecione --</option>
                  ${TIPOS_PUBLICACAO_PROCESSO.map(tipo => `<option value="${escapeAttr(tipo)}" ${pub.tipo === tipo ? 'selected' : ''}>${tipo}</option>`).join('')}
                </select>
              </div>
              <button type="button" class="btn lic-pub-remove">Remover</button>
            </div>
            <div class="lic-pub-meios-title">Meios publicados</div>
            <div class="lic-pub-meios-edit-grid">${meiosHtml}</div>
            <div class="lic-pub-form-actions">
              <button type="button" class="btn primary lic-pub-finish">Concluir publicação</button>
            </div>
          </div>
        `;
      }).join('');

      lista.querySelectorAll('.lic-pub-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const card = btn.closest('[data-pub-index]');
          const index = Number(card?.dataset.pubIndex);
          if (Number.isInteger(index)) {
            publicacoesProcesso.splice(index, 1);
            renderPublicacoesProcesso();
          }
        });
      });

      lista.querySelectorAll('.lic-pub-toggle').forEach(head => {
        const alternar = () => {
          const card = head.closest('[data-pub-index]');
          const index = Number(card?.dataset.pubIndex);
          if (Number.isInteger(index) && publicacoesProcesso[index]) {
            publicacoesProcesso[index].__open = !publicacoesProcesso[index].__open;
            renderPublicacoesProcesso();
          }
        };
        head.addEventListener('click', (event) => {
          if (event.target.closest('button')) return;
          alternar();
        });
        head.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          alternar();
        });
      });
      lista.querySelectorAll('.lic-pub-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          const card = btn.closest('[data-pub-index]');
          const index = Number(card?.dataset.pubIndex);
          if (Number.isInteger(index) && publicacoesProcesso[index]) {
            publicacoesProcesso[index].__editing = true;
            renderPublicacoesProcesso();
          }
        });
      });

      lista.querySelectorAll('.lic-pub-finish').forEach(btn => {
        btn.addEventListener('click', async () => {
          const card = btn.closest('.lic-publicacao-form');
          const index = Number(card?.dataset.pubIndex);
          if (!Number.isInteger(index)) return;
          btn.disabled = true;
          btn.textContent = 'Salvando...';
          await finalizarPublicacaoProcesso(index, card);
          btn.disabled = false;
          btn.textContent = 'Concluir publicação';
        });
      });

      lista.querySelectorAll('.lic-pub-meio-check').forEach(chk => {
        chk.addEventListener('change', () => {
          const meioBox = chk.closest('.lic-pub-meio-edit');
          const detalhes = meioBox?.querySelector('.lic-pub-meio-detalhes');
          if (detalhes) detalhes.style.display = chk.checked ? 'grid' : 'none';
        });
      });

      lista.querySelectorAll('.lic-pub-anexo').forEach(input => {
        input.addEventListener('change', () => {
          const status = input.closest('.field')?.querySelector('.lic-pub-anexo-status');
          if (status) status.textContent = input.files?.[0]?.name ? `Selecionado: ${input.files[0].name}` : 'Nenhum anexo selecionado.';
        });
      });

      lista.querySelectorAll('.lic-pub-data').forEach(aplicarMascaraData);
    }

    async function coletarPublicacoesProcesso() {
      container.querySelectorAll('.lic-publicacao-form').forEach(sincronizarPublicacaoCard);
      const coletadas = [];

      for (const pub of publicacoesProcesso) {
        if (!pub.tipo && !Object.values(pub.meios || {}).some(meioPublicacaoAtivo)) continue;

        const erro = validarPublicacao(pub);
        if (erro) {
          alert(erro);
          return null;
        }

        const meios = {};
        for (const meio of MEIOS_PUBLICACAO_PROCESSO) {
          const dados = pub.meios?.[meio.id] || {};
          if (!meioPublicacaoAtivo(dados)) continue;
          const anexo = await salvarArquivoIndexedDB(dados.arquivoPendente, dados.anexo || null);
          meios[meio.id] = { ativo: true, label: meio.label, data: String(dados.data || '').trim(), anexo };
        }

        coletadas.push({ id: pub.id || genId(), tipo: pub.tipo, meios });
      }

      publicacoesProcesso = coletadas.map(pub => ({ ...pub, __editing: false, __open: false }));
      return coletadas;
    }

    /* ---------- render tabela principal ---------- */
    function renderTable() {
      tblBody.innerHTML = '';
      const dataIds = new Set(data.map(r => r.id));
      [...selectedProcessos].forEach(id => {
        if (!dataIds.has(id)) selectedProcessos.delete(id);
      });

      const qGeral = (fGeral.value || '').trim().toLowerCase();
      const qSec = (fSecretaria.value || '').trim().toLowerCase();
      const qTipoProt = fTipoProtocolo.value || '';
      const qAssuntoProt = fAssuntoProtocolo.value || '';
      const qRegistroPrecos = fRegistroPrecos.value || '';

      function textoPesquisavelProcesso(valor, visitados = new Set()) {
        if (valor == null) return '';
        if (typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean') {
          return String(valor);
        }
        if (valor instanceof File || valor instanceof Blob) return '';
        if (typeof valor !== 'object') return '';
        if (visitados.has(valor)) return '';
        visitados.add(valor);
        if (Array.isArray(valor)) {
          return valor.map(item => textoPesquisavelProcesso(item, visitados)).join(' ');
        }
        return Object.entries(valor)
          .filter(([chave]) => !String(chave).startsWith('__'))
          .map(([chave, conteudo]) => `${chave} ${textoPesquisavelProcesso(conteudo, visitados)}`)
          .join(' ');
      }

      function normalizarTextoBusca(value) {
        return String(value || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
      }

      function matchAny(r, query) {
        if (!query) return true;
        return normalizarTextoBusca(textoPesquisavelProcesso(r)).includes(normalizarTextoBusca(query));
      }

filtered = data.filter(r =>
  matchAny(r, qGeral) &&
  matchAny(r, qSec) &&
  (!qTipoProt || normalizarCadastro(r.tipoProtocolo || (r.tipoProcesso === "credenciamento" || r.tipoProcesso === "licitacao" ? "PROCESSO LICITATÓRIO" : r.tipoProcesso)) === normalizarCadastro(qTipoProt)) &&
  (!qAssuntoProt || [r.assuntoProtocolo, r.naturezaProcesso, (r.tipoProcesso === "credenciamento" ? "CREDENCIAMENTO" : "")]
    .some(valor => normalizarCadastro(valor) === normalizarCadastro(qAssuntoProt))) &&
  (!qRegistroPrecos || (r.registroPrecos || (r.tipoRegistroPreco ? "sim" : "nao")) === qRegistroPrecos)
);


      filtered.forEach(r => {
        const tr = document.createElement('tr');
        if (r.novo) tr.classList.add("novo-registro");
        tr.innerHTML = `
          <td class="select-col">
            <input type="checkbox" class="lic_row_select" data-select-id="${r.id}" ${selectedProcessos.has(r.id) ? 'checked' : ''}>
          </td>
          <td><strong>${r.numero || ''}</strong></td>
          <td>${(r.objeto || '').slice(0,120)}</td>
          <td>${r.secretaria || ''}</td>
          <td>${r.dataCriacao || ''}</td>
          <td class="row-actions">
            <button class="btn" data-view="${r.id}">👁 Ver</button>
            <button class="btn" data-edit="${r.id}">Editar</button>
          </td>`;
        tblBody.appendChild(tr);
      });

      emptyEl.textContent = `${filtered.length ? 1 : 0}–${filtered.length} de ${data.length}`;

      // ativar botões
      tblBody.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => openEdit(btn.dataset.edit));
      tblBody.querySelectorAll('[data-view]').forEach(btn => btn.onclick = () => openView(btn.dataset.view));
      tblBody.querySelectorAll('[data-select-id]').forEach(check => {
        check.onchange = () => {
          if (check.checked) {
            selectedProcessos.add(check.dataset.selectId);
          } else {
            selectedProcessos.delete(check.dataset.selectId);
          }
          updateSelectionControls();
        };
      });
      updateSelectionControls();
    }

    function updateSelectionControls() {
      const visibleIds = filtered.map(r => r.id);
      const visibleSelected = visibleIds.filter(id => selectedProcessos.has(id)).length;

      deleteSelectedBtn.disabled = selectedProcessos.size === 0;
      deleteSelectedBtn.textContent = selectedProcessos.size
        ? `🗑 Excluir selecionados (${selectedProcessos.size})`
        : '🗑 Excluir selecionados';

      if (!visibleIds.length) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
        return;
      }

      selectAll.checked = visibleSelected === visibleIds.length;
      selectAll.indeterminate = visibleSelected > 0 && visibleSelected < visibleIds.length;
    }

    selectAll.addEventListener('change', () => {
      filtered.forEach(r => {
        if (selectAll.checked) {
          selectedProcessos.add(r.id);
        } else {
          selectedProcessos.delete(r.id);
        }
      });
      renderTable();
    });

    deleteSelectedBtn.addEventListener('click', () => {
      const total = selectedProcessos.size;
      if (!total) return;
      if (!confirm(`Deseja excluir ${total} processo(s) selecionado(s)?`)) return;

      data = data.filter(item => !selectedProcessos.has(item.id));
      selectedProcessos.clear();
      saveData(data);
      renderTable();
      showToast(`${total} processo(s) excluído(s).`);
    });

function renderItens(){

tblItens.innerHTML = "";

itensProcesso.forEach((item,index)=>{

const tr = document.createElement("tr");

tr.innerHTML = `
<td>${escHtml(item.descricao || '')}</td>
<td>${escHtml(item.valor || '')}</td>
<td>${escHtml(item.quantidade || '')}</td>
<td>${escHtml(item.unidade || '')}</td>
<td>
<button class="btn" data-edit-item="${index}">Editar</button>
<button class="btn" data-del="${index}">Excluir</button>
</td>
`;

tblItens.appendChild(tr);

});

tblItens.querySelectorAll("[data-edit-item]").forEach(btn=>{
btn.onclick = ()=>{
const item = itensProcesso[Number(btn.dataset.editItem)];
if(!item) return;
itemProcessoEditIndex = Number(btn.dataset.editItem);
tituloItemForm.textContent = "Editar Item";
fldItemDesc.value = item.descricao || "";
fldItemValor.value = item.valor || "";
fldItemQtd.value = item.quantidade || "";
fldItemUnidade.value = item.unidade || "";
dlgItemForm.showModal();
};
});

tblItens.querySelectorAll("[data-del]").forEach(btn=>{
btn.onclick = ()=>{
itensProcesso.splice(btn.dataset.del,1);
renderItens();
calcularValorEstimado();
const campoQtdItens = container.querySelector('#lic_etp_qtd_itens');
if(campoQtdItens) campoQtdItens.value = itensProcesso.length;
};
});

}

    /* ---------- export principal ---------- */
    exportBtn.addEventListener('click', () => {
      if (!data.length) return alert('Não há dados para exportar.');
      downloadFile('processos_licitatorios.json', JSON.stringify(data, null, 2));
      showToast('Arquivo exportado.');
    });

    /* ---------- Import submenu behavior ---------- */
    importBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      importMenu.style.display = importMenu.style.display === 'none' || !importMenu.style.display ? 'block' : 'none';
    });
    // clicar fora fecha menu
    document.addEventListener('click', () => {
      if (importMenu) importMenu.style.display = 'none';
    });

    // Import JSON (submenu) -> reuses fileInput
    importJsonBtn.onclick = (ev) => {
      ev.stopPropagation();
      fileInput.click();
    };

    importEtiquetaBtn.onclick = (ev) => {
      ev.stopPropagation();
      importMenu.style.display = 'none';
      etiquetaInput.click();
    };

    function extrairEtiquetas(texto) {
      const etiquetas = [];
      const blocos = texto.split("PROCESSO:");

      blocos.forEach(bloco => {
        bloco = bloco.trim();
        if (!bloco) return;

        const numeroMatch = bloco.match(/0*(\d+)\s*\/\s*(\d{4})/);
        if (!numeroMatch) return;

        const dataMatch = bloco.match(/DATA:\s*(\d{2}\/\d{2}\/\d{4})/i);
        const nomeMatch = bloco.match(/NOME:\s*(.*?)(?=ASSUNTO:)/is);
        const assuntoMatch = bloco.match(/ASSUNTO:\s*(.*?)(?=S[ÚU]MULA:)/is);
        const sumulaMatch = bloco.match(/S[ÚU]MULA:\s*([\s\S]*)/is);

        etiquetas.push({
          numero: `${numeroMatch[1]}/${numeroMatch[2]}`.toUpperCase(),
          dataCriacao: dataMatch ? dataMatch[1].toUpperCase() : "",
          secretaria: nomeMatch ? nomeMatch[1].replace(/\s+/g, " ").trim().toUpperCase() : "",
          interessadoOriginal: nomeMatch ? nomeMatch[1].replace(/\s+/g, " ").trim().toUpperCase() : "",
          objeto: assuntoMatch ? assuntoMatch[1].replace(/\s+/g, " ").trim().toUpperCase() : "",
          descricaoCompleta: sumulaMatch ? sumulaMatch[1].replace(/\s+/g, " ").trim().toUpperCase() : ""
        });
      });

      return etiquetas;
    }

    function selecionarOuAdicionarOpcao(select, value) {
      if (!select || !value) return;
      select.value = SECRETARIAS.includes(value) ? value : '';
    }

    function getSecretariaMapeada(interessado) {
      const map = loadSecretariaMap();
      const regra = map[normalizarChaveInteressado(interessado)];
      if (!regra) return '';
      return typeof regra === 'string' ? regra : regra.secretaria;
    }

    function aplicarMapaNaEtiqueta(etiqueta, trocas) {
      const interessado = etiqueta.interessadoOriginal || etiqueta.secretaria || '';
      const secretaria = getSecretariaMapeada(interessado);
      if (!secretaria) return etiqueta;

      etiqueta.interessadoOriginal = interessado;
      etiqueta.secretaria = secretaria;
      etiqueta.secretariaMapeada = true;

      if (Array.isArray(trocas)) {
        trocas.push({ de: interessado, para: secretaria });
      }

      return etiqueta;
    }

    function atualizarBotaoAssociacaoSecretaria() {
      const interessado = fld.interessadoOriginal.value || fld.secretaria.value || '';
      const chave = normalizarChaveInteressado(interessado);
      const secretariaAtual = fld.secretaria.value || '';
      const secretariaEhOficial = SECRETARIAS.includes(secretariaAtual);
      const deveMostrar = !!chave && (!secretariaEhOficial || !!fld.interessadoOriginal.value);

      btnAssocSecretaria.style.display = deveMostrar ? 'inline-block' : 'none';
    }

    function salvarAssociacaoInteressadoSecretaria(interessado, sigla) {
      const processoId = fld.idx.value;

      const map = loadSecretariaMap();
      map[normalizarChaveInteressado(interessado)] = {
        interessado,
        secretaria: sigla,
        criadoEm: new Date().toLocaleString('pt-BR')
      };
      saveSecretariaMap(map);

      fld.interessadoOriginal.value = interessado;
      fld.secretaria.value = sigla;

      let atualizados = 0;
      data.forEach(item => {
        const chaveItem = normalizarChaveInteressado(item.interessadoOriginal || item.secretaria);
        if (chaveItem === normalizarChaveInteressado(interessado)) {
          item.interessadoOriginal = interessado;
          item.secretaria = sigla;
          atualizados++;
        }
      });

      if (processoId && !atualizados) {
        const atual = data.find(item => item.id === processoId);
        if (atual) {
          atual.interessadoOriginal = interessado;
          atual.secretaria = sigla;
          atualizados++;
        }
      }

      saveData(data);
      renderTable();
      atualizarBotaoAssociacaoSecretaria();
      alert(`Associação salva:\n${interessado} -> ${sigla}\n\n${atualizados} processo(s) atualizados agora.`);
    }

    btnAssocSecretaria.addEventListener('click', () => {
      const interessado = (fld.interessadoOriginal.value || fld.secretaria.value || '').trim().toUpperCase();

      if (!interessado) {
        alert('Não há interessado para associar.');
        return;
      }

      assocInteressado.textContent = interessado;
      assocSelect.value = SECRETARIAS.includes(fld.secretaria.value) ? fld.secretaria.value : '';
      dlgAssoc.showModal();
    });

    assocClose.onclick = assocCancel.onclick = () => dlgAssoc.close();

    assocSave.addEventListener('click', () => {
      const interessado = (fld.interessadoOriginal.value || fld.secretaria.value || '').trim().toUpperCase();
      const sigla = assocSelect.value;

      if (!interessado) {
        alert('Não há interessado para associar.');
        return;
      }

      if (!sigla) {
        alert('Selecione uma secretaria.');
        return;
      }

      dlgAssoc.close();
      salvarAssociacaoInteressadoSecretaria(interessado, sigla);
    });

    function abrirNovoProcessoComEtiqueta(etiqueta) {
      atualizarSugestoesPregoeiros();
      btnExcluir.style.display = "none";
      form.reset();
      fld.idx.value = '';
      fld.interessadoOriginal.value = etiqueta.interessadoOriginal || etiqueta.secretaria || '';

      fld.numero.value = etiqueta.numero || '';
      fld.dataCriacao.value = etiqueta.dataCriacao || '';
      fld.objeto.value = etiqueta.objeto || '';
      selecionarOuAdicionarOpcao(fld.secretaria, etiqueta.secretaria || '');
      fld.descricaoCompleta.value = etiqueta.descricaoCompleta || '';
      fld.observacao.value = '';
      fld.volumes.value = '';
      fld.situacao.value = '';
      fld.fase.value = '';
      fld.tipoProcesso.value = '';
      fld.credTipo.value = '';
      fld.credNumero.value = '';
      fld.credPrincipal.value = '';
      fld.credCnpj.value = '';
      fld.credRazao.value = '';
      fld.credFantasia.value = '';
      fld.tipoProcesso.value = '';
      fld.novoTipoProtocolo.value = '';
      if (fld.naturezaProcesso) fld.naturezaProcesso.value = '';
      fld.assuntoProtocolo.innerHTML = '<option value="">-- selecione --</option>';
      fld.novoAssuntoProtocolo.value = '';
      fld.registroPrecos.value = '';
      if (fld.irpRegistroPreco) fld.irpRegistroPreco.value = '';
      if (selectProcessoGerador) selectProcessoGerador.value = '';
      if (selectAtaVinculada) selectAtaVinculada.innerHTML = '<option value="">-- selecione a ata cadastrada --</option>';
      container.querySelector('#lic_fornecedor').value = '';
      if (campoCNPJ) campoCNPJ.value = '';
      fld.credTipo.value = '';
      fld.credNumero.value = '';
      fld.credPrincipal.value = '';
      fld.credCnpj.value = '';
      fld.credRazao.value = '';
      fld.credFantasia.value = '';
      renderPessoaVinculadaSelect(null, pessoaVinculadaSelect, pessoaVinculadaStatus);
      renderPessoaVinculadaSelect(null, credPessoaVinculadaSelect, credPessoaVinculadaStatus);
      atasRegistroPreco = [];
      renderAtasPreview();
      fecharAtaInline();
      credItens = [];
      renderCredItensPreview();
      credItensContratacao = [];
      renderCredItensContratacaoPreview();
      itensProcesso = [];
      cotItens = [];
      renderCotacaoItens();
      renderRequisicoes();
      etapasConcluidas = {};
      fasesAtivasProcesso = [];
      aplicarFasesAtivasProcesso();
      atualizarEtapasConcluidas();

      container.querySelector('#tipo_licitacao_campos').style.display = "none";
      container.querySelector('#registro_preco_tipo').style.display = "none";
      container.querySelector('#atas_registro_container').style.display = "none";
      container.querySelector('#adesao_tipo_container').style.display = "none";
      container.querySelector('#processo_gerador_container').style.display = "none";
      container.querySelectorAll('input[name="tipo_registro_preco"]').forEach(r => r.checked = false);
      container.querySelectorAll('input[name="tipo_adesao_registro"]').forEach(r => r.checked = false);

      const selectTipo = container.querySelector('#lic_tipo_processo');
      if (selectTipo) selectTipo.value = "";

      atualizarBotaoAssociacaoSecretaria();
      atualizarClassificacaoProtocolo();
      resetarModalProcessoParaInicio();
      dlg.showModal();
    }

    function criarProcessoDaEtiqueta(etiqueta) {
      return {
        id: genId(),
        numero: etiqueta.numero || '',
        dataCriacao: etiqueta.dataCriacao || '',
        objeto: etiqueta.objeto || '',
        secretaria: etiqueta.secretaria || '',
        interessadoOriginal: etiqueta.interessadoOriginal || etiqueta.secretaria || '',
        descricaoCompleta: etiqueta.descricaoCompleta || '',
        irp: '',
        observacao: '',
        volumes: '',
        valorEstimado: null,
        recurso: [],
        modalidade: '',
        situacao: '',
        fase: '',
        tipoProcesso: '',
        credTipo: '',
        credNumero: '',
        credPrincipal: '',
        credCnpj: '',
        credRazao: '',
        credFantasia: '',
        credItens: [],
        credItensContratacao: [],
        itensProcesso: [],
        cotItens: [],
        requisicoes: [],
        novo: true
      };
    }

    function importarEtiquetasEmLote(etiquetas) {
      let adicionados = 0;
      let ignorados = 0;

      etiquetas.forEach(etiqueta => {
        const numero = String(etiqueta.numero || '').trim();
        if (!numero || data.some(item => item.numero === numero)) {
          ignorados++;
          return;
        }

        data.unshift(criarProcessoDaEtiqueta(etiqueta));
        adicionados++;
      });

      saveData(data);
      renderTable();

      if (ignorados) {
        showToast(`${adicionados} etiqueta(s) importada(s). ${ignorados} duplicada(s) ignorada(s).`);
      } else {
        showToast(`${adicionados} etiqueta(s) importada(s) em amarelo.`);
      }
    }

    etiquetaInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;

      const etiquetas = [];
      for (const file of files) {
        const texto = await file.text();
        etiquetas.push(...extrairEtiquetas(texto));
      }

      etiquetaInput.value = '';

      if (!etiquetas.length) {
        alert('Nenhuma etiqueta válida foi encontrada no TXT.');
        return;
      }

      const trocas = [];
      etiquetas.forEach(etiqueta => aplicarMapaNaEtiqueta(etiqueta, trocas));

      if (etiquetas.length === 1) {
        abrirNovoProcessoComEtiqueta(etiquetas[0]);
        if (trocas.length) {
          alert(`Secretaria identificada automaticamente:\n${trocas[0].de} -> ${trocas[0].para}`);
        }
        showToast('Etiqueta carregada no cadastro.');
        return;
      }

      importarEtiquetasEmLote(etiquetas);

      if (trocas.length) {
        const resumo = [...new Map(trocas.map(t => [`${t.de}->${t.para}`, t])).values()]
          .map(t => `${t.de} -> ${t.para}`)
          .join('\n');
        alert(`Secretarias identificadas automaticamente:\n${resumo}`);
      }
    });

    // existing JSON import (file input)
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const imported = JSON.parse(evt.target.result);
          if (!Array.isArray(imported)) throw new Error('Formato inválido.');

// manter sua normalização existente:
const normalized = imported.map(it => ({
  id: it.id || genId(),
  numero:
  (it.numero && String(it.numero).trim()) ||
  (it.processo && String(it.processo).trim()) ||
  (it["Nº Processo"] && String(it["Nº Processo"]).trim()) ||
  '',

  dataCriacao: it.dataCriacao || it.data || '',
  objeto: it.objeto || it.descricao || '',
  secretaria: it.secretaria || it.origem || '',
  interessadoOriginal: it.interessadoOriginal || '',
  tipoProcesso: it.tipoProcesso || '',
  credTipo: it.credTipo || '',
  credNumero: it.credNumero || '',
  credPrincipal: it.credPrincipal || '',
  credCnpj: it.credCnpj || '',
  credRazao: it.credRazao || '',
  credFantasia: it.credFantasia || '',
  credItens: Array.isArray(it.credItens) ? it.credItens : [],
  credItensContratacao: Array.isArray(it.credItensContratacao) ? it.credItensContratacao : [],
  credItens: Array.isArray(it.credItens) ? it.credItens : [],
  credItens: Array.isArray(it.credItens) ? it.credItens : [],
  tipoProcesso: it.tipoProcesso || '',
  credTipo: it.credTipo || '',
  credNumero: it.credNumero || '',
  credPrincipal: it.credPrincipal || '',
  credCnpj: it.credCnpj || '',
  credRazao: it.credRazao || '',
  credFantasia: it.credFantasia || '',
  interessadoOriginal: it.interessadoOriginal || '',

  // novos campos
  descricaoCompleta: it.descricaoCompleta || it.descricao || '',
  irp: it.irp || '',
  observacao: it.observacao || '',
  volumes: it.volumes || '',
  valorEstimado: (typeof it.valorEstimado === 'number') 
                   ? it.valorEstimado 
                   : parseBRLToNumber(it.valorEstimado) || null,
  recurso: Array.isArray(it.recurso) ? it.recurso : [],
  recursoMunicipal: (it.recurso && it.recurso.includes('Municipal')) || !!it.recurso_municipal,
  recursoEstadual: (it.recurso && it.recurso.includes('Estadual')) || !!it.recurso_estadual,
  recursoFederal: (it.recurso && it.recurso.includes('Federal')) || !!it.recurso_federal,
  modalidade: it.modalidade || '',
  situacao: it.situacao || '',
  fase: it.fase || '',
  editalForma: it.editalForma || '',
  editalNumero: it.editalNumero || '',
  editalValorEstimado: it.editalValorEstimado || '',
  editalCriterio: it.editalCriterio || '',
  editalModoDisputa: it.editalModoDisputa || '',
  editalDataSessao: it.editalDataSessao || '',
  editalHoraSessaoInicio: it.editalHoraSessaoInicio || '',
  editalHoraSessaoFim: it.editalHoraSessaoFim || '',
  editalDataInicio: it.editalDataInicio || '',
  editalHoraInicio: it.editalHoraInicio || '',
  editalDataFim: it.editalDataFim || '',
  editalHoraFim: it.editalHoraFim || '',
  editalObs: it.editalObs || '',
  licitacaoPregoeiro: it.licitacaoPregoeiro || '',
  licitacaoObs: it.licitacaoObs || '',
  avisoContratacaoDiretaForma: it.avisoContratacaoDiretaForma || '',
  avisoContratacaoDiretaNumero: it.avisoContratacaoDiretaNumero || '',
  avisoContratacaoDiretaAgente: it.avisoContratacaoDiretaAgente || '',
  avisoContratacaoDiretaValorEstimado: it.avisoContratacaoDiretaValorEstimado || '',
  avisoContratacaoDiretaCriterio: it.avisoContratacaoDiretaCriterio || '',
  avisoContratacaoDiretaDataSessao: it.avisoContratacaoDiretaDataSessao || '',
  avisoContratacaoDiretaHoraSessaoInicio: it.avisoContratacaoDiretaHoraSessaoInicio || '',
  avisoContratacaoDiretaHoraSessaoFim: it.avisoContratacaoDiretaHoraSessaoFim || '',
  avisoContratacaoDiretaDataInicio: it.avisoContratacaoDiretaDataInicio || '',
  avisoContratacaoDiretaHoraInicio: it.avisoContratacaoDiretaHoraInicio || '',
  avisoContratacaoDiretaDataFim: it.avisoContratacaoDiretaDataFim || '',
  avisoContratacaoDiretaHoraFim: it.avisoContratacaoDiretaHoraFim || '',
  resultadoItens: Array.isArray(it.resultadoItens) ? it.resultadoItens : [],
  resultadoValorHomologado: it.resultadoValorHomologado || '',
  novo: true,
}));

normalized.forEach(n => {
  if (n.numero) n.numero = String(n.numero).trim();
});

// NOVA LÓGICA: MESCLAR + PERGUNTAR SOBRE DUPLICADOS
const existentes = loadData();
const mapa = new Map();

// 1) colocar os existentes no mapa
existentes.forEach(item => mapa.set(item.numero, item));

// 2) processar cada item importado
normalized.forEach(novo => {
  const numero = novo.numero;

  if (!numero) return;

  if (mapa.has(numero)) {
    const existente = mapa.get(numero);

    const substituir = confirm(
      `O processo ${numero} já existe.\nDeseja substituir os dados atuais?`
    );

    if (substituir) {
      // mantém o ID antigo para não perder referências
      novo.id = existente.id;
      mapa.set(numero, novo);
    }

  } else {
    // processo totalmente novo
    if (!novo.id) novo.id = genId();
    mapa.set(numero, novo);
  }
});

// 3) salvar resultado final
data = Array.from(mapa.values());
saveData(data);
renderTable();
showToast('Importação concluída.');

          showToast('Dados importados com sucesso.');
        } catch (err) {
          alert('Erro ao importar JSON: ' + err.message);
        }
      };
      reader.readAsText(file);
      importMenu.style.display = 'none';
      fileInput.value = '';
    });

    /* ---------- Modais cadastro/edição/visualização ---------- */
    addBtn.addEventListener('click', () => {
      atualizarSugestoesPregoeiros();

      container.querySelector('#lic_title').textContent = "Novo processo";
      btnExcluir.style.display = "none";

      form.reset();
      fld.idx.value = '';
      fld.interessadoOriginal.value = '';
      // data atual como dd/mm/yyyy
      const now = new Date();
      const d = String(now.getDate()).padStart(2,'0');
      const m = String(now.getMonth()+1).padStart(2,'0');
      const y = now.getFullYear();
      fld.dataCriacao.value = `${d}/${m}/${y}`;

      // limpar novos campos
      fld.descricaoCompleta.value = '';
      fld.observacao.value = '';
      fld.volumes.value = '';
      fld.situacao.value = '';
      fld.fase.value = '';



// resetar campos dinâmicos do tipo de processo
if (fld.naturezaProcesso) fld.naturezaProcesso.value = "";
if (naturezaProcessoContainer) naturezaProcessoContainer.style.display = "none";
container.querySelector('#tipo_licitacao_campos').style.display = "none";
container.querySelector('#registro_preco_tipo').style.display = "none";
container.querySelector('#atas_registro_container').style.display = "none";
container.querySelector('#adesao_tipo_container').style.display = "none";
container.querySelector('#processo_gerador_container').style.display = "none";

container.querySelectorAll('input[name="tipo_registro_preco"]').forEach(r => r.checked = false);
container.querySelectorAll('input[name="tipo_adesao_registro"]').forEach(r => r.checked = false);

atasRegistroPreco = [];
itensAtaDraft = [];
aditivosAtaDraft = [];
renderAtasPreview();
fecharAtaInline();
credItens = [];
renderCredItensPreview();
credItensContratacao = [];
renderCredItensContratacaoPreview();
itensProcesso = [];
cotItens = [];
renderCotacaoItens();
resultadoItens = [];
renderResultadoItens();
container.querySelector('#lic_resultado_valor_homologado').value = '';
renderRequisicoes();
publicacoesProcesso = [];
renderPublicacoesProcesso();
container.querySelector('#lic_publicacao_pncp_link').value = '';
atualizarBotaoPncpPublicacao();
etapasConcluidas = {};
fasesAtivasProcesso = [];
aplicarFasesAtivasProcesso();
atualizarEtapasConcluidas();

const selectTipo = container.querySelector('#lic_tipo_processo');
if(selectTipo) selectTipo.value = "";

      atualizarBotaoAssociacaoSecretaria();
      resetarModalProcessoParaInicio();


      dlg.showModal();
    });
    dlgClose.onclick = dlgCancel.onclick = () => dlg.close();
    container.querySelector('#lic_pub_add')?.addEventListener('click', () => { container.querySelectorAll('.lic-publicacao-form').forEach(sincronizarPublicacaoCard); publicacoesProcesso.push(novaPublicacaoProcesso()); renderPublicacoesProcesso(); });
    container.querySelector('#lic_publicacao_pncp_link')?.addEventListener('input', atualizarBotaoPncpPublicacao);
    container.querySelector('#lic_publicacao_pncp_link')?.addEventListener('change', atualizarBotaoPncpPublicacao);

   if (fld.valorEstimado) {
  fld.valorEstimado.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');

    if (value === '') {
      e.target.value = '';
      return;
    }

    const number = parseFloat(value) / 100;

    e.target.value = number.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  });
}







const campoValorUnitario = container.querySelector('#lic_etp_valor_unitario');
const campoValorEstimado = container.querySelector('#lic_etp_valor_estimado');
const campoTRValorEstimado = container.querySelector('#lic_tr_valor_estimado');
const campoAvisoCdValorEstimado = container.querySelector('#lic_aviso_cd_valor_estimado');
const campoEditalValorEstimado = container.querySelector('#lic_edital_valor_estimado');

[campoValorUnitario, campoValorEstimado, campoTRValorEstimado, campoAvisoCdValorEstimado, campoEditalValorEstimado].forEach(campo => {

if(!campo) return;

campo.addEventListener('input', (e)=>{

let value = e.target.value.replace(/\D/g,'');

if(value === ""){
e.target.value = "";
return;
}

const number = parseFloat(value)/100;

e.target.value = number.toLocaleString('pt-BR',{
minimumFractionDigits:2,
maximumFractionDigits:2
});

});

});

function mascaraDataInput(campo) {
  if (!campo) return;
  campo.addEventListener('input', () => {
    let valor = campo.value.replace(/\D/g, '').slice(0, 8);
    if (valor.length > 4) valor = `${valor.slice(0, 2)}/${valor.slice(2, 4)}/${valor.slice(4)}`;
    else if (valor.length > 2) valor = `${valor.slice(0, 2)}/${valor.slice(2)}`;
    campo.value = valor;
  });
}

function mascaraHoraInput(campo) {
  if (!campo) return;
  campo.addEventListener('input', () => {
    let valor = campo.value.replace(/\D/g, '').slice(0, 4);
    if (valor.length > 2) valor = `${valor.slice(0, 2)}:${valor.slice(2)}`;
    campo.value = valor;
  });
}

[
  '#lic_edital_data_sessao',
  '#lic_edital_data_inicio',
  '#lic_edital_data_fim',
  '#lic_aviso_cd_data_sessao',
  '#lic_aviso_cd_data_inicio',
  '#lic_aviso_cd_data_fim'
].forEach(selector => mascaraDataInput(container.querySelector(selector)));

[
  '#lic_edital_hora_sessao_inicio',
  '#lic_edital_hora_sessao_fim',
  '#lic_edital_hora_inicio',
  '#lic_edital_hora_fim',
  '#lic_aviso_cd_hora_sessao_inicio',
  '#lic_aviso_cd_hora_sessao_fim',
  '#lic_aviso_cd_hora_inicio',
  '#lic_aviso_cd_hora_fim'
].forEach(selector => mascaraHoraInput(container.querySelector(selector)));

function sugestaoFormaContratacaoDireta() {
  const modalidade = normalizarCadastro(container.querySelector('#lic_tr_modalidade')?.value || '');
  const forma = normalizarCadastro(container.querySelector('#lic_etp_forma')?.value || '');
  if (!modalidade.includes('DISPENSA')) return '';
  if (forma === 'ELETRONICA') return 'DISPENSA ELETRÔNICA';
  if (forma === 'PRESENCIAL') return 'DISPENSA TRADICIONAL';
  return '';
}

function sugestaoFormaEdital() {
  const modalidade = normalizarCadastro(container.querySelector('#lic_tr_modalidade')?.value || '');
  const forma = normalizarCadastro(container.querySelector('#lic_etp_forma')?.value || '');
  const formaEletronica = forma === 'ELETRONICA';
  const formaPresencial = forma === 'PRESENCIAL';

  if (modalidade.includes('PREGAO')) {
    if (formaEletronica) return 'PREGÃO ELETRÔNICO';
    if (formaPresencial) return 'PREGÃO PRESENCIAL';
  }
  if (modalidade.includes('CONCORRENCIA')) {
    if (formaEletronica) return 'CONCORRÊNCIA ELETRÔNICA';
    if (formaPresencial) return 'CONCORRÊNCIA PRESENCIAL';
  }
  if (modalidade.includes('LEILAO')) {
    if (formaEletronica) return 'LEILÃO ELETRÔNICO';
    if (formaPresencial) return 'LEILÃO PRESENCIAL';
  }
  if (modalidade.includes('CONCURSO')) return 'CONCURSO';
  if (modalidade.includes('INEXIGIBILIDADE')) return 'CREDENCIAMENTO';
  return '';
}

function preencherAvisoContratacaoDiretaSeVazio() {
  const selectForma = container.querySelector('#lic_aviso_cd_forma');
  const valorEstimado = container.querySelector('#lic_aviso_cd_valor_estimado');
  const criterio = container.querySelector('#lic_aviso_cd_criterio');
  const sugestaoForma = sugestaoFormaContratacaoDireta();
  if (selectForma && !selectForma.value && sugestaoForma) selectForma.value = sugestaoForma;
  if (valorEstimado && !valorEstimado.value) {
    valorEstimado.value = container.querySelector('#lic_tr_valor_estimado')?.value || container.querySelector('#lic_etp_valor_estimado')?.value || '';
  }
  if (criterio && !criterio.value) {
    const criterioTr = container.querySelector('#lic_tr_criterio')?.value || '';
    const equivalente = [...criterio.options].find(opt => normalizarCadastro(opt.value) === normalizarCadastro(criterioTr));
    criterio.value = equivalente?.value || criterioTr;
  }
}

function preencherEditalSeVazio() {
  const selectForma = container.querySelector('#lic_edital_forma');
  const valorEstimado = container.querySelector('#lic_edital_valor_estimado');
  const sugestaoForma = sugestaoFormaEdital();
  if (selectForma && !selectForma.value && sugestaoForma) selectForma.value = sugestaoForma;
  if (valorEstimado && !valorEstimado.value) {
    valorEstimado.value = container.querySelector('#lic_tr_valor_estimado')?.value || '';
  }
}

container.querySelector('#lic_tr_modalidade')?.addEventListener('change', preencherAvisoContratacaoDiretaSeVazio);
container.querySelector('#lic_tr_criterio')?.addEventListener('change', preencherAvisoContratacaoDiretaSeVazio);
container.querySelector('#lic_etp_forma')?.addEventListener('change', preencherAvisoContratacaoDiretaSeVazio);
container.querySelector('#lic_tr_valor_estimado')?.addEventListener('input', preencherAvisoContratacaoDiretaSeVazio);
container.querySelector('#lic_etp_valor_estimado')?.addEventListener('input', preencherAvisoContratacaoDiretaSeVazio);
container.querySelector('#lic_tr_modalidade')?.addEventListener('change', preencherEditalSeVazio);
container.querySelector('#lic_etp_forma')?.addEventListener('change', preencherEditalSeVazio);
container.querySelector('#lic_tr_valor_estimado')?.addEventListener('input', preencherEditalSeVazio);


const campoCNPJ = container.querySelector('#lic_cnpj');
const campoCredCNPJ = container.querySelector('#lic_cred_cnpj');
const pessoaVinculadaSelect = container.querySelector('#lic_pessoa_vinculada');
const pessoaVinculadaStatus = container.querySelector('#lic_pessoa_vinculada_status');
const pessoaVinculadaAdd = container.querySelector('#lic_add_pessoa_vinculada');
const credPessoaVinculadaSelect = container.querySelector('#lic_cred_pessoa_vinculada');
const credPessoaVinculadaStatus = container.querySelector('#lic_cred_pessoa_vinculada_status');
const credPessoaVinculadaAdd = container.querySelector('#lic_cred_add_pessoa_vinculada');

function aplicarMascaraCNPJ(campo) {
if (!campo) return;

campo.addEventListener('input', (e) => {

let value = e.target.value.replace(/\D/g, '');

value = value.replace(/^(\d{2})(\d)/, '$1.$2');
value = value.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
value = value.replace(/\.(\d{3})(\d)/, '.$1/$2');
value = value.replace(/(\d{4})(\d)/, '$1-$2');

e.target.value = value.substring(0,18);

});

}

aplicarMascaraCNPJ(campoCNPJ);
aplicarMascaraCNPJ(campoCredCNPJ);

function abrirCadastroPessoaVinculadaProcesso(origem) {
  const isCredenciamento = origem === 'credenciamento';
  const cnpjInput = isCredenciamento ? campoCredCNPJ : campoCNPJ;
  const select = isCredenciamento ? credPessoaVinculadaSelect : pessoaVinculadaSelect;
  const status = isCredenciamento ? credPessoaVinculadaStatus : pessoaVinculadaStatus;
  const cnpj = cnpjInput?.value || '';

  if (onlyDigits(cnpj).length !== 14) {
    return alert('Informe primeiro um CNPJ válido para cadastrar uma pessoa vinculada.');
  }

  let fornecedor = buscarFornecedorPorCnpj(cnpj);
  if (!fornecedor) {
    fornecedor = upsertFornecedor({
      cnpj,
      razaoSocial: isCredenciamento
        ? (fld.credRazao.value || fld.credFantasia.value || 'FORNECEDOR SEM RAZÃO SOCIAL')
        : (container.querySelector('#lic_fornecedor')?.value || 'FORNECEDOR SEM RAZÃO SOCIAL'),
      nomeFantasia: isCredenciamento
        ? (fld.credFantasia.value || fld.credRazao.value || '')
        : (container.querySelector('#lic_fornecedor')?.value || ''),
      origem: 'CADASTRO NO PROCESSO'
    });
  }

  const dlgPessoa = document.createElement('dialog');
  dlgPessoa.style.width = 'min(560px,96vw)';
  dlgPessoa.innerHTML = `
    <div class="modal-head">
      <strong>Cadastrar pessoa vinculada</strong>
      <button type="button" class="btn ghost" id="proc_pessoa_close">Fechar</button>
    </div>
    <form id="proc_pessoa_form">
      <div class="modal-body">
        <div class="muted" style="margin-bottom:10px">
          CNPJ: ${formatCnpj(cnpj)}<br>
          Fornecedor: ${escHtml(fornecedor.razaoSocial || fornecedor.nomeFantasia || '')}
        </div>
        <div class="grid">
          <div class="field" style="grid-column:1/-1">
            <label>Nome da Pessoa Vinculada</label>
            <input id="proc_pessoa_nome" class="input" placeholder="NOME DA PESSOA">
          </div>
          <div class="field">
            <label>CPF</label>
            <input id="proc_pessoa_cpf" class="input" placeholder="000.000.000-00">
          </div>
          <div class="field">
            <label>Tipo de Vínculo</label>
            <input id="proc_pessoa_tipo" class="input" placeholder="EX: REPRESENTANTE LEGAL">
          </div>
          <div class="field" style="grid-column:1/-1">
            <label>Observação</label>
            <input id="proc_pessoa_obs" class="input">
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn" id="proc_pessoa_cancel">Cancelar</button>
        <button type="submit" class="btn primary">Salvar pessoa</button>
      </div>
    </form>
  `;

  document.body.appendChild(dlgPessoa);
  const fechar = () => {
    dlgPessoa.close();
    dlgPessoa.remove();
  };
  dlgPessoa.querySelector('#proc_pessoa_close').onclick = fechar;
  dlgPessoa.querySelector('#proc_pessoa_cancel').onclick = fechar;
  dlgPessoa.querySelector('#proc_pessoa_cpf').addEventListener('input', (event) => {
    event.target.value = formatCpf(event.target.value);
  });

  dlgPessoa.querySelector('#proc_pessoa_form').addEventListener('submit', (event) => {
    event.preventDefault();
    const nome = dlgPessoa.querySelector('#proc_pessoa_nome').value.trim();
    const cpf = dlgPessoa.querySelector('#proc_pessoa_cpf').value.trim();
    const tipoVinculo = dlgPessoa.querySelector('#proc_pessoa_tipo').value.trim();
    const observacao = dlgPessoa.querySelector('#proc_pessoa_obs').value.trim();

    if (!nome) return alert('Informe o nome da pessoa vinculada.');
    if (!tipoVinculo) return alert('Informe o tipo de vínculo.');

    const fornecedores = loadFornecedores();
    const idxFornecedor = fornecedores.findIndex(f => onlyDigits(f.cnpj) === onlyDigits(cnpj));
    const atual = idxFornecedor >= 0 ? fornecedores[idxFornecedor] : fornecedor;
    const pessoas = normalizarPessoasFornecedor(atual.pessoas);
    const pessoa = {
      id: genId(),
      nome,
      cpf,
      tipoVinculo,
      observacao,
      ativo: true,
      criadoEm: new Date().toLocaleString('pt-BR'),
      atualizadoEm: new Date().toLocaleString('pt-BR')
    };

    pessoas.push(pessoa);
    const atualizado = {
      ...atual,
      cnpj: formatCnpj(cnpj),
      pessoas,
      atualizadoEm: new Date().toLocaleString('pt-BR')
    };

    if (idxFornecedor >= 0) fornecedores[idxFornecedor] = atualizado;
    else fornecedores.unshift(atualizado);
    saveFornecedores(fornecedores);

    renderPessoaVinculadaSelect(atualizado, select, status);
    if (select) select.value = pessoa.id;
    fechar();
    showToast('Pessoa vinculada cadastrada.');
  });

  dlgPessoa.showModal();
}

pessoaVinculadaAdd?.addEventListener('click', () => abrirCadastroPessoaVinculadaProcesso('registro'));
credPessoaVinculadaAdd?.addEventListener('click', () => abrirCadastroPessoaVinculadaProcesso('credenciamento'));

const reqContainer = container.querySelector('#req_container');
const selectReqAdd = container.querySelector('#lic_req_add');

let reqCount = 0;

function adicionarRequisicao(){

reqCount++;

const div = document.createElement("div");

div.className = "grid";
div.style.marginBottom = "10px";

div.innerHTML = `

<div class="field">
<label>Nº da Requisição</label>
<input class="input req-numero" placeholder="508/25">
</div>

<div class="field">
<label>Qtd de itens</label>
<input class="input req-qtd" type="number">
</div>

`;

reqContainer.appendChild(div);
atualizarEtapasConcluidas();

}

function coletarRequisicoes(){

return [...reqContainer.querySelectorAll('.grid')].map(row => ({
numero: row.querySelector('.req-numero')?.value.trim() || "",
qtd: row.querySelector('.req-qtd')?.value.trim() || ""
})).filter(req => req.numero || req.qtd);

}

function renderRequisicoes(requisicoes = []){

reqContainer.innerHTML = "";
reqCount = 0;

const lista = Array.isArray(requisicoes) && requisicoes.length ? requisicoes : [{}];

lista.forEach(req => {

adicionarRequisicao();

const linhas = reqContainer.querySelectorAll('.grid');
const ultima = linhas[linhas.length - 1];

ultima.querySelector('.req-numero').value = req.numero || "";
ultima.querySelector('.req-qtd').value = req.qtd || "";

});

atualizarEtapasConcluidas();

}

if(selectReqAdd){

selectReqAdd.addEventListener("change",()=>{

if(selectReqAdd.value === "sim"){

adicionarRequisicao();

selectReqAdd.value = "nao";

}

});

}

renderRequisicoes();

   const cotContainer = container.querySelector('#cot_container');
const btnAbrirCotacaoItens = container.querySelector('#btnAbrirCotacaoItens');
const dlgCotacaoItens = container.querySelector('#lic_cot_itens_dlg');
const btnCotacaoItensClose = container.querySelector('#lic_cot_itens_close');
const cotItensModalBody = container.querySelector('#cot_itens_modal_body');
const btnAddCotacao = container.querySelector('#btnAddCotacao');
const btnImportCotacaoEtp = container.querySelector('#btnImportCotacaoEtp');
let cotItens = [];

btnAbrirCotacaoItens?.addEventListener('click', () => abrirDialogInterno(dlgCotacaoItens, dlg));
btnCotacaoItensClose?.addEventListener('click', () => fecharDialogInterno(dlgCotacaoItens));

function novaPesquisaCotacao(fonte = "", valor = "") {
  return { fonte, valor };
}

function novoItemCotacao(base = {}) {
  const pesquisas = Array.isArray(base.pesquisas) && base.pesquisas.length
    ? base.pesquisas.map(p => novaPesquisaCotacao(p.fonte || "", p.valor || ""))
    : [novaPesquisaCotacao(), novaPesquisaCotacao(), novaPesquisaCotacao()];
  return {
    id: base.id || genId(),
    descricao: base.descricao || "",
    quantidade: base.quantidade || base.qtd || "",
    unidade: base.unidade || "",
    pesquisas
  };
}

function formatarValorCotacaoInput(input) {
  let value = input.value.replace(/\D/g, '');
  if (value === "") {
    input.value = "";
    calcularCotacaoItens();
    return;
  }
  const number = parseFloat(value) / 100;
  input.value = number.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  calcularCotacaoItens();
}

function calcularResultadoValores(valores, tipo) {
  const numeros = valores.map(v => parseBRLToNumber(v)).filter(v => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!numeros.length) return 0;
  if (tipo === "menor_preco") return numeros[0];
  if (tipo === "maior_preco") return numeros[numeros.length - 1];
  if (tipo === "mediana") {
    const meio = Math.floor(numeros.length / 2);
    return numeros.length % 2 ? numeros[meio] : (numeros[meio - 1] + numeros[meio]) / 2;
  }
  return numeros.reduce((soma, valor) => soma + valor, 0) / numeros.length;
}

function calcularCotacaoItens() {
  const tipo = container.querySelector('#lic_cot_tipo')?.value || "media";
  let totalGeral = 0;
  cotItens.forEach(item => {
    const resultadoCalculado = calcularResultadoValores((item.pesquisas || []).map(p => p.valor), tipo);
    const resultadoUnitario = Math.round((resultadoCalculado + Number.EPSILON) * 100) / 100;
    const quantidade = parseBRLToNumber(item.quantidade) || 0;
    item.resultadoUnitario = resultadoUnitario;
    item.resultadoTotal = Math.round(((resultadoUnitario * quantidade) + Number.EPSILON) * 100) / 100;
    totalGeral += item.resultadoTotal;
  });
  const resultado = formatBRLDisplay(totalGeral);
  container.querySelector('#lic_cot_media').value = resultado;
  container.querySelector('#lic_cot_total').value = resultado;
  const campoValorEstimado = container.querySelector('#lic_etp_valor_estimado');
  if (campoValorEstimado) campoValorEstimado.value = resultado;
  atualizarResumoCotacaoItens();
}

function atualizarResumoCotacaoItens() {
  cotItensModalBody.querySelectorAll('[data-cot-item]').forEach(card => {
    const index = Number(card.dataset.cotItem);
    const item = cotItens[index];
    if (!item) return;
    const unitario = card.querySelector('[data-cot-unitario]');
    const total = card.querySelector('[data-cot-total]');
    if (unitario) unitario.textContent = formatBRLDisplay(item.resultadoUnitario || 0) || "0,00";
    if (total) total.textContent = formatBRLDisplay(item.resultadoTotal || 0) || "0,00";
  });
}

function renderCotacaoItens() {
  cotContainer.innerHTML = cotItens.length
    ? `<div class="muted" style="font-size:12px">${cotItens.length} item(ns) cotado(s). Use o botão abaixo para inserir ou ajustar os itens.</div>`
    : '<div class="muted" style="font-size:12px">Nenhum item cotado. Clique em "Abrir itens da cotação" para importar os itens do ETP ou adicionar manualmente.</div>';
  cotItensModalBody.innerHTML = "";
  if (!cotItens.length) {
    cotItensModalBody.innerHTML = '<div class="muted" style="font-size:12px">Nenhum item cotado. Importe os itens do ETP ou adicione um item manualmente.</div>';
    calcularCotacaoItens();
    return;
  }
  cotItens.forEach((item, itemIndex) => {
    const card = document.createElement('div');
    card.className = "cot-item-card";
    card.dataset.cotItem = String(itemIndex);
    card.style.cssText = "border:1px solid #dbe3ef;border-radius:8px;padding:12px;margin-bottom:12px;background:#fff";
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:10px">
        <strong>Item ${itemIndex + 1}</strong>
        <button type="button" class="btn danger" data-cot-remove-item="${itemIndex}">Excluir item</button>
      </div>
      <div class="grid">
        <div class="field" style="grid-column:1/-1">
          <label>Descrição do item</label>
          <input class="input cot-item-descricao" data-cot-field="descricao" value="${escHtml(item.descricao || '')}" placeholder="Descrição do item">
        </div>
        <div class="field">
          <label>Quantidade</label>
          <input class="input cot-item-quantidade" data-cot-field="quantidade" value="${escHtml(item.quantidade || '')}" placeholder="Ex: 12">
        </div>
        <div class="field">
          <label>Unidade de medida</label>
          <input class="input cot-item-unidade" data-cot-field="unidade" value="${escHtml(item.unidade || '')}" placeholder="UN">
        </div>
      </div>
      <div style="margin:10px 0 6px"><strong>Pesquisas do item</strong></div>
      <div class="cot-pesquisas-lista">
        ${(item.pesquisas || []).map((pesquisa, pesquisaIndex) => `
          <div class="grid cot-pesquisa-row" data-cot-pesquisa="${pesquisaIndex}" style="margin-bottom:8px">
            <div class="field">
              <label>Fonte</label>
              <input class="input cot-fonte" value="${escHtml(pesquisa.fonte || '')}" placeholder="Ex: PNCP">
            </div>
            <div class="field">
              <label>Valor unitário</label>
              <div style="display:flex;gap:8px;align-items:center">
                <input class="input cot-valor" value="${escHtml(pesquisa.valor || '')}" placeholder="0,00">
                <button type="button" class="btn danger" data-cot-remove-pesquisa="${pesquisaIndex}" title="Excluir pesquisa">Excluir</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      <button type="button" class="btn" data-cot-add-pesquisa="${itemIndex}">+ Adicionar pesquisa neste item</button>
      <div class="muted" style="margin-top:10px;font-size:12px">
        Resultado unitário: R$ <span data-cot-unitario>0,00</span> | Total do item: R$ <span data-cot-total>0,00</span>
      </div>
    `;
    cotItensModalBody.appendChild(card);
  });
  ligarEventosCotacaoItens();
  calcularCotacaoItens();
}

function ligarEventosCotacaoItens() {
  cotItensModalBody.querySelectorAll('[data-cot-field]').forEach(input => {
    input.addEventListener('input', () => {
      const card = input.closest('[data-cot-item]');
      const item = cotItens[Number(card?.dataset.cotItem)];
      if (!item) return;
      item[input.dataset.cotField] = input.value;
      if (input.dataset.cotField === 'quantidade') calcularCotacaoItens();
      atualizarEtapasConcluidas();
    });
  });
  cotItensModalBody.querySelectorAll('.cot-fonte, .cot-valor').forEach(input => {
    input.addEventListener('input', () => {
      const card = input.closest('[data-cot-item]');
      const row = input.closest('[data-cot-pesquisa]');
      const item = cotItens[Number(card?.dataset.cotItem)];
      const pesquisa = item?.pesquisas?.[Number(row?.dataset.cotPesquisa)];
      if (!pesquisa) return;
      if (input.classList.contains('cot-valor')) formatarValorCotacaoInput(input);
      pesquisa[input.classList.contains('cot-fonte') ? 'fonte' : 'valor'] = input.value;
      calcularCotacaoItens();
      atualizarEtapasConcluidas();
    });
  });
  cotItensModalBody.querySelectorAll('[data-cot-remove-pesquisa]').forEach(btn => {
    btn.onclick = () => {
      const card = btn.closest('[data-cot-item]');
      const item = cotItens[Number(card?.dataset.cotItem)];
      if (!item) return;
      item.pesquisas.splice(Number(btn.dataset.cotRemovePesquisa), 1);
      renderCotacaoItens();
    };
  });
  cotItensModalBody.querySelectorAll('[data-cot-add-pesquisa]').forEach(btn => {
    btn.onclick = () => {
      const item = cotItens[Number(btn.dataset.cotAddPesquisa)];
      if (!item) return;
      item.pesquisas.push(novaPesquisaCotacao());
      renderCotacaoItens();
    };
  });
  cotItensModalBody.querySelectorAll('[data-cot-remove-item]').forEach(btn => {
    btn.onclick = () => {
      cotItens.splice(Number(btn.dataset.cotRemoveItem), 1);
      renderCotacaoItens();
    };
  });
}

function coletarCotacaoItens() {
  calcularCotacaoItens();
  return cotItens.map(item => ({
    id: item.id || genId(),
    descricao: item.descricao || "",
    quantidade: item.quantidade || "",
    unidade: item.unidade || "",
    pesquisas: (item.pesquisas || []).map(p => ({ fonte: p.fonte || "", valor: p.valor || "" })).filter(p => p.fonte || p.valor),
    resultadoUnitario: item.resultadoUnitario || 0,
    resultadoTotal: item.resultadoTotal || 0
  })).filter(item => item.descricao || item.quantidade || item.unidade || item.pesquisas.length);
}

function normalizarItemParaCotacao(item) {
  if (!item) return null;
  return novoItemCotacao({
    descricao: item.descricao || item.objeto || item[1] || item[0] || "",
    quantidade: item.quantidade || item.qtd || item.qtde || item[5] || "",
    unidade: item.unidade || item.unidadeMedida || item.un || item[2] || ""
  });
}

function tabelaParaItensCotacao(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const header = rows[0].map(cell => normalizarCadastro(cell));
  const temCabecalho = header.some(cell => /ITEM|DESCRICAO|OBJETO|QTD|QTDE|UNIDADE|UN\.?/.test(cell));
  const idxDesc = header.findIndex(cell => /DESCRICAO|OBJETO/.test(cell));
  const idxQtd = header.findIndex(cell => /QTD|QTDE|QUANTIDADE/.test(cell));
  const idxUn = header.findIndex(cell => /UNIDADE|UN\.?/.test(cell));
  return rows.slice(temCabecalho ? 1 : 0).map(row => novoItemCotacao({
    descricao: row[idxDesc >= 0 ? idxDesc : 1] || row[0] || "",
    quantidade: row[idxQtd >= 0 ? idxQtd : 5] || "",
    unidade: row[idxUn >= 0 ? idxUn : 2] || ""
  })).filter(item => item.descricao || item.quantidade || item.unidade);
}

function obterItensBaseParaCotacao() {
  const bases = [];
  if (Array.isArray(itensProcesso) && itensProcesso.length) bases.push(...itensProcesso.map(normalizarItemParaCotacao).filter(Boolean));
  if (!bases.length && Array.isArray(credItens) && credItens.length) bases.push(...tabelaParaItensCotacao(credItens));
  if (!bases.length) {
    const irpId = container.querySelector('#lic_irp_registro_preco')?.value || "";
    const irp = loadIrps().find(row => row.id === irpId);
    if (irp?.itens?.length) bases.push(...tabelaParaItensCotacao(irp.itens));
  }
  if (!bases.length && Array.isArray(atasRegistroPreco) && atasRegistroPreco.length) {
    atasRegistroPreco.forEach(ata => bases.push(...tabelaParaItensCotacao(ata.itens || [])));
  }
  if (!bases.length) {
    const qtd = container.querySelector('#lic_etp_qtd_itens')?.value || "1";
    bases.push(novoItemCotacao({ descricao: "ITEM DO ETP", quantidade: qtd, unidade: "" }));
  }
  return bases;
}

function renderCotacaoLegada(pesquisas = []) {
  cotItens = [novoItemCotacao({
    descricao: "COTAÇÃO GLOBAL",
    quantidade: container.querySelector('#lic_cot_qtd')?.value || "1",
    unidade: "",
    pesquisas
  })];
  renderCotacaoItens();
}

btnAddCotacao?.addEventListener('click', () => {
  cotItens.push(novoItemCotacao());
  renderCotacaoItens();
});

btnImportCotacaoEtp?.addEventListener('click', () => {
  const itens = obterItensBaseParaCotacao();
  if (cotItens.length && !confirm('Substituir os itens cotados atuais pelos itens do ETP/processo?')) return;
  cotItens = itens;
  renderCotacaoItens();
  showToast(`${itens.length} item(ns) importado(s) para cotação.`);
});

container.querySelector('#lic_cot_tipo')?.addEventListener('change', calcularCotacaoItens);
renderCotacaoItens();

const resultadoItensContainer = container.querySelector('#resultado_itens_container');
const btnImportResultadoItens = container.querySelector('#btnImportResultadoItens');
const btnLimparResultadoItens = container.querySelector('#btnLimparResultadoItens');
const homologacaoItensContainer = container.querySelector('#homologacao_itens_container');
const homologacaoFiltroSituacao = container.querySelector('#lic_homologacao_filtro_situacao');
let resultadoItens = [];

function novoItemResultado(base = {}) {
  return {
    id: base.id || base.itemId || genId(),
    descricao: base.descricao || base.objeto || base[1] || base[0] || "",
    quantidade: base.quantidade || base.qtd || base.qtde || base[5] || "",
    unidade: base.unidade || base.unidadeMedida || base.un || base[2] || "",
    fornecedorId: base.fornecedorId || "",
    cnpj: base.cnpj || base.fornecedorCnpj || "",
    razaoSocial: base.razaoSocial || base.fornecedorRazao || "",
    nomeFantasia: base.nomeFantasia || base.fornecedorFantasia || "",
    pessoaVinculadaId: base.pessoaVinculadaId || "",
    pessoaVinculadaNome: base.pessoaVinculadaNome || "",
    pessoaVinculadaTipo: base.pessoaVinculadaTipo || "",
    situacao: base.situacao || "",
    valorUnitario: base.valorUnitario || base.valor || "",
    valorTotal: base.valorTotal || ""
  };
}

function normalizarItemParaResultado(item) {
  if (!item) return null;
  return novoItemResultado({
    id: item.id || item.itemId || genId(),
    descricao: item.descricao || item.objeto || item[1] || item[0] || "",
    quantidade: item.quantidade || item.qtd || item.qtde || item[5] || "",
    unidade: item.unidade || item.unidadeMedida || item.un || item[2] || "",
    valorUnitario: "",
    valorTotal: "",
    situacao: "",
    fornecedorId: "",
    cnpj: "",
    razaoSocial: "",
    nomeFantasia: "",
    pessoaVinculadaId: "",
    pessoaVinculadaNome: "",
    pessoaVinculadaTipo: ""
  });
}

function obterItensBaseParaResultado() {
  const bases = [];
  if (Array.isArray(cotItens) && cotItens.length) bases.push(...cotItens.map(normalizarItemParaResultado).filter(Boolean));
  if (!bases.length && Array.isArray(itensProcesso) && itensProcesso.length) bases.push(...itensProcesso.map(normalizarItemParaResultado).filter(Boolean));
  if (!bases.length && Array.isArray(credItens) && credItens.length) bases.push(...tabelaParaItensCotacao(credItens).map(normalizarItemParaResultado).filter(Boolean));
  if (!bases.length) {
    const irpId = container.querySelector('#lic_irp_registro_preco')?.value || "";
    const irp = loadIrps().find(row => row.id === irpId);
    if (irp?.itens?.length) bases.push(...tabelaParaItensCotacao(irp.itens).map(normalizarItemParaResultado).filter(Boolean));
  }
  return bases;
}

function calcularResultadoItens() {
  let totalGeral = 0;
  resultadoItens.forEach(item => {
    const unitario = Math.round(((parseBRLToNumber(item.valorUnitario) || 0) + Number.EPSILON) * 100) / 100;
    const quantidade = parseBRLToNumber(item.quantidade) || 0;
    item.valorTotal = Math.round(((unitario * quantidade) + Number.EPSILON) * 100) / 100;
    if (normalizarCadastro(item.situacao) !== 'DESERTO') totalGeral += item.valorTotal;
  });
  resultadoItensContainer?.querySelectorAll('[data-res-item]').forEach(card => {
    const item = resultadoItens[Number(card.dataset.resItem)];
    const total = card.querySelector('[data-res-total]');
    if (item && total) total.textContent = formatBRLDisplay(item.valorTotal || 0) || "0,00";
  });
  const campoValorHomologado = container.querySelector('#lic_resultado_valor_homologado');
  if (campoValorHomologado) campoValorHomologado.value = formatBRLDisplay(totalGeral) || "";
  const campoValorHomologadoHomologacao = container.querySelector('#lic_homologacao_valor_homologado');
  if (campoValorHomologadoHomologacao) campoValorHomologadoHomologacao.value = formatBRLDisplay(totalGeral) || "";
  renderHomologacaoItens();
  return totalGeral;
}

function renderHomologacaoItens() {
  if (!homologacaoItensContainer) return;
  const filtro = homologacaoFiltroSituacao?.value || "";
  const itens = resultadoItens
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !filtro || normalizarCadastro(item.situacao) === normalizarCadastro(filtro));

  if (!resultadoItens.length) {
    homologacaoItensContainer.innerHTML = '<div class="muted" style="font-size:12px">Nenhum item no Resultado para homologar.</div>';
    return;
  }

  homologacaoItensContainer.innerHTML = itens.length ? `
    <div class="process-table-wrap">
      <table class="homologacao-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Descrição do Produto/Serviço</th>
            <th>Unidade</th>
            <th>Quantidade</th>
            <th>Valor Unitário</th>
            <th>Valor Total</th>
            <th>Situação</th>
            <th>Proponente/Fornecedor</th>
          </tr>
        </thead>
        <tbody>
          ${itens.map(({ item, index }) => `
            <tr class="${normalizarCadastro(item.situacao) === 'DESERTO' ? 'homologacao-deserto' : ''}">
              <td>${index + 1}</td>
              <td>${escHtml(item.descricao || '')}</td>
              <td>${escHtml(item.unidade || '')}</td>
              <td>${escHtml(item.quantidade || '')}</td>
              <td>${escHtml(formatBRLDisplay(parseBRLToNumber(item.valorUnitario) || 0) || '0,00')}</td>
              <td>${escHtml(formatBRLDisplay(item.valorTotal || 0) || '0,00')}</td>
              <td>${escHtml(item.situacao || '')}</td>
              <td>${escHtml(item.razaoSocial || item.nomeFantasia || '')}${item.cnpj ? ` ${escHtml(item.cnpj)}` : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : '<div class="muted" style="font-size:12px">Nenhum item encontrado para a situação selecionada.</div>';
}

function preencherFornecedorResultadoPorCnpj(index) {
  const item = resultadoItens[index];
  if (!item || onlyDigits(item.cnpj).length !== 14) return;
  const cnpjDigits = onlyDigits(item.cnpj);
  const outroItem = resultadoItens.find((res, resIndex) =>
    resIndex !== index &&
    onlyDigits(res.cnpj) === cnpjDigits &&
    (res.razaoSocial || res.nomeFantasia)
  );
  if (outroItem) {
    Object.assign(item, {
      cnpj: formatCnpj(outroItem.cnpj),
      fornecedorId: outroItem.fornecedorId || "",
      razaoSocial: outroItem.razaoSocial || "",
      nomeFantasia: outroItem.nomeFantasia || "",
      pessoaVinculadaId: outroItem.pessoaVinculadaId || "",
      pessoaVinculadaNome: outroItem.pessoaVinculadaNome || "",
      pessoaVinculadaTipo: outroItem.pessoaVinculadaTipo || ""
    });
    renderResultadoItens();
    showToast('Fornecedor reaproveitado do item anterior.');
    return;
  }
  const fornecedor = buscarFornecedorPorCnpj(item.cnpj);
  if (!fornecedor) {
    abrirModalFornecedorResultado(index);
    return;
  }
  item.cnpj = formatCnpj(fornecedor.cnpj);
  item.fornecedorId = fornecedor.id || "";
  item.razaoSocial = fornecedor.razaoSocial || fornecedor.nomeFantasia || "";
  item.nomeFantasia = fornecedor.nomeFantasia || "";
  renderResultadoItens();
  showToast(`Fornecedor localizado: ${fornecedor.razaoSocial || fornecedor.nomeFantasia || fornecedor.cnpj}`);
}

function abrirModalFornecedorResultado(index) {
  const item = resultadoItens[index];
  if (!item) return;
  const fornecedor = buscarFornecedorPorCnpj(item.cnpj);
  const pessoas = normalizarPessoasFornecedor(fornecedor?.pessoas).filter(p => p.ativo !== false);
  const dlgFornecedor = document.createElement('dialog');
  dlgFornecedor.style.width = 'min(680px,96vw)';
  dlgFornecedor.innerHTML = `
    <div class="modal-head">
      <strong>Fornecedor do Resultado</strong>
      <button type="button" class="btn ghost" id="res_forn_close">Fechar</button>
    </div>
    <form id="res_forn_form">
      <div class="modal-body">
        <div class="grid">
          <div class="field">
            <label>CNPJ</label>
            <input id="res_forn_cnpj" class="input" value="${escHtml(formatCnpj(item.cnpj || ''))}" placeholder="00.000.000/0000-00">
          </div>
          <div class="field">
            <label>Razão Social</label>
            <input id="res_forn_razao" class="input" value="${escHtml(item.razaoSocial || fornecedor?.razaoSocial || '')}">
          </div>
          <div class="field">
            <label>Nome Fantasia</label>
            <input id="res_forn_fantasia" class="input" value="${escHtml(item.nomeFantasia || fornecedor?.nomeFantasia || '')}">
          </div>
          <div class="field">
            <label>Pessoa Vinculada</label>
            <select id="res_forn_pessoa" class="select">
              <option value="">-- nenhuma pessoa vinculada --</option>
              ${pessoas.map(pessoa => `<option value="${escHtml(pessoa.id)}" data-nome="${escHtml(pessoa.nome || '')}" data-tipo="${escHtml(pessoa.tipoVinculo || '')}" ${item.pessoaVinculadaId === pessoa.id ? 'selected' : ''}>${escHtml(pessoa.nome || '')}${pessoa.tipoVinculo ? ' - ' + escHtml(pessoa.tipoVinculo) : ''}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Nova Pessoa Vinculada</label>
            <input id="res_forn_pessoa_nome" class="input" placeholder="NOME DA PESSOA">
          </div>
          <div class="field">
            <label>CPF</label>
            <input id="res_forn_pessoa_cpf" class="input" placeholder="000.000.000-00">
          </div>
          <div class="field">
            <label>Tipo de Vínculo</label>
            <input id="res_forn_pessoa_tipo" class="input" placeholder="EX: REPRESENTANTE LEGAL">
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn" id="res_forn_cancel">Cancelar</button>
        <button type="submit" class="btn primary">Salvar fornecedor</button>
      </div>
    </form>
  `;

  document.body.appendChild(dlgFornecedor);
  const fechar = () => {
    dlgFornecedor.close();
    dlgFornecedor.remove();
  };
  const cnpjInput = dlgFornecedor.querySelector('#res_forn_cnpj');
  const cpfInput = dlgFornecedor.querySelector('#res_forn_pessoa_cpf');
  cnpjInput.addEventListener('input', () => { cnpjInput.value = formatCnpj(cnpjInput.value); });
  cpfInput.addEventListener('input', (event) => { event.target.value = formatCpf(event.target.value); });
  dlgFornecedor.querySelector('#res_forn_close').onclick = fechar;
  dlgFornecedor.querySelector('#res_forn_cancel').onclick = fechar;
  dlgFornecedor.querySelector('#res_forn_form').addEventListener('submit', (event) => {
    event.preventDefault();
    const cnpj = cnpjInput.value.trim();
    const razaoSocial = dlgFornecedor.querySelector('#res_forn_razao').value.trim();
    const nomeFantasia = dlgFornecedor.querySelector('#res_forn_fantasia').value.trim();
    const pessoaSelect = dlgFornecedor.querySelector('#res_forn_pessoa');
    const novaPessoaNome = dlgFornecedor.querySelector('#res_forn_pessoa_nome').value.trim();
    const novaPessoaCpf = dlgFornecedor.querySelector('#res_forn_pessoa_cpf').value.trim();
    const novaPessoaTipo = dlgFornecedor.querySelector('#res_forn_pessoa_tipo').value.trim();

    if (onlyDigits(cnpj).length !== 14) return alert('Informe um CNPJ válido com 14 dígitos.');
    if (!razaoSocial) return alert('Informe a Razão Social.');

    let pessoaSelecionada = dadosPessoaSelecionada(pessoaSelect);
    const fornecedorAtual = buscarFornecedorPorCnpj(cnpj);
    const pessoasAtualizadas = normalizarPessoasFornecedor(fornecedorAtual?.pessoas);
    if (novaPessoaNome) {
      const novaPessoa = {
        id: genId(),
        nome: novaPessoaNome,
        cpf: novaPessoaCpf,
        tipoVinculo: novaPessoaTipo,
        ativo: true,
        criadoEm: new Date().toLocaleString('pt-BR'),
        atualizadoEm: new Date().toLocaleString('pt-BR')
      };
      pessoasAtualizadas.push(novaPessoa);
      pessoaSelecionada = {
        pessoaVinculadaId: novaPessoa.id,
        pessoaVinculadaNome: novaPessoa.nome,
        pessoaVinculadaTipo: novaPessoa.tipoVinculo
      };
    }

    const fornecedorSalvo = upsertFornecedor({
      cnpj,
      razaoSocial,
      nomeFantasia,
      pessoas: pessoasAtualizadas,
      origem: 'RESULTADO DO PROCESSO'
    });

    Object.assign(item, {
      fornecedorId: fornecedorSalvo?.id || item.fornecedorId || "",
      cnpj: formatCnpj(cnpj),
      razaoSocial,
      nomeFantasia,
      pessoaVinculadaId: pessoaSelecionada.pessoaVinculadaId,
      pessoaVinculadaNome: pessoaSelecionada.pessoaVinculadaNome,
      pessoaVinculadaTipo: pessoaSelecionada.pessoaVinculadaTipo
    });

    fechar();
    renderResultadoItens();
    showToast('Fornecedor do item salvo.');
  });
  dlgFornecedor.showModal();
}

function renderResultadoItens() {
  if (!resultadoItensContainer) return;
  resultadoItensContainer.innerHTML = resultadoItens.length
    ? resultadoItens.map((item, index) => `
      <div class="cot-item-card" data-res-item="${index}" style="border:1px solid #dbe3ef;border-radius:8px;padding:12px;margin-bottom:12px;background:#fff">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:10px">
          <strong>Item ${index + 1}</strong>
          <span class="muted">Total do item: R$ <span data-res-total>${escHtml(formatBRLDisplay(item.valorTotal || 0) || '0,00')}</span></span>
        </div>
        <div class="grid">
          <div class="field" style="grid-column:1/-1">
            <label>Descrição do item</label>
            <input class="input" data-res-field="descricao" value="${escHtml(item.descricao || '')}" readonly>
          </div>
          <div class="field">
            <label>Quantidade</label>
            <input class="input" data-res-field="quantidade" value="${escHtml(item.quantidade || '')}" readonly>
          </div>
          <div class="field">
            <label>Unidade de medida</label>
            <input class="input" data-res-field="unidade" value="${escHtml(item.unidade || '')}" readonly>
          </div>
          <div class="field">
            <label>Situação</label>
            <select class="select" data-res-field="situacao">
              <option value="">-- selecione --</option>
              <option value="ACEITO" ${item.situacao === 'ACEITO' ? 'selected' : ''}>ACEITO</option>
              <option value="DESERTO" ${item.situacao === 'DESERTO' ? 'selected' : ''}>DESERTO</option>
            </select>
          </div>
          <div class="field">
            <label>Valor unitário do resultado</label>
            <input class="input res-valor-unitario" data-res-field="valorUnitario" value="${escHtml(item.valorUnitario || '')}" placeholder="0,00">
          </div>
          <div class="field">
            <label>CNPJ do Fornecedor</label>
            <input class="input res-cnpj" data-res-field="cnpj" value="${escHtml(item.cnpj || '')}" placeholder="00.000.000/0000-00">
          </div>
          <div class="field" style="grid-column:1/-1">
            <label>Fornecedor</label>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <div class="muted" style="flex:1;min-width:220px">
                ${escHtml(item.razaoSocial || item.nomeFantasia || 'Fornecedor não informado')}
              </div>
              <button type="button" class="btn" data-res-fornecedor="${index}">Dados do fornecedor</button>
            </div>
          </div>
        </div>
      </div>
    `).join('')
    : '<div class="muted" style="font-size:12px">Nenhum item recebido. Clique em "Receber itens cadastrados" para usar os itens do processo.</div>';

  resultadoItensContainer.querySelectorAll('[data-res-field]').forEach(input => {
    const atualizarCampoResultado = () => {
      const card = input.closest('[data-res-item]');
      const item = resultadoItens[Number(card?.dataset.resItem)];
      if (!item) return;
      if (input.classList.contains('res-cnpj')) input.value = formatCnpj(input.value);
      if (input.classList.contains('res-valor-unitario')) {
        let value = input.value.replace(/\D/g, '');
        input.value = value ? (parseFloat(value) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
      }
      item[input.dataset.resField] = input.value;
      calcularResultadoItens();
      atualizarEtapasConcluidas();
    };
    input.addEventListener('input', atualizarCampoResultado);
    input.addEventListener('change', atualizarCampoResultado);
    input.addEventListener('change', () => {
      const card = input.closest('[data-res-item]');
      if (input.classList.contains('res-cnpj')) preencherFornecedorResultadoPorCnpj(Number(card?.dataset.resItem));
    });
    input.addEventListener('blur', () => {
      const card = input.closest('[data-res-item]');
      if (input.classList.contains('res-cnpj')) preencherFornecedorResultadoPorCnpj(Number(card?.dataset.resItem));
    });
  });
  resultadoItensContainer.querySelectorAll('[data-res-fornecedor]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalFornecedorResultado(Number(btn.dataset.resFornecedor)));
  });
  calcularResultadoItens();
}

function coletarResultadoItens() {
  calcularResultadoItens();
  return resultadoItens.map(item => ({
    id: item.id || genId(),
    descricao: item.descricao || "",
    quantidade: item.quantidade || "",
    unidade: item.unidade || "",
    fornecedorId: item.fornecedorId || "",
    cnpj: item.cnpj || "",
    razaoSocial: item.razaoSocial || "",
    nomeFantasia: item.nomeFantasia || "",
    pessoaVinculadaId: item.pessoaVinculadaId || "",
    pessoaVinculadaNome: item.pessoaVinculadaNome || "",
    pessoaVinculadaTipo: item.pessoaVinculadaTipo || "",
    situacao: item.situacao || "",
    valorUnitario: item.valorUnitario || "",
    valorTotal: item.valorTotal || 0
  })).filter(item => item.descricao || item.quantidade || item.unidade || item.cnpj || item.razaoSocial || item.situacao || item.valorUnitario);
}

btnImportResultadoItens?.addEventListener('click', () => {
  const itens = obterItensBaseParaResultado();
  if (!itens.length) return alert('Nenhum item cadastrado foi encontrado para receber no Resultado.');
  if (resultadoItens.length && !confirm('Substituir os itens atuais do resultado pelos itens cadastrados?')) return;
  resultadoItens = itens;
  renderResultadoItens();
  showToast(`${itens.length} item(ns) recebido(s) no Resultado.`);
});

btnLimparResultadoItens?.addEventListener('click', () => {
  if (resultadoItens.length && !confirm('Limpar todos os itens do Resultado?')) return;
  resultadoItens = [];
  renderResultadoItens();
});

homologacaoFiltroSituacao?.addEventListener('change', renderHomologacaoItens);
renderResultadoItens();
btnPrint.addEventListener('click', () => {
  const area = dlgView.querySelector('#conteudoPrint') || dlgView.querySelector('.modal-body');
  const conteudo = area ? area.innerHTML : '';
  const win = window.open('', '', 'width=1100,height=800');

  win.document.write(`
    <html>
    <head>
      <title>Impressão do processo</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#0f172a;background:#fff}
        h2,h3{margin:0 0 10px;color:#0f172a}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{border:1px solid #dbe3ef;padding:7px;text-align:left;vertical-align:top}
        .process-hero,.process-info-grid,.process-main-grid,.process-view-grid{display:block}
        .process-hero,.process-info-card,.process-panel,.process-view-section,.process-publicacao-card,.process-link-line{border:1px solid #dbe3ef;border-radius:8px;padding:12px;margin-bottom:12px;background:#fff;color:#0f172a}
        .process-view-section summary{font-weight:700;margin-bottom:8px}
        .muted{color:#64748b}
        button,.btn{display:none!important}
        a{color:#1d4ed8;text-decoration:none}
      </style>
    </head>
    <body>${conteudo}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
});
btnExcluir.addEventListener('click', () => {

const id = fld.idx.value;

if(!id) return;

if(!confirm("Deseja excluir este processo?")) return;

data = data.filter(d => d.id != id);

saveData(data);
renderTable();

dlg.close();

});

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();



     const isEdicao = !!fld.idx.value;
const itemAnterior = isEdicao ? (data.find(x => x.id === fld.idx.value) || {}) : {};
const pessoaProcesso = dadosPessoaSelecionada(
credPessoaVinculadaSelect?.value ? credPessoaVinculadaSelect : pessoaVinculadaSelect
);
const cnpjFornecedorProcesso = fld.credCnpj.value.trim() || container.querySelector('#lic_cnpj')?.value || "";
let tipoProtocoloSelecionado = fld.tipoProcesso.value ||
  itemAnterior.tipoProtocolo ||
  (itemAnterior.tipoProcesso === "credenciamento" || itemAnterior.tipoProcesso === "licitacao" ? "PROCESSO LICITATÓRIO" : (itemAnterior.tipoProcesso || ""));
if (tipoProtocoloSelecionado === "OUTROS") {
  tipoProtocoloSelecionado = upsertTipoProtocolo(fld.novoTipoProtocolo.value);
}

let assuntoProtocoloSelecionado = fld.assuntoProtocolo.value ||
  itemAnterior.assuntoProtocolo ||
  "";
if (assuntoProtocoloSelecionado === "OUTROS") {
  assuntoProtocoloSelecionado = upsertAssuntoProtocolo(tipoProtocoloSelecionado, fld.novoAssuntoProtocolo.value);
}

const naturezaSelecionada = fld.naturezaProcesso?.value ||
  itemAnterior.naturezaProcesso ||
  (itemAnterior.tipoProcesso === "credenciamento" || normalizarCadastro(itemAnterior.assuntoProtocolo) === "CREDENCIAMENTO" ? "CREDENCIAMENTO" : "");
const isCredenciamentoProtocolo = normalizarCadastro(tipoProtocoloSelecionado) === "PROCESSO LICITATORIO" &&
  normalizarCadastro(naturezaSelecionada) === "CREDENCIAMENTO";
const isNaturezaRegistroPrecoProtocolo = normalizarCadastro(tipoProtocoloSelecionado) === "PROCESSO LICITATORIO" &&
  normalizarCadastro(naturezaSelecionada) === "REGISTRO DE PRECO";
const isNaturezaAdesaoProtocolo = normalizarCadastro(tipoProtocoloSelecionado) === "PROCESSO LICITATORIO" &&
  normalizarCadastro(naturezaSelecionada) === "ADESAO";
const isNaturezaSemRegistroPrecoProtocolo = normalizarCadastro(tipoProtocoloSelecionado) === "PROCESSO LICITATORIO" &&
  !!naturezaSelecionada &&
  !isCredenciamentoProtocolo &&
  !isNaturezaRegistroPrecoProtocolo &&
  !isNaturezaAdesaoProtocolo;
const registroPrecosSelecionado = isCredenciamentoProtocolo
  ? ""
  : ((isNaturezaRegistroPrecoProtocolo || isNaturezaAdesaoProtocolo) ? "sim" : (isNaturezaSemRegistroPrecoProtocolo ? "nao" : (fld.registroPrecos.value || itemAnterior.registroPrecos || (itemAnterior.tipoRegistroPreco ? "sim" : ""))));
const tipoProcessoLegado = isCredenciamentoProtocolo
    ? "credenciamento"
    : normalizarCadastro(tipoProtocoloSelecionado) === "PROCESSO LICITATORIO"
      ? "licitacao"
      : tipoProtocoloSelecionado;
const tipoLicitacaoSelecionado = registroPrecosSelecionado === "sim" ? "registro_preco" : "";

const publicacoesColetadas = await coletarPublicacoesProcesso();
if (publicacoesColetadas === null) return;
const cotItensColetados = coletarCotacaoItens();
const pesquisas = cotItensColetados.flatMap(itemCot => (itemCot.pesquisas || []).map(p => ({
  fonte: itemCot.descricao ? `${itemCot.descricao} - ${p.fonte || ''}`.trim() : (p.fonte || ''),
  valor: p.valor || ""
})));
const ataAdesaoSelecionada = isNaturezaAdesaoProtocolo ? ataSelecionadaAdesao() : null;
const ataAdesaoTexto = ataAdesaoSelecionada
  ? [ataAdesaoSelecionada.numero, ataAdesaoSelecionada.ano].filter(Boolean).join('/')
  : (itemAnterior.ata || '');
const fornecedorAdesao = ataAdesaoSelecionada
  ? (ataAdesaoSelecionada.fornecedorRazao || ataAdesaoSelecionada.fornecedorFantasia || '')
  : (container.querySelector('#lic_fornecedor')?.value || itemAnterior.fornecedor || '');
const cnpjAdesao = ataAdesaoSelecionada
  ? (ataAdesaoSelecionada.fornecedorCnpj || '')
  : (container.querySelector('#lic_cnpj')?.value || itemAnterior.cnpj || '');
const item = {
  id: fld.idx.value || genId(),
  numero: fld.numero.value.trim(),
  novo: !isEdicao,
        dataCriacao: fld.dataCriacao.value.trim(),
        objeto: fld.objeto.value.trim(),
        secretaria: fld.secretaria.value,
        interessadoOriginal: fld.interessadoOriginal.value || '',
        // novos campos
        descricaoCompleta: fld.descricaoCompleta.value.trim(),
        
        observacao: fld.observacao.value.trim(),
        volumes: fld.volumes.value || '',
        
        situacao: fld.situacao.value.trim(),
        fase: fld.fase.value.trim(),
        fasesAtivas: coletarFasesAtivasProcesso(),
        etapasConcluidas: coletarEtapasConcluidas(),
        publicacoes: publicacoesColetadas,
        publicacaoPncpLink: container.querySelector('#lic_publicacao_pncp_link')?.value.trim() || '',
        tipoProtocolo: tipoProtocoloSelecionado,
        naturezaProcesso: naturezaSelecionada,
        assuntoProtocolo: assuntoProtocoloSelecionado,
        registroPrecos: registroPrecosSelecionado,
        irpRegistroPreco: registroPrecosSelecionado === 'sim' ? (fld.irpRegistroPreco?.value || itemAnterior.irpRegistroPreco || '') : '',
        tipoProcesso: tipoProcessoLegado,
        modalidadeLicitacao: container.querySelector('#lic_tipo_modalidade')?.value || "",
        tipoLicitacao: tipoLicitacaoSelecionado,
        credTipo: fld.credTipo.value || itemAnterior.credTipo || "",
        credNumero: fld.credNumero.value.trim() || itemAnterior.credNumero || "",
        credPrincipal: fld.credPrincipal.value || itemAnterior.credPrincipal || "",
        credCnpj: fld.credCnpj.value.trim() || itemAnterior.credCnpj || "",
        credRazao: fld.credRazao.value.trim() || itemAnterior.credRazao || "",
        credFantasia: fld.credFantasia.value.trim() || itemAnterior.credFantasia || "",
        credItens: credItens,
        credItensContratacao: credItensContratacao,
itensProcesso: itensProcesso,
        fornecedorId: fornecedorIdPorCnpj(cnpjFornecedorProcesso),
        pessoaVinculadaId: pessoaProcesso.pessoaVinculadaId,
        pessoaVinculadaNome: pessoaProcesso.pessoaVinculadaNome,
        pessoaVinculadaTipo: pessoaProcesso.pessoaVinculadaTipo,

        tipoRegistroPreco: isNaturezaRegistroPrecoProtocolo ? "gerador" : (isNaturezaAdesaoProtocolo ? "adesao" : (isNaturezaSemRegistroPrecoProtocolo ? "" : (container.querySelector('input[name="tipo_registro_preco"]:checked')?.value || itemAnterior.tipoRegistroPreco || ""))),
tipoAdesaoRegistro: isNaturezaAdesaoProtocolo ? (container.querySelector('input[name="tipo_adesao_registro"]:checked')?.value || itemAnterior.tipoAdesaoRegistro || "") : "",
atasRegistroPreco: atasRegistroPreco,
processoGerador: isNaturezaAdesaoProtocolo ? (container.querySelector('#lic_processo_gerador')?.value || itemAnterior.processoGerador || "") : "",
ataRegistroPrecoId: isNaturezaAdesaoProtocolo ? (selectAtaVinculada?.value || "") : "",
ata: isNaturezaAdesaoProtocolo ? ataAdesaoTexto : "",
fornecedor: isNaturezaAdesaoProtocolo ? fornecedorAdesao : "",
cnpj: isNaturezaAdesaoProtocolo ? cnpjAdesao : "",

sdNumero: container.querySelector('#lic_sd_numero')?.value || "",
sdUnidade: container.querySelector('#lic_sd_unidade')?.value || "",
sdElaborado: container.querySelector('#lic_sd_elaborado')?.value || "",
sdFicha: container.querySelector('#lic_sd_ficha')?.value || "",
sdSubElemento: container.querySelector('#lic_sd_sub_elemento')?.value || "",
sdInstrumento: container.querySelector('#lic_sd_instrumento')?.value || "",
sdAutoridade: container.querySelector('#lic_sd_autoridade')?.value || "",

sdRecurso:[
container.querySelector('#lic_sd_rec_municipal')?.checked ? "Municipal" : null,
container.querySelector('#lic_sd_rec_estadual')?.checked ? "Estadual" : null,
container.querySelector('#lic_sd_rec_federal')?.checked ? "Federal" : null
].filter(Boolean),

requisicoes: coletarRequisicoes(),


etpElaborado: container.querySelector('#lic_etp_elaborado')?.value || "",
etpForma: container.querySelector('#lic_etp_forma')?.value || "",
etpQtdItens: container.querySelector('#lic_etp_qtd_itens')?.value || "",
etpMetodologia: container.querySelector('#lic_etp_metodologia')?.value || "",
etpValorEstimado: container.querySelector('#lic_etp_valor_estimado')?.value || "",

trElaborado: container.querySelector('#lic_tr_elaborado')?.value || "",
trAprovador: container.querySelector('#lic_tr_aprovador')?.value || "",

trObs: container.querySelector('#lic_tr_obs')?.value || "",
trModalidade: container.querySelector('#lic_tr_modalidade')?.value || "",
trFundamento: container.querySelector('#lic_tr_fundamento')?.value || "",
trCriterio: container.querySelector('#lic_tr_criterio')?.value || "",
trRegime: container.querySelector('#lic_tr_regime')?.value || "",

trUnidade: container.querySelector('#lic_tr_unidade')?.value || "",
trValorEstimado: container.querySelector('#lic_tr_valor_estimado')?.value || "",

editalForma: container.querySelector('#lic_edital_forma')?.value || "",
editalNumero: container.querySelector('#lic_edital_numero')?.value || "",
editalValorEstimado: container.querySelector('#lic_edital_valor_estimado')?.value || "",
editalCriterio: container.querySelector('#lic_edital_criterio')?.value || "",
editalModoDisputa: container.querySelector('#lic_edital_modo_disputa')?.value || "",
editalDataSessao: container.querySelector('#lic_edital_data_sessao')?.value || "",
editalHoraSessaoInicio: container.querySelector('#lic_edital_hora_sessao_inicio')?.value || "",
editalHoraSessaoFim: container.querySelector('#lic_edital_hora_sessao_fim')?.value || "",
editalDataInicio: container.querySelector('#lic_edital_data_inicio')?.value || "",
editalHoraInicio: container.querySelector('#lic_edital_hora_inicio')?.value || "",
editalDataFim: container.querySelector('#lic_edital_data_fim')?.value || "",
editalHoraFim: container.querySelector('#lic_edital_hora_fim')?.value || "",
editalObs: container.querySelector('#lic_edital_obs')?.value || "",
licitacaoPregoeiro: container.querySelector('#lic_licitacao_pregoeiro')?.value || "",
licitacaoObs: container.querySelector('#lic_licitacao_obs')?.value || "",
resultadoItens: coletarResultadoItens(),
resultadoValorHomologado: container.querySelector('#lic_resultado_valor_homologado')?.value || "",
avisoContratacaoDiretaForma: container.querySelector('#lic_aviso_cd_forma')?.value || "",
avisoContratacaoDiretaNumero: container.querySelector('#lic_aviso_cd_numero')?.value || "",
avisoContratacaoDiretaAgente: container.querySelector('#lic_aviso_cd_agente')?.value || "",
avisoContratacaoDiretaValorEstimado: container.querySelector('#lic_aviso_cd_valor_estimado')?.value || "",
avisoContratacaoDiretaCriterio: container.querySelector('#lic_aviso_cd_criterio')?.value || "",
avisoContratacaoDiretaDataSessao: container.querySelector('#lic_aviso_cd_data_sessao')?.value || "",
avisoContratacaoDiretaHoraSessaoInicio: container.querySelector('#lic_aviso_cd_hora_sessao_inicio')?.value || "",
avisoContratacaoDiretaHoraSessaoFim: container.querySelector('#lic_aviso_cd_hora_sessao_fim')?.value || "",
avisoContratacaoDiretaDataInicio: container.querySelector('#lic_aviso_cd_data_inicio')?.value || "",
avisoContratacaoDiretaHoraInicio: container.querySelector('#lic_aviso_cd_hora_inicio')?.value || "",
avisoContratacaoDiretaDataFim: container.querySelector('#lic_aviso_cd_data_fim')?.value || "",
avisoContratacaoDiretaHoraFim: container.querySelector('#lic_aviso_cd_hora_fim')?.value || "",

cotRealizado: container.querySelector('#lic_cot_realizado')?.value || "",
cotTipo: container.querySelector('#lic_cot_tipo')?.value || "",
cotMedia: container.querySelector('#lic_cot_media')?.value || "",
cotQtd: container.querySelector('#lic_cot_qtd')?.value || "",
cotTotal: container.querySelector('#lic_cot_total')?.value || "",
cotQuadro: container.querySelector('#lic_cot_quadro')?.value || "",
cotPesquisas: pesquisas,
cotItens: cotItensColetados,



      };

      
      if (!item.numero || !item.secretaria) return alert('Preencha os campos obrigatórios.');
      if (!item.tipoProtocolo) return alert('Selecione o Tipo de Protocolo.');
      if (fld.tipoProcesso.value === "OUTROS" && !fld.novoTipoProtocolo.value.trim()) {
        return alert('Informe o novo Tipo de Protocolo.');
      }
      if (normalizarCadastro(item.tipoProtocolo) === "PROCESSO LICITATORIO") {
        const isCredenciamento = normalizarCadastro(item.naturezaProcesso) === "CREDENCIAMENTO";
        if (!isCredenciamento && !item.assuntoProtocolo) return alert('Selecione o Tipo de Objeto do Processo Licitatório.');
        if (fld.assuntoProtocolo.value === "OUTROS" && !fld.novoAssuntoProtocolo.value.trim()) {
          return alert('Informe o novo Tipo de Objeto.');
        }
        if (!item.naturezaProcesso) return alert('Selecione a Natureza do Processo Licitatório.');
        if (!isCredenciamento && !item.registroPrecos) return alert('Informe se é Registro de Preços.');
        if (item.registroPrecos === "sim" && !item.tipoRegistroPreco) {
          return alert('Selecione se o Registro de Preços é Processo Gerador da Ata ou Adesão.');
        }
      }
      if (normalizarCadastro(item.tipoProtocolo) === "SOLICITACAO") {
        if (!item.assuntoProtocolo) return alert('Selecione o Assunto da Solicitação.');
        if (fld.assuntoProtocolo.value === "OUTROS" && !fld.novoAssuntoProtocolo.value.trim()) {
          return alert('Informe o novo Assunto / Categoria.');
        }
      }
      if (item.tipoRegistroPreco === "adesao" && !item.tipoAdesaoRegistro && item.processoGerador) {
        item.tipoAdesaoRegistro = "interna";
      }
      if (item.tipoRegistroPreco === "adesao") {
        if (!item.tipoAdesaoRegistro) return alert('Selecione se a adesão é interna ou externa.');
        if (item.tipoAdesaoRegistro === "interna" && !item.processoGerador) {
          return alert('Selecione o processo gerador da ata para adesão interna.');
        }
        if (item.tipoAdesaoRegistro === "interna") {
          const atasGerador = atasDoProcessoGeradorAdesao(item.processoGerador);
          if (!atasGerador.length) return alert('O processo gerador selecionado ainda não possui atas cadastradas.');
          if (!item.ataRegistroPrecoId) return alert('Selecione a ata cadastrada do processo gerador.');
        }
      }
      if (item.tipoProcesso === "credenciamento") {
        if (!item.credTipo) return alert('Selecione o tipo de credenciamento.');
        if (item.credTipo === "principal" && !item.credNumero) {
          return alert('Informe o Nº/Ano do Credenciamento.');
        }
        if (item.credTipo === "contratacao") {
          if (!item.credPrincipal) return alert('Selecione a qual credenciamento este processo pertence.');
          if (!item.credCnpj || !item.credRazao || !item.credFantasia) {
            return alert('Preencha CNPJ, Razão Social e Nome Fantasia do credenciado.');
          }
          if (!Array.isArray(item.credItensContratacao) || item.credItensContratacao.length <= 1) {
            return alert('Selecione os itens que o contratado irá participar.');
          }
        }
      }
      const dup = data.find(x => x.numero === item.numero && x.id !== item.id);
      if (dup) return alert('Já existe processo com este número.');
      const idx = data.findIndex(x => x.id === item.id);
      if (idx >= 0) data[idx] = item; else data.unshift(item);
      const fornecedorRegistrado = registrarFornecedorDoProcesso(item);
      if (fornecedorRegistrado && !item.fornecedorId) item.fornecedorId = fornecedorRegistrado.id;
      (item.resultadoItens || []).forEach(resItem => {
        if (onlyDigits(resItem.cnpj).length === 14) {
          const fornecedorResultado = upsertFornecedor({
            cnpj: resItem.cnpj,
            razaoSocial: resItem.razaoSocial,
            nomeFantasia: resItem.nomeFantasia,
            origem: 'RESULTADO DO PROCESSO'
          });
          resItem.fornecedorId = fornecedorResultado?.id || resItem.fornecedorId || "";
        }
      });
      saveData(data);
      renderTable();
      dlg.close();
      showToast('Processo salvo.');
    });

    function openEdit(id){

const item = data.find(r => r.id == id);
if(!item) return;

form.reset();
container.querySelector('#lic_title').textContent = "Editar processo";

// 🔑 ISSO DEFINE QUE É EDIÇÃO
fld.idx.value = item.id;

// =========================
// PREENCHER CAMPOS GERAIS
// =========================
fld.numero.value = item.numero || "";
fld.dataCriacao.value = item.dataCriacao || "";
fld.objeto.value = item.objeto || "";
fld.interessadoOriginal.value = item.interessadoOriginal || (SECRETARIAS.includes(item.secretaria) ? "" : (item.secretaria || ""));
selecionarOuAdicionarOpcao(fld.secretaria, item.secretaria || "");
fld.descricaoCompleta.value = item.descricaoCompleta || "";
fld.observacao.value = item.observacao || "";
fld.volumes.value = item.volumes || "";
fld.situacao.value = item.situacao || "";
fld.fase.value = item.fase || "";
itensProcesso = Array.isArray(item.itensProcesso) ? item.itensProcesso : [];
atualizarBotaoAssociacaoSecretaria();

// =========================
// TIPO DE PROCESSO / CATEGORIAS
// =========================
const tipoProtocoloEdicao = item.tipoProtocolo ||
  (item.tipoProcesso === "credenciamento" || item.tipoProcesso === "licitacao" ? "PROCESSO LICITATÓRIO" : (item.tipoProcesso || ""));
const naturezaProcessoEdicao = item.naturezaProcesso ||
  (item.tipoProcesso === "credenciamento" || normalizarCadastro(item.assuntoProtocolo) === "CREDENCIAMENTO" ? "CREDENCIAMENTO" :
    item.tipoRegistroPreco === "gerador" ? "REGISTRO DE PREÇO" :
    item.tipoRegistroPreco === "adesao" ? "ADESÃO" : "");
const assuntoProtocoloEdicao = normalizarCadastro(item.assuntoProtocolo) === "CREDENCIAMENTO"
  ? ""
  : (item.assuntoProtocolo || "");
const registroPrecosEdicao = item.registroPrecos || (item.tipoRegistroPreco ? "sim" : "");

if (tipoProtocoloEdicao) {
  const existeTipo = [...fld.tipoProcesso.options].some(opt => normalizarCadastro(opt.value) === normalizarCadastro(tipoProtocoloEdicao));
  if (!existeTipo) {
    const option = document.createElement("option");
    option.value = tipoProtocoloEdicao;
    option.textContent = tipoProtocoloEdicao;
    fld.tipoProcesso.appendChild(option);
  }
  fld.tipoProcesso.value = tipoProtocoloEdicao;
}

fld.novoTipoProtocolo.value = item.novoTipoProtocolo || "";
if (fld.naturezaProcesso) fld.naturezaProcesso.value = naturezaProcessoEdicao;
carregarAssuntosDoTipo(fld.tipoProcesso.value, assuntoProtocoloEdicao);
fld.assuntoProtocolo.value = assuntoProtocoloEdicao;
fld.novoAssuntoProtocolo.value = item.novoAssuntoProtocolo || "";
fld.registroPrecos.value = registroPrecosEdicao;
carregarIrpsRegistroPreco(item.irpRegistroPreco || '');
if (fld.irpRegistroPreco) fld.irpRegistroPreco.value = item.irpRegistroPreco || '';

container.querySelectorAll('input[name="tipo_adesao_registro"]').forEach(r => {
  const tipoAdesao = item.tipoAdesaoRegistro || (item.processoGerador ? "interna" : "");
  r.checked = !!tipoAdesao && r.value === tipoAdesao;
});
selectProcessoGerador.value = item.processoGerador || "";

fld.credTipo.value = item.credTipo || "";
fld.credNumero.value = item.credNumero || "";
fld.credPrincipal.value = item.credPrincipal || "";
fld.credCnpj.value = item.credCnpj || "";
fld.credRazao.value = item.credRazao || "";
fld.credFantasia.value = item.credFantasia || "";

atasRegistroPreco = Array.isArray(item.atasRegistroPreco) ? item.atasRegistroPreco : [];
renderAtasPreview();
fecharAtaInline();
credItens = Array.isArray(item.credItens) ? item.credItens : [];
renderCredItensPreview();
credItensContratacao = Array.isArray(item.credItensContratacao) ? item.credItensContratacao : [];
renderCredItensContratacaoPreview();
etapasConcluidas = item.etapasConcluidas && typeof item.etapasConcluidas === "object" ? { ...item.etapasConcluidas } : {};
fasesAtivasProcesso = Array.isArray(item.fasesAtivas)
  ? item.fasesAtivas.filter(id => fasesDisponiveisProcesso.some(fase => fase.id === id))
  : fasesDisponiveisProcesso.map(fase => fase.id);
aplicarFasesAtivasProcesso();
atualizarClassificacaoProtocolo();
if (item.processoGerador) {
  selectProcessoGerador.value = item.processoGerador;
  carregarAtasProcessoGeradorAdesao(item.ataRegistroPrecoId || '');
  if (!selectAtaVinculada?.value && item.ata) {
    const atasAdesao = atasDoProcessoGeradorAdesao(item.processoGerador);
    const ataPorTexto = atasAdesao.find(ata => normalizarCadastro([ata.numero, ata.ano].filter(Boolean).join('/')) === normalizarCadastro(item.ata));
    if (ataPorTexto && selectAtaVinculada) selectAtaVinculada.value = ataPorTexto.id || '';
  }
  aplicarAtaVinculadaAdesao(item.pessoaVinculadaId || '');
}
atualizarEtapasConcluidas();

// =========================
// SD
// =========================
container.querySelector('#lic_sd_numero').value = item.sdNumero || "";
container.querySelector('#lic_sd_unidade').value = item.sdUnidade || "";
container.querySelector('#lic_sd_elaborado').value = item.sdElaborado || "";
container.querySelector('#lic_sd_ficha').value = item.sdFicha || "";
container.querySelector('#lic_sd_sub_elemento').value = item.sdSubElemento || "";
container.querySelector('#lic_sd_instrumento').value = item.sdInstrumento || "";
container.querySelector('#lic_sd_autoridade').value = item.sdAutoridade || "";

container.querySelector('#lic_sd_rec_municipal').checked = item.sdRecurso?.includes("Municipal");
container.querySelector('#lic_sd_rec_estadual').checked = item.sdRecurso?.includes("Estadual");
container.querySelector('#lic_sd_rec_federal').checked = item.sdRecurso?.includes("Federal");

// =========================
// REQUISIÇÕES
// =========================
renderRequisicoes(item.requisicoes || []);

// =========================
// ETP
// =========================
container.querySelector('#lic_etp_elaborado').value = item.etpElaborado || "";
container.querySelector('#lic_etp_forma').value = item.etpForma || "";
container.querySelector('#lic_etp_qtd_itens').value = item.etpQtdItens || "";
container.querySelector('#lic_etp_metodologia').value = item.etpMetodologia || "";
container.querySelector('#lic_etp_valor_estimado').value = item.etpValorEstimado || "";

// =========================
// TR
// =========================
container.querySelector('#lic_tr_elaborado').value = item.trElaborado || "";
container.querySelector('#lic_tr_aprovador').value = item.trAprovador || "";
container.querySelector('#lic_tr_obs').value = item.trObs || "";
const trModalidadeSelect = container.querySelector('#lic_tr_modalidade');
if (trModalidadeSelect) {
  const modalidadeSalva = item.trModalidade || "";
  const existeModalidade = [...trModalidadeSelect.options].some(opt => opt.value === modalidadeSalva);
  if (modalidadeSalva && !existeModalidade) {
    const option = document.createElement("option");
    option.value = modalidadeSalva;
    option.textContent = modalidadeSalva;
    trModalidadeSelect.appendChild(option);
  }
  trModalidadeSelect.value = modalidadeSalva;
}
container.querySelector('#lic_tr_fundamento').value = item.trFundamento || "";
const trCriterioSelect = container.querySelector('#lic_tr_criterio');
if (trCriterioSelect) {
  const criterioSalvo = item.trCriterio || "";
  const existeCriterio = [...trCriterioSelect.options].some(opt => opt.value === criterioSalvo);
  if (criterioSalvo && !existeCriterio) {
    const option = document.createElement("option");
    option.value = criterioSalvo;
    option.textContent = criterioSalvo;
    trCriterioSelect.appendChild(option);
  }
  trCriterioSelect.value = criterioSalvo;
}
container.querySelector('#lic_tr_regime').value = item.trRegime || "";
container.querySelector('#lic_tr_unidade').value = item.trUnidade || "";
container.querySelector('#lic_tr_valor_estimado').value = item.trValorEstimado || "";
const editalFormaSelect = container.querySelector('#lic_edital_forma');
if (editalFormaSelect) {
  const formaEditalSalva = item.editalForma || "";
  const formaEquivalente = [...editalFormaSelect.options].find(opt => normalizarCadastro(opt.value) === normalizarCadastro(formaEditalSalva));
  editalFormaSelect.value = formaEquivalente?.value || "";
}
container.querySelector('#lic_edital_numero').value = item.editalNumero || "";
container.querySelector('#lic_edital_valor_estimado').value = item.editalValorEstimado || "";
const editalCriterioSelect = container.querySelector('#lic_edital_criterio');
if (editalCriterioSelect) {
  const criterioEditalSalvo = item.editalCriterio || "";
  const criterioEquivalente = [...editalCriterioSelect.options].find(opt => normalizarCadastro(opt.value) === normalizarCadastro(criterioEditalSalvo));
  if (criterioEditalSalvo && !criterioEquivalente) {
    const option = document.createElement("option");
    option.value = criterioEditalSalvo;
    option.textContent = criterioEditalSalvo;
    editalCriterioSelect.appendChild(option);
  }
  editalCriterioSelect.value = criterioEquivalente?.value || criterioEditalSalvo;
}
container.querySelector('#lic_edital_modo_disputa').value = item.editalModoDisputa || "";
container.querySelector('#lic_edital_data_sessao').value = item.editalDataSessao || "";
container.querySelector('#lic_edital_hora_sessao_inicio').value = item.editalHoraSessaoInicio || "";
container.querySelector('#lic_edital_hora_sessao_fim').value = item.editalHoraSessaoFim || "";
container.querySelector('#lic_edital_data_inicio').value = item.editalDataInicio || "";
container.querySelector('#lic_edital_hora_inicio').value = item.editalHoraInicio || "";
container.querySelector('#lic_edital_data_fim').value = item.editalDataFim || "";
container.querySelector('#lic_edital_hora_fim').value = item.editalHoraFim || "";
container.querySelector('#lic_edital_obs').value = item.editalObs || "";
preencherEditalSeVazio();
atualizarSugestoesPregoeiros();
container.querySelector('#lic_licitacao_pregoeiro').value = item.licitacaoPregoeiro || "";
container.querySelector('#lic_licitacao_obs').value = item.licitacaoObs || "";
container.querySelector('#lic_resultado_valor_homologado').value = item.resultadoValorHomologado || "";
resultadoItens = Array.isArray(item.resultadoItens) ? item.resultadoItens.map(res => novoItemResultado(res)) : [];
renderResultadoItens();
container.querySelector('#lic_aviso_cd_forma').value = item.avisoContratacaoDiretaForma || "";
container.querySelector('#lic_aviso_cd_numero').value = item.avisoContratacaoDiretaNumero || "";
container.querySelector('#lic_aviso_cd_agente').value = item.avisoContratacaoDiretaAgente || "";
container.querySelector('#lic_aviso_cd_valor_estimado').value = item.avisoContratacaoDiretaValorEstimado || "";
const avisoCdCriterioSelect = container.querySelector('#lic_aviso_cd_criterio');
if (avisoCdCriterioSelect) {
  const criterioAvisoSalvo = item.avisoContratacaoDiretaCriterio || "";
  const criterioEquivalente = [...avisoCdCriterioSelect.options].find(opt => normalizarCadastro(opt.value) === normalizarCadastro(criterioAvisoSalvo));
  if (criterioAvisoSalvo && !criterioEquivalente) {
    const option = document.createElement("option");
    option.value = criterioAvisoSalvo;
    option.textContent = criterioAvisoSalvo;
    avisoCdCriterioSelect.appendChild(option);
  }
  avisoCdCriterioSelect.value = criterioEquivalente?.value || criterioAvisoSalvo;
}
container.querySelector('#lic_aviso_cd_data_sessao').value = item.avisoContratacaoDiretaDataSessao || "";
container.querySelector('#lic_aviso_cd_hora_sessao_inicio').value = item.avisoContratacaoDiretaHoraSessaoInicio || "";
container.querySelector('#lic_aviso_cd_hora_sessao_fim').value = item.avisoContratacaoDiretaHoraSessaoFim || "";
container.querySelector('#lic_aviso_cd_data_inicio').value = item.avisoContratacaoDiretaDataInicio || "";
container.querySelector('#lic_aviso_cd_hora_inicio').value = item.avisoContratacaoDiretaHoraInicio || "";
container.querySelector('#lic_aviso_cd_data_fim').value = item.avisoContratacaoDiretaDataFim || "";
container.querySelector('#lic_aviso_cd_hora_fim').value = item.avisoContratacaoDiretaHoraFim || "";

// =========================
// COTAÇÃO
// =========================
container.querySelector('#lic_cot_realizado').value = item.cotRealizado || "";
container.querySelector('#lic_cot_tipo').value = item.cotTipo || "media";
container.querySelector('#lic_cot_media').value = item.cotMedia || "";
container.querySelector('#lic_cot_qtd').value = item.cotQtd || "";
container.querySelector('#lic_cot_total').value = item.cotTotal || "";
container.querySelector('#lic_cot_quadro').value = item.cotQuadro || "";

// recriar cotações
if (Array.isArray(item.cotItens) && item.cotItens.length) {
  cotItens = item.cotItens.map(cot => novoItemCotacao(cot));
  renderCotacaoItens();
} else if (Array.isArray(item.cotPesquisas) && item.cotPesquisas.length) {
  renderCotacaoLegada(item.cotPesquisas);
} else {
  cotItens = [];
  renderCotacaoItens();
}

// =========================
publicacoesProcesso = Array.isArray(item.publicacoes) ? item.publicacoes.map(pub => ({ ...pub, __editing: false, __open: false })) : [];
renderPublicacoesProcesso();
container.querySelector('#lic_publicacao_pncp_link').value = item.publicacaoPncpLink || '';
atualizarBotaoPncpPublicacao();
fecharBlocosDoModalProcesso();
// ABRIR MODAL
// =========================
dlg.showModal();

btnExcluir.style.display = "inline-block";

}

    dlgEditClose.onclick = dlgEditCancel.onclick = () => dlgEdit.close();

    dlgEditDelete.onclick = () => {
      const id = fldEdit.idx.value;
      if (!confirm('Excluir este processo?')) return;
      data = data.filter(x => x.id !== id);
      saveData(data);
      renderTable();
      dlgEdit.close();
      showToast('Excluído.');
    };

    formEdit.onsubmit = (ev) => {

      
      ev.preventDefault();
      const id = fldEdit.idx.value;
      const idx = data.findIndex(x => x.id === id);
      if (idx === -1) return alert('Registro não encontrado.');
      const newNumero = fldEdit.numero.value.trim();
      const dup = data.find(x => x.numero === newNumero && x.id !== id);
      if (dup) return alert('Já existe outro processo com este número.');

      

      const recursoArr = [];
      if (fldEdit.recurso_municipal.checked) recursoArr.push('Municipal');
      if (fldEdit.recurso_estadual.checked) recursoArr.push('Estadual');
      if (fldEdit.recurso_federal.checked) recursoArr.push('Federal');

      const valorNum = parseBRLToNumber(fldEdit.valorEstimado.value);

      // atualiza campos
      data[idx].numero = fldEdit.numero.value.trim();
      data[idx].dataCriacao = fldEdit.dataCriacao.value.trim();
      data[idx].objeto = fldEdit.objeto.value.trim();
      data[idx].secretaria = fldEdit.secretaria.value;
      // novos
      data[idx].descricaoCompleta = fldEdit.descricaoCompleta.value.trim();
      data[idx].irp = fldEdit.irp.value || '';
      data[idx].observacao = fldEdit.observacao.value.trim();
      data[idx].volumes = fldEdit.volumes.value || '';
      data[idx].valorEstimado = valorNum !== null ? valorNum : null;
      data[idx].recurso = recursoArr;
      data[idx].modalidade = fldEdit.modalidade.value.trim();
      data[idx].situacao = fldEdit.situacao.value.trim();
      data[idx].fase = fldEdit.fase.value.trim();
      data[idx].novo = false;

      registrarFornecedorDoProcesso(data[idx]);

      saveData(data);
      renderTable();
      dlgEdit.close();
      showToast('Alterações salvas.');
    };

function gerarConteudoVisualizacao(item){
const credPrincipal = item.credPrincipal
  ? data.find(p => p.id === item.credPrincipal)
  : null;
const processoGeradorAta = item.processoGerador
  ? data.find(p => p.id === item.processoGerador)
  : null;
const tipoAdesaoVisual = item.tipoAdesaoRegistro || (item.processoGerador ? "interna" : "");
const atasVisual = Array.isArray(item.atasRegistroPreco) ? item.atasRegistroPreco : [];
const formaContratacaoVisual = normalizarCadastro(item.etpForma) === "ELETRONICA"
  ? "ELETRÔNICA"
  : normalizarCadastro(item.etpForma) === "PRESENCIAL"
    ? "PRESENCIAL"
    : (item.etpForma ? String(item.etpForma).toLocaleUpperCase("pt-BR") : "");
const recursoVisual = Array.isArray(item.sdRecurso) && item.sdRecurso.length
  ? item.sdRecurso.join(", ").toLocaleUpperCase("pt-BR")
  : "";
const modalidadeVisual = item.trModalidade ? String(item.trModalidade).toLocaleUpperCase("pt-BR") : "";
let irpVisual = null;
if (item.irpRegistroPreco) {
  try {
    irpVisual = JSON.parse(localStorage.getItem(IRP_STORAGE_KEY) || '[]').find(irp => irp.id === item.irpRegistroPreco) || null;
  } catch (error) {
    console.error('Erro ao carregar IRP vinculada:', error);
  }
}
const irpVisualTexto = irpVisual ? `IRP ${irpVisual.numero || ""}/${irpVisual.ano || ""}${irpVisual.objeto ? " - " + irpVisual.objeto : ""}` : "IRP vinculada não encontrada";
const registroPrecoHtml = item.tipoRegistroPreco ? `
<hr>
<h4>Registro de Preço</h4>
<b>Tipo:</b> ${item.tipoRegistroPreco === "gerador" ? "Processo Gerador da Ata" : item.tipoRegistroPreco === "adesao" ? "Adesão" : ""}<br>
${item.tipoRegistroPreco === "gerador" && item.irpRegistroPreco ? `<b>Intenção de Registro de Preço:</b> ${irpVisualTexto}<br>` : ""}
${item.tipoRegistroPreco === "adesao" ? `<b>Tipo de Adesão:</b> ${tipoAdesaoVisual === "interna" ? "Interna" : tipoAdesaoVisual === "externa" ? "Externa" : ""}<br>` : ""}
${item.tipoRegistroPreco === "adesao" && tipoAdesaoVisual === "interna" ? `<b>Processo gerador vinculado:</b> ${processoGeradorAta ? `${processoGeradorAta.numero || ""} - ${processoGeradorAta.objeto || ""}` : ""}<br>` : ""}
${item.tipoRegistroPreco === "gerador" ? `<b>Atas cadastradas:</b> ${atasVisual.length}<br>` : ""}
${item.ata ? `<b>ATA:</b> ${item.ata || ""}<br>` : ""}
${item.fornecedor ? `<b>Fornecedor:</b> ${item.fornecedor || ""}<br>` : ""}
${item.cnpj ? `<b>CNPJ:</b> ${item.cnpj || ""}<br>` : ""}
${item.tipoRegistroPreco === "gerador" && atasVisual.length ? `
<div style="margin-top:10px;overflow:auto">
<table>
<thead>
<tr><th>Ata</th><th>Fornecedor</th><th>Objeto resumido</th><th>Vigência</th><th>PNCP</th><th>PDFs</th><th>Itens</th><th>Aditivos</th></tr>
</thead>
<tbody>
${atasVisual.map(ata => `
<tr>
<td><strong>${ata.numero || ""}/${ata.ano || ""}</strong></td>
<td>${ata.fornecedorRazao || ata.fornecedorFantasia || ""}<br>${ata.fornecedorCnpj || ""}</td>
<td>${ata.objetoResumido || ""}</td>
<td>${ata.vigenciaInicio || ""} a ${ata.vigenciaFim || ""}</td>
<td>${ata.linkPncp ? `<a href="${ata.linkPncp}" target="_blank">Abrir</a>` : ""}</td>
<td>
${linkAnexoPdf(ata.pdfAta, "Ata", "")}
${ata.pdfAta && ata.pdfExtrato ? " | " : ""}
${linkAnexoPdf(ata.pdfExtrato, "Extrato", "")}
</td>
<td>${contarItensTabela(ata.itens)}</td>
<td>${Array.isArray(ata.aditivos) ? ata.aditivos.length : 0}</td>
</tr>
${Array.isArray(ata.itens) && ata.itens.length ? `
<tr><td colspan="8">
<strong>Itens:</strong>
${renderTabelaItensAta(ata.itens, Infinity)}
</td></tr>
` : ""}
${Array.isArray(ata.aditivos) && ata.aditivos.length ? `
<tr><td colspan="8">
<strong>Aditivos:</strong>
${ata.aditivos.map(aditivo => `
<div>
${aditivo.numero || ""} - Vigência: ${aditivo.vigencia || ""} - Assinatura: ${aditivo.dataAssinatura || ""} - Publicação: ${aditivo.publicacao || ""}
${aditivo.pdf ? ` - ${linkAnexoPdf(aditivo.pdf, "PDF", "")}` : ""}
</div>
`).join("")}
</td></tr>
` : ""}
`).join("")}
</tbody>
</table>
</div>
` : ""}
` : "";
const credHtml = item.tipoProcesso === "credenciamento" ? `
<hr>
<h4>Credenciamento</h4>
<b>Tipo:</b> ${item.credTipo === "principal" ? "Processo de Credenciamento" : item.credTipo === "contratacao" ? "Processo de Contratação" : ""}<br>
${item.credTipo === "principal" ? `<b>Nº/Ano do Credenciamento:</b> ${item.credNumero || ""}<br>` : ""}
${item.credTipo === "principal" ? `<b>Itens do Edital:</b> ${Array.isArray(item.credItens) ? item.credItens.length : 0} linha(s)<br>` : ""}
${item.credTipo === "contratacao" ? `
<b>Pertence ao Credenciamento:</b> ${credPrincipal ? `${credPrincipal.credNumero || ""} - ${credPrincipal.numero || ""}` : ""}<br>
<b>CNPJ do Credenciado:</b> ${item.credCnpj || ""}<br>
<b>Razão Social:</b> ${item.credRazao || ""}<br>
<b>Nome Fantasia:</b> ${item.credFantasia || ""}<br>
<b>Itens selecionados:</b> ${Array.isArray(item.credItensContratacao) && item.credItensContratacao.length > 1 ? item.credItensContratacao.length - 1 : 0}<br>
` : ""}
` : "";
return `

<b>Nº do processo:</b> ${item.numero || ""}<br>
<b>Secretaria:</b> ${item.secretaria || ""}<br>
<b>Data de criação:</b> ${item.dataCriacao || ""}<br><br>

<b>Tipo de Protocolo:</b> ${item.tipoProtocolo || (item.tipoProcesso === "credenciamento" || item.tipoProcesso === "licitacao" ? "PROCESSO LICITATÓRIO" : item.tipoProcesso || "")}<br>
${item.naturezaProcesso ? `<b>Natureza:</b> ${item.naturezaProcesso}<br>` : ""}
${item.assuntoProtocolo ? `<b>Tipo de Objeto:</b> ${item.assuntoProtocolo}<br>` : ""}
${item.registroPrecos || item.tipoRegistroPreco ? `<b>Registro de Preços:</b> ${(item.registroPrecos || (item.tipoRegistroPreco ? "sim" : "")).toUpperCase()}<br>` : ""}
<br>

<b>Objeto:</b><br>
${item.objeto || ""}<br><br>

${item.pessoaVinculadaId ? `
<b>Pessoa Vinculada:</b> ${item.pessoaVinculadaNome || ""}<br>
<b>Tipo de Vínculo:</b> ${item.pessoaVinculadaTipo || ""}<br><br>
` : ""}

<b>Descrição completa:</b><br>
${item.descricaoCompleta || ""}<br><br>

${credHtml}
${registroPrecoHtml}

<hr>

<h4>Solicitação de Demanda</h4>
<b>Nº SD:</b> ${item.sdNumero || ""}<br>
<b>Unidade:</b> ${item.sdUnidade || ""}<br>
<b>Elaborado por:</b> ${item.sdElaborado || ""}<br>
<b>Recurso:</b> ${recursoVisual}<br>

<hr>

<h4>ETP</h4>
<b>Valor estimado:</b> ${item.etpValorEstimado || ""}<br>

<hr>

<h4>Termo de Referência</h4>
<b>Forma de Contratação / Modalidade:</b> ${modalidadeVisual}${formaContratacaoVisual ? `<br>${formaContratacaoVisual}` : ""}<br>

<hr>

<h4>Cotação</h4>
<b>Média:</b> ${item.cotMedia || ""}<br>
<b>Total:</b> ${item.cotTotal || ""}<br>

<hr>

<b>Situação:</b> ${item.situacao || ""}<br>
<b>Fase:</b> ${item.fase || ""}<br>

`;


}

    function openView(id){
      const item = data.find(d => d.id == id);
      if(!item) return;
      restaurarVisualizacaoProcesso();

      const body = dlgView.querySelector('#view_body');
      const headTitle = dlgView.querySelector('#view_head_title');
      const safe = (value) => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      const textBlock = (value) => safe(value || '').replace(/\n/g, '<br>');
      const valueOrDash = (value) => value ? safe(value) : '<span class="muted">Não informado</span>';
      const yesNo = (value) => value ? valueOrDash(value) : '<span class="muted">Não informado</span>';

      const protocolo = item.tipoProtocolo || (item.tipoProcesso === 'credenciamento' || item.tipoProcesso === 'licitacao' ? 'PROCESSO LICITATÓRIO' : item.tipoProcesso || '');
      const assunto = item.assuntoProtocolo || (item.tipoProcesso === 'credenciamento' ? 'CREDENCIAMENTO' : '');
      const isCredenciamentoView = item.tipoProcesso === 'credenciamento' || normalizarCadastro(item.naturezaProcesso) === 'CREDENCIAMENTO' || normalizarCadastro(assunto) === 'CREDENCIAMENTO';
      const isRegistroPrecoView = item.registroPrecos === 'sim' || !!item.tipoRegistroPreco;
      const recursoTexto = Array.isArray(item.sdRecurso) && item.sdRecurso.length ? item.sdRecurso.join(', ').toLocaleUpperCase('pt-BR') : '';
      const valorEstimado = item.etpValorEstimado || item.trValorEstimado || item.valorEstimado || '';
      const modalidadeComForma = `${valorMaiusculoOuDash(item.trModalidade)}${item.etpForma ? `<br>${formaContratacaoComNumeroTexto(item.etpForma, item.avisoContratacaoDiretaNumero)}` : ''}`;
      const fasesAtivasView = new Set(Array.isArray(item.fasesAtivas) ? item.fasesAtivas : fasesDisponiveisProcesso.map(fase => fase.id));
      const temFaseView = (fase) => fasesAtivasView.has(fase);

      function infoCard(label, value, extraClass = '') {
        return `<div class="process-info-card ${extraClass}"><span>${label}</span><strong>${valueOrDash(value)}</strong></div>`;
      }

      function adminMetric(label, value, extraClass = '') {
        return `<div class="process-admin-metric ${extraClass}"><span>${label}</span><strong>${valueOrDash(value)}</strong></div>`;
      }

      function field(label, value) {
        return `<div class="process-view-field"><span>${label}</span><strong>${valueOrDash(value)}</strong></div>`;
      }

      function fieldHtml(label, html) {
        return `<div class="process-view-field"><span>${label}</span><strong>${html || ''}</strong></div>`;
      }

      function formaContratacaoTexto(value) {
        const normalizado = normalizarCadastro(value);
        if (normalizado === 'ELETRONICA') return 'ELETRÔNICA';
        if (normalizado === 'PRESENCIAL') return 'PRESENCIAL';
        return value ? safe(String(value).toLocaleUpperCase('pt-BR')) : '';
      }

      function formaContratacaoComNumeroTexto(value, numero) {
        const forma = formaContratacaoTexto(value);
        const numeroTexto = String(numero || '').trim();
        return [forma, numeroTexto ? `N° ${safe(numeroTexto)}` : ''].filter(Boolean).join(' ');
      }

      function valorMaiusculoOuDash(value) {
        return value ? safe(String(value).toLocaleUpperCase('pt-BR')) : '<span class="muted">Não informado</span>';
      }

      function criterioCalculoTexto(value) {
        const normalizado = normalizarCadastro(value);
        if (!normalizado) return '';
        if (normalizado === 'MEDIA') return 'MÉDIA';
        if (normalizado === 'MEDIANA') return 'MEDIANA';
        if (normalizado === 'MENOR' || normalizado === 'MENOR PRECO') return 'MENOR PREÇO';
        if (normalizado === 'MAIOR' || normalizado === 'MAIOR PRECO') return 'MAIOR PREÇO';
        return safe(String(value).toLocaleUpperCase('pt-BR'));
      }

      function section(title, content, open = false) {
        return `
          <details class="process-view-section" ${open ? 'open' : ''}>
            <summary>${safe(title)}</summary>
            <div class="process-view-section-body">${content}</div>
          </details>
        `;
      }

      const credPrincipal = item.credPrincipal ? data.find(p => p.id === item.credPrincipal) : null;
      const processoGeradorAta = item.processoGerador ? data.find(p => p.id === item.processoGerador) : null;
      const atasVisual = Array.isArray(item.atasRegistroPreco) ? item.atasRegistroPreco : [];
      const tipoAdesaoVisual = item.tipoAdesaoRegistro || (item.processoGerador ? 'interna' : '');
      let irpVisual = null;
      if (item.irpRegistroPreco) {
        try { irpVisual = JSON.parse(localStorage.getItem(IRP_STORAGE_KEY) || '[]').find(irp => irp.id === item.irpRegistroPreco) || null; }
        catch (error) { console.error('Erro ao carregar IRP vinculada:', error); }
      }
      const irpTexto = irpVisual ? `IRP ${irpVisual.numero || ''}/${irpVisual.ano || ''}${irpVisual.objeto ? ' - ' + irpVisual.objeto : ''}` : '';

      const publicacoes = Array.isArray(item.publicacoes) ? item.publicacoes : [];
      const pubHtml = `
        ${item.publicacaoPncpLink ? `<div class="process-link-line"><strong>PNCP:</strong> <a href="${safe(item.publicacaoPncpLink)}" target="_blank" rel="noopener">Abrir publicação no PNCP</a></div>` : '<div class="empty">Nenhum link PNCP informado.</div>'}
        ${publicacoes.length ? publicacoes.map(pub => {
          const meios = pub.meios || {};
          const meiosHtml = Object.values(meios).filter(m => m && (m.ativo || m.data || m.anexo)).map(m => `
            <div class="process-publicacao-meio">
              <div><strong>${safe(m.label || '')}</strong><span>Data: ${safe(m.data || '')}</span></div>
              <div>${m.anexo ? linkAnexoPdf(m.anexo, m.anexo.nome || 'Visualizar anexo') : '<span class="muted">Sem anexo</span>'}</div>
            </div>
          `).join('');
          return `<div class="process-publicacao-card"><strong>${safe(pub.tipo || 'PUBLICAÇÃO')}</strong>${meiosHtml || '<div class="muted">Nenhum meio informado.</div>'}</div>`;
        }).join('') : ''}
      `;

      const registroPrecoHtml = isRegistroPrecoView ? `
        <div class="process-view-grid compact">
          ${field('Tipo', item.tipoRegistroPreco === 'gerador' ? 'Processo Gerador da Ata' : item.tipoRegistroPreco === 'adesao' ? 'Adesão' : item.tipoRegistroPreco)}
          ${item.tipoRegistroPreco === 'gerador' ? field('IRP vinculada', irpTexto) : ''}
          ${item.tipoRegistroPreco === 'adesao' ? field('Tipo de adesão', tipoAdesaoVisual === 'interna' ? 'Interna' : tipoAdesaoVisual === 'externa' ? 'Externa' : '') : ''}
          ${item.tipoRegistroPreco === 'adesao' && tipoAdesaoVisual === 'interna' ? field('Processo gerador', processoGeradorAta ? `${processoGeradorAta.numero || ''} - ${processoGeradorAta.objeto || ''}` : '') : ''}
          ${field('Atas cadastradas', atasVisual.length ? String(atasVisual.length) : '')}
        </div>
        ${atasVisual.length ? `<div class="process-table-wrap"><table><thead><tr><th>Ata</th><th>Fornecedor</th><th>Objeto resumido</th><th>Vigência</th><th>PNCP</th><th>PDFs</th><th>Itens</th></tr></thead><tbody>${atasVisual.map(ata => `<tr><td><strong>${safe(ata.numero || '')}/${safe(ata.ano || '')}</strong></td><td>${safe(ata.fornecedorRazao || ata.fornecedorFantasia || '')}<br>${safe(ata.fornecedorCnpj || '')}</td><td>${safe(ata.objetoResumido || '')}</td><td>${safe(ata.vigenciaInicio || '')} a ${safe(ata.vigenciaFim || '')}</td><td>${ata.linkPncp ? `<a href="${safe(ata.linkPncp)}" target="_blank">Abrir</a>` : ''}</td><td>${linkAnexoPdf(ata.pdfAta, 'Ata', '')} ${linkAnexoPdf(ata.pdfExtrato, 'Extrato', '')}</td><td>${contarItensTabela(ata.itens)}</td></tr>`).join('')}</tbody></table></div>` : ''}
      ` : '<div class="empty">Não é processo de Registro de Preço.</div>';

      const credHtml = isCredenciamentoView ? `
        <div class="process-view-grid compact">
          ${field('Tipo', item.credTipo === 'principal' ? 'Processo de Credenciamento' : item.credTipo === 'contratacao' ? 'Processo de Contratação' : '')}
          ${field('Nº/Ano do Credenciamento', item.credNumero)}
          ${item.credTipo === 'contratacao' ? field('Pertence ao Credenciamento', credPrincipal ? `${credPrincipal.credNumero || ''} - ${credPrincipal.numero || ''}` : '') : ''}
          ${item.credTipo === 'contratacao' ? field('CNPJ', item.credCnpj) : ''}
          ${item.credTipo === 'contratacao' ? field('Razão Social', item.credRazao) : ''}
          ${item.credTipo === 'contratacao' ? field('Nome Fantasia', item.credFantasia) : ''}
          ${field('Itens', item.credTipo === 'principal' ? `${Array.isArray(item.credItens) ? Math.max(item.credItens.length - 1, 0) : 0} item(s) do edital` : `${Array.isArray(item.credItensContratacao) ? Math.max(item.credItensContratacao.length - 1, 0) : 0} item(s) selecionado(s)`)}
        </div>
      ` : '<div class="empty">Não é processo de credenciamento.</div>';

      const requisicoes = Array.isArray(item.requisicoes) && item.requisicoes.length
        ? item.requisicoes.map(r => `<div>${safe(r.numero || '')} | QTD: ${safe(r.qtd || '')}</div>`).join('')
        : '<span class="muted">Não informado</span>';
      const pesquisas = Array.isArray(item.cotPesquisas) && item.cotPesquisas.length
        ? item.cotPesquisas.map(p => `<div>${safe(p.fonte || '')}: ${safe(p.valor || '')}</div>`).join('')
        : '<span class="muted">Não informado</span>';
      const cotItensHtml = Array.isArray(item.cotItens) && item.cotItens.length
        ? item.cotItens.map((cot, idx) => `
          <div style="margin:8px 0;padding:8px;border:1px solid #dbe3ef;border-radius:8px">
            <strong>${idx + 1}. ${safe(cot.descricao || 'Item sem descrição')}</strong><br>
            <span class="muted">Qtd: ${safe(cot.quantidade || '')} ${safe(cot.unidade || '')} | Unitário: R$ ${safe(formatBRLDisplay(cot.resultadoUnitario || 0) || '0,00')} | Total: R$ ${safe(formatBRLDisplay(cot.resultadoTotal || 0) || '0,00')}</span>
          </div>
        `).join('')
        : pesquisas;
      const resultadoItensHtml = Array.isArray(item.resultadoItens) && item.resultadoItens.length
        ? item.resultadoItens.map((res, idx) => `
          <div style="margin:8px 0;padding:8px;border:1px solid #dbe3ef;border-radius:8px">
            <strong>${idx + 1}. ${safe(res.descricao || 'Item sem descrição')}</strong><br>
            <span class="muted">Qtd: ${safe(res.quantidade || '')} ${safe(res.unidade || '')} | Situação: ${safe(res.situacao || 'Não informada')} | Unitário: R$ ${safe(formatBRLDisplay(parseBRLToNumber(res.valorUnitario) || 0) || '0,00')} | Total: R$ ${safe(formatBRLDisplay(res.valorTotal || 0) || '0,00')}</span><br>
            <span class="muted">Fornecedor: ${safe(res.razaoSocial || res.nomeFantasia || 'Não informado')} ${res.cnpj ? `- ${safe(res.cnpj)}` : ''}</span>
          </div>
        `).join('')
        : '<span class="muted">Nenhum item informado</span>';
      const homologacaoItensAceitos = Array.isArray(item.resultadoItens)
        ? item.resultadoItens.map((res, idx) => ({ res, idx })).filter(({ res }) => normalizarCadastro(res.situacao) === 'ACEITO')
        : [];
      const homologacaoItensViewHtml = homologacaoItensAceitos.length
        ? `<div class="process-table-wrap"><table class="homologacao-table"><thead><tr><th>Item</th><th>Descrição do Produto/Serviço</th><th>Unidade</th><th>Quantidade</th><th>Valor Unitário</th><th>Valor Total</th><th>Situação</th><th>Proponente/Fornecedor</th></tr></thead><tbody>${homologacaoItensAceitos.map(({ res, idx }) => `<tr><td>${idx + 1}</td><td>${safe(res.descricao || '')}</td><td>${safe(res.unidade || '')}</td><td>${safe(res.quantidade || '')}</td><td>${safe(formatBRLDisplay(parseBRLToNumber(res.valorUnitario) || 0) || '0,00')}</td><td>${safe(formatBRLDisplay(res.valorTotal || 0) || '0,00')}</td><td>${safe(res.situacao || '')}</td><td>${safe(res.razaoSocial || res.nomeFantasia || '')}${res.cnpj ? ` ${safe(res.cnpj)}` : ''}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty">Nenhum item aceito para homologação.</div>';
      const valorHomologadoCalculado = Array.isArray(item.resultadoItens)
        ? item.resultadoItens.reduce((soma, res) => normalizarCadastro(res.situacao) === 'DESERTO' ? soma : soma + (Number(res.valorTotal) || 0), 0)
        : 0;
      const valorHomologado = valorHomologadoCalculado ? formatBRLDisplay(valorHomologadoCalculado) : (item.resultadoValorHomologado || '');
      const registroPrecoTexto = item.registroPrecos === 'sim' || item.tipoRegistroPreco ? 'SIM' : item.registroPrecos === 'nao' ? 'NÃO' : '';
      const tipoRegistroPrecoTexto = item.tipoRegistroPreco === 'gerador'
        ? 'PROCESSO GERADOR DA ATA'
        : item.tipoRegistroPreco === 'adesao'
          ? 'ADESÃO'
          : item.tipoRegistroPreco || '';
      const fornecedoresResumoMap = new Map();
      (Array.isArray(item.resultadoItens) ? item.resultadoItens : []).forEach(res => {
        const chave = onlyDigits(res.cnpj) || normalizarCadastro(res.razaoSocial || res.nomeFantasia || '');
        if (!chave) return;
        if (!fornecedoresResumoMap.has(chave)) {
          fornecedoresResumoMap.set(chave, {
            cnpj: res.cnpj || '',
            razaoSocial: res.razaoSocial || '',
            nomeFantasia: res.nomeFantasia || ''
          });
        }
      });
      if (!fornecedoresResumoMap.size && (item.credCnpj || item.credRazao || item.credFantasia)) {
        fornecedoresResumoMap.set(onlyDigits(item.credCnpj) || 'credenciado', {
          cnpj: item.credCnpj || '',
          razaoSocial: item.credRazao || '',
          nomeFantasia: item.credFantasia || ''
        });
      }
      if (!fornecedoresResumoMap.size && (item.cnpj || item.fornecedor)) {
        fornecedoresResumoMap.set(onlyDigits(item.cnpj) || 'fornecedor', {
          cnpj: item.cnpj || '',
          razaoSocial: item.fornecedor || '',
          nomeFantasia: item.fornecedor || ''
        });
      }
      const fornecedoresResumo = [...fornecedoresResumoMap.values()];
      const cnpjFornecedorResumo = fornecedoresResumo.map(f => safe(f.cnpj || '')).filter(Boolean).join('<br>');
      const razaoFornecedorResumo = fornecedoresResumo.map(f => safe(f.razaoSocial || '')).filter(Boolean).join('<br>');
      const fantasiaFornecedorResumo = fornecedoresResumo.map(f => safe(f.nomeFantasia || '')).filter(Boolean).join('<br>');

      headTitle.textContent = item.numero ? `Processo ${item.numero}` : 'Detalhes do processo';
      body.innerHTML = `
        <div id="conteudoPrint" class="process-view-print-area">
          <section class="process-hero">
            <div>
              <span class="process-view-kicker">${safe(protocolo || 'PROCESSO')}</span>
              <h2>${safe(item.numero || 'Sem número')}</h2>
              <p>${textBlock(item.objeto || 'Objeto não informado')}</p>
            </div>
            <div class="process-status-stack">
              <span>${safe(item.situacao || 'Sem situação')}</span>
              <strong>${safe(item.fase || 'Sem fase')}</strong>
            </div>
          </section>

          <section class="process-info-grid">
            ${infoCard('Secretaria', item.secretaria)}
            ${infoCard('Data de criação', item.dataCriacao)}
            ${infoCard('Natureza', item.naturezaProcesso)}
            ${infoCard('Tipo de Objeto', assunto)}
            ${infoCard('Registro de Preços', registroPrecoTexto)}
            ${infoCard('Volumes', item.volumes)}
          </section>

          <section class="process-main-grid">
            <div class="process-panel wide">
              <h3>Descrição completa</h3>
              <div class="process-text">${textBlock(item.descricaoCompleta || 'Não informado')}</div>
            </div>
            <div class="process-panel process-admin-panel">
              <h3>Resumo administrativo</h3>
              <div class="process-admin-metrics">
                ${adminMetric('Valor estimado', valorEstimado, 'estimated')}
                ${adminMetric('Valor homologado', valorHomologado, 'approved')}
              </div>
              <div class="process-admin-list">
                ${field('Recurso', recursoTexto)}
                ${fieldHtml('Forma de Contratação / Modalidade', modalidadeComForma)}
                ${fieldHtml('CNPJ', cnpjFornecedorResumo || '<span class="muted">Não informado</span>')}
                ${fieldHtml('Razão Social', razaoFornecedorResumo || '<span class="muted">Não informado</span>')}
                ${fieldHtml('Nome Fantasia', fantasiaFornecedorResumo || '<span class="muted">Não informado</span>')}
              </div>
            </div>
          </section>

          ${section('Publicações', pubHtml)}
          ${temFaseView('sd') ? section('Solicitação de Demanda', `<div class="process-view-grid compact">${field('Nº SD', item.sdNumero)}${field('Unidade', item.sdUnidade)}${field('Elaborado por', item.sdElaborado)}${field('Ficha', item.sdFicha)}${field('Sub Elemento', item.sdSubElemento)}${field('Instrumento', item.sdInstrumento)}${field('Autoridade', item.sdAutoridade)}${field('Recurso', recursoTexto)}</div>`) : ''}
          ${temFaseView('etp') ? section('Estudo Técnico Preliminar', `<div class="process-view-grid compact">${field('Elaborado por', item.etpElaborado)}${fieldHtml('Forma', formaContratacaoTexto(item.etpForma))}${field('Qtd. itens', item.etpQtdItens)}${fieldHtml('Metodologia', criterioCalculoTexto(item.etpMetodologia))}${field('Valor', item.etpValorEstimado)}</div>`) : ''}
          ${temFaseView('requisicao') ? section('Requisições', requisicoes) : ''}
          ${temFaseView('cotacao') ? section('Cotação', `<div class="process-view-grid compact">${field('Realizado por', item.cotRealizado)}${fieldHtml('Tipo de cálculo', criterioCalculoTexto(item.cotTipo))}${field('Resultado da Cotação', item.cotMedia)}${field('Quadro', item.cotQuadro)}</div><div class="process-sublist"><strong>Itens / Pesquisas</strong>${cotItensHtml}</div>`) : ''}
          ${temFaseView('tr') ? section('Termo de Referência', `<div class="process-view-grid compact">${field('Elaborado por', item.trElaborado)}${field('Aprovador', item.trAprovador)}${fieldHtml('Forma de Contratação / Modalidade', modalidadeComForma)}${field('Fundamento', item.trFundamento)}${fieldHtml('Critério', valorMaiusculoOuDash(item.trCriterio))}${field('Regime', item.trRegime)}${field('Unidade', item.trUnidade)}${field('Valor', item.trValorEstimado)}</div><div class="process-text"><strong>Observação:</strong><br>${textBlock(item.trObs || 'Não informado')}</div>`) : ''}
          ${temFaseView('edital') ? section('Edital', `<div class="process-view-grid compact">${field('Forma de Contratação', item.editalForma)}${field('Número', item.editalNumero)}${field('Valor estimado', item.editalValorEstimado)}${fieldHtml('Critério de julgamento', valorMaiusculoOuDash(item.editalCriterio))}${fieldHtml('Modo de disputa', valorMaiusculoOuDash(item.editalModoDisputa))}${field('Sessão', [item.editalDataSessao, item.editalHoraSessaoInicio && item.editalHoraSessaoFim ? `${item.editalHoraSessaoInicio} a ${item.editalHoraSessaoFim}` : (item.editalHoraSessaoInicio || item.editalHoraSessaoFim || '')].filter(Boolean).join(' - '))}${field('Início das propostas', [item.editalDataInicio, item.editalHoraInicio].filter(Boolean).join(' '))}${field('Fim das propostas', [item.editalDataFim, item.editalHoraFim].filter(Boolean).join(' '))}</div><div class="process-text" style="margin-top:10px">${textBlock(item.editalObs || 'Não informado')}</div>`) : ''}
          ${temFaseView('licitacao') ? section('Licitação', `<div class="process-view-grid compact">${field('Pregoeiro', item.licitacaoPregoeiro)}</div><div class="process-text" style="margin-top:10px">${textBlock(item.licitacaoObs || 'Não informado')}</div>`) : ''}
          ${temFaseView('aviso_contratacao_direta') ? section('Aviso de Contratação Direta', `<div class="process-view-grid compact">${field('Forma de Contratação', item.avisoContratacaoDiretaForma)}${field('Número', item.avisoContratacaoDiretaNumero)}${field('Agente de Contratação', item.avisoContratacaoDiretaAgente)}${field('Valor estimado', item.avisoContratacaoDiretaValorEstimado)}${fieldHtml('Critério de julgamento', valorMaiusculoOuDash(item.avisoContratacaoDiretaCriterio))}${field('Sessão', [item.avisoContratacaoDiretaDataSessao, item.avisoContratacaoDiretaHoraSessaoInicio && item.avisoContratacaoDiretaHoraSessaoFim ? `${item.avisoContratacaoDiretaHoraSessaoInicio} a ${item.avisoContratacaoDiretaHoraSessaoFim}` : (item.avisoContratacaoDiretaHoraSessaoInicio || item.avisoContratacaoDiretaHoraSessaoFim || '')].filter(Boolean).join(' - '))}${field('Início das propostas', [item.avisoContratacaoDiretaDataInicio, item.avisoContratacaoDiretaHoraInicio].filter(Boolean).join(' '))}${field('Fim das propostas', [item.avisoContratacaoDiretaDataFim, item.avisoContratacaoDiretaHoraFim].filter(Boolean).join(' '))}</div>`) : ''}
          ${temFaseView('resultado') ? section('Resultado', `<div class="process-sublist"><strong>Itens / Resultado da disputa</strong>${resultadoItensHtml}</div>`) : ''}
          ${temFaseView('homologacao') ? section('Homologação', `<div class="process-admin-metrics" style="margin-bottom:10px">${adminMetric('Valor homologado', valorHomologado, 'approved')}</div>${homologacaoItensViewHtml}`) : ''}
          ${isCredenciamentoView ? section('Credenciamento', credHtml) : ''}
          ${isRegistroPrecoView ? section('Registro de Preço', registroPrecoHtml) : ''}
          ${section('Observações do processo', `<div class="process-text">${textBlock(item.observacao || 'Não informado')}</div>`)}
        </div>
      `;

      dlgView.showModal();
    }
    function carregarAssuntosFiltro() {
      const tipo = fTipoProtocolo.value;
      fAssuntoProtocolo.innerHTML = '<option value="">Todos os assuntos</option>';
      const incluirNaturezas = !tipo || normalizarCadastro(tipo) === "PROCESSO LICITATORIO";
      if (incluirNaturezas) {
        ["CREDENCIAMENTO"].forEach(nome => {
          const option = document.createElement("option");
          option.value = nome;
          option.textContent = tipo ? nome : `${nome} (NATUREZA)`;
          fAssuntoProtocolo.appendChild(option);
        });
      }
      loadAssuntosProtocolo()
        .filter(a => !tipo || normalizarCadastro(a.tipo) === normalizarCadastro(tipo))
        .filter(a => a.ativo !== false)
        .filter(a => normalizarCadastro(a.nome) !== "CREDENCIAMENTO")
        .forEach(a => {
          const option = document.createElement("option");
          option.value = a.nome;
          option.textContent = `${a.nome}${tipo ? "" : ` (${a.tipo})`}`;
          fAssuntoProtocolo.appendChild(option);
        });
    }

    fTipoProtocolo.addEventListener('change', () => {
      carregarAssuntosFiltro();
      renderTable();
    });

    [fGeral, fSecretaria, fTipoProtocolo, fAssuntoProtocolo, fRegistroPrecos].forEach(el => {
      el.addEventListener('input', renderTable);
      el.addEventListener('change', renderTable);
    });

    carregarAssuntosFiltro();
    renderTable();

    // utilitários públicos
    window.getProcessoLicitatorioPorNumero = (n) => {
  if (!n) return null;

  n = String(n).trim().toLowerCase();

  const processos = loadData();

  return processos.find(p =>
    String(p.numero || '')
      .trim()
      .toLowerCase() === n
  ) || null;
};

    window.reloadProcessosLicitatorios = () => { data = loadData(); renderTable(); };



    container.querySelectorAll(".tabs").forEach(tabGroup => {

  const tabs = tabGroup.querySelectorAll(".tab");
  const modal = tabGroup.closest("dialog");

  tabs.forEach(btn => {

    btn.addEventListener("click", () => {

      modal.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      modal.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

      btn.classList.add("active");

      const tab = btn.dataset.tab;
      modal.querySelector("#tab-" + tab).classList.add("active");

    });

  });

});


function resetarModalProcessoParaInicio() {
  dlg.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
  dlg.querySelectorAll(".tab-content").forEach(content => content.classList.remove("active"));
  dlg.querySelector('.tab[data-tab="geral"]')?.classList.add("active");
  dlg.querySelector('#tab-geral')?.classList.add("active");
  fecharBlocosDoModalProcesso();
}

function fecharBlocosDoModalProcesso() {
  dlg.querySelectorAll(".fase-bloco").forEach(bloco => bloco.classList.add("fechado"));
}

function nomeFaseProcesso(id) {
  return fasesDisponiveisProcesso.find(fase => fase.id === id)?.nome || id;
}

function renderSeletorFasesProcesso() {
  if (!faseAddSelect || !fasesAtivasList) return;
  const ativas = new Set(fasesAtivasProcesso);
  faseAddSelect.innerHTML = '<option value="">-- selecione uma fase --</option>';
  fasesDisponiveisProcesso
    .filter(fase => !ativas.has(fase.id))
    .forEach(fase => {
      const option = document.createElement("option");
      option.value = fase.id;
      option.textContent = fase.nome;
      faseAddSelect.appendChild(option);
    });

  fasesAtivasList.innerHTML = fasesAtivasProcesso.length
    ? fasesAtivasProcesso.map(id => `
      <span class="fase-ativa-chip">
        ${nomeFaseProcesso(id)}
        <button type="button" class="fase-ativa-remove" data-fase-remove="${id}" title="Remover fase">×</button>
      </span>
    `).join("")
    : '<span class="muted">Nenhuma fase adicionada.</span>';
}

function aplicarFasesAtivasProcesso() {
  const ativas = new Set(fasesAtivasProcesso);
  container.querySelectorAll(".fase-bloco[data-etapa]").forEach(bloco => {
    bloco.style.display = ativas.has(bloco.dataset.etapa) ? "" : "none";
  });
  renderSeletorFasesProcesso();
  atualizarEtapasConcluidas();
}

function coletarFasesAtivasProcesso() {
  return fasesAtivasProcesso.filter(id => fasesDisponiveisProcesso.some(fase => fase.id === id));
}

faseAddBtn?.addEventListener("click", () => {
  const fase = faseAddSelect?.value;
  if (!fase || fasesAtivasProcesso.includes(fase)) return;
  fasesAtivasProcesso.push(fase);
  aplicarFasesAtivasProcesso();
  if (fase === "aviso_contratacao_direta") preencherAvisoContratacaoDiretaSeVazio();
});

fasesAtivasList?.addEventListener("click", event => {
  const btn = event.target.closest("[data-fase-remove]");
  if (!btn) return;
  const fase = btn.dataset.faseRemove;
  fasesAtivasProcesso = fasesAtivasProcesso.filter(id => id !== fase);
  if (etapasConcluidas[fase]) delete etapasConcluidas[fase];
  aplicarFasesAtivasProcesso();
});

const selectTipoProcesso = container.querySelector('#lic_tipo_processo');
const novoTipoProtocoloContainer = container.querySelector('#novo_tipo_protocolo_container');
const naturezaProcessoContainer = container.querySelector('#natureza_processo_container');
const assuntoProtocoloContainer = container.querySelector('#assunto_protocolo_container');
const novoAssuntoProtocoloContainer = container.querySelector('#novo_assunto_protocolo_container');
const registroPrecosProtocoloContainer = container.querySelector('#registro_precos_protocolo_container');
const selectAssuntoProtocolo = container.querySelector('#lic_assunto_protocolo');
const selectRegistroPrecos = container.querySelector('#lic_registro_precos');
const irpRegistroContainer = container.querySelector('#irp_registro_container');
const selectIrpRegistroPreco = container.querySelector('#lic_irp_registro_preco');
const blocoLicitacao = container.querySelector('#tipo_licitacao_campos');
const blocoRegistroPreco = container.querySelector('#registro_preco_tipo');
const containerTipoAdesao = container.querySelector('#adesao_tipo_container');
const radiosTipoAdesao = container.querySelectorAll('input[name="tipo_adesao_registro"]');
const containerProcessoGerador = container.querySelector('#processo_gerador_container');
const processoGeradorVinculo = container.querySelector('#processo_gerador_vinculo');
const selectProcessoGerador = container.querySelector('#lic_processo_gerador');
const selectAtaVinculada = container.querySelector('#lic_ata_vinculada');
const blocoCredenciamento = container.querySelector('#credenciamento_campos');
const selectCredTipo = container.querySelector('#lic_cred_tipo');
const credNumeroContainer = container.querySelector('#cred_numero_container');
const credPrincipalContainer = container.querySelector('#cred_principal_container');
const credContratacaoCampos = container.querySelector('#cred_contratacao_campos');
const selectCredPrincipal = container.querySelector('#lic_cred_principal');

function tipoPossuiAssuntos(tipo) {
  const key = normalizarCadastro(tipo);
  return key === "PROCESSO LICITATORIO" || key === "SOLICITACAO";
}

function carregarAssuntosDoTipo(tipo, selecionado = "") {
  selectAssuntoProtocolo.innerHTML = '<option value="">-- selecione --</option>';
  if (!tipoPossuiAssuntos(tipo)) return;

  loadAssuntosProtocolo()
    .filter(a => normalizarCadastro(a.tipo) === normalizarCadastro(tipo))
    .filter(a => !(normalizarCadastro(tipo) === "PROCESSO LICITATORIO" && ["CREDENCIAMENTO", "CONTRATA MAIS BRASIL"].includes(normalizarCadastro(a.nome))))
    .filter(a => a.ativo !== false || normalizarCadastro(a.nome) === normalizarCadastro(selecionado))
    .forEach(a => {
      const option = document.createElement("option");
      option.value = a.nome;
      option.textContent = a.nome;
      selectAssuntoProtocolo.appendChild(option);
    });

  const optOutros = document.createElement("option");
  optOutros.value = "OUTROS";
  optOutros.textContent = "OUTROS";
  selectAssuntoProtocolo.appendChild(optOutros);

  if (selecionado) {
    if (normalizarCadastro(tipo) === "PROCESSO LICITATORIO" && ["CREDENCIAMENTO", "CONTRATA MAIS BRASIL"].includes(normalizarCadastro(selecionado))) return;
    const exists = [...selectAssuntoProtocolo.options].some(o => normalizarCadastro(o.value) === normalizarCadastro(selecionado));
    if (!exists) {
      const option = document.createElement("option");
      option.value = selecionado;
      option.textContent = selecionado;
      selectAssuntoProtocolo.insertBefore(option, optOutros);
    }
    selectAssuntoProtocolo.value = selecionado;
  }
}

function atualizarClassificacaoProtocolo() {
  const tipo = selectTipoProcesso.value;
  const assunto = selectAssuntoProtocolo.value;
  const natureza = fld.naturezaProcesso?.value || "";
  const isOutrosTipo = tipo === "OUTROS";
  const tipoReal = isOutrosTipo ? fld.novoTipoProtocolo.value : tipo;
  const isProcessoLicitatorio = normalizarCadastro(tipoReal) === "PROCESSO LICITATORIO";
const isSolicitacao = normalizarCadastro(tipoReal) === "SOLICITACAO";
const isCredenciamento = isProcessoLicitatorio && normalizarCadastro(natureza) === "CREDENCIAMENTO";
  const isNaturezaRegistroPreco = isProcessoLicitatorio && normalizarCadastro(natureza) === "REGISTRO DE PRECO";
  const isNaturezaAdesao = isProcessoLicitatorio && normalizarCadastro(natureza) === "ADESAO";
  const podePerguntarRegistroPrecos = isProcessoLicitatorio && !natureza && !isCredenciamento && !isNaturezaRegistroPreco && !isNaturezaAdesao;
  if (!podePerguntarRegistroPrecos && selectRegistroPrecos.value) {
    selectRegistroPrecos.value = "";
  }
  const registroPrecos = (isNaturezaRegistroPreco || isNaturezaAdesao) ? "sim" : (podePerguntarRegistroPrecos ? selectRegistroPrecos.value : "");
  const isRegistroPrecos = podePerguntarRegistroPrecos && registroPrecos === "sim";
  const isRegistroPrecoGerador = isNaturezaRegistroPreco || isNaturezaAdesao || isRegistroPrecos;

  novoTipoProtocoloContainer.style.display = isOutrosTipo ? "block" : "none";
  naturezaProcessoContainer.style.display = isProcessoLicitatorio ? "block" : "none";
  assuntoProtocoloContainer.style.display = (isProcessoLicitatorio || isSolicitacao) ? "block" : "none";
  novoAssuntoProtocoloContainer.style.display = assunto === "OUTROS" ? "block" : "none";
  registroPrecosProtocoloContainer.style.display = podePerguntarRegistroPrecos ? "block" : "none";

  blocoLicitacao.style.display = isRegistroPrecoGerador ? "grid" : "none";
  blocoRegistroPreco.style.display = isRegistroPrecoGerador ? "block" : "none";
  blocoCredenciamento.style.display = isCredenciamento ? "block" : "none";

  if (!isRegistroPrecoGerador) {
    atasRegistroContainer.style.display = "none";
        irpRegistroContainer.style.display = "none";
    if (selectIrpRegistroPreco) selectIrpRegistroPreco.value = "";
    containerTipoAdesao.style.display = "none";
    containerProcessoGerador.style.display = "none";
    radiosTipoAdesao.forEach(r => r.checked = false);
    selectProcessoGerador.value = "";
  } else {
    atualizarCamposRegistroPreco();
  }

  if (!isCredenciamento) {
    selectCredTipo.value = "";
    credItensContainer.style.display = "none";
    credPrincipalContainer.style.display = "none";
    credContratacaoCampos.style.display = "none";
  } else {
    atualizarCamposCredenciamento();
  }
}

function atualizarCamposRegistroPreco(){
const natureza = fld.naturezaProcesso?.value || "";
const tipoRegistro = normalizarCadastro(natureza) === "REGISTRO DE PRECO"
  ? "gerador"
  : normalizarCadastro(natureza) === "ADESAO"
    ? "adesao"
    : "";
const tipoAdesao = container.querySelector('input[name="tipo_adesao_registro"]:checked')?.value || "";
const isAdesao = tipoRegistro === "adesao";
const isAdesaoInterna = isAdesao && tipoAdesao === "interna";
const isGerador = tipoRegistro === "gerador";

atasRegistroContainer.style.display = isGerador ? "block" : "none";
irpRegistroContainer.style.display = isGerador ? "block" : "none";
if (isGerador) carregarIrpsRegistroPreco();
else if (selectIrpRegistroPreco) selectIrpRegistroPreco.value = "";
containerTipoAdesao.style.display = isAdesao ? "block" : "none";
containerProcessoGerador.style.display = isAdesao ? "block" : "none";
processoGeradorVinculo.style.display = isAdesaoInterna ? "block" : "none";

if (!isAdesao) {
radiosTipoAdesao.forEach(r => r.checked = false);
selectProcessoGerador.value = "";
if (selectAtaVinculada) selectAtaVinculada.innerHTML = '<option value="">-- selecione a ata cadastrada --</option>';
}

if (isAdesaoInterna) {
carregarProcessosGeradores(selectProcessoGerador.value);
carregarAtasProcessoGeradorAdesao();
} else {
selectProcessoGerador.value = "";
if (selectAtaVinculada) selectAtaVinculada.innerHTML = '<option value="">-- selecione a ata cadastrada --</option>';
}
}

radiosTipoAdesao.forEach(r => {
  r.addEventListener("change", atualizarCamposRegistroPreco);
});

selectProcessoGerador?.addEventListener("change", () => {
  carregarAtasProcessoGeradorAdesao();
  aplicarAtaVinculadaAdesao();
});

selectAtaVinculada?.addEventListener("change", () => aplicarAtaVinculadaAdesao());

function carregarIrpsRegistroPreco(selecionado = ""){
  if (!selectIrpRegistroPreco) return;
  const atual = selecionado || selectIrpRegistroPreco.value;
  let irps = [];
  try {
    irps = JSON.parse(localStorage.getItem(IRP_STORAGE_KEY) || '[]');
  } catch (error) {
    console.error('Erro ao carregar IRPs:', error);
    irps = [];
  }

  selectIrpRegistroPreco.innerHTML = '<option value="">-- selecione uma IRP cadastrada --</option>';
  irps.forEach(irp => {
    const option = document.createElement('option');
    option.value = irp.id;
    option.textContent = `IRP ${irp.numero || ''}/${irp.ano || ''}${irp.objeto ? ' - ' + irp.objeto : ''}`;
    selectIrpRegistroPreco.appendChild(option);
  });

  if (atual) {
    const existe = [...selectIrpRegistroPreco.options].some(option => option.value === atual);
    if (!existe) {
      const option = document.createElement('option');
      option.value = atual;
      option.textContent = 'IRP vinculada não encontrada no cadastro';
      selectIrpRegistroPreco.appendChild(option);
    }
    selectIrpRegistroPreco.value = atual;
  }
}

function carregarProcessosGeradores(selecionado = ""){

const atual = selecionado || selectProcessoGerador.value;
selectProcessoGerador.innerHTML = '<option value="">-- selecione o processo --</option>';

data
.filter(p => p.tipoRegistroPreco === "gerador")
.forEach(p => {

const option = document.createElement("option");

option.value = p.id;
option.textContent = p.numero + " - " + p.objeto;

selectProcessoGerador.appendChild(option);

});

if (atual && [...selectProcessoGerador.options].some(option => option.value === atual)) {
selectProcessoGerador.value = atual;
}

}

function atasDoProcessoGeradorAdesao(processoId) {
  if (!processoId) return [];
  const processo = data.find(p => p.id === processoId);
  return Array.isArray(processo?.atasRegistroPreco) ? processo.atasRegistroPreco : [];
}

function rotuloAtaAdesao(ata) {
  const numero = [ata?.numero, ata?.ano].filter(Boolean).join('/');
  const fornecedor = ata?.fornecedorRazao || ata?.fornecedorFantasia || '';
  const objeto = ata?.objetoResumido || '';
  return [`Ata ${numero || 'sem número'}`, fornecedor, objeto].filter(Boolean).join(' - ');
}

function carregarAtasProcessoGeradorAdesao(selecionada = '') {
  if (!selectAtaVinculada) return;
  const atual = selecionada || selectAtaVinculada.value;
  const atas = atasDoProcessoGeradorAdesao(selectProcessoGerador?.value || '');
  selectAtaVinculada.innerHTML = '<option value="">-- selecione a ata cadastrada --</option>';
  atas.forEach((ata, index) => {
    const option = document.createElement('option');
    option.value = ata.id || String(index);
    option.textContent = rotuloAtaAdesao(ata);
    option.dataset.index = String(index);
    selectAtaVinculada.appendChild(option);
  });
  if (atual && [...selectAtaVinculada.options].some(option => option.value === atual)) {
    selectAtaVinculada.value = atual;
  }
}

function ataSelecionadaAdesao() {
  if (!selectAtaVinculada?.value) return null;
  const atas = atasDoProcessoGeradorAdesao(selectProcessoGerador?.value || '');
  return atas.find(ata => ata.id === selectAtaVinculada.value)
    || atas[Number(selectAtaVinculada.selectedOptions?.[0]?.dataset?.index)];
}

function atualizarPessoasVinculadasPorCnpjAdesao(selecionada = '') {
  const fornecedor = buscarFornecedorPorCnpj(campoCNPJ?.value || '');
  renderPessoaVinculadaSelect(fornecedor, pessoaVinculadaSelect, pessoaVinculadaStatus);
  if (selecionada && pessoaVinculadaSelect && [...pessoaVinculadaSelect.options].some(option => option.value === selecionada)) {
    pessoaVinculadaSelect.value = selecionada;
  }
}

function aplicarAtaVinculadaAdesao(pessoaSelecionada = '') {
  const ata = ataSelecionadaAdesao();
  const campoFornecedor = container.querySelector('#lic_fornecedor');
  if (!ata) {
    if (campoFornecedor) campoFornecedor.value = '';
    if (campoCNPJ) campoCNPJ.value = '';
    atualizarPessoasVinculadasPorCnpjAdesao(pessoaSelecionada);
    return;
  }
  if (campoFornecedor) campoFornecedor.value = ata.fornecedorRazao || ata.fornecedorFantasia || '';
  if (campoCNPJ) campoCNPJ.value = formatCnpj(ata.fornecedorCnpj || '');
  atualizarPessoasVinculadasPorCnpjAdesao(pessoaSelecionada);
}

function carregarCredenciamentosPrincipais(){

const atual = selectCredPrincipal.value;
selectCredPrincipal.innerHTML = '<option value="">-- selecione o credenciamento --</option>';

data
.filter(p => p.tipoProcesso === "credenciamento" && p.credTipo === "principal")
.forEach(p => {

const option = document.createElement("option");
option.value = p.id;
option.textContent = `${p.credNumero || "SEM Nº"} - ${p.numero || ""} - ${p.objeto || ""}`;
selectCredPrincipal.appendChild(option);

});

if(atual) selectCredPrincipal.value = atual;

}

function atualizarCamposCredenciamento(){
const isCredenciamento = normalizarCadastro(selectTipoProcesso.value) === "PROCESSO LICITATORIO" &&
  normalizarCadastro(fld.naturezaProcesso?.value || "") === "CREDENCIAMENTO";
blocoCredenciamento.style.display = isCredenciamento ? "block" : "none";

if(!isCredenciamento){
selectCredTipo.value = "";
credNumeroContainer.style.display = "block";
credItensContainer.style.display = "none";
credPrincipalContainer.style.display = "none";
credContratacaoCampos.style.display = "none";
return;
}

const isContratacao = selectCredTipo.value === "contratacao";
const isPrincipal = selectCredTipo.value === "principal";
credNumeroContainer.style.display = isContratacao ? "none" : "block";
credItensContainer.style.display = isPrincipal ? "block" : "none";
credPrincipalContainer.style.display = isContratacao ? "block" : "none";
credContratacaoCampos.style.display = isContratacao ? "block" : "none";

if(isContratacao){
carregarCredenciamentosPrincipais();
}
}

selectTipoProcesso.addEventListener("change", () => {
carregarAssuntosDoTipo(selectTipoProcesso.value);
selectRegistroPrecos.value = "";
if (fld.naturezaProcesso) fld.naturezaProcesso.value = "";
atualizarClassificacaoProtocolo();
});

fld.naturezaProcesso?.addEventListener("change", atualizarClassificacaoProtocolo);
selectAssuntoProtocolo.addEventListener("change", atualizarClassificacaoProtocolo);
selectRegistroPrecos.addEventListener("change", atualizarClassificacaoProtocolo);
fld.novoTipoProtocolo.addEventListener("input", atualizarClassificacaoProtocolo);
selectCredTipo.addEventListener("change", atualizarCamposCredenciamento);

function etapaCamposPreenchidos(bloco) {
  const conteudo = bloco.querySelector('.fase-conteudo');
  if (!conteudo) return false;

  const campos = [...conteudo.querySelectorAll('input, select, textarea')]
    .filter(campo =>
      campo.type !== 'hidden' &&
      campo.type !== 'button' &&
      campo.type !== 'submit' &&
      campo.type !== 'file' &&
      !campo.matches('[data-etapa-check]') &&
      !campo.matches('[data-ignore-etapa-check]') &&
      !campo.disabled
    );

  if (!campos.length) return false;

  const checkboxGroups = new Map();
  const radioGroups = new Map();

  for (const campo of campos) {
    if (campo.type === 'checkbox') {
      const key = campo.name || campo.closest('.field')?.querySelector('label')?.textContent || campo.id || 'checkbox';
      if (!checkboxGroups.has(key)) checkboxGroups.set(key, []);
      checkboxGroups.get(key).push(campo);
      continue;
    }

    if (campo.type === 'radio') {
      const key = campo.name || campo.id || 'radio';
      if (!radioGroups.has(key)) radioGroups.set(key, []);
      radioGroups.get(key).push(campo);
      continue;
    }

    if (!String(campo.value || '').trim()) return false;
  }

  for (const grupo of checkboxGroups.values()) {
    if (!grupo.some(campo => campo.checked)) return false;
  }

  for (const grupo of radioGroups.values()) {
    if (!grupo.some(campo => campo.checked)) return false;
  }

  return true;
}

function atualizarEtapaConcluida(bloco) {
  const etapa = bloco.dataset.etapa;
  if (!etapa) return;

  const check = bloco.querySelector(`[data-etapa-check="${etapa}"]`);
  const concluida = !!etapasConcluidas[etapa] || etapaCamposPreenchidos(bloco);
  bloco.classList.toggle('etapa-concluida', concluida);
  if (check) check.checked = concluida;
}

function atualizarEtapasConcluidas() {
  container.querySelectorAll('.fase-bloco[data-etapa]').forEach(atualizarEtapaConcluida);
}

function coletarEtapasConcluidas() {
  const result = {};
  container.querySelectorAll('.fase-bloco[data-etapa]').forEach(bloco => {
    const etapa = bloco.dataset.etapa;
    if (!etapa) return;
    if (etapasConcluidas[etapa] || etapaCamposPreenchidos(bloco)) {
      result[etapa] = true;
    }
  });
  etapasConcluidas = { ...result };
  return result;
}

form.addEventListener('input', atualizarEtapasConcluidas);
form.addEventListener('change', atualizarEtapasConcluidas);

container.querySelectorAll(".fase-titulo").forEach(titulo => {

titulo.addEventListener("click", (event) => {
if (event.target.closest('.etapa-check')) return;

const bloco = titulo.closest(".fase-bloco");

bloco.classList.toggle("fechado");

});

});

container.querySelectorAll('.etapa-check').forEach(label => {
  label.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const check = label.querySelector('[data-etapa-check]');
    const etapa = check.dataset.etapaCheck;
    if (!etapa) return;
    if (etapasConcluidas[etapa]) delete etapasConcluidas[etapa];
    else etapasConcluidas[etapa] = true;
    atualizarEtapasConcluidas();
  });
});

atualizarEtapasConcluidas();

}

  function initCategoriaCredenciamento(container) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) throw new Error('Container inválido');

    const processos = loadData();
    const principais = processos.filter(p =>
      p.tipoProcesso === "credenciamento" && p.credTipo === "principal"
    );
    let selecionadoId = principais[0]?.id || "";

    const esc = (value) => String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    function render() {
      const principal = processos.find(p => p.id === selecionadoId);
      const contratacoes = selecionadoId
        ? processos.filter(p =>
            p.tipoProcesso === "credenciamento" &&
            p.credTipo === "contratacao" &&
            p.credPrincipal === selecionadoId
          )
        : [];
      const itens = Array.isArray(principal?.credItens) ? principal.credItens : [];
      const itemCols = itens.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
      const contratacoesComItens = contratacoes.map(c => ({
        processo: c,
        itens: Array.isArray(c.credItensContratacao) ? c.credItensContratacao : []
      }));

      container.innerHTML = `
        <section class="wrap">
          <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px">
            <div>
              <h2 style="margin:0 0 6px 0">Credenciamentos</h2>
              <div class="muted">Visualize processos de credenciamento e suas contratações vinculadas.</div>
            </div>
            <div class="muted" style="font-size:13px">
              ${principais.length} credenciamento(s) principal(is)
            </div>
          </header>

          <div class="grid" style="grid-template-columns:minmax(320px, .9fr) minmax(420px, 1.4fr);align-items:start">
            <div class="card">
              <h3 style="margin-top:0">Processos de Credenciamento</h3>
              ${principais.length ? `
                <div style="display:flex;flex-direction:column;gap:8px">
                  ${principais.map(p => `
                    <button type="button" class="btn cred-principal-btn ${p.id === selecionadoId ? 'primary' : ''}" data-cred-principal="${esc(p.id)}" style="text-align:left;white-space:normal">
                      <strong>${esc(p.credNumero || "SEM Nº")}</strong><br>
                      <span>${esc(p.numero || "")}</span><br>
                      <span style="font-size:12px">${esc(p.objeto || "")}</span>
                    </button>
                  `).join('')}
                </div>
              ` : `<div class="empty">Nenhum processo principal de credenciamento cadastrado.</div>`}
            </div>

            <div class="card">
              ${principal ? `
                <div style="margin-bottom:12px">
                  <h3 style="margin:0 0 6px 0">${esc(principal.credNumero || "Credenciamento sem número")}</h3>
                  <div><strong>Processo:</strong> ${esc(principal.numero || "")}</div>
                  <div><strong>Objeto:</strong> ${esc(principal.objeto || "")}</div>
                  <div><strong>Data de criação:</strong> ${esc(principal.dataCriacao || "")}</div>
                  <div><strong>Itens do edital:</strong> ${Array.isArray(principal.credItens) ? principal.credItens.length : 0} linha(s)</div>
                  <div style="margin-top:10px">
                    <button type="button" class="btn" id="cred_ver_itens" ${itens.length ? '' : 'disabled'}>Ver itens do edital</button>
                  </div>
                </div>

                <h3>Processos de Contratação</h3>
                ${contratacoes.length ? `
                  <div style="overflow:auto">
                    <table>
                      <thead>
                        <tr>
                          <th>Nº Processo</th>
                          <th>Credenciado</th>
                          <th>CNPJ</th>
                          <th>Objeto</th>
                          <th>Data</th>
                          <th>Itens</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${contratacoes.map(c => `
                          <tr>
                            <td><strong>${esc(c.numero || "")}</strong></td>
                            <td>
                              ${esc(c.credRazao || "")}<br>
                              <span class="muted">${esc(c.credFantasia || "")}</span>
                              ${c.pessoaVinculadaId ? `<br><span class="muted">${esc(c.pessoaVinculadaNome || "")} - ${esc(c.pessoaVinculadaTipo || "")}</span>` : ""}
                            </td>
                            <td>${esc(c.credCnpj || "")}</td>
                            <td>${esc(c.objeto || "")}</td>
                            <td>${esc(c.dataCriacao || "")}</td>
                            <td>
                              <button type="button" class="btn" data-ver-itens-contratacao="${esc(c.id)}" ${Array.isArray(c.credItensContratacao) && c.credItensContratacao.length ? '' : 'disabled'}>
                                Ver itens (${Array.isArray(c.credItensContratacao) && c.credItensContratacao.length > 1 ? c.credItensContratacao.length - 1 : 0})
                              </button>
                            </td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                ` : `<div class="empty">Nenhum processo de contratação vinculado a este credenciamento.</div>`}
              ` : `<div class="empty">Selecione um processo de credenciamento.</div>`}
            </div>
          </div>

          <dialog id="cred_itens_modal" style="width:92vw;max-width:1100px">
            <div class="modal-head">
              <strong>Itens do Edital - ${esc(principal?.credNumero || "")}</strong>
              <button id="cred_itens_close" class="btn ghost">Fechar</button>
            </div>
            <div class="modal-body">
              ${itens.length ? `
                <div class="muted" style="margin-bottom:10px">${itens.length} linha(s) e ${itemCols} coluna(s).</div>
                <div style="overflow:auto;max-height:68vh">
                  <table>
                    <tbody>
                      ${itens.map((row, rowIndex) => `
                        <tr>
                          ${Array.from({ length: itemCols }, (_, colIndex) => rowIndex === 0
                            ? `<th>${esc(row?.[colIndex] || "")}</th>`
                            : `<td>${esc(row?.[colIndex] || "")}</td>`
                          ).join('')}
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : `<div class="empty">Nenhum item importado para este credenciamento.</div>`}
            </div>
          </dialog>

          <dialog id="cred_itens_contratacao_modal" style="width:92vw;max-width:1100px">
            <div class="modal-head">
              <strong id="cred_itens_contratacao_titulo">Itens da Contratação</strong>
              <button id="cred_itens_contratacao_close" class="btn ghost">Fechar</button>
            </div>
            <div class="modal-body" id="cred_itens_contratacao_body"></div>
          </dialog>
        </section>
      `;

      container.querySelectorAll('[data-cred-principal]').forEach(btn => {
        btn.onclick = () => {
          selecionadoId = btn.dataset.credPrincipal;
          render();
        };
      });

      const btnVerItens = container.querySelector('#cred_ver_itens');
      const modalItens = container.querySelector('#cred_itens_modal');
      const closeItens = container.querySelector('#cred_itens_close');

      if (btnVerItens && modalItens) {
        btnVerItens.onclick = () => modalItens.showModal();
      }
      if (closeItens && modalItens) {
        closeItens.onclick = () => modalItens.close();
      }

      const modalItensContratacao = container.querySelector('#cred_itens_contratacao_modal');
      const modalItensContratacaoBody = container.querySelector('#cred_itens_contratacao_body');
      const modalItensContratacaoTitulo = container.querySelector('#cred_itens_contratacao_titulo');
      const closeItensContratacao = container.querySelector('#cred_itens_contratacao_close');

      container.querySelectorAll('[data-ver-itens-contratacao]').forEach(btn => {
        btn.onclick = () => {
          const item = contratacoesComItens.find(c => c.processo.id === btn.dataset.verItensContratacao);
          const linhas = item?.itens || [];
          const cols = linhas.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
          modalItensContratacaoTitulo.textContent = `Itens da Contratação - ${item?.processo.numero || ''}`;
          modalItensContratacaoBody.innerHTML = linhas.length ? `
            <div class="muted" style="margin-bottom:10px">${Math.max(linhas.length - 1, 0)} item(ns) selecionado(s).</div>
            <div style="overflow:auto;max-height:68vh">
              <table>
                <tbody>
                  ${linhas.map((row, rowIndex) => `
                    <tr>
                      ${Array.from({ length: cols }, (_, colIndex) => rowIndex === 0
                        ? `<th>${esc(row?.[colIndex] || "")}</th>`
                        : `<td>${esc(row?.[colIndex] || "")}</td>`
                      ).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `<div class="empty">Nenhum item selecionado nesta contratação.</div>`;
          modalItensContratacao.showModal();
        };
      });

      if (closeItensContratacao && modalItensContratacao) {
        closeItensContratacao.onclick = () => modalItensContratacao.close();
      }
    }

    render();
  }

  function initCategoriaContratacoes(container, config) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) throw new Error('Container inválido');

    const esc = (value) => String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    const processos = loadData();
    const alvo = normalizarCadastro(config.alvo || "");
    const titulo = config.titulo || "Contratações";
    const subtitulo = config.subtitulo || "Processos agrupados por forma de contratação/modalidade.";
    const controleStorageKey = `contratacoesControle_${alvo || "geral"}`;
    let controleManual = {};

    try {
      controleManual = JSON.parse(localStorage.getItem(controleStorageKey) || "{}");
    } catch (error) {
      console.error("Erro ao carregar controle manual das contratações:", error);
      controleManual = {};
    }

    function modalidadeProcesso(processo) {
      return processo.trModalidade ||
        processo.editalForma ||
        processo.modalidade ||
        processo.modalidadeLicitacao ||
        processo.avisoContratacaoDiretaForma ||
        "";
    }

    function formaProcesso(processo) {
      const forma = processo.etpForma || "";
      if (!forma) return "";
      return normalizarCadastro(forma) === "ELETRONICA" ? "ELETRÔNICA" : String(forma).toLocaleUpperCase("pt-BR");
    }

    function valorProcesso(processo, campo) {
      const value = processo[campo];
      if (typeof value === "number") return formatBRL(value);
      return value || "";
    }

    function valorHomologadoProcesso(processo) {
      const valorCalculado = Array.isArray(processo.resultadoItens)
        ? processo.resultadoItens.reduce((soma, item) => normalizarCadastro(item.situacao) === "DESERTO" ? soma : soma + (Number(item.valorTotal) || 0), 0)
        : 0;
      return valorCalculado ? formatBRLDisplay(valorCalculado) : valorProcesso(processo, "resultadoValorHomologado");
    }

    function contratacaoDiretaTexto(processo) {
      const forma = processo.avisoContratacaoDiretaForma || modalidadeProcesso(processo);
      const numero = processo.avisoContratacaoDiretaNumero || "";
      const formaTexto = String(forma || "").toLocaleUpperCase("pt-BR");
      const numeroTexto = String(numero || "").trim();
      return [formaTexto, numeroTexto ? `N° ${numeroTexto}` : ""].filter(Boolean).join(" ");
    }

    function editalContratacaoTexto(processo) {
      const forma = processo.editalForma || modalidadeProcesso(processo);
      const numero = processo.editalNumero || "";
      const formaTexto = String(forma || "").toLocaleUpperCase("pt-BR");
      const numeroTexto = String(numero || "").trim();
      return [formaTexto, numeroTexto ? `N° ${numeroTexto}` : ""].filter(Boolean).join(" ");
    }

    function primeiraColunaValor(processo) {
      if (config.colunaEditalContratacao) return editalContratacaoTexto(processo);
      if (config.colunaContratacaoDireta) return contratacaoDiretaTexto(processo);
      return processo.assuntoProtocolo || processo.assunto || "";
    }

    function dadosManuais(processo) {
      return controleManual[processo.id] || {};
    }

    function salvarCampoManual(processoId, campo, valor) {
      if (!processoId || !campo) return;
      controleManual[processoId] = {
        ...(controleManual[processoId] || {}),
        [campo]: valor
      };
      localStorage.setItem(controleStorageKey, JSON.stringify(controleManual));
    }

    function salvarControleManual(processoId, dados) {
      if (!processoId) return;
      controleManual[processoId] = {
        ...(controleManual[processoId] || {}),
        ...dados
      };
      localStorage.setItem(controleStorageKey, JSON.stringify(controleManual));
    }

    function pertenceAoGrupo(processo) {
      const modalidade = normalizarCadastro(modalidadeProcesso(processo));
      const editalForma = normalizarCadastro(processo.editalForma || "");
      const natureza = normalizarCadastro(processo.naturezaProcesso || "");

      if (alvo === "PREGAO") return modalidade.includes("PREGAO") || editalForma.includes("PREGAO");
      if (alvo === "CONCORRENCIA") return modalidade.includes("CONCORRENCIA");
      if (alvo === "DISPENSA") return modalidade.includes("DISPENSA") || natureza.includes("DISPENSA");
      if (alvo === "INEXIGIBILIDADE") return modalidade.includes("INEXIGIBILIDADE") || natureza.includes("INEXIGIBILIDADE");
      return false;
    }

    const filtrados = processos
      .filter(p => normalizarCadastro(p.tipoProtocolo || p.tipoProcesso || "") !== "CREDENCIAMENTO")
      .filter(pertenceAoGrupo)
      .sort((a, b) => String(b.dataCriacao || "").localeCompare(String(a.dataCriacao || "")));
    const usaTabelaControle = config.colunasDispensa || config.colunasPregao;

    function responsavelTabela(processo) {
      return (config.usarPregoeiroLicitacao ? processo.licitacaoPregoeiro : "") ||
        (config.usarAgenteAviso ? processo.avisoContratacaoDiretaAgente : "") ||
        dadosManuais(processo).pregoeiro ||
        "";
    }

    function dataSessaoTabela(processo) {
      return config.usarDadosEdital ? (processo.editalDataSessao || "") : (processo.avisoContratacaoDiretaDataSessao || "");
    }

    function horarioTabela(processo) {
      return config.usarDadosEdital ? (processo.editalHoraSessaoInicio || "") : (processo.avisoContratacaoDiretaHoraSessaoInicio || "");
    }

    function textoBuscaContratacao(processo) {
      return normalizarCadastro([
        processo.numero,
        primeiraColunaValor(processo),
        processo.objeto,
        processo.secretaria,
        modalidadeProcesso(processo),
        formaProcesso(processo),
        responsavelTabela(processo),
        dataSessaoTabela(processo),
        horarioTabela(processo),
        dadosManuais(processo).situacao,
        valorProcesso(processo, "valorEstimado"),
        valorProcesso(processo, "trValorEstimado"),
        valorProcesso(processo, "etpValorEstimado"),
        valorHomologadoProcesso(processo),
        processo.dataCriacao
      ].filter(Boolean).join(" "));
    }

    container.innerHTML = `
      <section class="wrap">
        <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px">
          <div>
            <h2 style="margin:0 0 6px 0">${esc(titulo)}</h2>
            <div class="muted">${esc(subtitulo)}</div>
          </div>
          <div id="contratacoes_contador" class="muted" style="font-size:13px">${filtrados.length} processo(s)</div>
        </header>

        <div class="toolbar" style="margin-bottom:12px">
          <input id="contratacoes_busca" class="input" placeholder="Buscar por qualquer informação da tabela...">
        </div>

        <div class="card">
          ${filtrados.length ? `
            <div style="overflow:auto">
              <table>
                <thead>
                  <tr>
                    <th>Nº Processo</th>
                    <th>${esc(config.primeiraColunaTitulo || "Tipo de Objeto")}</th>
                    <th>Objeto</th>
                    <th>Secretaria</th>
                    ${config.ocultarColunaModalidade ? "" : "<th>Forma de Contratação / Modalidade</th>"}
                    ${usaTabelaControle ? `<th>${esc(config.responsavelTitulo || "Pregoeiro")}</th><th>Data Sessão</th><th>Horário</th><th>Situação</th>` : "<th>Valor Estimado</th>"}
                    <th>Valor Homologado</th>
                    ${usaTabelaControle ? "<th>Ações</th>" : ""}
                    ${usaTabelaControle ? "" : "<th>Data</th>"}
                  </tr>
                </thead>
                <tbody>
                  ${filtrados.map(p => `
                    <tr data-contratacao-row data-search="${esc(textoBuscaContratacao(p))}">
                      <td><strong>${esc(p.numero || "")}</strong></td>
                      <td>${esc(primeiraColunaValor(p))}</td>
                      <td ${config.colunasDispensa ? 'style="max-width:360px;white-space:normal;line-height:1.35"' : ''}>${esc(p.objeto || "")}</td>
                      <td>${esc(p.secretaria || "")}</td>
                      ${config.ocultarColunaModalidade ? "" : `<td>
                        <strong>${esc(String(modalidadeProcesso(p) || "").toLocaleUpperCase("pt-BR"))}</strong>
                        ${formaProcesso(p) ? `<br><span class="muted">${esc(formaProcesso(p))}</span>` : ""}
                      </td>`}
                      ${usaTabelaControle ? `
                        <td>${esc(responsavelTabela(p))}</td>
                        <td>${esc(dataSessaoTabela(p))}</td>
                        <td>${esc(horarioTabela(p))}</td>
                        <td>${esc(dadosManuais(p).situacao || "")}</td>
                      ` : `<td>${esc(valorProcesso(p, "valorEstimado") || valorProcesso(p, "trValorEstimado") || valorProcesso(p, "etpValorEstimado"))}</td>`}
                      <td>${esc(valorHomologadoProcesso(p))}</td>
                      ${usaTabelaControle ? `<td><button type="button" class="btn" data-contratacao-controle="${esc(p.id || "")}" title="Editar informações" aria-label="Editar informações">📒</button></td>` : ""}
                      ${usaTabelaControle ? "" : `<td>${esc(p.dataCriacao || "")}</td>`}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `<div class="empty">Nenhum processo encontrado para esta categoria.</div>`}
        </div>

        ${usaTabelaControle ? `
          <dialog id="contratacao_controle_modal" style="width:min(560px,94vw)">
            <div class="modal-head">
              <strong>${esc(config.modalTitulo || "Informações da Contratação")}</strong>
              <button type="button" id="contratacao_controle_fechar" class="btn ghost">Fechar</button>
            </div>
            <form id="contratacao_controle_form" class="modal-body">
              <input type="hidden" id="contratacao_controle_id">
              <div class="field">
                <label>${esc(config.primeiraColunaTitulo || "Contratação")}</label>
                <input id="contratacao_controle_dispensa" class="input" readonly>
              </div>
              <div class="grid">
                <div class="field">
                  <label>Data Sessão</label>
                  <input id="contratacao_controle_data_sessao" class="input" readonly>
                </div>
                <div class="field">
                  <label>Horário</label>
                  <input id="contratacao_controle_horario" class="input" readonly>
                </div>
              </div>
              <div class="field">
                <label>${esc(config.responsavelTitulo || "Pregoeiro")}</label>
                <input id="contratacao_controle_pregoeiro" class="input" placeholder="${esc(config.responsavelPlaceholder || "Nome do pregoeiro")}" ${config.responsavelSomenteLeitura ? "readonly" : ""}>
              </div>
              <div class="field">
                <label>Situação</label>
                <input id="contratacao_controle_situacao" class="input" placeholder="Situação">
              </div>
              <div class="modal-actions">
                <button type="button" id="contratacao_controle_cancelar" class="btn">Cancelar</button>
                <button type="submit" class="btn primary">Salvar</button>
              </div>
            </form>
          </dialog>
        ` : ""}
      </section>
    `;

    const campoBuscaContratacoes = container.querySelector("#contratacoes_busca");
    const contadorContratacoes = container.querySelector("#contratacoes_contador");
    campoBuscaContratacoes?.addEventListener("input", () => {
      const termo = normalizarCadastro(campoBuscaContratacoes.value || "");
      let visiveis = 0;
      container.querySelectorAll("[data-contratacao-row]").forEach(row => {
        const mostrar = !termo || String(row.dataset.search || "").includes(termo);
        row.style.display = mostrar ? "" : "none";
        if (mostrar) visiveis += 1;
      });
      if (contadorContratacoes) {
        contadorContratacoes.textContent = `${visiveis} de ${filtrados.length} processo(s)`;
      }
    });

    if (usaTabelaControle) {
      const modal = container.querySelector("#contratacao_controle_modal");
      const form = container.querySelector("#contratacao_controle_form");
      const fechar = container.querySelector("#contratacao_controle_fechar");
      const cancelar = container.querySelector("#contratacao_controle_cancelar");
      const campoId = container.querySelector("#contratacao_controle_id");
      const campoDispensa = container.querySelector("#contratacao_controle_dispensa");
      const campoDataSessao = container.querySelector("#contratacao_controle_data_sessao");
      const campoHorario = container.querySelector("#contratacao_controle_horario");
      const campoPregoeiro = container.querySelector("#contratacao_controle_pregoeiro");
      const campoSituacao = container.querySelector("#contratacao_controle_situacao");

      container.querySelectorAll("[data-contratacao-controle]").forEach(btn => {
        btn.addEventListener("click", () => {
          const processo = filtrados.find(p => p.id === btn.dataset.contratacaoControle);
          if (!processo || !modal) return;
          const dados = dadosManuais(processo);
          campoId.value = processo.id || "";
          campoDispensa.value = primeiraColunaValor(processo);
          campoDataSessao.value = config.usarDadosEdital ? (processo.editalDataSessao || "") : (processo.avisoContratacaoDiretaDataSessao || "");
          campoHorario.value = config.usarDadosEdital ? (processo.editalHoraSessaoInicio || "") : (processo.avisoContratacaoDiretaHoraSessaoInicio || "");
          campoPregoeiro.value = (config.usarPregoeiroLicitacao ? processo.licitacaoPregoeiro : "") || (config.usarAgenteAviso ? processo.avisoContratacaoDiretaAgente : "") || dados.pregoeiro || "";
          campoSituacao.value = dados.situacao || "";
          modal.showModal();
        });
      });

      fechar?.addEventListener("click", () => modal?.close());
      cancelar?.addEventListener("click", () => modal?.close());
      form?.addEventListener("submit", (event) => {
        event.preventDefault();
        const dadosSalvar = {
          situacao: campoSituacao.value.trim()
        };
        if (!config.responsavelSomenteLeitura) {
          dadosSalvar.pregoeiro = campoPregoeiro.value.trim();
        }
        salvarControleManual(campoId.value, dadosSalvar);
        modal?.close();
        initCategoriaContratacoes(container, config);
      });
    }
  }

  function initCategoriaContratacoesPregoes(container) {
    initCategoriaContratacoes(container, {
      titulo: "Pregões",
      alvo: "PREGAO",
      subtitulo: "Processos cuja Forma de Contratação / Modalidade esteja cadastrada como pregão.",
      primeiraColunaTitulo: "N° Pregão",
      colunaEditalContratacao: true,
      ocultarColunaModalidade: true,
      colunasPregao: true,
      usarDadosEdital: true,
      usarPregoeiroLicitacao: true,
      modalTitulo: "Informações do Pregão"
    });
  }

  function initCategoriaContratacoesConcorrencias(container) {
    initCategoriaContratacoes(container, {
      titulo: "Concorrências",
      alvo: "CONCORRENCIA",
      subtitulo: "Processos cuja Forma de Contratação / Modalidade esteja cadastrada como concorrência."
    });
  }

  function initCategoriaContratacoesDispensas(container) {
    initCategoriaContratacoes(container, {
      titulo: "Dispensas",
      alvo: "DISPENSA",
      subtitulo: "Processos cadastrados como dispensa de licitação.",
      primeiraColunaTitulo: "N° da Dispensa",
      colunaContratacaoDireta: true,
      ocultarColunaModalidade: true,
      colunasDispensa: true,
      usarAgenteAviso: true,
      responsavelTitulo: "Agente de Contratação",
      responsavelPlaceholder: "Nome do agente de contratação",
      responsavelSomenteLeitura: true
    });
  }

  function initCategoriaContratacoesInexigibilidades(container) {
    initCategoriaContratacoes(container, {
      titulo: "Inexigibilidades",
      alvo: "INEXIGIBILIDADE",
      subtitulo: "Processos cadastrados como inexigibilidade."
    });
  }

  function initFornecedores(container) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) throw new Error('Container inválido');

    let filtro = "";
    let pessoasDraft = [];

    const esc = (value) => String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    function sincronizarFornecedoresDosProcessos() {
      loadData().forEach(registrarFornecedorDoProcesso);
    }

    function pessoaUsadaEmProcesso(pessoaId) {
      return loadData().some(p => p.pessoaVinculadaId === pessoaId);
    }

    function fornecedorUsadoEmProcesso(fornecedor) {
      if (!fornecedor) return false;
      const cnpjDigits = onlyDigits(fornecedor.cnpj);
      return loadData().some(p =>
        p.fornecedorId === fornecedor.id ||
        onlyDigits(p.cnpj) === cnpjDigits ||
        onlyDigits(p.credCnpj) === cnpjDigits ||
        (Array.isArray(p.resultadoItens) && p.resultadoItens.some(item => item.fornecedorId === fornecedor.id || onlyDigits(item.cnpj) === cnpjDigits))
      );
    }

    function processosVinculadosFornecedor(fornecedor) {
      if (!fornecedor) return [];
      const cnpjDigits = onlyDigits(fornecedor.cnpj);
      return loadData().filter(p =>
        p.fornecedorId === fornecedor.id ||
        onlyDigits(p.cnpj) === cnpjDigits ||
        onlyDigits(p.credCnpj) === cnpjDigits ||
        (Array.isArray(p.resultadoItens) && p.resultadoItens.some(item => item.fornecedorId === fornecedor.id || onlyDigits(item.cnpj) === cnpjDigits))
      );
    }

    function dadosVinculoFornecedorNoProcesso(processo, fornecedor) {
      const cnpjDigits = onlyDigits(fornecedor?.cnpj);
      const itemResultado = Array.isArray(processo?.resultadoItens)
        ? processo.resultadoItens.find(item => (item.fornecedorId === fornecedor?.id || onlyDigits(item.cnpj) === cnpjDigits) && (item.pessoaVinculadaNome || item.pessoaVinculadaTipo))
        : null;
      return {
        pessoa: itemResultado?.pessoaVinculadaNome || processo?.pessoaVinculadaNome || "",
        tipo: itemResultado?.pessoaVinculadaTipo || processo?.pessoaVinculadaTipo || ""
      };
    }

    function renderProcessosFornecedor(fornecedor) {
      const lista = container.querySelector('#forn_processos_lista');
      if (!lista) return;

      const processos = processosVinculadosFornecedor(fornecedor);
      lista.innerHTML = processos.length ? `
        <div style="overflow:auto;max-height:260px">
          <table>
            <thead>
              <tr>
                <th>Nº Processo</th>
                <th>Objeto</th>
                <th>Pessoa Vinculada</th>
                <th>Tipo</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              ${processos.map(p => `
                ${(() => {
                  const vinculo = dadosVinculoFornecedorNoProcesso(p, fornecedor);
                  return `
                <tr>
                  <td><strong>${esc(p.numero || "")}</strong></td>
                  <td>${esc(p.objeto || "")}</td>
                  <td>${esc(vinculo.pessoa || "")}</td>
                  <td>${esc(vinculo.tipo || "")}</td>
                  <td>${esc(p.dataCriacao || "")}</td>
                </tr>
                  `;
                })()}
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">Nenhum processo vinculado a este fornecedor.</div>`;
    }

    function abrirVisualizacaoFornecedor(fornecedor) {
      if (!fornecedor) return;
      const pessoas = normalizarPessoasFornecedor(fornecedor.pessoas);
      const processos = processosVinculadosFornecedor(fornecedor);
      const dlg = container.querySelector('#fornecedor_view_dlg');
      const body = container.querySelector('#fornecedor_view_body');
      if (!dlg || !body) return;

      body.innerHTML = `
        <div class="fornecedor-view-shell">
          <section class="fornecedor-hero">
            <div>
              <span>FORNECEDOR</span>
              <h3>${esc(fornecedor.razaoSocial || fornecedor.nomeFantasia || "Fornecedor sem razão social")}</h3>
              <p>${esc(fornecedor.nomeFantasia || "Nome fantasia não informado")}</p>
            </div>
            <strong>${esc(fornecedor.cnpj || "CNPJ não informado")}</strong>
          </section>

          <section class="fornecedor-info-grid">
            <div class="fornecedor-info-card">
              <span>CNPJ</span>
              <strong>${esc(fornecedor.cnpj || "") || '<span class="muted">Não informado</span>'}</strong>
            </div>
            <div class="fornecedor-info-card">
              <span>Atualizado em</span>
              <strong>${esc(fornecedor.atualizadoEm || "") || '<span class="muted">Não informado</span>'}</strong>
            </div>
            <div class="fornecedor-info-card wide">
              <span>Razão Social</span>
              <strong>${esc(fornecedor.razaoSocial || "") || '<span class="muted">Não informado</span>'}</strong>
            </div>
            <div class="fornecedor-info-card wide">
              <span>Nome Fantasia</span>
              <strong>${esc(fornecedor.nomeFantasia || "") || '<span class="muted">Não informado</span>'}</strong>
            </div>
          </section>

          <section class="fornecedor-section">
            <div class="fornecedor-section-head">
              <h4>Pessoas Vinculadas</h4>
              <span>${pessoas.length} registro(s)</span>
            </div>
        ${pessoas.length ? `
          <div class="fornecedor-table-wrap">
            <table class="fornecedor-view-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF</th>
                  <th>Tipo</th>
                  <th>Situação</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                ${pessoas.map(p => `
                  <tr>
                    <td><strong>${esc(p.nome || "")}</strong></td>
                    <td>${esc(p.cpf || "")}</td>
                    <td>${esc(p.tipoVinculo || "")}</td>
                    <td>${p.ativo === false ? "INATIVO" : "ATIVO"}</td>
                    <td>${esc(p.observacao || "")}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty">Nenhuma pessoa vinculada cadastrada para este fornecedor.</div>`}
          </section>

          <section class="fornecedor-section">
            <div class="fornecedor-section-head">
              <h4>Processos Vinculados</h4>
              <span>${processos.length} processo(s)</span>
            </div>
        ${processos.length ? `
          <div class="fornecedor-table-wrap">
            <table class="fornecedor-view-table">
              <thead>
                <tr>
                  <th>Nº Processo</th>
                  <th>Objeto</th>
                  <th>Pessoa Vinculada</th>
                  <th>Tipo</th>
                  <th>Data</th>
              </tr>
              </thead>
              <tbody>
                ${processos.map(p => `
                  ${(() => {
                    const vinculo = dadosVinculoFornecedorNoProcesso(p, fornecedor);
                    return `
                  <tr>
                    <td><strong>${esc(p.numero || "")}</strong></td>
                    <td>${esc(p.objeto || "")}</td>
                    <td>${esc(vinculo.pessoa || "")}</td>
                    <td>${esc(vinculo.tipo || "")}</td>
                    <td>${esc(p.dataCriacao || "")}</td>
                  </tr>
                    `;
                  })()}
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty">Nenhum processo vinculado a este fornecedor.</div>`}
          </section>
        </div>
      `;

      dlg.showModal();
    }

    function fornecedoresFiltrados() {
      const termo = normalizarChaveInteressado(filtro);
      return loadFornecedores()
        .filter(f => {
          if (!termo) return true;
          return normalizarChaveInteressado([
            f.cnpj,
            f.razaoSocial,
            f.nomeFantasia,
            processosVinculadosFornecedor(f).map(p => {
              const vinculo = dadosVinculoFornecedorNoProcesso(p, f);
              const resultado = Array.isArray(p.resultadoItens) ? p.resultadoItens.map(item => `${item.cnpj || ""} ${item.razaoSocial || ""} ${item.nomeFantasia || ""} ${item.pessoaVinculadaNome || ""} ${item.pessoaVinculadaTipo || ""}`).join(" ") : "";
              return `${p.numero} ${p.objeto} ${vinculo.pessoa} ${vinculo.tipo} ${resultado}`;
            }).join(" "),
            normalizarPessoasFornecedor(f.pessoas).map(p => `${p.nome} ${p.cpf} ${p.tipoVinculo}`).join(" ")
          ].join(" ")).includes(termo);
        })
        .sort((a, b) => (a.razaoSocial || a.nomeFantasia || a.cnpj || "")
          .localeCompare(b.razaoSocial || b.nomeFantasia || b.cnpj || "", "pt-BR"));
    }

    function abrirModal(fornecedor = null) {
      const dlg = container.querySelector('#fornecedor_dlg');
      const form = container.querySelector('#fornecedor_form');
      form.reset();
      pessoasDraft = normalizarPessoasFornecedor(fornecedor?.pessoas);
      container.querySelector('#forn_id').value = fornecedor?.id || "";
      container.querySelector('#forn_cnpj').value = fornecedor?.cnpj || "";
      container.querySelector('#forn_razao').value = fornecedor?.razaoSocial || "";
      container.querySelector('#forn_fantasia').value = fornecedor?.nomeFantasia || "";
      container.querySelector('#fornecedor_delete').style.display = fornecedor ? "" : "none";
      renderProcessosFornecedor(fornecedor);
      renderPessoasDraft();
      dlg.showModal();
    }

    function limparFormPessoa() {
      container.querySelector('#forn_pessoa_id').value = "";
      container.querySelector('#forn_pessoa_nome').value = "";
      container.querySelector('#forn_pessoa_cpf').value = "";
      container.querySelector('#forn_pessoa_tipo').value = "";
      container.querySelector('#forn_pessoa_obs').value = "";
      container.querySelector('#forn_pessoa_ativo').checked = true;
      container.querySelector('#forn_pessoa_salvar').textContent = "+ Adicionar Pessoa Vinculada";
    }

    function renderPessoasDraft() {
      const lista = container.querySelector('#forn_pessoas_lista');
      if (!lista) return;

      lista.innerHTML = pessoasDraft.length ? `
        <div style="overflow:auto;max-height:260px">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF</th>
                <th>Tipo de Vínculo</th>
                <th>Situação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${pessoasDraft.map(p => `
                <tr>
                  <td><strong>${esc(p.nome || "")}</strong></td>
                  <td>${esc(p.cpf || "")}</td>
                  <td>${esc(p.tipoVinculo || "")}</td>
                  <td>${p.ativo === false ? "INATIVO" : "ATIVO"}</td>
                  <td>
                    <button type="button" class="btn" data-edit-pessoa="${esc(p.id)}">Editar</button>
                    <button type="button" class="btn" data-toggle-pessoa="${esc(p.id)}">${p.ativo === false ? "Ativar" : "Inativar"}</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">Nenhuma pessoa vinculada cadastrada para este fornecedor.</div>`;

      lista.querySelectorAll('[data-edit-pessoa]').forEach(btn => {
        btn.onclick = () => {
          const pessoa = pessoasDraft.find(p => p.id === btn.dataset.editPessoa);
          if (!pessoa) return;
          container.querySelector('#forn_pessoa_id').value = pessoa.id;
          container.querySelector('#forn_pessoa_nome').value = pessoa.nome || "";
          container.querySelector('#forn_pessoa_cpf').value = pessoa.cpf || "";
          container.querySelector('#forn_pessoa_tipo').value = pessoa.tipoVinculo || "";
          container.querySelector('#forn_pessoa_obs').value = pessoa.observacao || "";
          container.querySelector('#forn_pessoa_ativo').checked = pessoa.ativo !== false;
          container.querySelector('#forn_pessoa_salvar').textContent = "Salvar pessoa";
        };
      });

      lista.querySelectorAll('[data-toggle-pessoa]').forEach(btn => {
        btn.onclick = () => {
          const pessoa = pessoasDraft.find(p => p.id === btn.dataset.togglePessoa);
          if (!pessoa) return;
          pessoa.ativo = pessoa.ativo === false;
          pessoa.atualizadoEm = new Date().toLocaleString('pt-BR');
          if (pessoa.ativo === false && pessoaUsadaEmProcesso(pessoa.id)) {
            showToast('Pessoa inativada e mantida no histórico dos processos.');
          }
          renderPessoasDraft();
        };
      });
    }

    function render() {
      const fornecedores = fornecedoresFiltrados();

      container.innerHTML = `
        <section class="wrap">
          <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px">
            <div>
              <h2 style="margin:0 0 6px 0">Fornecedores</h2>
              <div class="muted">Cadastro automático por CNPJ e inclusão manual de fornecedores.</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
              <button type="button" class="btn" id="forn_sync">Atualizar a partir dos processos</button>
              <button type="button" class="btn primary" id="forn_new">+ Novo fornecedor</button>
            </div>
          </header>

          <div class="card" style="margin-bottom:12px">
            <div class="grid" style="grid-template-columns:1fr auto;align-items:end">
              <div class="field">
                <label>Pesquisar fornecedor</label>
                <input id="forn_search" class="input" placeholder="Filtrar por CNPJ, razão social, fantasia, pessoa ou processo" value="${esc(filtro)}">
              </div>
              <div class="muted" style="padding-bottom:10px">${fornecedores.length} fornecedor(es)</div>
            </div>
          </div>

          <div class="card">
            ${fornecedores.length ? `
              <div style="overflow:auto">
                <table>
                  <thead>
                    <tr>
                      <th>CNPJ</th>
                      <th>Razão Social</th>
                      <th>Nome Fantasia</th>
                      <th>Pessoas</th>
                      <th>Processos Vinculados</th>
                      <th>Atualizado em</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${fornecedores.map(f => `
                      <tr>
                        <td><strong>${esc(f.cnpj || "")}</strong></td>
                        <td>${esc(f.razaoSocial || "")}</td>
                        <td>${esc(f.nomeFantasia || "")}</td>
                        <td>${normalizarPessoasFornecedor(f.pessoas).filter(p => p.ativo !== false).length}</td>
                        <td>${processosVinculadosFornecedor(f).length}</td>
                        <td>${esc(f.atualizadoEm || "")}</td>
                        <td>
                          <button type="button" class="btn" data-view-fornecedor="${esc(f.id)}">Ver</button>
                          <button type="button" class="btn" data-edit-fornecedor="${esc(f.id)}">Editar</button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : `<div class="empty">Nenhum fornecedor cadastrado ainda.</div>`}
          </div>

          <dialog id="fornecedor_dlg" style="width:min(720px, 94vw)">
            <form id="fornecedor_form" method="dialog">
              <div class="modal-head">
                <strong>Fornecedor</strong>
                <button type="button" id="fornecedor_close" class="btn ghost">Fechar</button>
              </div>
              <div class="modal-body">
                <input type="hidden" id="forn_id">
                <div class="grid">
                  <div class="field">
                    <label>CNPJ</label>
                    <input id="forn_cnpj" class="input" placeholder="00.000.000/0000-00" required>
                  </div>
                </div>
                <div class="field">
                  <label>Razão Social</label>
                  <input id="forn_razao" class="input" required>
                </div>
                <div class="field">
                  <label>Nome Fantasia</label>
                  <input id="forn_fantasia" class="input">
                </div>
                <hr>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">
                  <strong>Processos Vinculados</strong>
                  <span class="muted" style="font-size:12px">Gerado automaticamente pelos processos cadastrados</span>
                </div>
                <div id="forn_processos_lista" style="margin-top:10px"></div>
                <hr>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">
                  <strong>Pessoas Vinculadas</strong>
                  <button type="button" class="btn" id="forn_pessoa_limpar">Limpar campos</button>
                </div>
                <input type="hidden" id="forn_pessoa_id">
                <div class="grid">
                  <div class="field" style="grid-column:1/-1">
                    <label>Nome da Pessoa Vinculada</label>
                    <input id="forn_pessoa_nome" class="input" placeholder="NOME DA PESSOA">
                  </div>
                  <div class="field">
                    <label>Tipo de Vínculo</label>
                    <input id="forn_pessoa_tipo" class="input" list="forn_tipos_vinculo" placeholder="AGENTE CULTURAL">
                    <datalist id="forn_tipos_vinculo">
                      <option value="AGENTE CULTURAL">
                      <option value="ARTISTA">
                      <option value="REPRESENTANTE">
                      <option value="RESPONSÁVEL TÉCNICO">
                      <option value="PROFISSIONAL VINCULADO">
                      <option value="PRESTADOR DO SERVIÇO">
                      <option value="PREPOSTO">
                      <option value="SÓCIO">
                      <option value="OUTRO">
                    </datalist>
                  </div>
                  <div class="field">
                    <label>CPF</label>
                    <input id="forn_pessoa_cpf" class="input" placeholder="000.000.000-00">
                  </div>
                  <div class="field" style="grid-column:1/-1">
                    <label>Observação</label>
                    <input id="forn_pessoa_obs" class="input">
                  </div>
                  <div class="field">
                    <label>Situação</label>
                    <label style="display:flex;align-items:center;gap:8px;height:38px">
                      <input type="checkbox" id="forn_pessoa_ativo" checked> Ativo
                    </label>
                  </div>
                  <div class="field" style="display:flex;align-items:end">
                    <button type="button" class="btn" id="forn_pessoa_salvar">+ Adicionar Pessoa Vinculada</button>
                  </div>
                </div>
                <div id="forn_pessoas_lista" style="margin-top:10px"></div>
              </div>
              <div class="modal-actions">
                <button type="button" class="btn danger" id="fornecedor_delete">Excluir</button>
                <button type="button" class="btn" id="fornecedor_cancel">Cancelar</button>
                <button type="submit" class="btn primary">Salvar</button>
              </div>
            </form>
          </dialog>

          <dialog id="fornecedor_view_dlg" style="width:min(1080px, 96vw)">
            <div class="modal-head">
              <strong>Visualizar Fornecedor</strong>
              <button type="button" id="fornecedor_view_close" class="btn ghost">Fechar</button>
            </div>
            <div class="modal-body" id="fornecedor_view_body"></div>
          </dialog>
        </section>
      `;

      const search = container.querySelector('#forn_search');
      const dlg = container.querySelector('#fornecedor_dlg');
      const form = container.querySelector('#fornecedor_form');
      const cnpjInput = container.querySelector('#forn_cnpj');
      const cpfPessoaInput = container.querySelector('#forn_pessoa_cpf');

      search.addEventListener('input', () => {
        filtro = search.value;
        render();
      });

      container.querySelector('#forn_new').onclick = () => abrirModal();
      container.querySelector('#forn_sync').onclick = () => {
        sincronizarFornecedoresDosProcessos();
        render();
        showToast('Fornecedores atualizados a partir dos processos.');
      };

      container.querySelectorAll('[data-edit-fornecedor]').forEach(btn => {
        btn.onclick = () => {
          const fornecedor = loadFornecedores().find(f => f.id === btn.dataset.editFornecedor);
          abrirModal(fornecedor);
        };
      });

      container.querySelectorAll('[data-view-fornecedor]').forEach(btn => {
        btn.onclick = () => {
          const fornecedor = loadFornecedores().find(f => f.id === btn.dataset.viewFornecedor);
          abrirVisualizacaoFornecedor(fornecedor);
        };
      });

      container.querySelector('#fornecedor_close').onclick = () => dlg.close();
      container.querySelector('#fornecedor_cancel').onclick = () => dlg.close();
      container.querySelector('#fornecedor_view_close').onclick = () => container.querySelector('#fornecedor_view_dlg').close();
      cnpjInput.addEventListener('input', () => {
        cnpjInput.value = formatCnpj(cnpjInput.value);
      });
      cpfPessoaInput.addEventListener('input', () => {
        cpfPessoaInput.value = formatCpf(cpfPessoaInput.value);
      });

      container.querySelector('#forn_pessoa_limpar').onclick = limparFormPessoa;
      container.querySelector('#forn_pessoa_salvar').onclick = () => {
        const id = container.querySelector('#forn_pessoa_id').value;
        const nome = container.querySelector('#forn_pessoa_nome').value.trim();
        const cpf = container.querySelector('#forn_pessoa_cpf').value.trim();
        const tipoVinculo = container.querySelector('#forn_pessoa_tipo').value.trim();
        const observacao = container.querySelector('#forn_pessoa_obs').value.trim();
        const ativo = container.querySelector('#forn_pessoa_ativo').checked;

        if (!nome) return alert('Informe o nome da pessoa vinculada.');
        if (!tipoVinculo) return alert('Informe o tipo de vínculo.');

        const idxPessoa = pessoasDraft.findIndex(p => p.id === id);
        const pessoa = {
          id: id || genId(),
          nome,
          cpf,
          tipoVinculo,
          observacao,
          ativo,
          criadoEm: idxPessoa >= 0 ? pessoasDraft[idxPessoa].criadoEm : new Date().toLocaleString('pt-BR'),
          atualizadoEm: new Date().toLocaleString('pt-BR')
        };

        if (idxPessoa >= 0) pessoasDraft[idxPessoa] = pessoa;
        else pessoasDraft.push(pessoa);

        limparFormPessoa();
        renderPessoasDraft();
      };

      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const id = container.querySelector('#forn_id').value;
        const cnpj = container.querySelector('#forn_cnpj').value;
        const razaoSocial = container.querySelector('#forn_razao').value.trim();
        const nomeFantasia = container.querySelector('#forn_fantasia').value.trim();

        if (onlyDigits(cnpj).length !== 14) return alert('Informe um CNPJ válido com 14 dígitos.');
        if (!razaoSocial) return alert('Informe a Razão Social.');

        const fornecedores = loadFornecedores();
        const idx = fornecedores.findIndex(f => f.id === id);
        const duplicate = fornecedores.find(f => onlyDigits(f.cnpj) === onlyDigits(cnpj) && f.id !== id);
        if (duplicate) return alert('Já existe um fornecedor cadastrado com este CNPJ.');

        const atual = idx >= 0 ? fornecedores[idx] : {};
        const fornecedor = {
          id: atual.id || genId(),
          cnpj: formatCnpj(cnpj),
          razaoSocial,
          nomeFantasia,
          origem: atual.origem || '',
          pessoas: normalizarPessoasFornecedor(pessoasDraft),
          atualizadoEm: new Date().toLocaleString('pt-BR'),
          criadoEm: atual.criadoEm || new Date().toLocaleString('pt-BR')
        };

        if (idx >= 0) fornecedores[idx] = fornecedor;
        else fornecedores.unshift(fornecedor);
        saveFornecedores(fornecedores);
        dlg.close();
        render();
        showToast('Fornecedor salvo.');
      });

      container.querySelector('#fornecedor_delete').onclick = () => {
        const id = container.querySelector('#forn_id').value;
        if (!id || !confirm('Excluir este fornecedor?')) return;
        const fornecedor = loadFornecedores().find(f => f.id === id);
        if (fornecedorUsadoEmProcesso(fornecedor)) {
          return alert('Este fornecedor já está vinculado a processo(s). Para preservar o histórico, a exclusão foi bloqueada.');
        }
        saveFornecedores(loadFornecedores().filter(f => f.id !== id));
        dlg.close();
        render();
        showToast('Fornecedor excluído.');
      };
    }

    sincronizarFornecedoresDosProcessos();
    render();
  }

  function initCategoriaRegistroPrecoIrp(container) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) throw new Error('Container inválido');

    const esc = (value) => String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    const loadIrps = () => {
      try { return JSON.parse(localStorage.getItem(IRP_STORAGE_KEY) || '[]'); }
      catch (e) { console.error('Erro ao carregar IRPs:', e); return []; }
    };

    const saveIrps = (items) => {
      localStorage.setItem(IRP_STORAGE_KEY, JSON.stringify(items));
    };

    const aplicarMascaraDataLocal = (campo) => {
      if (!campo) return;
      campo.addEventListener('input', () => {
        let v = campo.value.replace(/\D/g, '').slice(0, 8);
        v = v.replace(/^(\d{2})(\d)/, '$1/$2');
        v = v.replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
        campo.value = v;
      });
    };

    const arquivoParaBase64Local = (input, atual) => salvarAnexoIndexedDB(input, atual);

    const parseItensTxtLocal = (texto) => String(texto || '')
      .split(/\r?\n/)
      .map(line => line.split('\t').map(cell => cell.replace(/\s+/g, ' ').trim()))
      .filter(row => row.some(cell => cell));

    const renderTabelaItens = (items, limite = Infinity) => {
      if (!Array.isArray(items) || !items.length) return `<div class="empty">Nenhum item importado.</div>`;
      const sample = items.slice(0, limite);
      const colunas = items.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
      return `
        <div style="overflow:auto">
          <table>
            <tbody>
              ${sample.map(row => `
                <tr>
                  ${Array.from({ length: colunas }).map((_, idx) => `<td>${esc(row?.[idx] || '')}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${items.length > sample.length ? `<div class="muted" style="margin-top:6px">Prévia limitada às primeiras ${sample.length} linhas.</div>` : ''}
        </div>
      `;
    };

    const linkPdf = (arquivo, label) => linkAnexoPdf(arquivo, label);

    let irps = loadIrps();
    let itensDraft = [];
    let editId = '';

    container.innerHTML = `
      <section class="wrap">
        <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px">
          <div>
            <h2 style="margin:0 0 6px 0">IRP</h2>
            <div class="muted">Visualização dos processos relacionados a intenção de registro de preços.</div>
          </div>
          <button id="irp_add" class="btn primary" type="button">+ Nova IRP</button>
        </header>

        <div class="card" id="irp_lista"></div>
      </section>

      <dialog id="irp_dlg" style="width:min(860px,96vw)">
        <div class="modal-head">
          <strong id="irp_dlg_titulo">Nova IRP</strong>
          <button id="irp_close" class="btn ghost" type="button">Fechar</button>
        </div>
        <div class="modal-body">
          <div class="grid">
            <div class="field">
              <label>N° da IRP</label>
              <input id="irp_numero" class="input" inputmode="numeric" maxlength="3" placeholder="001">
            </div>
            <div class="field">
              <label>Ano</label>
              <input id="irp_ano" class="input" inputmode="numeric" maxlength="4" placeholder="2026">
            </div>
            <div class="field">
              <label>Situação</label>
              <input id="irp_situacao" class="input" placeholder="EX: ABERTA">
            </div>
            <div class="field">
              <label>Prazo para manifestar interesse</label>
              <input id="irp_prazo" class="input" placeholder="DD/MM/AAAA" maxlength="10">
            </div>
            <div class="field">
              <label>Data da publicação</label>
              <input id="irp_publicacao_data" class="input" placeholder="DD/MM/AAAA" maxlength="10">
            </div>
            <div class="field" style="grid-column:1/-1">
              <label>Objeto</label>
              <textarea id="irp_objeto" class="input" rows="3"></textarea>
            </div>
            <div class="field" style="grid-column:1/-1">
              <label>Processo Gerador vinculado</label>
              <select id="irp_processo_gerador" class="input">
                <option value="">-- nenhum processo vinculado --</option>
              </select>
              <div class="muted" style="font-size:12px;margin-top:6px">Selecione o processo gerador da ata relacionado a esta IRP.</div>
            </div>
            <div class="field" style="grid-column:1/-1">
              <label>Itens</label>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button id="irp_import_itens" class="btn" type="button">Importar TXT de Itens</button>
                <button id="irp_limpar_itens" class="btn" type="button">Limpar Itens</button>
                <input id="irp_itens_file" type="file" accept=".txt,text/plain" style="display:none">
              </div>
              <div id="irp_itens_status" class="muted" style="font-size:12px;margin-top:6px">Nenhum item importado.</div>
              <div id="irp_itens_preview" style="margin-top:8px;display:none;overflow:auto;max-height:220px"></div>
            </div>
            <div class="field">
              <label>Publicação em PDF</label>
              <input id="irp_pdf_publicacao" class="input" type="file" accept="application/pdf,.pdf">
              <div id="irp_pdf_publicacao_status" class="muted" style="font-size:12px;margin-top:4px"></div>
            </div>
            <div class="field">
              <label>CI de abertura da IRP em PDF</label>
              <input id="irp_pdf_ci" class="input" type="file" accept="application/pdf,.pdf">
              <div id="irp_pdf_ci_status" class="muted" style="font-size:12px;margin-top:4px"></div>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <button id="irp_delete" class="btn danger" type="button" style="display:none">Excluir</button>
          <button id="irp_cancel" class="btn" type="button">Cancelar</button>
          <button id="irp_save" class="btn primary" type="button">Salvar</button>
        </div>
      </dialog>

      <dialog id="irp_itens_dlg" style="width:min(900px,96vw)">
        <div class="modal-head">
          <strong>Itens da IRP</strong>
          <button id="irp_itens_close" class="btn ghost" type="button">Fechar</button>
        </div>
        <div class="modal-body" id="irp_itens_view"></div>
      </dialog>
    `;

    const dlg = container.querySelector('#irp_dlg');
    const dlgItens = container.querySelector('#irp_itens_dlg');
    const lista = container.querySelector('#irp_lista');
    const campos = {
      numero: container.querySelector('#irp_numero'),
      ano: container.querySelector('#irp_ano'),
      situacao: container.querySelector('#irp_situacao'),
      prazo: container.querySelector('#irp_prazo'),
      publicacaoData: container.querySelector('#irp_publicacao_data'),
      objeto: container.querySelector('#irp_objeto'),
      processoGerador: container.querySelector('#irp_processo_gerador'),
      pdfPublicacao: container.querySelector('#irp_pdf_publicacao'),
      pdfCi: container.querySelector('#irp_pdf_ci')
    };

    function processosGeradoresRegistroPreco() {
      return loadData().filter(p => p.tipoRegistroPreco === "gerador");
    }

    function rotuloProcessoGerador(id) {
      if (!id) return '';
      const processo = processosGeradoresRegistroPreco().find(p => p.id === id);
      return processo ? `${processo.numero || 'SEM NÚMERO'} - ${processo.objeto || ''}` : 'Processo vinculado não encontrado';
    }

    function carregarProcessosGeradoresIrp(selecionado = '') {
      if (!campos.processoGerador) return;
      const atual = selecionado || campos.processoGerador.value;
      campos.processoGerador.innerHTML = '<option value="">-- nenhum processo vinculado --</option>';
      processosGeradoresRegistroPreco().forEach(processo => {
        const option = document.createElement('option');
        option.value = processo.id;
        option.textContent = `${processo.numero || 'SEM NÚMERO'} - ${processo.objeto || ''}`;
        campos.processoGerador.appendChild(option);
      });
      if (atual) {
        const existe = [...campos.processoGerador.options].some(option => option.value === atual);
        if (!existe) {
          const option = document.createElement('option');
          option.value = atual;
          option.textContent = 'Processo vinculado não encontrado';
          campos.processoGerador.appendChild(option);
        }
        campos.processoGerador.value = atual;
      }
    }

    function sincronizarProcessoGeradorDaIrp(irp) {
      const processos = loadData();
      let mudou = false;
      processos.forEach(processo => {
        if (processo.irpRegistroPreco === irp.id && processo.id !== irp.processoGerador) {
          processo.irpRegistroPreco = '';
          mudou = true;
        }
        if (irp.processoGerador && processo.id === irp.processoGerador && processo.irpRegistroPreco !== irp.id) {
          processo.irpRegistroPreco = irp.id;
          mudou = true;
        }
      });
      if (mudou) saveData(processos);
    }

    function renderItensDraft() {
      const status = container.querySelector('#irp_itens_status');
      const preview = container.querySelector('#irp_itens_preview');
      const colunas = itensDraft.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
      status.textContent = itensDraft.length ? `${contarItensTabela(itensDraft)} item(s) importado(s). Primeira linha usada como cabeçalho. ${itensDraft.length} linha(s) no arquivo.` : 'Nenhum item importado.';
      preview.style.display = itensDraft.length ? 'block' : 'none';
      preview.innerHTML = itensDraft.length ? renderTabelaItens(itensDraft, 10) : '';
    }

    function renderLista() {
      irps = loadIrps();
      lista.innerHTML = irps.length ? `
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:10px">
          <strong>${irps.length} IRP(s) cadastrada(s)</strong>
        </div>
        <div style="overflow:auto">
          <table>
            <thead>
              <tr>
                <th>IRP</th>
                <th>Situação</th>
                <th>Prazo</th>
                <th>Publicação</th>
                <th>Objeto</th>
                <th>Processo Gerador</th>
                <th>Itens</th>
                <th>Anexos</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${irps.map(item => `
                <tr>
                  <td><strong>${esc(item.numero || '')}/${esc(item.ano || '')}</strong></td>
                  <td>${esc(item.situacao || '')}</td>
                  <td>${esc(item.prazoManifestacao || '')}</td>
                  <td>${esc(item.dataPublicacao || '')}</td>
                  <td>${esc(item.objeto || '')}</td>
                  <td>${esc(rotuloProcessoGerador(item.processoGerador))}</td>
                  <td>${contarItensTabela(item.itens)}</td>
                  <td>
                    ${linkPdf(item.pdfPublicacao, 'Publicação')}
                    ${linkPdf(item.pdfCiAbertura, 'Aviso de Abertura')}
                  </td>
                  <td>
                    <button class="btn" type="button" data-irp-itens="${esc(item.id)}">Itens</button>
                    <button class="btn" type="button" data-irp-edit="${esc(item.id)}">Editar</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">Nenhuma IRP cadastrada.</div>`;
    }

    function abrirForm(id = '') {
      editId = id;
      const atual = irps.find(item => item.id === id) || {};
      container.querySelector('#irp_dlg_titulo').textContent = id ? 'Editar IRP' : 'Nova IRP';
      campos.numero.value = atual.numero || '';
      campos.ano.value = atual.ano || '';
      campos.situacao.value = atual.situacao || '';
      campos.prazo.value = atual.prazoManifestacao || '';
      campos.publicacaoData.value = atual.dataPublicacao || '';
      campos.objeto.value = atual.objeto || '';
      carregarProcessosGeradoresIrp(atual.processoGerador || '');
      campos.pdfPublicacao.value = '';
      campos.pdfCi.value = '';
      container.querySelector('#irp_pdf_publicacao_status').textContent = atual.pdfPublicacao?.nome ? `Arquivo atual: ${atual.pdfPublicacao.nome}` : '';
      container.querySelector('#irp_pdf_ci_status').textContent = atual.pdfCiAbertura?.nome ? `Arquivo atual: ${atual.pdfCiAbertura.nome}` : '';
      itensDraft = Array.isArray(atual.itens) ? atual.itens : [];
      renderItensDraft();
      container.querySelector('#irp_delete').style.display = id ? 'inline-block' : 'none';
      dlg.showModal();
    }

    async function salvarForm() {
      const numero = onlyDigits(campos.numero.value).slice(0, 3);
      const ano = onlyDigits(campos.ano.value).slice(0, 4);
      if (!numero) return alert('Informe o N° da IRP.');
      if (ano.length !== 4) return alert('Informe o ano com 4 dígitos.');
      if (!campos.situacao.value.trim()) return alert('Informe a situação da IRP.');
      if (!campos.prazo.value.trim()) return alert('Informe o prazo para manifestar interesse.');
      if (!campos.objeto.value.trim()) return alert('Informe o objeto da IRP.');

      const idx = irps.findIndex(item => item.id === editId);
      const atual = idx >= 0 ? irps[idx] : {};
      let pdfPublicacao = null;
      let pdfCiAbertura = null;
      try {
        pdfPublicacao = await arquivoParaBase64Local(campos.pdfPublicacao, atual.pdfPublicacao);
        pdfCiAbertura = await arquivoParaBase64Local(campos.pdfCi, atual.pdfCiAbertura);
      } catch (error) {
        console.error('Erro ao salvar anexos da IRP:', error);
        return alert('Não foi possível salvar os PDFs da IRP no IndexedDB. Verifique se o navegador permite armazenamento local para este arquivo.');
      }
      const item = {
        id: atual.id || genId(),
        numero,
        ano,
        situacao: campos.situacao.value.trim(),
        prazoManifestacao: campos.prazo.value.trim(),
        objeto: campos.objeto.value.trim(),
        processoGerador: campos.processoGerador.value || '',
        itens: itensDraft,
        dataPublicacao: campos.publicacaoData.value.trim(),
        pdfPublicacao,
        pdfCiAbertura,
        criadoEm: atual.criadoEm || new Date().toLocaleString('pt-BR'),
        atualizadoEm: new Date().toLocaleString('pt-BR')
      };

      if (idx >= 0) irps[idx] = item;
      else irps.unshift(item);
      sincronizarProcessoGeradorDaIrp(item);
      try {
        saveIrps(irps);
      } catch (error) {
        const isQuota = error?.name === 'QuotaExceededError' || String(error?.message || '').toLowerCase().includes('quota');
        if (!isQuota) {
          console.error('Erro ao salvar IRP:', error);
          return alert('Não foi possível salvar a IRP. Verifique o console para mais detalhes.');
        }

        const salvarSemAnexos = confirm(
          'Não foi possível salvar a IRP porque os PDFs anexados ultrapassaram o limite de armazenamento do navegador. Deseja salvar a IRP sem os anexos em PDF?'
        );
        if (!salvarSemAnexos) return;

        item.pdfPublicacao = atual.pdfPublicacao || null;
        item.pdfCiAbertura = atual.pdfCiAbertura || null;
        if (idx >= 0) irps[idx] = item;
        else irps[0] = item;

        try {
          sincronizarProcessoGeradorDaIrp(item);
          saveIrps(irps);
        } catch (fallbackError) {
          console.error('Erro ao salvar IRP sem anexos:', fallbackError);
          return alert('Ainda não foi possível salvar a IRP. O armazenamento do navegador pode estar cheio.');
        }
      }
      dlg.close();
      renderLista();
      showToast('IRP salva com sucesso.');
    }

    container.querySelector('#irp_add').onclick = () => abrirForm();
    container.querySelector('#irp_close').onclick = () => dlg.close();
    container.querySelector('#irp_cancel').onclick = () => dlg.close();
    container.querySelector('#irp_save').onclick = salvarForm;
    container.querySelector('#irp_itens_close').onclick = () => dlgItens.close();
    container.querySelector('#irp_delete').onclick = () => {
      if (!editId || !confirm('Excluir esta IRP?')) return;
      saveIrps(irps.filter(item => item.id !== editId));
      dlg.close();
      renderLista();
      showToast('IRP excluída.');
    };

    campos.numero.addEventListener('input', () => { campos.numero.value = onlyDigits(campos.numero.value).slice(0, 3); });
    campos.ano.addEventListener('input', () => { campos.ano.value = onlyDigits(campos.ano.value).slice(0, 4); });
    aplicarMascaraDataLocal(campos.prazo);
    aplicarMascaraDataLocal(campos.publicacaoData);

    container.querySelector('#irp_import_itens').onclick = () => container.querySelector('#irp_itens_file').click();
    container.querySelector('#irp_itens_file').addEventListener('change', async () => {
      const file = container.querySelector('#irp_itens_file').files[0];
      if (!file) return;
      itensDraft = parseItensTxtLocal(await file.text());
      container.querySelector('#irp_itens_file').value = '';
      renderItensDraft();
    });
    container.querySelector('#irp_limpar_itens').onclick = () => {
      if (itensDraft.length && !confirm('Limpar os itens importados desta IRP?')) return;
      itensDraft = [];
      renderItensDraft();
    };

    lista.addEventListener('click', (event) => {
      const edit = event.target.closest('[data-irp-edit]');
      const itensBtn = event.target.closest('[data-irp-itens]');
      if (edit) abrirForm(edit.dataset.irpEdit);
      if (itensBtn) {
        const item = irps.find(row => row.id === itensBtn.dataset.irpItens);
        container.querySelector('#irp_itens_view').innerHTML = renderTabelaItens(item?.itens || [], Infinity);
        dlgItens.showModal();
      }
    });

    renderLista();
  }

  function initCategoriaRegistroPrecoAdesoes(container) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) throw new Error('Container inválido');

    const processos = loadData();
    const geradores = processos.filter(p => p.tipoRegistroPreco === "gerador");
    const adesoes = processos.filter(p => p.tipoRegistroPreco === "adesao");
    const internas = adesoes.filter(p => (p.tipoAdesaoRegistro || (p.processoGerador ? "interna" : "")) === "interna");
    const externas = adesoes.filter(p => (p.tipoAdesaoRegistro || "") === "externa" || (!p.tipoAdesaoRegistro && !p.processoGerador));
    const esc = (value) => String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    function renderTabela(lista, tipo) {
      if (!lista.length) return `<div class="empty">Nenhuma adesão ${tipo.toLowerCase()} encontrada.</div>`;

      return `
        <div style="overflow:auto">
          <table>
            <thead>
              <tr>
                <th>Nº Processo</th>
                <th>Objeto</th>
                <th>Fornecedor</th>
                <th>CNPJ</th>
                <th>Ata</th>
                <th>Processo Gerador</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              ${lista.map(p => {
                const gerador = p.processoGerador ? geradores.find(g => g.id === p.processoGerador) : null;
                return `
                  <tr>
                    <td><strong>${esc(p.numero || "")}</strong></td>
                    <td>${esc(p.objeto || "")}</td>
                    <td>${esc(p.fornecedor || "")}</td>
                    <td>${esc(p.cnpj || "")}</td>
                    <td>${esc(p.ata || "")}</td>
                    <td>${gerador ? `${esc(gerador.numero || "")} - ${esc(gerador.objeto || "")}` : ""}</td>
                    <td>${esc(p.dataCriacao || "")}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    container.innerHTML = `
      <section class="wrap">
        <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px">
          <div>
            <h2 style="margin:0 0 6px 0">Adesões</h2>
            <div class="muted">Adesões internas e externas agrupadas por tipo.</div>
          </div>
          <div class="muted">${adesoes.length} adesão(ões)</div>
        </header>

        <div class="card" style="margin-bottom:12px">
          <h3 style="margin-top:0">Adesões Internas</h3>
          ${renderTabela(internas, "Interna")}
        </div>

        <div class="card">
          <h3 style="margin-top:0">Adesões Externas</h3>
          ${renderTabela(externas, "Externa")}
        </div>
      </section>
    `;
  }

  function initCategoriaRegistroPrecoAtas(container) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) throw new Error('Container inválido');

    const todosProcessos = loadData();
    const processosGeradores = todosProcessos.filter(p => p.tipoRegistroPreco === "gerador");
    const processos = processosGeradores.filter(p => Array.isArray(p.atasRegistroPreco) && p.atasRegistroPreco.length);
    const esc = (value) => String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
    let itensAtaDraft = [];
    let aditivosAtaDraft = [];
    let publicacoesAtaDraft = [];
    let publicacoesAditivoDraft = [];
    let contextoPublicacaoAta = 'ata';
    let catAtaEditProcessoId = '';
    let catAtaEditAtaId = '';
    let catAtaEditAtaIndex = -1;

    function aplicarMascaraDataLocal(campo) {
      if (!campo) return;
      campo.addEventListener('input', () => {
        let v = campo.value.replace(/\D/g, '').slice(0, 8);
        v = v.replace(/^(\d{2})(\d)/, '$1/$2');
        v = v.replace(/^(\d{2})\/(\d{2})(\d)/, '$1/$2/$3');
        campo.value = v;
      });
    }

    function renderTabelaItens(items) {
      const linhas = Array.isArray(items) ? items : [];
      if (!linhas.length) return `<div class="empty">Nenhum item importado.</div>`;

      const colunas = linhas.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
      return `
        <div style="overflow:auto;max-height:360px">
          <table>
            <tbody>
              ${linhas.map((row, rowIndex) => `
                <tr>
                  ${Array.from({ length: colunas }, (_, colIndex) => rowIndex === 0
                    ? `<th>${esc(row?.[colIndex] || "")}</th>`
                    : `<td>${esc(row?.[colIndex] || "")}</td>`
                  ).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    function renderItensDraft() {
      const status = container.querySelector('#cat_ata_itens_status');
      const preview = container.querySelector('#cat_ata_itens_preview');
      if (!status || !preview) return;
      if (!itensAtaDraft.length) {
        status.textContent = 'Nenhum item importado.';
        preview.style.display = 'none';
        preview.innerHTML = '';
        return;
      }
      const colunas = itensAtaDraft.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
      status.textContent = `${Math.max(itensAtaDraft.length - 1, 0)} item(s) importado(s). Primeira linha usada como cabeçalho. ${itensAtaDraft.length} linha(s) no arquivo.`;
      preview.style.display = '';
      preview.innerHTML = renderTabelaItens(itensAtaDraft.slice(0, 12));
    }

    function aplicarMascaraPeriodoDataLocal(campo) {
      if (!campo) return;
      campo.addEventListener('input', () => {
        let digits = campo.value.replace(/\D/g, '').slice(0, 16);
        const partes = [];
        if (digits.length > 0) partes.push(digits.slice(0, 2));
        if (digits.length > 2) partes.push(digits.slice(2, 4));
        if (digits.length > 4) partes.push(digits.slice(4, 8));
        let texto = partes.join('/');
        if (digits.length > 8) {
          const fim = [];
          const d2 = digits.slice(8);
          if (d2.length > 0) fim.push(d2.slice(0, 2));
          if (d2.length > 2) fim.push(d2.slice(2, 4));
          if (d2.length > 4) fim.push(d2.slice(4, 8));
          texto += ' A ' + fim.join('/');
        }
        campo.value = texto;
      });
    }

    function renderAditivosDraftCategoria() {
      const lista = container.querySelector('#cat_ata_aditivos_lista');
      if (!lista) return;
      lista.innerHTML = aditivosAtaDraft.length ? `
        <div style="overflow:auto">
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Aditivado</th>
                <th>Vigência</th>
                <th>Assinatura</th>
                <th>Publicação</th>
                <th>PDF</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              ${aditivosAtaDraft.map((aditivo, index) => `
                <tr>
                  <td><strong>${esc(aditivo.numero || '')}</strong></td>
                  <td>${esc(aditivo.objetoAditivado || '')}</td>
                  <td>${aditivoAlteraVigencia(aditivo) ? esc(aditivo.vigencia || '') : '<span class="muted">Não altera</span>'}</td>
                  <td>${esc(aditivo.dataAssinatura || '')}</td>
                  <td>${esc(aditivo.publicacao || '')}</td>
                  <td>${aditivo.pdf?.nome ? esc(aditivo.pdf.nome) : ''}</td>
                  <td><button type="button" class="btn" data-cat-edit-aditivo="${index}">Editar</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : `<div class="empty">Nenhum aditivo cadastrado para esta ata.</div>`;

      lista.querySelectorAll('[data-cat-edit-aditivo]').forEach(btn => {
        btn.addEventListener('click', () => abrirAditivoCategoria(Number(btn.dataset.catEditAditivo)));
      });
    }

    function seloDocumentoPublicacao(tipo) {
      const normalizado = normalizarCadastro(tipo || '');
      if (normalizado.includes('PNCP')) return 'PNCP';
      if (normalizado.includes('ATA') && !normalizado.includes('EXTRATO')) return 'ATA';
      if (normalizado.includes('RETIFICACAO')) return 'RETIFICAÇÃO';
      if (normalizado.includes('ADITIVO')) return 'ADITIVO';
      if (normalizado.includes('EXTRATO')) return 'EXTRATO';
      return tipo || 'DOCUMENTO';
    }

    function renderDocumentoComSelo(selo, titulo) {
      return `
        <div class="ata-doc-title">
          <span class="ata-doc-pill">${esc(selo || 'DOC')}</span>
          <strong>${esc(titulo || 'Documento')}</strong>
        </div>
      `;
    }

    function renderPublicacoesExtratoCategoria(publicacoes, comAcoes = true) {
      if (!Array.isArray(publicacoes) || !publicacoes.length) return `<div class="empty">Nenhuma publicação cadastrada.</div>`;
      return `
        <div style="overflow:auto">
          <table>
            <thead><tr><th>Documento</th><th>Data</th><th>Abrir</th>${comAcoes ? '<th>Ações</th>' : ''}</tr></thead>
            <tbody>
              ${publicacoes.map((pub, index) => `
                <tr>
                  <td>${renderDocumentoComSelo(seloDocumentoPublicacao(pub.tipo), pub.nome || pub.pdf?.nome || pub.tipo || 'Publicação')}</td>
                  <td>${esc(pub.data || '')}</td>
                  <td>${linkAnexoPdf(pub.pdf, '👁️', 'btn ata-doc-icon')}</td>
                  ${comAcoes ? `<td><button type="button" class="btn" data-cat-edit-publicacao="${index}">Editar</button></td>` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    function renderPublicacoesAtaDraftCategoria() {
      const lista = container.querySelector('#cat_ata_publicacoes_lista');
      if (!lista) return;
      lista.innerHTML = renderPublicacoesExtratoCategoria(publicacoesAtaDraft, true);
      lista.querySelectorAll('[data-cat-edit-publicacao]').forEach(btn => {
        btn.addEventListener('click', () => abrirPublicacaoCategoria('ata', Number(btn.dataset.catEditPublicacao)));
      });
    }

    function renderPublicacoesAditivoDraftCategoria() {
      const lista = container.querySelector('#cat_aditivo_publicacoes_lista');
      if (!lista) return;
      lista.innerHTML = renderPublicacoesExtratoCategoria(publicacoesAditivoDraft, true);
      lista.querySelectorAll('[data-cat-edit-publicacao]').forEach(btn => {
        btn.addEventListener('click', () => abrirPublicacaoCategoria('aditivo', Number(btn.dataset.catEditPublicacao)));
      });
    }

    function renderDocumentosAtaCategoria(ata) {
      const linhas = [];
      if (ata?.linkPncp) {
        linhas.push({
          selo: 'PNCP',
          titulo: 'PUBLICAÇÃO NO PNCP',
          data: '',
          conteudo: `<a class="btn ata-doc-icon" href="${esc(ata.linkPncp)}" target="_blank" rel="noopener" title="Abrir publicação no PNCP">↗</a>`
        });
      }
      if (ata?.pdfAta) {
        linhas.push({
          selo: 'ATA',
          titulo: ata.nomePdfAta || ata.pdfAta?.nome || 'PDF DA ATA',
          data: ata.dataAssinatura || '',
          conteudo: linkAnexoPdf(ata.pdfAta, '👁️', 'btn ata-doc-icon')
        });
      }
      if (ata?.pdfExtrato) {
        linhas.push({
          selo: 'EXTRATO',
          titulo: ata.nomePdfExtrato || ata.pdfExtrato?.nome || 'EXTRATO DA ATA',
          data: ata.dataExtrato || '',
          conteudo: linkAnexoPdf(ata.pdfExtrato, '👁️', 'btn ata-doc-icon')
        });
      }
      (Array.isArray(ata?.publicacoesExtrato) ? ata.publicacoesExtrato : []).forEach(pub => {
        linhas.push({
          selo: seloDocumentoPublicacao(pub.tipo),
          titulo: pub.nome || pub.pdf?.nome || '',
          data: pub.data || '',
          conteudo: linkAnexoPdf(pub.pdf, '👁️', 'btn ata-doc-icon')
        });
      });
      if (!linhas.length) return `<div class="empty">Nenhuma publicação cadastrada.</div>`;
      return `
        <div style="overflow:auto">
          <table>
            <thead><tr><th>Documento</th><th>Data</th><th>Abrir</th></tr></thead>
            <tbody>
              ${linhas.map(linha => `
                <tr>
                  <td>${renderDocumentoComSelo(linha.selo, linha.titulo)}</td>
                  <td>${esc(linha.data)}</td>
                  <td>${linha.conteudo}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    function irpDoProcessoCategoria(processoId) {
      if (!processoId) return null;
      const processosAtualizados = loadData();
      const processo = processosAtualizados.find(p => p.id === processoId);
      let irps = [];
      try {
        irps = JSON.parse(localStorage.getItem(IRP_STORAGE_KEY) || '[]');
      } catch (error) {
        console.error('Erro ao carregar IRPs para seleção de itens da ata:', error);
        irps = [];
      }
      const irpId = processo?.irpRegistroPreco || '';
      return irps.find(irp => irp.id === irpId) || irps.find(irp => irp.processoGerador === processoId) || null;
    }

    function esconderSeletorItensIrpCategoria() {
      const painel = container.querySelector('#cat_ata_irp_selector');
      if (painel) painel.style.display = 'none';
    }

    function abrirSeletorItensIrpCategoria() {
      const processoId = container.querySelector('#cat_ata_processo')?.value || catAtaEditProcessoId;
      if (!processoId) return alert('Selecione primeiro o processo gerador da ata.');
      const painel = container.querySelector('#cat_ata_irp_selector');
      const status = container.querySelector('#cat_ata_irp_status');
      const lista = container.querySelector('#cat_ata_irp_lista');
      if (!painel || !status || !lista) return;

      const irp = irpDoProcessoCategoria(processoId);
      if (!irp) return alert('Este processo gerador ainda não possui uma IRP vinculada. Vincule a IRP no processo ou no cadastro da IRP antes de selecionar os itens.');

      const linhas = normalizarItensAta(irp.itens);
      const cabecalho = linhas[0] || [];
      const itens = linhas.slice(1).filter(row => Array.isArray(row) && row.some(cell => String(cell || '').trim()));
      if (!itens.length) return alert('A IRP vinculada não possui itens cadastrados.');

      const processosAtualizados = loadData();
      const processo = processosAtualizados.find(p => p.id === processoId);
      const atas = Array.isArray(processo?.atasRegistroPreco) ? processo.atasRegistroPreco : [];
      const usadosOutrasAtas = mapaItensAtaUsados(atas, {
        id: catAtaEditAtaId || '',
        index: catAtaEditAtaIndex
      });
      const selecionadosAtuais = new Set(normalizarItensAta(itensAtaDraft).slice(1).map(chaveItemAta).filter(Boolean));
      const colunas = Math.max(cabecalho.length, ...itens.map(row => row.length));
      const bloqueados = itens.filter(row => usadosOutrasAtas.has(chaveItemAta(row))).length;
      status.textContent = `IRP ${irp.numero || ''}/${irp.ano || ''} - ${itens.length} item(s) disponível(is). ${bloqueados ? `${bloqueados} já usado(s) em outra ata deste processo.` : ''}`;
      lista.innerHTML = `
        <table>
          <thead>
            <tr>
              <th></th>
              ${Array.from({ length: colunas }, (_, colIndex) => `<th>${esc(cabecalho[colIndex] || `Coluna ${colIndex + 1}`)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${itens.map((row, idx) => {
              const key = chaveItemAta(row);
              const usado = usadosOutrasAtas.get(key);
              const checked = selecionadosAtuais.has(key) || !!usado;
              const disabled = usado ? 'disabled' : '';
              const title = usado ? ` title="Já usado na ata ${esc(usado.ata?.numero || '')}/${esc(usado.ata?.ano || '')}"` : '';
              return `
                <tr class="${usado ? 'row-muted' : ''}">
                  <td><input type="checkbox" data-cat-irp-ata-item="${idx + 1}" ${checked ? 'checked' : ''} ${disabled}${title}></td>
                  ${Array.from({ length: colunas }, (_, colIndex) => `<td>${esc(row[colIndex] || '')}</td>`).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
      painel.dataset.irpItens = JSON.stringify(linhas);
      painel.style.display = 'block';
    }

    function aplicarItensSelecionadosIrpCategoria() {
      const painel = container.querySelector('#cat_ata_irp_selector');
      if (!painel) return;
      let linhas = [];
      try {
        linhas = JSON.parse(painel.dataset.irpItens || '[]');
      } catch (error) {
        console.error('Erro ao ler itens selecionados da IRP:', error);
        linhas = [];
      }
      const selecionados = [...painel.querySelectorAll('[data-cat-irp-ata-item]:checked:not(:disabled)')]
        .map(input => Number(input.dataset.catIrpAtaItem))
        .filter(index => Number.isInteger(index) && index > 0 && linhas[index]);
      if (!selecionados.length) return alert('Selecione ao menos um item da IRP.');
      if (itensAtaDraft.length && !confirm('Substituir os itens atuais da ata pelos itens selecionados da IRP?')) return;

      itensAtaDraft = [linhas[0] || [], ...selecionados.map(index => linhas[index])];
      renderItensDraft();
      esconderSeletorItensIrpCategoria();
      showToast(`${selecionados.length} item(s) da IRP adicionados à ata.`);
    }

    function renderAditivos(aditivos) {
      if (!Array.isArray(aditivos) || !aditivos.length) return `<div class="empty">Nenhum aditivo cadastrado.</div>`;
      return `
        <table>
          <thead><tr><th>Número</th><th>Aditivado</th><th>Vigência</th><th>Assinatura</th><th>Publicação</th><th>PDF</th><th>Publicações/Extratos</th></tr></thead>
          <tbody>
            ${aditivos.map(a => `
              <tr>
                <td>${esc(a.numero || "")}</td>
                <td>${esc(a.objetoAditivado || "")}</td>
                <td>${aditivoAlteraVigencia(a) ? esc(a.vigencia || "") : '<span class="muted">Não altera</span>'}</td>
                <td>${esc(a.dataAssinatura || "")}</td>
                <td>${esc(a.publicacao || "")}</td>
                <td>${linkAnexoPdf(a.pdf, "Ver PDF")}</td>
                <td>${Array.isArray(a.publicacoesExtrato) && a.publicacoesExtrato.length ? `${a.publicacoesExtrato.length} publicação(ões)` : ''}</td>
              </tr>
              ${Array.isArray(a.publicacoesExtrato) && a.publicacoesExtrato.length ? `<tr><td colspan="7">${renderPublicacoesExtratoCategoria(a.publicacoesExtrato, false)}</td></tr>` : ''}
            `).join('')}
          </tbody>
        </table>
      `;
    }

    function aditivoAlteraVigencia(aditivo) {
      return Boolean(aditivo?.alteraVigencia || (aditivo?.alteraVigencia === undefined && aditivo?.vigencia));
    }

    function vigenciaAtualAtaCategoria(ata) {
      const aditivosComVigencia = Array.isArray(ata?.aditivos)
        ? ata.aditivos.filter(a => aditivoAlteraVigencia(a) && a.vigencia)
        : [];
      const ultimoAditivo = aditivosComVigencia[aditivosComVigencia.length - 1];
      return ultimoAditivo?.vigencia || [ata?.vigenciaInicio, ata?.vigenciaFim].filter(Boolean).join(" a ");
    }

    function parseDataBrAtaCategoria(valor) {
      const match = String(valor || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (!match) return null;
      const data = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
      return Number.isNaN(data.getTime()) ? null : data;
    }

    function dataFinalVigenciaAtaCategoria(ata) {
      const vigenciaAtual = vigenciaAtualAtaCategoria(ata);
      const datas = String(vigenciaAtual || '').match(/\d{2}\/\d{2}\/\d{4}/g);
      if (datas?.length) return parseDataBrAtaCategoria(datas[datas.length - 1]);
      return parseDataBrAtaCategoria(ata?.vigenciaFim);
    }

    function adicionarMesesAtaCategoria(base, meses) {
      const data = new Date(base.getFullYear(), base.getMonth(), base.getDate());
      data.setMonth(data.getMonth() + meses);
      return data;
    }

    function alertaVigenciaAtaCategoria(ata) {
      const fim = dataFinalVigenciaAtaCategoria(ata);
      if (!fim) return '';
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      fim.setHours(0, 0, 0, 0);
      if (fim <= adicionarMesesAtaCategoria(hoje, 1)) return 'vermelho';
      if (fim <= adicionarMesesAtaCategoria(hoje, 3)) return 'amarelo';
      return '';
    }

    function textoBuscaAtaCategoria(processo, ata) {
      const partes = [
        processo?.numero,
        processo?.objeto,
        processo?.secretaria,
        ata?.numero,
        ata?.ano,
        ata?.unidadeOrcamentaria,
        ata?.objeto,
        ata?.objetoResumido,
        ata?.modalidade,
        ata?.dataAssinatura,
        ata?.dataExtrato,
        ata?.vigenciaInicio,
        ata?.vigenciaFim,
        vigenciaAtualAtaCategoria(ata),
        ata?.linkPncp,
        ata?.fornecedorCnpj,
        ata?.fornecedorRazao,
        ata?.fornecedorFantasia,
        ata?.nomePdfAta,
        ata?.nomePdfExtrato,
        ata?.pdfAta?.nome,
        ata?.pdfExtrato?.nome
      ];
      (Array.isArray(ata?.publicacoesExtrato) ? ata.publicacoesExtrato : []).forEach(pub => {
        partes.push(pub.tipo, pub.nome, pub.data, pub.pdf?.nome);
      });
      (Array.isArray(ata?.aditivos) ? ata.aditivos : []).forEach(aditivo => {
        partes.push(aditivo.numero, aditivo.objetoAditivado, aditivo.vigencia, aditivo.dataAssinatura, aditivo.publicacao, aditivo.pdf?.nome);
        (Array.isArray(aditivo.publicacoesExtrato) ? aditivo.publicacoesExtrato : []).forEach(pub => {
          partes.push(pub.tipo, pub.nome, pub.data, pub.pdf?.nome);
        });
      });
      (Array.isArray(ata?.itens) ? ata.itens : []).forEach(item => {
        if (Array.isArray(item)) partes.push(...item);
        else if (item && typeof item === 'object') partes.push(...Object.values(item));
        else partes.push(item);
      });
      return normalizarCadastro(partes.filter(v => v !== undefined && v !== null).join(' '));
    }

    const todasAtas = processos.flatMap(p =>
      p.atasRegistroPreco.map(ata => ({
        processo: p,
        ata,
        alertaVigencia: alertaVigenciaAtaCategoria(ata)
      }))
    );

    const totalAlertaVermelho = todasAtas.filter(item => item.alertaVigencia === 'vermelho').length;
    const totalAlertaAmarelo = todasAtas.filter(item => item.alertaVigencia === 'amarelo').length;
    const anosAtas = [...new Set(todasAtas.map(({ ata }) => String(ata?.ano || '').trim()).filter(Boolean))]
      .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));

    function renderTabelaAtasCategoria(linhas) {
      if (!linhas.length) return `<div class="empty">Nenhuma ata cadastrada em processos geradores.</div>`;
      return `
        <div class="ata-table-card">
          <table class="ata-table-view">
            <thead>
              <tr>
                <th>N° e ano da ata</th>
                <th>Objeto resumido</th>
                <th>Vigência</th>
                <th>Modalidade</th>
                <th>Fornecedor</th>
              </tr>
            </thead>
            <tbody>
              ${linhas.map(({ processo, ata, alertaVigencia }) => `
                <tr data-cat-ata-row data-cat-ata-ano="${esc(ata.ano || '')}" data-cat-ata-alert="${esc(alertaVigencia || '')}" data-cat-ata-search="${esc(textoBuscaAtaCategoria(processo, ata))}">
                  <td><strong>Ata ${esc(ata.numero || "")}/${esc(ata.ano || "")}</strong></td>
                  <td>${esc(ata.objetoResumido || "")}</td>
                  <td>${esc(vigenciaAtualAtaCategoria(ata))}</td>
                  <td>${esc(ata.modalidade || "")}</td>
                  <td>${esc(ata.fornecedorRazao || "")}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    container.innerHTML = `
      <section class="wrap">
        <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px">
          <div>
            <h2 style="margin:0 0 6px 0">Atas de Registro de Preço</h2>
            <div class="muted">Atas agrupadas por processo gerador.</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">
            <div class="ata-view-toggle" aria-label="Modo de exibição das atas">
              <button type="button" class="btn active" data-ata-view-mode="grade">Grade</button>
              <button type="button" class="btn" data-ata-view-mode="tabela">Tabela</button>
            </div>
            <div class="muted">${todasAtas.length} ata(s)</div>
            <button id="cat_ata_add" class="btn primary" type="button">+ Nova Ata</button>
          </div>
        </header>

        <div class="ata-search-bar">
          <input id="cat_ata_busca" class="input" placeholder="Buscar por número, objeto, fornecedor, modalidade, vigência, item, aditivo, publicação...">
          <select id="cat_ata_ano_filtro" class="input">
            <option value="">Todos os anos</option>
            ${anosAtas.map(ano => `<option value="${esc(ano)}">${esc(ano)}</option>`).join('')}
          </select>
          <span id="cat_ata_busca_status" class="muted">${todasAtas.length} ata(s) encontrada(s)</span>
        </div>

        <div class="ata-deadline-panel">
          <button type="button" class="ata-deadline-card warning" data-ata-deadline-filter="amarelo">
            <span>Atas Próximas do Vencimento</span>
            <strong>${totalAlertaAmarelo}</strong>
          </button>
          <button type="button" class="ata-deadline-card danger" data-ata-deadline-filter="vermelho">
            <span>Vencidas ou vencendo neste mês</span>
            <strong>${totalAlertaVermelho}</strong>
          </button>
        </div>

        <div id="cat_ata_grade_view">
          ${processos.length ? processos.map(p => `
            <div class="ata-process-card" data-cat-process-card>
              <div class="ata-process-head">
                <div>
                  <div class="ata-process-number">${esc(p.numero || "")}</div>
                  <div class="ata-process-object">${esc(p.objeto || "")}</div>
                </div>
                <span class="ata-count-pill">${p.atasRegistroPreco.length} ata(s)</span>
              </div>

              <div class="ata-card-list">
                ${p.atasRegistroPreco.map((ata, ataIndex) => {
                  const alertaVigencia = alertaVigenciaAtaCategoria(ata);
                  return `
                  <article class="ata-view-card ${alertaVigencia ? `ata-vigencia-${alertaVigencia}` : ''}" data-cat-ata-card data-cat-ata-ano="${esc(ata.ano || '')}" data-cat-ata-alert="${esc(alertaVigencia || '')}" data-cat-ata-search="${esc(textoBuscaAtaCategoria(p, ata))}">
                    <div class="ata-view-head">
                      <div>
                        <div class="ata-view-kicker">Ata de Registro de Preço</div>
                        <h3>Ata ${esc(ata.numero || "")}/${esc(ata.ano || "")}</h3>
                      </div>
                      <div class="ata-card-actions">
                        <button type="button" class="btn" data-cat-processo="${esc(p.id || '')}" data-cat-edit-ata="${esc(ata.id || '')}" data-cat-edit-ata-index="${ataIndex}">Editar</button>
                        <button type="button" class="btn ata-delete-btn" data-cat-processo="${esc(p.id || '')}" data-cat-delete-ata="${esc(ata.id || '')}" data-cat-delete-ata-index="${ataIndex}" data-cat-ata-label="${esc(`Ata ${ata.numero || ''}/${ata.ano || ''}`)}">Excluir</button>
                      </div>
                    </div>

                    <div class="ata-summary-grid">
                      <div class="ata-summary-item">
                        <span>Fornecedor</span>
                        <strong>${esc(ata.fornecedorRazao || ata.fornecedorFantasia || "Não informado")}</strong>
                        ${ata.fornecedorCnpj ? `<small>${esc(ata.fornecedorCnpj)}</small>` : ""}
                      </div>
                      <div class="ata-summary-item">
                        <span>Objeto resumido</span>
                        <strong>${esc(ata.objetoResumido || "Não informado")}</strong>
                      </div>
                      <div class="ata-summary-item">
                        <span>Vigência</span>
                        <strong>${esc(vigenciaAtualAtaCategoria(ata) || "Não informado")}</strong>
                        ${alertaVigencia === 'vermelho' ? '<small class="ata-deadline-text danger">Vencida ou vencendo neste mês</small>' : ''}
                        ${alertaVigencia === 'amarelo' ? '<small class="ata-deadline-text warning">Próxima do vencimento</small>' : ''}
                      </div>
                      <div class="ata-summary-item">
                        <span>Modalidade</span>
                        <strong>${esc(ata.modalidade || "Não informado")}</strong>
                      </div>
                    </div>

                    <details class="ata-view-section">
                      <summary class="ata-view-section-title">Publicações/Extratos da Ata</summary>
                      ${renderDocumentosAtaCategoria(ata)}
                    </details>
                    <details class="ata-view-section">
                      <summary class="ata-view-section-title">Itens</summary>
                      ${renderTabelaItens(ata.itens)}
                    </details>
                    <details class="ata-view-section">
                      <summary class="ata-view-section-title">Aditivos</summary>
                      ${renderAditivos(ata.aditivos)}
                    </details>
                  </article>
                `}).join('')}
              </div>
            </div>
          `).join('') : `<div class="empty">Nenhuma ata cadastrada em processos geradores.</div>`}
        </div>

        <div id="cat_ata_tabela_view" style="display:none">
          ${renderTabelaAtasCategoria(todasAtas)}
        </div>

        <dialog id="cat_ata_dlg" class="ata-editor-dialog">
          <div class="modal-head">
            <strong id="cat_ata_title">Nova Ata de Registro de Preço</strong>
            <button id="cat_ata_close" class="btn ghost" type="button">Fechar</button>
          </div>
          <form id="cat_ata_form" class="modal-body ata-editor-body">
            <div class="grid ata-editor-grid">
              <div class="ata-editor-section-title">Identificação da Ata</div>
              <div class="field" style="grid-column:1/-1">
                <label>Processo Gerador da Ata</label>
                <select id="cat_ata_processo" class="input" required>
                  <option value="">-- selecione o processo gerador --</option>
                  ${processosGeradores.map(p => `
                    <option value="${esc(p.id)}">${esc(p.numero || 'SEM NÚMERO')} - ${esc(p.objeto || '')}</option>
                  `).join('')}
                </select>
              </div>
              <div class="field">
                <label>N°</label>
                <input id="cat_ata_numero" class="input" required>
              </div>
              <div class="field">
                <label>Ano</label>
                <input id="cat_ata_ano" class="input" inputmode="numeric" maxlength="4" required>
              </div>
              <div class="field">
                <label>Unidade Orçamentária</label>
                <input id="cat_ata_unidade" class="input">
              </div>
              <div class="field">
                <label>Modalidade</label>
                <input id="cat_ata_modalidade" class="input">
              </div>
              <div class="field" style="grid-column:1/-1">
                <label>Objeto</label>
                <textarea id="cat_ata_objeto" class="input" rows="3"></textarea>
              </div>
              <div class="field" style="grid-column:1/-1">
                <label>Objeto Resumido</label>
                <input id="cat_ata_objeto_resumido" class="input">
              </div>
              <div class="ata-editor-section-title">Vigência e PNCP</div>
              <div class="field">
                <label>Data de assinatura</label>
                <input id="cat_ata_assinatura" class="input" placeholder="DD/MM/AAAA" maxlength="10">
              </div>
              <div class="field">
                <label>Início da vigência</label>
                <input id="cat_ata_vig_inicio" class="input" placeholder="DD/MM/AAAA" maxlength="10">
              </div>
              <div class="field">
                <label>Término da vigência</label>
                <input id="cat_ata_vig_fim" class="input" placeholder="DD/MM/AAAA" maxlength="10">
              </div>
              <div class="field" style="grid-column:1/-1">
                <label>Link PNCP</label>
                <input id="cat_ata_pncp" class="input" type="url" placeholder="https://">
              </div>
              <div class="ata-editor-section-title">Fornecedor</div>
              <div class="field">
                <label>CNPJ do Fornecedor</label>
                <input id="cat_ata_cnpj" class="input" placeholder="00.000.000/0000-00">
              </div>
              <div class="field">
                <label>Razão Social</label>
                <input id="cat_ata_fornecedor" class="input">
              </div>
              <div class="field">
                <label>Nome Fantasia</label>
                <input id="cat_ata_fantasia" class="input">
              </div>
              <div class="ata-editor-section-title">Publicações e Anexos</div>
              <div class="field">
                <label>Nome do PDF da Ata</label>
                <input id="cat_ata_pdf_nome" class="input" placeholder="Ex: ATA Nº 33-2025">
              </div>
              <div class="field">
                <label>PDF da Ata</label>
                <input id="cat_ata_pdf" class="input" type="file" accept="application/pdf,.pdf">
              </div>
              <div class="field">
                <label>Nome da Publicação do Extrato</label>
                <input id="cat_ata_pdf_extrato_nome" class="input" placeholder="Ex: EXTRATO DA ATA Nº 33-2025">
              </div>
              <div class="field">
                <label>Data do Extrato da Ata</label>
                <input id="cat_ata_data_extrato" class="input" placeholder="DD/MM/AAAA" maxlength="10">
              </div>
              <div class="field">
                <label>PDF do Extrato da Ata no Diário Oficial</label>
                <input id="cat_ata_pdf_extrato" class="input" type="file" accept="application/pdf,.pdf">
              </div>
              <div class="field" style="grid-column:1/-1">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">
                  <label style="margin:0">Publicações/Extratos da Ata</label>
                  <button type="button" id="cat_ata_publicacao_add" class="btn">+ Incluir Publicação</button>
                </div>
                <div id="cat_ata_publicacoes_lista"></div>
              </div>
              <div class="field" style="grid-column:1/-1">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">
                  <label style="margin:0">Aditivos da Ata</label>
                  <button type="button" id="cat_ata_aditivo_add" class="btn">+ Incluir Aditivo</button>
                </div>
                <div id="cat_ata_aditivos_lista"></div>
              </div>
              <div class="ata-editor-section-title">Itens</div>
              <div class="field" style="grid-column:1/-1">
                <label>Itens da Ata</label>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                  <button id="cat_ata_import_itens" class="btn" type="button">Importar TXT de Itens</button>
                  <button id="cat_ata_select_irp" class="btn" type="button">Selecionar itens da IRP</button>
                  <button id="cat_ata_limpar_itens" class="btn" type="button">Limpar Itens</button>
                  <input id="cat_ata_itens_file" type="file" accept=".txt,text/plain" style="display:none">
                </div>
                <div id="cat_ata_itens_status" class="muted" style="font-size:12px;margin-top:6px">Nenhum item importado.</div>
                <div id="cat_ata_itens_preview" style="margin-top:8px;display:none;overflow:auto;max-height:260px"></div>
                <div id="cat_ata_irp_selector" class="card" style="display:none;box-shadow:none;margin-top:10px;padding:10px">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px">
                    <strong>Itens da IRP vinculada</strong>
                    <button type="button" id="cat_ata_irp_cancel" class="btn">Fechar seleção</button>
                  </div>
                  <div id="cat_ata_irp_status" class="muted" style="font-size:12px;margin-bottom:8px"></div>
                  <div id="cat_ata_irp_lista" style="overflow:auto;max-height:300px"></div>
                  <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">
                    <button type="button" id="cat_ata_irp_select_all" class="btn">Selecionar todos</button>
                    <button type="button" id="cat_ata_irp_apply" class="btn primary">Usar itens selecionados</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn" id="cat_ata_cancel">Cancelar</button>
              <button type="submit" class="btn primary">Salvar Ata</button>
            </div>
          </form>
        </dialog>

        <dialog id="cat_aditivo_dlg" style="width:min(620px,94vw)">
          <div class="modal-head">
            <strong>Aditivo da Ata</strong>
            <button type="button" id="cat_aditivo_close" class="btn ghost">Fechar</button>
          </div>
          <div class="modal-body">
            <form id="cat_aditivo_form">
              <input type="hidden" id="cat_aditivo_idx">
              <div class="grid">
                <div class="field"><label>Número do Aditivo</label><input id="cat_aditivo_numero" class="input" required></div>
                <div class="field" style="grid-column:1/-1"><label>O que está sendo aditivado</label><input id="cat_aditivo_objeto" class="input" placeholder="Ex: vigência, troca de marca, reequilíbrio, acréscimo de quantitativo"></div>
                <label class="ata-check-field" style="grid-column:1/-1">
                  <input id="cat_aditivo_altera_vigencia" type="checkbox">
                  <span>Este aditivo altera a vigência da ata</span>
                </label>
                <div class="field"><label>Vigência do Novo Aditivo</label><input id="cat_aditivo_vigencia" class="input" placeholder="DD/MM/AAAA A DD/MM/AAAA" disabled></div>
                <div class="field"><label>Data de Assinatura</label><input id="cat_aditivo_assinatura" class="input" placeholder="DD/MM/AAAA" maxlength="10"></div>
                <div class="field"><label>Publicação</label><input id="cat_aditivo_publicacao" class="input" placeholder="DD/MM/AAAA" maxlength="10"></div>
                <div class="field" style="grid-column:1/-1">
                  <label>PDF do Aditivo</label>
                  <input id="cat_aditivo_pdf" class="input" type="file" accept="application/pdf,.pdf">
                  <div id="cat_aditivo_pdf_status" class="muted" style="font-size:12px;margin-top:4px"></div>
                </div>
                <div class="field" style="grid-column:1/-1">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">
                    <label style="margin:0">Publicações/Extratos do Aditivo</label>
                    <button type="button" id="cat_aditivo_publicacao_add" class="btn">+ Incluir Publicação</button>
                  </div>
                  <div id="cat_aditivo_publicacoes_lista"></div>
                </div>
              </div>
              <div class="modal-actions">
                <button type="button" id="cat_aditivo_delete" class="btn danger">Excluir aditivo</button>
                <button type="button" id="cat_aditivo_cancel" class="btn">Cancelar</button>
                <button type="submit" class="btn primary">Salvar aditivo</button>
              </div>
            </form>
          </div>
        </dialog>

        <dialog id="cat_publicacao_dlg" style="width:min(620px,94vw)">
          <div class="modal-head">
            <strong>Publicação/Extrato</strong>
            <button type="button" id="cat_publicacao_close" class="btn ghost">Fechar</button>
          </div>
          <div class="modal-body">
            <form id="cat_publicacao_form">
              <input type="hidden" id="cat_publicacao_idx">
              <div class="grid">
                <div class="field">
                  <label>Tipo</label>
                  <select id="cat_publicacao_tipo" class="input" required>
                    <option value="">-- selecione --</option>
                    <option value="EXTRATO ORIGINAL">EXTRATO ORIGINAL</option>
                    <option value="RETIFICAÇÃO DO EXTRATO">RETIFICAÇÃO DO EXTRATO</option>
                    <option value="EXTRATO DO TERMO ADITIVO">EXTRATO DO TERMO ADITIVO</option>
                    <option value="RETIFICAÇÃO DO EXTRATO DO TERMO ADITIVO">RETIFICAÇÃO DO EXTRATO DO TERMO ADITIVO</option>
                    <option value="OUTROS">OUTROS</option>
                  </select>
                </div>
                <div class="field">
                  <label>Data da publicação</label>
                  <input id="cat_publicacao_data" class="input" placeholder="DD/MM/AAAA" maxlength="10">
                </div>
                <div class="field" style="grid-column:1/-1">
                  <label>Nome/Título do PDF</label>
                  <input id="cat_publicacao_nome" class="input" placeholder="Ex: RETIFICAÇÃO DO EXTRATO DA ATA">
                </div>
                <div class="field" style="grid-column:1/-1">
                  <label>PDF da publicação</label>
                  <input id="cat_publicacao_pdf" class="input" type="file" accept="application/pdf,.pdf">
                  <div id="cat_publicacao_pdf_status" class="muted" style="font-size:12px;margin-top:4px"></div>
                </div>
              </div>
              <div class="modal-actions">
                <button type="button" id="cat_publicacao_delete" class="btn danger">Excluir publicação</button>
                <button type="button" id="cat_publicacao_cancel" class="btn">Cancelar</button>
                <button type="submit" class="btn primary">Salvar publicação</button>
              </div>
            </form>
          </div>
        </dialog>
      </section>
    `;

    const dlg = container.querySelector('#cat_ata_dlg');
    const form = container.querySelector('#cat_ata_form');
    const dlgAditivo = container.querySelector('#cat_aditivo_dlg');
    const formAditivo = container.querySelector('#cat_aditivo_form');
    const dlgPublicacao = container.querySelector('#cat_publicacao_dlg');
    const formPublicacao = container.querySelector('#cat_publicacao_form');
    const cnpjInput = container.querySelector('#cat_ata_cnpj');

    function abrirFormAtaCategoria(processoId = '', ataId = '', ataIndex = -1) {
      if (!processosGeradores.length) {
        return alert('Cadastre primeiro um processo gerador de ata para vincular a nova ata.');
      }

      const processoSelect = container.querySelector('#cat_ata_processo');
      const titulo = container.querySelector('#cat_ata_title');
      const processosAtualizados = loadData();
      const processo = processosAtualizados.find(p => p.id === processoId);
      const atas = Array.isArray(processo?.atasRegistroPreco) ? processo.atasRegistroPreco : [];
      const indexNumerico = Number(ataIndex);
      const ata = ataId
        ? atas.find(a => a.id === ataId)
        : (Number.isInteger(indexNumerico) && indexNumerico >= 0 ? atas[indexNumerico] : null);

      catAtaEditProcessoId = ata ? processoId : '';
      catAtaEditAtaId = ata?.id || '';
      catAtaEditAtaIndex = ata ? atas.indexOf(ata) : -1;
      itensAtaDraft = normalizarItensAta(ata?.itens);
      aditivosAtaDraft = Array.isArray(ata?.aditivos) ? ata.aditivos.map(a => ({ ...a })) : [];
      publicacoesAtaDraft = Array.isArray(ata?.publicacoesExtrato) ? ata.publicacoesExtrato.map(p => ({ ...p })) : [];
      form.reset();
      esconderSeletorItensIrpCategoria();
      if (titulo) titulo.textContent = ata ? 'Editar Ata de Registro de Preço' : 'Nova Ata de Registro de Preço';
      if (processoSelect) {
        processoSelect.disabled = !!ata;
        processoSelect.value = ata ? processoId : '';
      }

      if (ata) {
        container.querySelector('#cat_ata_numero').value = ata.numero || '';
        container.querySelector('#cat_ata_ano').value = ata.ano || '';
        container.querySelector('#cat_ata_unidade').value = ata.unidadeOrcamentaria || '';
        container.querySelector('#cat_ata_modalidade').value = ata.modalidade || '';
        container.querySelector('#cat_ata_objeto').value = ata.objeto || '';
        container.querySelector('#cat_ata_objeto_resumido').value = ata.objetoResumido || '';
        container.querySelector('#cat_ata_assinatura').value = ata.dataAssinatura || '';
        container.querySelector('#cat_ata_vig_inicio').value = ata.vigenciaInicio || '';
        container.querySelector('#cat_ata_vig_fim').value = ata.vigenciaFim || '';
        container.querySelector('#cat_ata_data_extrato').value = ata.dataExtrato || '';
        container.querySelector('#cat_ata_pncp').value = ata.linkPncp || '';
        container.querySelector('#cat_ata_cnpj').value = ata.fornecedorCnpj || '';
        container.querySelector('#cat_ata_fornecedor').value = ata.fornecedorRazao || '';
        container.querySelector('#cat_ata_fantasia').value = ata.fornecedorFantasia || '';
        container.querySelector('#cat_ata_pdf_nome').value = ata.nomePdfAta || '';
        container.querySelector('#cat_ata_pdf_extrato_nome').value = ata.nomePdfExtrato || '';
      }

      renderItensDraft();
      renderPublicacoesAtaDraftCategoria();
      renderAditivosDraftCategoria();
      dlg.showModal();
    }

    function abrirAditivoCategoria(index = '') {
      const aditivo = index !== '' ? aditivosAtaDraft[Number(index)] : null;
      publicacoesAditivoDraft = Array.isArray(aditivo?.publicacoesExtrato) ? aditivo.publicacoesExtrato.map(p => ({ ...p })) : [];
      formAditivo?.reset();
      container.querySelector('#cat_aditivo_idx').value = index;
      container.querySelector('#cat_aditivo_numero').value = aditivo?.numero || '';
      container.querySelector('#cat_aditivo_objeto').value = aditivo?.objetoAditivado || '';
      container.querySelector('#cat_aditivo_altera_vigencia').checked = aditivoAlteraVigencia(aditivo);
      container.querySelector('#cat_aditivo_vigencia').value = aditivoAlteraVigencia(aditivo) ? (aditivo?.vigencia || '') : '';
      container.querySelector('#cat_aditivo_assinatura').value = aditivo?.dataAssinatura || '';
      container.querySelector('#cat_aditivo_publicacao').value = aditivo?.publicacao || '';
      container.querySelector('#cat_aditivo_pdf_status').textContent = aditivo?.pdf?.nome ? `Arquivo atual: ${aditivo.pdf.nome}` : '';
      container.querySelector('#cat_aditivo_delete').style.display = aditivo ? '' : 'none';
      atualizarCampoVigenciaAditivo();
      renderPublicacoesAditivoDraftCategoria();
      dlgAditivo?.showModal();
    }

    function abrirPublicacaoCategoria(contexto, index = '') {
      contextoPublicacaoAta = contexto === 'aditivo' ? 'aditivo' : 'ata';
      const lista = contextoPublicacaoAta === 'aditivo' ? publicacoesAditivoDraft : publicacoesAtaDraft;
      const publicacao = index !== '' ? lista[Number(index)] : null;
      formPublicacao?.reset();
      container.querySelector('#cat_publicacao_idx').value = index;
      container.querySelector('#cat_publicacao_tipo').value = publicacao?.tipo || '';
      container.querySelector('#cat_publicacao_data').value = publicacao?.data || '';
      container.querySelector('#cat_publicacao_nome').value = publicacao?.nome || '';
      container.querySelector('#cat_publicacao_pdf_status').textContent = publicacao?.pdf?.nome ? `Arquivo atual: ${publicacao.pdf.nome}` : '';
      container.querySelector('#cat_publicacao_delete').style.display = publicacao ? '' : 'none';
      dlgPublicacao?.showModal();
    }

    container.querySelector('#cat_ata_add').onclick = () => abrirFormAtaCategoria();

    let filtroAlertaVigenciaAta = '';

    function aplicarBuscaAtasCategoria() {
      const termo = normalizarCadastro(container.querySelector('#cat_ata_busca')?.value || '');
      const anoSelecionado = container.querySelector('#cat_ata_ano_filtro')?.value || '';
      let encontrados = 0;

      container.querySelectorAll('[data-cat-ata-card]').forEach(card => {
        const bateBusca = !termo || (card.dataset.catAtaSearch || '').includes(termo);
        const bateAno = !anoSelecionado || card.dataset.catAtaAno === anoSelecionado;
        const bateAlerta = !filtroAlertaVigenciaAta || card.dataset.catAtaAlert === filtroAlertaVigenciaAta;
        const bate = bateBusca && bateAno && bateAlerta;
        card.style.display = bate ? '' : 'none';
        if (bate) encontrados += 1;
      });

      container.querySelectorAll('[data-cat-process-card]').forEach(cardProcesso => {
        const temAtaVisivel = [...cardProcesso.querySelectorAll('[data-cat-ata-card]')]
          .some(card => card.style.display !== 'none');
        cardProcesso.style.display = temAtaVisivel ? '' : 'none';
      });

      container.querySelectorAll('[data-cat-ata-row]').forEach(row => {
        const bateBusca = !termo || (row.dataset.catAtaSearch || '').includes(termo);
        const bateAno = !anoSelecionado || row.dataset.catAtaAno === anoSelecionado;
        const bateAlerta = !filtroAlertaVigenciaAta || row.dataset.catAtaAlert === filtroAlertaVigenciaAta;
        const bate = bateBusca && bateAno && bateAlerta;
        row.style.display = bate ? '' : 'none';
      });

      const status = container.querySelector('#cat_ata_busca_status');
      if (status) status.textContent = `${encontrados} ata(s) encontrada(s)`;

      container.querySelectorAll('[data-ata-deadline-filter]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.ataDeadlineFilter === filtroAlertaVigenciaAta);
      });
    }

    container.querySelector('#cat_ata_busca')?.addEventListener('input', aplicarBuscaAtasCategoria);
    container.querySelector('#cat_ata_ano_filtro')?.addEventListener('change', aplicarBuscaAtasCategoria);

    container.querySelectorAll('[data-ata-deadline-filter]').forEach(btn => {
      btn.onclick = () => {
        const filtro = btn.dataset.ataDeadlineFilter || '';
        filtroAlertaVigenciaAta = filtroAlertaVigenciaAta === filtro ? '' : filtro;
        aplicarBuscaAtasCategoria();
      };
    });

    container.querySelectorAll('[data-ata-view-mode]').forEach(btn => {
      btn.onclick = () => {
        const modo = btn.dataset.ataViewMode || 'grade';
        const grade = container.querySelector('#cat_ata_grade_view');
        const tabela = container.querySelector('#cat_ata_tabela_view');
        if (grade) grade.style.display = modo === 'grade' ? '' : 'none';
        if (tabela) tabela.style.display = modo === 'tabela' ? '' : 'none';
        container.querySelectorAll('[data-ata-view-mode]').forEach(item => {
          item.classList.toggle('active', item.dataset.ataViewMode === modo);
        });
      };
    });

    container.querySelectorAll('[data-cat-edit-ata]').forEach(btn => {
      btn.onclick = () => abrirFormAtaCategoria(btn.dataset.catProcesso || '', btn.dataset.catEditAta || '', btn.dataset.catEditAtaIndex || -1);
    });

    container.querySelectorAll('[data-cat-delete-ata]').forEach(btn => {
      btn.onclick = () => {
        const processoId = btn.dataset.catProcesso || '';
        const ataId = btn.dataset.catDeleteAta || '';
        const ataIndexFallback = Number(btn.dataset.catDeleteAtaIndex || -1);
        const label = btn.dataset.catAtaLabel || 'esta ata';
        if (!confirm(`Excluir ${label}? Esta ação removerá a ata deste processo.`)) return;

        const processosAtualizados = loadData();
        const processoIndex = processosAtualizados.findIndex(p => p.id === processoId);
        if (processoIndex < 0) return alert('Processo gerador não encontrado.');

        const processo = processosAtualizados[processoIndex];
        const atas = Array.isArray(processo.atasRegistroPreco) ? processo.atasRegistroPreco : [];
        let ataIndex = ataId ? atas.findIndex(ata => ata.id === ataId) : -1;
        if (ataIndex < 0 && ataIndexFallback >= 0 && atas[ataIndexFallback]) ataIndex = ataIndexFallback;
        if (ataIndex < 0) return alert('Ata não encontrada para exclusão.');

        atas.splice(ataIndex, 1);
        processo.atasRegistroPreco = atas;
        processosAtualizados[processoIndex] = processo;
        saveData(processosAtualizados);
        showToast('Ata excluída com sucesso.');
        initCategoriaRegistroPrecoAtas(container);
      };
    });

    container.querySelector('#cat_ata_close').onclick = () => dlg.close();
    container.querySelector('#cat_ata_cancel').onclick = () => dlg.close();
    container.querySelector('#cat_ata_publicacao_add').onclick = () => abrirPublicacaoCategoria('ata');
    container.querySelector('#cat_ata_aditivo_add').onclick = () => abrirAditivoCategoria();
    container.querySelector('#cat_aditivo_close').onclick = () => dlgAditivo?.close();
    container.querySelector('#cat_aditivo_cancel').onclick = () => dlgAditivo?.close();
    container.querySelector('#cat_aditivo_publicacao_add').onclick = () => abrirPublicacaoCategoria('aditivo');
    function atualizarCampoVigenciaAditivo() {
      const checkbox = container.querySelector('#cat_aditivo_altera_vigencia');
      const campo = container.querySelector('#cat_aditivo_vigencia');
      if (!checkbox || !campo) return;
      campo.disabled = !checkbox.checked;
      if (!checkbox.checked) campo.value = '';
    }
    container.querySelector('#cat_aditivo_altera_vigencia')?.addEventListener('change', atualizarCampoVigenciaAditivo);
    container.querySelector('#cat_publicacao_close').onclick = () => dlgPublicacao?.close();
    container.querySelector('#cat_publicacao_cancel').onclick = () => dlgPublicacao?.close();
    container.querySelector('#cat_ata_select_irp').onclick = abrirSeletorItensIrpCategoria;
    container.querySelector('#cat_ata_irp_cancel').onclick = esconderSeletorItensIrpCategoria;
    container.querySelector('#cat_ata_irp_apply').onclick = aplicarItensSelecionadosIrpCategoria;
    container.querySelector('#cat_ata_irp_select_all').onclick = () => {
      const checks = [...container.querySelectorAll('#cat_ata_irp_selector [data-cat-irp-ata-item]:not(:disabled)')];
      const marcar = checks.some(input => !input.checked);
      checks.forEach(input => { input.checked = marcar; });
    };
    container.querySelector('#cat_ata_processo').addEventListener('change', esconderSeletorItensIrpCategoria);
    async function importarTxtItensAtaCategoria() {
      const input = container.querySelector('#cat_ata_itens_file');
      const status = container.querySelector('#cat_ata_itens_status');
      const file = input?.files?.[0];
      if (!file) return;
      if (status) status.textContent = `Lendo ${file.name}...`;
      try {
        const texto = await file.text();
        const itensImportados = String(texto || '')
          .replace(/^\uFEFF/, '')
          .split(/\r?\n/)
          .map(line => {
            const linha = String(line || '').trim();
            const separador = linha.includes('\t') ? '\t'
              : linha.includes(';') ? ';'
              : linha.includes('|') ? '|'
              : null;
            return (separador ? linha.split(separador) : [linha])
              .map(cell => cell.replace(/\s+/g, ' ').trim());
          })
          .filter(row => row.some(cell => cell));

        if (!itensImportados.length) {
          if (status) status.textContent = 'Nenhum item importado.';
          input.value = '';
          return alert('Não encontrei dados no TXT selecionado.');
        }

        itensAtaDraft = itensImportados;
        input.value = '';
        renderItensDraft();
        showToast(`${Math.max(itensImportados.length - 1, 0)} item(s) importado(s) do TXT.`);
      } catch (error) {
        console.error('Erro ao importar TXT de itens da ata:', error);
        if (status) status.textContent = 'Erro ao importar TXT: ' + (error && error.message ? error.message : error);
        alert('Não foi possível ler/renderizar o TXT selecionado. Detalhe: ' + (error && error.message ? error.message : error));
      }
    }

    const catAtaImportBtn = container.querySelector('#cat_ata_import_itens');
    const catAtaItensInput = container.querySelector('#cat_ata_itens_file');
    if (catAtaImportBtn && catAtaItensInput) {
      catAtaImportBtn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        catAtaItensInput.value = '';
        catAtaItensInput.click();
      };
      catAtaItensInput.onchange = importarTxtItensAtaCategoria;
    }

    container.querySelector('#cat_ata_limpar_itens').onclick = () => {
      if (itensAtaDraft.length && !confirm('Limpar os itens importados desta ata?')) return;
      itensAtaDraft = [];
      renderItensDraft();
    };

    ['#cat_ata_assinatura', '#cat_ata_vig_inicio', '#cat_ata_vig_fim', '#cat_ata_data_extrato'].forEach(sel => {
      aplicarMascaraDataLocal(container.querySelector(sel));
    });
    ['#cat_aditivo_assinatura', '#cat_aditivo_publicacao'].forEach(sel => {
      aplicarMascaraDataLocal(container.querySelector(sel));
    });
    aplicarMascaraDataLocal(container.querySelector('#cat_publicacao_data'));
    aplicarMascaraPeriodoDataLocal(container.querySelector('#cat_aditivo_vigencia'));

    container.querySelector('#cat_publicacao_delete').onclick = () => {
      const idx = container.querySelector('#cat_publicacao_idx').value;
      if (idx === '' || !confirm('Excluir esta publicação?')) return;
      const lista = contextoPublicacaoAta === 'aditivo' ? publicacoesAditivoDraft : publicacoesAtaDraft;
      lista.splice(Number(idx), 1);
      if (contextoPublicacaoAta === 'aditivo') renderPublicacoesAditivoDraftCategoria();
      else renderPublicacoesAtaDraftCategoria();
      dlgPublicacao?.close();
    };

    formPublicacao?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const idx = container.querySelector('#cat_publicacao_idx').value;
      const lista = contextoPublicacaoAta === 'aditivo' ? publicacoesAditivoDraft : publicacoesAtaDraft;
      const atual = idx !== '' ? lista[Number(idx)] : {};
      let pdf = atual?.pdf || null;
      try {
        pdf = await salvarAnexoIndexedDB(container.querySelector('#cat_publicacao_pdf'), pdf);
      } catch (error) {
        console.error('Erro ao salvar PDF da publicação:', error);
        return alert('Não foi possível salvar o PDF da publicação no armazenamento local do navegador.');
      }
      const publicacao = {
        id: atual?.id || genId(),
        tipo: container.querySelector('#cat_publicacao_tipo').value.trim(),
        nome: container.querySelector('#cat_publicacao_nome').value.trim(),
        data: container.querySelector('#cat_publicacao_data').value.trim(),
        pdf,
        atualizadoEm: new Date().toLocaleString('pt-BR'),
        criadoEm: atual?.criadoEm || new Date().toLocaleString('pt-BR')
      };
      if (!publicacao.tipo) return alert('Selecione o tipo da publicação.');
      if (idx !== '') lista[Number(idx)] = publicacao;
      else lista.push(publicacao);
      if (contextoPublicacaoAta === 'aditivo') renderPublicacoesAditivoDraftCategoria();
      else renderPublicacoesAtaDraftCategoria();
      dlgPublicacao?.close();
    });

    container.querySelector('#cat_aditivo_delete').onclick = () => {
      const idx = container.querySelector('#cat_aditivo_idx').value;
      if (idx === '' || !confirm('Excluir este aditivo?')) return;
      aditivosAtaDraft.splice(Number(idx), 1);
      renderAditivosDraftCategoria();
      dlgAditivo?.close();
    };

    formAditivo?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const idx = container.querySelector('#cat_aditivo_idx').value;
      const atual = idx !== '' ? aditivosAtaDraft[Number(idx)] : {};
      let pdf = atual?.pdf || null;
      try {
        pdf = await salvarAnexoIndexedDB(container.querySelector('#cat_aditivo_pdf'), pdf);
      } catch (error) {
        console.error('Erro ao salvar PDF do aditivo:', error);
        return alert('Não foi possível salvar o PDF do aditivo no armazenamento local do navegador.');
      }
      const alteraVigencia = container.querySelector('#cat_aditivo_altera_vigencia')?.checked || false;
      const vigencia = alteraVigencia ? container.querySelector('#cat_aditivo_vigencia').value.trim() : '';
      if (alteraVigencia && !vigencia) return alert('Informe a nova vigência do aditivo ou desmarque a opção de alteração de vigência.');
      const aditivo = {
        id: atual?.id || genId(),
        numero: container.querySelector('#cat_aditivo_numero').value.trim(),
        objetoAditivado: container.querySelector('#cat_aditivo_objeto').value.trim(),
        alteraVigencia,
        vigencia,
        dataAssinatura: container.querySelector('#cat_aditivo_assinatura').value.trim(),
        publicacao: container.querySelector('#cat_aditivo_publicacao').value.trim(),
        pdf,
        publicacoesExtrato: publicacoesAditivoDraft,
        atualizadoEm: new Date().toLocaleString('pt-BR'),
        criadoEm: atual?.criadoEm || new Date().toLocaleString('pt-BR')
      };
      if (!aditivo.numero) return alert('Informe o número do aditivo.');
      if (idx !== '') aditivosAtaDraft[Number(idx)] = aditivo;
      else aditivosAtaDraft.push(aditivo);
      renderAditivosDraftCategoria();
      dlgAditivo?.close();
    });

    function preencherFornecedorPorCnpj() {
      const fornecedor = buscarFornecedorPorCnpj(cnpjInput.value);
      if (!fornecedor) return;
      container.querySelector('#cat_ata_fornecedor').value = fornecedor.razaoSocial || '';
      container.querySelector('#cat_ata_fantasia').value = fornecedor.nomeFantasia || '';
    }

    cnpjInput.addEventListener('input', () => {
      cnpjInput.value = formatCnpj(cnpjInput.value);
      if (onlyDigits(cnpjInput.value).length === 14) preencherFornecedorPorCnpj();
    });
    cnpjInput.addEventListener('blur', preencherFornecedorPorCnpj);

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const processoSelect = container.querySelector('#cat_ata_processo');
      const processoId = processoSelect.value || catAtaEditProcessoId;
      const processosAtualizados = loadData();
      const processoIndex = processosAtualizados.findIndex(p => p.id === processoId);
      if (processoIndex < 0) return alert('Selecione o processo gerador da ata.');

      const processo = processosAtualizados[processoIndex];
      processo.atasRegistroPreco = Array.isArray(processo.atasRegistroPreco) ? processo.atasRegistroPreco : [];
      let ataIndex = catAtaEditAtaId ? processo.atasRegistroPreco.findIndex(a => a.id === catAtaEditAtaId) : -1;
      if (ataIndex < 0 && catAtaEditAtaIndex >= 0 && processo.atasRegistroPreco[catAtaEditAtaIndex]) ataIndex = catAtaEditAtaIndex;
      const ataAtual = ataIndex >= 0 ? processo.atasRegistroPreco[ataIndex] : null;

      let pdfAta = ataAtual?.pdfAta || null;
      let pdfExtrato = ataAtual?.pdfExtrato || null;
      try {
        pdfAta = await salvarAnexoIndexedDB(container.querySelector('#cat_ata_pdf'), pdfAta);
        pdfExtrato = await salvarAnexoIndexedDB(container.querySelector('#cat_ata_pdf_extrato'), pdfExtrato);
      } catch (error) {
        console.error('Erro ao salvar anexos da ata:', error);
        return alert('Não foi possível salvar os PDFs da ata no IndexedDB. Verifique se o navegador permite armazenamento local para este arquivo.');
      }

      if (!validarItensAtaNaIrp(irpDoProcessoCategoria(processoId), itensAtaDraft)) return;

      const duplicado = encontrarItemAtaDuplicado(processo.atasRegistroPreco, itensAtaDraft, {
        id: ataAtual?.id || '',
        index: ataIndex
      });
      if (duplicado) {
        return alert(`Este item já está vinculado à ata ${duplicado.ata?.numero || ''}/${duplicado.ata?.ano || ''} deste processo. Remova o item duplicado antes de salvar.`);
      }

      const agora = new Date().toLocaleString('pt-BR');
      const ata = {
        id: ataAtual?.id || genId(),
        numero: container.querySelector('#cat_ata_numero').value.trim(),
        ano: container.querySelector('#cat_ata_ano').value.trim(),
        unidadeOrcamentaria: container.querySelector('#cat_ata_unidade').value.trim(),
        objeto: container.querySelector('#cat_ata_objeto').value.trim(),
        objetoResumido: container.querySelector('#cat_ata_objeto_resumido').value.trim(),
        modalidade: container.querySelector('#cat_ata_modalidade').value.trim(),
        dataAssinatura: container.querySelector('#cat_ata_assinatura').value.trim(),
        dataExtrato: container.querySelector('#cat_ata_data_extrato').value.trim(),
        vigenciaInicio: container.querySelector('#cat_ata_vig_inicio').value.trim(),
        vigenciaFim: container.querySelector('#cat_ata_vig_fim').value.trim(),
        linkPncp: container.querySelector('#cat_ata_pncp').value.trim(),
        fornecedorCnpj: container.querySelector('#cat_ata_cnpj').value.trim(),
        fornecedorRazao: container.querySelector('#cat_ata_fornecedor').value.trim(),
        fornecedorFantasia: container.querySelector('#cat_ata_fantasia').value.trim(),
        nomePdfAta: container.querySelector('#cat_ata_pdf_nome').value.trim(),
        nomePdfExtrato: container.querySelector('#cat_ata_pdf_extrato_nome').value.trim(),
        pdfAta,
        pdfExtrato,
        publicacoesExtrato: publicacoesAtaDraft,
        itens: normalizarItensAta(itensAtaDraft),
        aditivos: aditivosAtaDraft,
        atualizadoEm: agora,
        criadoEm: ataAtual?.criadoEm || agora
      };

      if (!ata.numero || !ata.ano) return alert('Informe o número e o ano da ata.');
      if (ata.fornecedorCnpj) {
        upsertFornecedor({
          cnpj: ata.fornecedorCnpj,
          razaoSocial: ata.fornecedorRazao,
          nomeFantasia: ata.fornecedorFantasia,
          origem: `ATA ${ata.numero || ''}/${ata.ano || ''}`.trim()
        });
      }

      if (ataIndex >= 0) processo.atasRegistroPreco[ataIndex] = ata;
      else processo.atasRegistroPreco.push(ata);
      processosAtualizados[processoIndex] = processo;
      saveData(processosAtualizados);
      catAtaEditProcessoId = '';
      catAtaEditAtaId = '';
      catAtaEditAtaIndex = -1;
      processoSelect.disabled = false;
      dlg.close();
      showToast(ataIndex >= 0 ? 'Ata atualizada com sucesso.' : 'Ata cadastrada e vinculada ao processo gerador.');
      initCategoriaRegistroPrecoAtas(container);
    });
  }

  function initConversorItensEdital(container) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) throw new Error('Container inválido');

    let workbook = null;
    let rows = [];
    let txtContent = '';

    const esc = (value) => String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    function limparCelula(value) {
      return String(value ?? '')
        .replace(/\r?\n/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function normalizarLinhas(sheetRows) {
      const cleaned = sheetRows
        .map(row => row.map(limparCelula))
        .filter(row => row.some(cell => cell !== ''));

      const maxCols = cleaned.reduce((max, row) => Math.max(max, row.length), 0);
      return cleaned.map(row => {
        const out = row.slice();
        while (out.length < maxCols) out.push('');
        return out;
      });
    }

    function gerarTxt() {
      txtContent = rows.map(row => row.map(limparCelula).join('\t')).join('\r\n');
      const output = container.querySelector('#conv_itens_txt');
      if (output) output.value = txtContent;
    }

    function renderPreview() {
      gerarTxt();
      const preview = container.querySelector('#conv_itens_preview');
      const count = container.querySelector('#conv_itens_count');

      count.textContent = rows.length
        ? `${rows.length} linha(s) e ${rows[0]?.length || 0} coluna(s) detectadas.`
        : 'Nenhum dado carregado.';

      if (!rows.length) {
        preview.innerHTML = '<div class="empty">Importe uma planilha para visualizar os itens.</div>';
        return;
      }

      const sample = rows.slice(0, 30);
      preview.innerHTML = `
        <div style="overflow:auto;max-height:420px">
          <table>
            <tbody>
              ${sample.map((row, rowIndex) => `
                <tr>
                  ${row.map(cell => rowIndex === 0
                    ? `<th>${esc(cell)}</th>`
                    : `<td>${esc(cell)}</td>`
                  ).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${rows.length > sample.length ? `<div class="muted" style="margin-top:8px">Prévia limitada às primeiras ${sample.length} linhas.</div>` : ''}
      `;
    }

    function carregarAba(sheetName) {
      const sheet = workbook.Sheets[sheetName];
      const sheetRows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: ''
      });
      rows = normalizarLinhas(sheetRows);
      renderPreview();
    }

    container.innerHTML = `
      <section class="wrap">
        <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px">
          <div>
            <h2 style="margin:0 0 6px 0">Conversor de Itens</h2>
            <div class="muted">Converta tabelas XLS/XLSX/CSV em TXT tabulado para importar itens no sistema.</div>
          </div>
        </header>

        <div class="card" style="margin-bottom:12px">
          <div class="grid" style="align-items:end">
            <div class="field">
              <label>Arquivo da tabela</label>
              <input id="conv_itens_file" class="input" type="file" accept=".xls,.xlsx,.csv,.tsv">
            </div>
            <div class="field">
              <label>Aba</label>
              <select id="conv_itens_sheet" class="select" disabled>
                <option value="">-- selecione uma planilha --</option>
              </select>
            </div>
            <div class="field">
              <button id="conv_itens_download" class="btn primary" type="button" disabled>Exportar TXT</button>
            </div>
          </div>
          <div id="conv_itens_count" class="muted" style="margin-top:10px">Nenhum dado carregado.</div>
        </div>

        <div class="card" style="margin-bottom:12px">
          <h3 style="margin-top:0">Prévia da tabela</h3>
          <div id="conv_itens_preview">
            <div class="empty">Importe uma planilha para visualizar os itens.</div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-top:0">TXT gerado</h3>
          <textarea id="conv_itens_txt" class="input" rows="10" readonly></textarea>
        </div>
      </section>
    `;

    const fileInput = container.querySelector('#conv_itens_file');
    const sheetSelect = container.querySelector('#conv_itens_sheet');
    const downloadBtn = container.querySelector('#conv_itens_download');

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;

      if (typeof XLSX === 'undefined') {
        alert('Biblioteca XLSX não carregada. Verifique o arquivo js/xlsx.full.min.js.');
        return;
      }

      const buffer = await file.arrayBuffer();
      workbook = XLSX.read(buffer, { type: 'array' });

      sheetSelect.innerHTML = workbook.SheetNames
        .map(name => `<option value="${esc(name)}">${esc(name)}</option>`)
        .join('');
      sheetSelect.disabled = false;
      downloadBtn.disabled = false;

      carregarAba(workbook.SheetNames[0]);
    });

    sheetSelect.addEventListener('change', () => {
      if (workbook && sheetSelect.value) carregarAba(sheetSelect.value);
    });

    downloadBtn.addEventListener('click', () => {
      if (!txtContent) return alert('Nenhum TXT foi gerado.');

      const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'itens_convertidos.txt';
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  function initConversorItensAta(container) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) throw new Error('Container inválido');

    let workbook = null;
    let rows = [];
    let txtContent = '';

    const esc = (value) => String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    function limparCelula(value) {
      return String(value ?? '')
        .replace(/\r?\n/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function normalizarLinhas(sheetRows) {
      const cleaned = sheetRows
        .map(row => row.map(limparCelula))
        .filter(row => row.some(cell => cell !== ''));

      const maxCols = cleaned.reduce((max, row) => Math.max(max, row.length), 0);
      return cleaned.map(row => {
        const out = row.slice();
        while (out.length < maxCols) out.push('');
        return out;
      });
    }

    function gerarTxt() {
      txtContent = rows.map(row => row.map(limparCelula).join('\t')).join('\r\n');
      const output = container.querySelector('#conv_ata_txt');
      if (output) output.value = txtContent;
    }

    function renderPreview() {
      gerarTxt();
      const preview = container.querySelector('#conv_ata_preview');
      const count = container.querySelector('#conv_ata_count');

      count.textContent = rows.length
        ? `${rows.length} linha(s) e ${rows[0]?.length || 0} coluna(s) detectadas.`
        : 'Nenhum dado carregado.';

      if (!rows.length) {
        preview.innerHTML = '<div class="empty">Importe uma planilha para visualizar os itens da ata.</div>';
        return;
      }

      const sample = rows.slice(0, 30);
      preview.innerHTML = `
        <div style="overflow:auto;max-height:420px">
          <table>
            <tbody>
              ${sample.map((row, rowIndex) => `
                <tr>
                  ${row.map(cell => rowIndex === 0
                    ? `<th>${esc(cell)}</th>`
                    : `<td>${esc(cell)}</td>`
                  ).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${rows.length > sample.length ? `<div class="muted" style="margin-top:8px">Prévia limitada às primeiras ${sample.length} linhas.</div>` : ''}
      `;
    }

    function carregarAba(sheetName) {
      const sheet = workbook.Sheets[sheetName];
      const sheetRows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: ''
      });
      rows = normalizarLinhas(sheetRows);
      renderPreview();
    }

    container.innerHTML = `
      <section class="wrap">
        <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px">
          <div>
            <h2 style="margin:0 0 6px 0">Conversor de Itens da Ata</h2>
            <div class="muted">Converta tabelas XLS/XLSX/CSV em TXT tabulado para importar nos itens da ata de registro de preço.</div>
          </div>
        </header>

        <div class="card" style="margin-bottom:12px">
          <div class="grid" style="align-items:end">
            <div class="field">
              <label>Arquivo da tabela</label>
              <input id="conv_ata_file" class="input" type="file" accept=".xls,.xlsx,.csv,.tsv">
            </div>
            <div class="field">
              <label>Aba</label>
              <select id="conv_ata_sheet" class="select" disabled>
                <option value="">-- selecione uma planilha --</option>
              </select>
            </div>
            <div class="field">
              <button id="conv_ata_download" class="btn primary" type="button" disabled>Exportar TXT</button>
            </div>
          </div>
          <div id="conv_ata_count" class="muted" style="margin-top:10px">Nenhum dado carregado.</div>
        </div>

        <div class="card" style="margin-bottom:12px">
          <h3 style="margin-top:0">Prévia da tabela</h3>
          <div id="conv_ata_preview">
            <div class="empty">Importe uma planilha para visualizar os itens da ata.</div>
          </div>
        </div>

        <div class="card">
          <h3 style="margin-top:0">TXT gerado</h3>
          <textarea id="conv_ata_txt" class="input" rows="10" readonly></textarea>
        </div>
      </section>
    `;

    const fileInput = container.querySelector('#conv_ata_file');
    const sheetSelect = container.querySelector('#conv_ata_sheet');
    const downloadBtn = container.querySelector('#conv_ata_download');

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;

      if (typeof XLSX === 'undefined') {
        alert('Biblioteca XLSX não carregada. Verifique o arquivo js/xlsx.full.min.js.');
        return;
      }

      const buffer = await file.arrayBuffer();
      workbook = XLSX.read(buffer, { type: 'array' });

      sheetSelect.innerHTML = workbook.SheetNames
        .map(name => `<option value="${esc(name)}">${esc(name)}</option>`)
        .join('');
      sheetSelect.disabled = false;
      downloadBtn.disabled = false;

      carregarAba(workbook.SheetNames[0]);
    });

    sheetSelect.addEventListener('change', () => {
      if (workbook && sheetSelect.value) carregarAba(sheetSelect.value);
    });

    downloadBtn.addEventListener('click', () => {
      if (!txtContent) return alert('Nenhum TXT foi gerado.');

      const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'itens_ata_registro_preco.txt';
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  window.initLicitatorios = initLicitatorios;
  window.initCategoriaCredenciamento = initCategoriaCredenciamento;
  window.initCategoriaContratacoesPregoes = initCategoriaContratacoesPregoes;
  window.initCategoriaContratacoesConcorrencias = initCategoriaContratacoesConcorrencias;
  window.initCategoriaContratacoesDispensas = initCategoriaContratacoesDispensas;
  window.initCategoriaContratacoesInexigibilidades = initCategoriaContratacoesInexigibilidades;
  window.initCategoriaRegistroPrecoIrp = initCategoriaRegistroPrecoIrp;
  window.initCategoriaRegistroPrecoAdesoes = initCategoriaRegistroPrecoAdesoes;
  window.initCategoriaRegistroPrecoAtas = initCategoriaRegistroPrecoAtas;
  window.initConversorItensEdital = initConversorItensEdital;
  window.initConversorItensAta = initConversorItensAta;
  window.initFornecedores = initFornecedores;
})();
