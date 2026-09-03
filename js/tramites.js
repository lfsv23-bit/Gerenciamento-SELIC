// js/tramites.js (versão atualizada com Painel Compacto, filtros e indicadores filtrados)
// Mantive toda a lógica de entradas/histórico já existente e apenas adicionei o painel
(() => {
  const STORAGE_KEY = 'tramitesProcessos';
  const PROCESSOS_STORAGE_KEY = 'processosLicitatorios';
  let tramitesInternosCache = [];
  let processosCache = [];

  /* ---------- Utilitários ---------- */
  function loadData() {
    if (window.isSupabaseConfigured?.()) return Array.isArray(tramitesInternosCache) ? tramitesInternosCache : [];
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }
  async function saveData(items) {
    if (window.isSupabaseConfigured?.() && window.AppDatabase?.salvarTramitesInternos) {
      tramitesInternosCache = Array.isArray(items) ? items : [];
      try {
        await window.AppDatabase.salvarTramitesInternos(tramitesInternosCache);
      } catch (error) {
        console.error('[SUPABASE][tramites_internos][SAVE][ERRO]', error);
        alert('Não foi possível salvar os trâmites internos no Supabase.\n\nDetalhe: ' + (error?.message || error));
        throw error;
      }
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
  function carregarProcessosLicitatoriosLocal() {
    try { return JSON.parse(localStorage.getItem(PROCESSOS_STORAGE_KEY) || '[]'); }
    catch { return []; }
  }
  function carregarProcessosLicitatorios() {
    if (window.isSupabaseConfigured?.()) {
      return Array.isArray(processosCache) && processosCache.length
        ? processosCache
        : (Array.isArray(window.__processosLicitatoriosData) ? window.__processosLicitatoriosData : []);
    }
    return carregarProcessosLicitatoriosLocal();
  }
  async function carregarProcessosSupabaseParaTramites() {
    if (window.isSupabaseConfigured?.() && window.AppDatabase?.loadProcessosCompletos) {
      try {
        processosCache = await window.AppDatabase.loadProcessosCompletos();
        window.__processosLicitatoriosData = processosCache;
        return processosCache;
      } catch (error) {
        console.error('[SUPABASE][processos][SELECT][TRAMITES][ERRO]', error);
        alert('Não foi possível carregar os processos no Supabase.\n\nDetalhe: ' + (error?.message || error));
        processosCache = [];
        return [];
      }
    }
    processosCache = carregarProcessosLicitatoriosLocal();
    return processosCache;
  }
  async function carregarTramitesInternosSupabase() {
    if (window.isSupabaseConfigured?.() && window.AppDatabase?.listarTramitesInternos) {
      try {
        tramitesInternosCache = await window.AppDatabase.listarTramitesInternos();
        return tramitesInternosCache;
      } catch (error) {
        console.error('[SUPABASE][tramites_internos][SELECT][ERRO]', error);
        alert('Não foi possível carregar os trâmites internos no Supabase.\n\nDetalhe: ' + (error?.message || error));
        tramitesInternosCache = [];
        return [];
      }
    }
    tramitesInternosCache = loadData();
    return tramitesInternosCache;
  }
  function genId() {
    return String(Date.now()) + Math.floor(Math.random() * 1000);
  }
  function fmtDate(iso) {
    if (!iso) return '';
    if (String(iso).includes('-')) {
      const [y, m, d] = String(iso).split('-');
      return `${d}/${m}/${y}`;
    }
    return iso;
  }
  function diasNoSetor(dataEntrada) {
    if (!dataEntrada) return 0;
    const d1 = new Date(dataEntrada);
    const d2 = new Date();
    if (isNaN(d1)) return 0;
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
  }

  /* ---------- Módulo ---------- */
  async function initTramites(container, opcoes = {}) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) throw new Error('Container inválido para initTramites');

    /* ---------- UI (inserção) — agora com painel compacto e filtros ---------- */
    container.innerHTML = `
      <style>
        /* Painel compacto */
        .tra-panel { display:flex; align-items:center; gap:18px; padding:10px 0; margin-bottom:6px; }
        .tra-indicator { display:flex; flex-direction:column; align-items:flex-start; min-width:180px; }
        .tra-indicator .label { font-size:12px; color:var(--muted,#6b7280); }
        .tra-indicator .value { font-weight:700; font-size:18px; margin-top:4px; }

        .tra-filters { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }

        .btn-edit { background:#6b7280; border-color:#6b7280; color:#fff; }
        .btn-tramitar { background:#2563eb; border-color:#2563eb; color:#fff; }
        .btn-finalizar { background:#16a34a; border-color:#16a34a; color:#fff; }
        .btn-novaentrada { background:#ea580c; border-color:#ea580c; color:#fff; }

        /* status chips */
        .status { padding:4px 8px; border-radius:12px; font-size:12px; display:inline-block; }
        .status-aguardando { background:#fef3c7; color:#92400e; }
        .status-andamento { background:#dbeafe; color:#1e3a8a; }
        .status-concluido { background:#dcfce7; color:#065f46; }

        /* small responsive tweaks */
        @media (max-width:800px) {
          .tra-panel { flex-direction:column; align-items:flex-start; gap:8px; }
        }
      </style>

      <link rel="stylesheet" href="css/tramites-premium.css">
      <section class="wrap">
        <header style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div>
            <h2 style="margin:0 0 6px 0">${opcoes.titulo || 'Trâmites de Processos'}</h2>
            <div class="muted">${opcoes.subtitulo || 'Registre e acompanhe movimentações dos processos'}</div>
          </div>
          <div style="display:flex;gap:8px">
            <input id="tra_q" class="input" placeholder="buscar nº processo, objeto, motivo..." style="min-width:280px">
            <button id="tra_add" class="btn primary">Novo trâmite</button>
          </div>
        </header>

        <!-- Painel compacto -->
        <div class="tra-panel" style="border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:10px">
          <div style="display:flex;gap:18px;align-items:center;width:100%;flex-wrap:wrap">
            <div class="tra-indicator">
              <div class="label">📄 Pendentes</div>
              <div id="tra_ind_pendentes" class="value">0</div>
            </div>
            <div class="tra-indicator">
              <div class="label">⏱️ Acima do limite</div>
              <div id="tra_ind_acima" class="value">0</div>
            </div>

            <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
              <label style="font-size:12px;color:var(--muted);margin-right:6px">Limite dias</label>
              <select id="tra_limit_days" class="select">
                <option value="7">7 dias</option>
                <option value="15" selected>15 dias</option>
                <option value="20">20 dias</option>
                <option value="30">30 dias</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Filtros compactos -->
        <div class="tra-filters">
          <select id="tra_filter_status" class="select" style="min-width:160px">
            <option value="todos">Status: Todos</option>
            <option value="AGUARDANDO">AGUARDANDO</option>
            <option value="EM ANDAMENTO">EM ANDAMENTO</option>
            <option value="CONCLUÍDO">CONCLUÍDO</option>
          </select>

          <select id="tra_filter_tipo" class="select" style="min-width:160px">
            <option value="todos">Tipo: Todos</option>
            <option value="INTERNO">INTERNO</option>
            <option value="EXTERNO">EXTERNO</option>
          </select>

          <select id="tra_filter_setor" class="select" style="min-width:180px">
            <option value="todos">Setor: Todos</option>
            <option>COTAÇÃO</option>
            <option>CONTROLADORIA</option>
            <option>DESPACHO PARA SECRETARIA</option>
            <option>EDITAL</option>
            <option>GERAL</option>
            <option>IRP</option>
            <option>LICITAÇÃO</option>
            <option>PLANEJAMENTO</option>
            <option>PROCURADORIA</option>
            <option>PROTOCOLO</option>
          </select>

          <select id="tra_filter_motivo" class="select" style="min-width:220px">
            <option value="todos">Motivo: Todos</option>
            <option>AUTORIZAÇÃO DE CONSUMO DA ATA</option>
            <option>CADASTRO DE LICITAÇÃO</option>
            <option>COTAÇÃO</option>
            <option>CREDENCIAMENTO</option>
            <option>DESPACHO</option>
            <option>EDITAL E AGENDAMENTO DE SESSÃO</option>
            <option>ELABORAÇÃO DE ATA</option>
            <option>ELABORAÇÃO DE ETP/ TR</option>
            <option>EMISSÃO DE PLANILHA</option>
            <option>MANIFESTAÇÃO DE INTERESSE</option>
            <option>MINUTA DE EDITAL</option>
            <option>PARECER CONCLUSIVO</option>
            <option>PARECER INICIAL</option>
            <option>PROVIDÊNCIAS</option>
            <option>PUBLICAÇÃO</option>
            <option>RESERVA ORÇAMENTÁRIA</option>
          </select>

          <select id="tra_filter_responsavel" class="select" style="min-width:180px">
            <option value="todos">Responsável: Todos</option>
            <!-- preenchido dinamicamente -->
          </select>

          <div style="margin-left:auto;display:flex;gap:8px">
            <button id="filtro_pendentes" class="btn primary">Pendentes</button>
            <button id="filtro_concluidos" class="btn">Concluídos</button>
            <button id="filtro_todos" class="btn">Todos</button>
          </div>
        </div>

        <div class="card" style="margin-bottom:12px;overflow:auto">
          <div style="margin-bottom:6px;font-size:12px;color:var(--muted)">
            🟡 Aguardando • 🔵 Em Andamento • 🟢 Concluído
          </div>
          <table id="tra_tbl">
            <thead>
              <tr>
                <th>Nº PROCESSO</th>
                <th>ENTRADA</th>
                <th>DIAS NO SETOR</th>
                <th>MOTIVO</th>
                <th>SECRETARIA</th>
                <th>DATA ENTRADA</th>
                <th>OBJETO</th>
                <th>RESPONSÁVEL</th>
                <th>TIPO</th>
                <th>STATUS</th>
                <th>DESTINO</th>
                <th></th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
          <div id="tra_empty" class="empty">0–0 de 0</div>
        </div>
      </section>

      <!-- Modal de Busca -->
      <dialog id="tra_busca" style="width:520px">
        <div class="modal-head" style="display:flex;justify-content:space-between;align-items:center">
          <strong>Localizar Processo</strong>
          <button id="busca_close" class="btn ghost" type="button">Fechar</button>
        </div>
        <div class="modal-body">
          <input id="busca_input" class="input" placeholder="Digite Nº, objeto ou secretaria...">
          <div id="busca_lista" style="margin-top:12px;max-height:260px;overflow-y:auto;border:1px solid var(--line);border-radius:var(--radius);background:#fff"></div>
        </div>
      </dialog>

      <!-- Modal de Trâmite -->
      <dialog id="tra_dlg">
        <form id="tra_form" style="min-width:600px">
          <div class="modal-head" style="display:flex;justify-content:space-between;align-items:center">
            <strong id="tra_title">Novo trâmite</strong>
            <button id="tra_close" class="btn ghost" type="button">Fechar</button>
          </div>
          <div class="modal-body">
            <input type="hidden" id="tra_idx">
            <input type="hidden" id="tra_entrada">
            <div class="grid">
              <div class="field">
                <label>Nº PROCESSO</label>
                <input id="tra_numero" class="input" required readonly>
              </div>
              <div class="field">
                <label>SECRETARIA</label>
                <input id="tra_secretaria" class="input" readonly>
              </div>
              <div class="field">
                <label>ENTRADA</label>
                <input id="tra_entrada_display" class="input" readonly>
              </div>
              <div class="field" style="grid-column:1/-1">
                <label>OBJETO</label>
                <input id="tra_objeto" class="input" readonly>
              </div>
              <div class="field">
                <label>DATA DE ENTRADA</label>
                <input id="tra_dataEntrada" class="input" type="date" required>
              </div>

              <div class="field">
                <label>MOTIVO</label>
                <select id="tra_motivo" class="select">
                  <option value="">Selecione…</option>
                  <option>AUTORIZAÇÃO DE CONSUMO DA ATA</option>
                  <option>CADASTRO DE LICITAÇÃO</option>
                  <option>COTAÇÃO</option>
                  <option>CREDENCIAMENTO</option>
                  <option>DESPACHO</option>
                  <option>EDITAL E AGENDAMENTO DE SESSÃO</option>
                  <option>ELABORAÇÃO DE ATA</option>
                  <option>ELABORAÇÃO DE ETP/ TR</option>
                  <option>EMISSÃO DE PLANILHA</option>
                  <option>MANIFESTAÇÃO DE INTERESSE</option>
                  <option>MINUTA DE EDITAL</option>
                  <option>PARECER CONCLUSIVO</option>
                  <option>PARECER INICIAL</option>
                  <option>PROVIDÊNCIAS</option>
                  <option>PUBLICAÇÃO</option>
                  <option>RESERVA ORÇAMENTÁRIA</option>
                </select>
              </div>

              <div class="field">
                <label>RESPONSÁVEL</label>
                <input id="tra_responsavel" class="input">
              </div>

              <div class="field">
                <label>STATUS</label>
                <select id="tra_status" class="select">
                  <option>AGUARDANDO</option>
                  <option>EM ANDAMENTO</option>
                  <option>CONCLUÍDO</option>
                </select>
              </div>

              <div class="field">
                <label>TIPO DE TRÂMITE</label>
                <select id="tra_tipo_tramite" class="select">
                  <option value="INTERNO">INTERNO</option>
                  <option value="EXTERNO">EXTERNO</option>
                </select>
              </div>

              <div class="field">
                <label>DESTINO / SETOR</label>
                <select id="tra_destino" class="select">
                  <option value="">Selecione…</option>
                  <option>COTAÇÃO</option>
                  <option>CONTROLADORIA</option>
                  <option>DESPACHO PARA SECRETARIA</option>
                  <option>EDITAL</option>
                  <option>GERAL</option>
                  <option>IRP</option>
                  <option>LICITAÇÃO</option>
                  <option>PLANEJAMENTO</option>
                  <option>PROCURADORIA</option>
                  <option>PROTOCOLO</option>
                </select>
              </div>

              <div class="field" style="grid-column:1/-1">
                <label>OBSERVAÇÃO / PARECER</label>
                <textarea id="tra_obs" class="input" rows="2"></textarea>
              </div>
            </div>
          </div>
          <div class="modal-foot" style="display:flex;gap:8px;justify-content:flex-end;padding:12px;border-top:1px solid var(--line)">
            <button id="tra_delete" type="button" class="btn" style="background:var(--danger);border-color:var(--danger);color:#fff;display:none">Excluir</button>
            <button id="tra_cancel" type="button" class="btn">Cancelar</button>
            <button id="tra_save" type="button" class="btn primary">Salvar</button>
          </div>
        </form>
      </dialog>

      <!-- Modal de Detalhes do Processo + Trâmites -->
      <dialog id="tra_view" style="width:900px;max-width:95%;">
       <div class="modal-head" style="display:flex;justify-content:space-between;align-items:center">
  <strong>Detalhes do Processo</strong>

  <div style="display:flex;gap:8px">
    <button id="tra_view_relatorio" class="btn">Gerar Relatório</button>
    <button id="tra_view_close" class="btn ghost" type="button">Fechar</button>
  </div>
</div>

        <div class="modal-body" style="max-height:70vh;overflow-y:auto">
          <div id="tra_view_content"></div>
        </div>
      </dialog>
    `;

    /* ---------- Referências DOM ---------- */
    const tblBody = container.querySelector('#tra_tbl tbody');
    const qInput = container.querySelector('#tra_q');
    const addBtn = container.querySelector('#tra_add');

    // busca modal refs
    const dlgBusca = container.querySelector('#tra_busca');
    const buscaInput = container.querySelector('#busca_input');
    const buscaLista = container.querySelector('#busca_lista');
    const buscaCloseBtn = container.querySelector('#busca_close');

    // trâmite modal refs
    const dlgForm = container.querySelector('#tra_dlg');
    const form = container.querySelector('#tra_form');
    const fld = {
      idx: container.querySelector('#tra_idx'),
      entrada: container.querySelector('#tra_entrada'),
      entradaDisplay: container.querySelector('#tra_entrada_display'),
      numero: container.querySelector('#tra_numero'),
      secretaria: container.querySelector('#tra_secretaria'),
      objeto: container.querySelector('#tra_objeto'),
      dataEntrada: container.querySelector('#tra_dataEntrada'),
      motivo: container.querySelector('#tra_motivo'),
      responsavel: container.querySelector('#tra_responsavel'),
      status: container.querySelector('#tra_status'),
      tipoTramite: container.querySelector('#tra_tipo_tramite'),
      destino: container.querySelector('#tra_destino'),
      obs: container.querySelector('#tra_obs'),
      deleteBtn: container.querySelector('#tra_delete'),
      cancelBtn: container.querySelector('#tra_cancel'),
      saveBtn: container.querySelector('#tra_save'),
      closeBtn: container.querySelector('#tra_close')
    };

    // visualização modal refs
    const dlgView = container.querySelector('#tra_view');
    const viewCloseBtn = container.querySelector('#tra_view_close');
    const viewContent = container.querySelector('#tra_view_content');

    // painel & filtros refs
    const indPendentes = container.querySelector('#tra_ind_pendentes');
    const indAcima = container.querySelector('#tra_ind_acima');
    const selLimitDays = container.querySelector('#tra_limit_days');
    const selStatus = container.querySelector('#tra_filter_status');
    const selTipo = container.querySelector('#tra_filter_tipo');
    const selSetor = container.querySelector('#tra_filter_setor');
    const selMotivo = container.querySelector('#tra_filter_motivo');
    const selResponsavel = container.querySelector('#tra_filter_responsavel');

    const btnFiltroPendentes = container.querySelector('#filtro_pendentes');
    const btnFiltroConcluidos = container.querySelector('#filtro_concluidos');
    const btnFiltroTodos = container.querySelector('#filtro_todos');

    /* ---------- Estado ---------- */
    await carregarProcessosSupabaseParaTramites();
    let data = await carregarTramitesInternosSupabase();
    // 🔄 MIGRAÇÃO: preencher dataPrimeiraEntrada para registros antigos
(async function migrarDatasAntigas() {
  let alterou = false;

  // agrupar por número do processo
  const grupos = {};
  data.forEach(t => {
    const num = String(t.numero).trim().toLowerCase();
    if (!grupos[num]) grupos[num] = [];
    grupos[num].push(t);
  });

  Object.values(grupos).forEach(tramites => {
    // pegar somente ENTRADA 1
    const entrada1 = tramites.filter(t => Number(t.entrada || 1) === 1);

    if (!entrada1.length) return;

    // menor dataEntrada da entrada 1
    entrada1.sort((a, b) => new Date(a.dataEntrada) - new Date(b.dataEntrada));
    const dataPrimeira = entrada1[0].dataEntrada;

    tramites.forEach(t => {
      if (!t.dataPrimeiraEntrada) {
        t.dataPrimeiraEntrada = dataPrimeira;
        alterou = true;
      }
    });
  });

  if (alterou) {
    await saveData(data);
    console.log('✅ Migração concluída: dataPrimeiraEntrada preenchida');
  }
})();

    let filtered = data.slice();
    let filtroAtual = 'pendentes';
    // filtros adicionais
    let statusFilter = 'todos';
    let tipoFilter = opcoes.tipoInicial || 'todos';
    let setorFilter = 'todos';
    let motivoFilter = 'todos';
    let responsavelFilter = 'todos';
    let limitDays = Number(selLimitDays.value || 15);

    // ação atual do modal: 'new' | 'edit' | 'tramitar' | 'finalizar' | 'novaEntrada'
    let currentAction = 'new';

    const destinosInternos = [
      'COTAÇÃO',
      'EDITAL',
      'GERAL',
      'IRP',
      'LICITAÇÃO',
      'PLANEJAMENTO',
      'PROTOCOLO'
    ];

    const destinosExternos = [
      'CONTROLADORIA',
      'DESPACHO PARA SECRETARIA',
      'PROCURADORIA',
      'SECRETARIA DE SAÚDE',
      'SECRETARIA SOLICITANTE'
    ];

    function tipoTramiteTexto(value) {
      return String(value || 'INTERNO').toUpperCase() === 'EXTERNO' ? 'EXTERNO' : 'INTERNO';
    }

    function atualizarDestinosPorTipo(valorSelecionado = '') {
      const tipo = tipoTramiteTexto(fld.tipoTramite?.value);
      const destinos = tipo === 'EXTERNO' ? destinosExternos : destinosInternos;
      const valorAtual = valorSelecionado || fld.destino.value || '';
      fld.destino.innerHTML = '<option value="">Selecione…</option>' + destinos
        .map(destino => `<option>${destino}</option>`)
        .join('');

      if (valorAtual && !destinos.includes(valorAtual)) {
        const option = document.createElement('option');
        option.value = valorAtual;
        option.textContent = valorAtual;
        fld.destino.appendChild(option);
      }

      fld.destino.value = valorAtual;
    }

    /* ---------- Helpers para 'entrada' ---------- */
    function getAllByNumero(numero) {
      return data.filter(t => String(t.numero).trim().toLowerCase() === String(numero).trim().toLowerCase());
    }
    function getMaxEntrada(numero) {
      const list = getAllByNumero(numero);
      if (!list.length) return 0;
      return Math.max(...list.map(x => Number(x.entrada || 0)));
    }
    function getLatestForNumero(numero) {
      // pega o trâmite com maior entrada e, dentro dessa entrada, o mais recente (data)
      const list = getAllByNumero(numero);
      if (!list.length) return null;
      const maxEntrada = getMaxEntrada(numero);
      const sameEntrada = list.filter(x => Number(x.entrada || 0) === maxEntrada);
      // se houver empates, ordena por dataEntrada desc
      sameEntrada.sort((a,b) => new Date(b.dataEntrada) - new Date(a.dataEntrada));
      return sameEntrada[0];
    }

    /* ---------- Prevenir Enter enviar form ---------- */
    form.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        if (ev.target && ev.target.tagName && ev.target.tagName.toLowerCase() === 'textarea') return;
        ev.preventDefault();
      }
    });

    /* ---------- Função: abrir visualização (fora do render) ---------- */
    function openView(item) {
      if (!item || !item.numero) return;

      const numero = String(item.numero).trim().toLowerCase();

      // Buscar dados do processo licitatório
      const processos = carregarProcessosLicitatorios();
      const processo = processos.find(p => String(p.numero || '').trim().toLowerCase() === numero);

      // Trâmites do mesmo processo ordenados por entrada asc e dataEntrada asc
      const historico = data
  .filter(t => String(t.numero).trim().toLowerCase() === numero)
  .map((r,i)=>({ ...r, __ordem:i }))
  .sort((a,b) => {

 const ea = Number(a.entrada || 0), eb = Number(b.entrada || 0);
 if (ea !== eb) return ea - eb;

 const da = new Date(a.dataEntrada);
 const db = new Date(b.dataEntrada);

 if (da - db !== 0) return da - db;

 // 🔥 NOVO: usa ordem real de criação
 const oa = Number(a.ordemReal || 0);
 const ob = Number(b.ordemReal || 0);

 if (oa !== ob) return oa - ob;

 return a.__ordem - b.__ordem;
});



      // agrupar por entrada
      const blocos = {};
      historico.forEach(t => {
        const e = Number(t.entrada || 0) || 1;
        if (!blocos[e]) blocos[e] = [];
        blocos[e].push(t);
      });

      let html = '';

      html += `<h3 style="margin-top:8px">🔵 Dados do Processo Licitatório</h3>`;

      if (!processo) {
        html += `<div style="color:red;margin-top:6px">⚠ Processo não encontrado nos licitatórios.</div>`;
      } else {
        html += `
          <div class="card" style="padding:12px;margin-top:6px">
            <div><strong>N° Processo:</strong> ${processo.numero || '-'}</div>
            <div><strong>Secretaria:</strong> ${processo.secretaria || '-'}</div>
            <div style="margin-top:6px"><strong>Objeto:</strong><br>${processo.objeto || '-'}</div>
            <div style="margin-top:6px"><strong>Descrição Completa:</strong><div style="white-space:pre-wrap;margin-top:6px">${processo.descricaoCompleta || '-'}</div></div>
            <div style="margin-top:8px">
              <strong>IRP:</strong> ${processo.irp || '-'} &nbsp;|&nbsp;
              <strong>Modalidade:</strong> ${processo.modalidade || '-'} &nbsp;|&nbsp;
              <strong>Fase:</strong> ${processo.fase || '-'}
            </div>
            <div style="margin-top:8px">
              <strong>Situação:</strong> ${processo.situacao || '-'} &nbsp;|&nbsp;
              <strong>Valor Estimado:</strong> ${processo.valorEstimado != null ? 'R$ ' + Number(processo.valorEstimado).toLocaleString('pt-BR', {minimumFractionDigits:2}) : '-'}
            </div>
            <div style="margin-top:6px"><strong>Recurso:</strong> ${(processo.recurso || []).join(', ') || '-'}</div>
          </div>
        `;
      }

      html += `<h3 style="margin-top:18px">🟧 Histórico de Trâmites</h3>`;

      if (!Object.keys(blocos).length) {
        html += `<div class="empty" style="margin-top:6px">Nenhum trâmite encontrado.</div>`;
      } else {
        // order entradas ascending (1,2,3...)
        const entradas = Object.keys(blocos).map(Number).sort((a,b)=>a-b);
        entradas.forEach(e => {
          html += `<h4 style="margin-top:12px">📘 ENTRADA ${e}</h4>`;
          html += `<div class="card" style="padding:8px;margin-top:6px">`;
          blocos[e].forEach(t => {
            html += `
              <div style="padding:10px;border-bottom:1px solid var(--line)">
                <div><strong>Status:</strong> ${t.status || '-' } &nbsp; <small style="color:var(--muted)">(${fmtDate(t.dataEntrada)})</small></div>
                <div><strong>Motivo:</strong> ${t.motivo || '-'}</div>
                <div><strong>Responsável:</strong> ${t.responsavel || '-'}</div>
                <div style="margin-top:6px"><strong>Observação:</strong><div style="white-space:pre-wrap;margin-top:4px">${t.obs || '-'}</div></div>
              </div>
            `;
          });
          html += `</div>`;
        });
      }

      viewContent.innerHTML = html;
      dlgView.showModal();
      document.getElementById('tra_view_relatorio').onclick = () => gerarRelatorio(item);
    }

    function gerarRelatorio(item) {

      const numero = String(item.numero).trim().toLowerCase();

      // Buscar dados do processo licitatório
      const processos = carregarProcessosLicitatorios();
      const processo = processos.find(p => String(p.numero || '').trim().toLowerCase() === numero);

      // Histórico ordenado
      const historico = data
  .filter(t => String(t.numero).trim().toLowerCase() === numero)
  .map((r,i)=>({ ...r, __ordem:i }))
  .sort((a,b) => {

 const ea = Number(a.entrada || 0), eb = Number(b.entrada || 0);
 if (ea !== eb) return ea - eb;

 const da = new Date(a.dataEntrada);
 const db = new Date(b.dataEntrada);

 if (da - db !== 0) return da - db;

 // 🔥 NOVO: usa ordem real de criação
 const oa = Number(a.ordemReal || 0);
 const ob = Number(b.ordemReal || 0);

 if (oa !== ob) return oa - ob;

 return a.__ordem - b.__ordem;
});



      // Agrupar por entrada
      const blocos = {};
      historico.forEach(t => {
        const e = Number(t.entrada || 0) || 1;
        if (!blocos[e]) blocos[e] = [];
        blocos[e].push(t);
      });

      // -------------------------
      // GERAR HTML DO RELATÓRIO
      // -------------------------

      let html = `
      <html>
      <head>
        <title>Relatório do Processo ${item.numero}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1, h2, h3 { margin: 0 0 10px 0; }
          h1 { font-size: 26px; }
          h2 { margin-top: 25px; font-size: 20px; }
          .bloco {
            margin-top: 20px;
            padding: 15px;
            border: 1px solid #ccc;
            border-radius: 8px;
          }
          .registro {
            padding: 10px 0;
            border-bottom: 1px solid #e5e5e5;
          }
          .registro:last-child {
            border-bottom: none;
          }
          .label { font-weight: bold; }
          @media print {
            body { margin: 10px; }
          }
        </style>
      </head>
      <body>

        <h1>RELATÓRIO DO PROCESSO ${item.numero}</h1>

        <h2>Dados do Processo</h2>
        <div class="bloco">
          <div><span class="label">Número:</span> ${processo?.numero || '-'}</div>
          <div><span class="label">Secretaria:</span> ${processo?.secretaria || '-'}</div>
          <div><span class="label">Objeto:</span> ${processo?.objeto || '-'}</div>
        </div>

        <h2>Histórico de Trâmites</h2>
      `;

      const entradas = Object.keys(blocos).map(Number).sort((a,b) => a - b);

      entradas.forEach(e => {
        html += `
          <h3>ENTRADA ${e}</h3>
          <div class="bloco">
        `;

        blocos[e].forEach(t => {
          html += `
            <div class="registro">
              <div><span class="label">Data:</span> ${fmtDate(t.dataEntrada)}</div>
              <div><span class="label">Status:</span> ${t.status}</div>
              <div><span class="label">Motivo:</span> ${t.motivo || '-'}</div>
              <div><span class="label">Responsável:</span> ${t.responsavel || '-'}</div>
              <div style="margin-top:6px">
                <span class="label">Observação:</span><br>
                <div style="white-space: pre-wrap; margin-top:4px">${t.obs || '-'}</div>
              </div>
            </div>
          `;
        });

        html += `</div>`;
      });

      html += `
      </body>
      </html>
      `;

      // Abre nova janela com o relatório
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
    }

    /* ---------- Função: renderTable (agrupando por processo e usando entrada mais recente) ---------- */
    function renderTable() {
      tblBody.innerHTML = '';
      const q = (qInput.value || '').trim().toLowerCase();

      // Agrupa trâmites por número do processo
      const grupos = {};
      for (const t of data) {
        const num = String(t.numero).trim();
        if (!grupos[num]) grupos[num] = [];
        grupos[num].push(t);
      }

      // Para cada processo, pega o trâmite com maior entrada e dentro dela o mais recente
      const maisRecentes = Object.values(grupos).map(lista => {
        // determinar maior entrada
        const maxE = Math.max(...lista.map(x => Number(x.entrada || 0)));
        // pegar os da entrada max
        const sameE = lista.filter(x => Number(x.entrada || 0) === maxE);
        sameE.sort((a,b) => new Date(b.dataEntrada) - new Date(a.dataEntrada));
        return sameE[0];
      });

      // Aplica filtros (pendentes / concluídos) + novos filtros do painel
      filtered = maisRecentes.filter(r => {
        const status = (r.status || '').toUpperCase();

        // filtro por botão (pendentes / concluidos / todos)
        if (filtroAtual === 'pendentes' && status === 'CONCLUÍDO') return false;
        if (filtroAtual === 'concluidos' && status !== 'CONCLUÍDO') return false;

        // filtro por search
        if (q) {
          const text = `${r.numero||''} ${r.objeto||''} ${r.secretaria||''} ${r.motivo||''} ${r.responsavel||''} ${tipoTramiteTexto(r.tipoTramite)} ${r.destino||''}`.toLowerCase();
          if (!text.includes(q)) return false;
        }

        // filtro Status (select)
        if (statusFilter && statusFilter !== 'todos') {
          if (String(status).toUpperCase() !== String(statusFilter).toUpperCase()) return false;
        }

        // filtro Tipo de Trâmite
        if (tipoFilter && tipoFilter !== 'todos') {
          if (tipoTramiteTexto(r.tipoTramite) !== tipoFilter) return false;
        }

        // filtro Setor (destino)
        if (setorFilter && setorFilter !== 'todos') {
          if ((r.destino || '') !== setorFilter) return false;
        }

        // filtro Motivo
        if (motivoFilter && motivoFilter !== 'todos') {
          if ((r.motivo || '') !== motivoFilter) return false;
        }

        // filtro Responsável
        if (responsavelFilter && responsavelFilter !== 'todos') {
          if ((r.responsavel || '') !== responsavelFilter) return false;
        }

        return true;
      });

      // atualizar indicadores (INDICADORES FILTRADOS)
      const pendentesCount = filtered.reduce((acc, cur) => {
        const st = (cur.status || '').toUpperCase();
        if (st === 'AGUARDANDO' || st === 'EM ANDAMENTO') return acc + 1;
        return acc;
      }, 0);

      const acimaCount = filtered.reduce((acc, cur) => {
        const dias = diasNoSetor(cur.dataEntrada);
        if (dias >= limitDays) return acc + 1;
        return acc;
      }, 0);

      indPendentes.textContent = pendentesCount;
      indAcima.textContent = acimaCount;

      // Renderiza APENAS o trâmite mais recente de cada processo (da entrada atual)
      filtered.forEach((r) => {
        const status = (r.status || '').toString().toUpperCase();
        const statusColor =
          status === 'AGUARDANDO' ? 'status-aguardando' :
          status === 'EM ANDAMENTO' ? 'status-andamento' :
          status === 'CONCLUÍDO' ? 'status-concluido' : '';

        const entradaDisplay = Number(r.entrada || 0) || 1;

        // determinar se mostra o botão Nova Entrada: só se o último (maisRecentes) estiver CONCLUÍDO
        const showNovaEntrada = status === 'CONCLUÍDO';

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${r.numero || ''}</strong></td>
          <td>${entradaDisplay}</td>
          <td>${diasNoSetor(r.dataEntrada)}</td>
          <td>${r.motivo || ''}</td>
          <td>${r.secretaria || ''}</td>
          <td>${fmtDate(r.dataPrimeiraEntrada || r.dataEntrada) || ''}</td>
<td>${r.objeto || ''}</td>
          <td>${r.responsavel || ''}</td>
          <td>${tipoTramiteTexto(r.tipoTramite)}</td>
          <td><span class="status ${statusColor}">${r.status || ''}</span></td>
          <td>${r.destino || ''}</td>
          <td style="display:flex;gap:6px;align-items:center">
            <button class="btn btn-edit" data-edit="${r.id}">Editar</button>
            <button class="btn btn-tramitar" data-tramitar="${r.id}">Tramitar</button>
            <button class="btn btn-finalizar" data-finalizar="${r.id}">Finalizar</button>
            ${showNovaEntrada ? `<button class="btn btn-novaentrada" data-novaentrada="${r.numero}" title="Nova Entrada">Nova Entrada</button>` : ''}
          </td>
        `;
        tblBody.appendChild(tr);
      });

      container.querySelector('#tra_empty').textContent =
        `${filtered.length ? 1 : 0}–${filtered.length} de ${Object.keys(grupos).length}`;

      // vincula botões
      tblBody.querySelectorAll('[data-edit]').forEach(btn =>
        btn.onclick = (e) => { e.stopPropagation(); openEdit(btn.dataset.edit); }
      );

      tblBody.querySelectorAll('[data-tramitar]').forEach(btn =>
        btn.onclick = (e) => { e.stopPropagation(); openTramitar(btn.dataset.tramitar); }
      );

      tblBody.querySelectorAll('[data-finalizar]').forEach(btn =>
        btn.onclick = (e) => { e.stopPropagation(); openFinalizar(btn.dataset.finalizar); }
      );

      tblBody.querySelectorAll('[data-novaentrada]').forEach(btn =>
        btn.onclick = (e) => { e.stopPropagation(); openNovaEntrada(btn.dataset.novaentrada); }
      );

      // clique na linha abre o histórico (ignorando clique em botões)
      tblBody.querySelectorAll('tr').forEach((tr, index) => {
        const item = filtered[index];
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          openView(item);
        });
      });
    }

    /* ---------- Open/Edit/Busca handlers ---------- */
    function openEdit(id) {
      const item = data.find(x => String(x.id) === String(id));
      if (!item) return alert('Trâmite não encontrado.');

      currentAction = 'edit';
      populateFormWithItem(item);
      container.querySelector('#tra_title').textContent = `Editar ${item.numero || ''}`;
      fld.deleteBtn.style.display = 'inline-flex';
      fld.idx.value = item.id || '';
      fld.status.disabled = false; // permitir editar status
      dlgForm.showModal();
    }

    function openBusca() {
      currentAction = 'new';
      buscaInput.value = '';
      buscaLista.innerHTML = '';
      dlgBusca.showModal();
      setTimeout(() => buscaInput.focus(), 60);
    }

    function renderResultados(query) {
      const processos = carregarProcessosLicitatorios();
      const q = (query || '').trim().toLowerCase();
      const results = processos.filter(p => {
        const text = `${p.numero || ''} ${p.objeto || ''} ${p.secretaria || ''}`.toLowerCase();
        return text.includes(q);
      });

      if (!results.length) {
        buscaLista.innerHTML = `<div style="padding:10px;color:var(--muted)">Nenhum processo encontrado</div>`;
        return;
      }

      buscaLista.innerHTML = results.map(p => `
        <div class="busca-item" data-num="${p.numero}" style="padding:8px 10px;border-bottom:1px solid var(--line);cursor:pointer">
          <strong>${p.numero}</strong><br>
          <span class="muted">${(p.objeto || '').slice(0,120)}</span><br>
          <small>${p.secretaria || ''}</small>
        </div>
      `).join('');

      buscaLista.querySelectorAll('.busca-item').forEach(div => {
        div.onclick = () => selecionarProcesso(div.dataset.num);
      });
    }

    function selecionarProcesso(numero) {
      const proc = window.getProcessoLicitatorioPorNumero?.(numero);
      if (!proc) {
        alert('⚠️ Este processo ainda não foi cadastrado em Processos Licitatórios.');
        dlgBusca.close();
        return;
      }
      dlgBusca.close();
      abrirFormularioComProcesso(proc);
    }

    function abrirFormularioComProcesso(proc) {
      // Abrir novo trâmite dentro da entrada atual (se houver) OU entrada=1
      currentAction = 'new';
      clearForm();
      fld.idx.value = '';
      fld.numero.value = proc.numero || '';
      fld.secretaria.value = proc.secretaria || '';
      fld.objeto.value = proc.objeto || '';

      // determinar entrada atual: se existe, usar max entrada; se não, 1
      const maxEntrada = getMaxEntrada(proc.numero);
      const entradaParaUsar = maxEntrada > 0 ? maxEntrada : 1;
      fld.entrada.value = entradaParaUsar;
      fld.entradaDisplay.value = entradaParaUsar;

      fld.dataEntrada.value = new Date().toISOString().slice(0, 10);
      fld.deleteBtn.style.display = 'none';
      container.querySelector('#tra_title').textContent = `Novo trâmite – ${proc.numero || ''}`;
      fld.status.disabled = false;
      dlgForm.showModal();
      setTimeout(() => fld.motivo.focus(), 60);
    }

    function openTramitar(id) {
      // TRAMITAR = cria NOVO trâmite (mantém histórico) DENTRO DA MESMA entrada (ciclo atual).
      const item = data.find(x => String(x.id) === String(id));
      if (!item) return alert('Trâmite não encontrado.');

      currentAction = 'tramitar';
      // preenche com dados do item, mas força idx vazio para criar novo registro
      populateFormWithItem(item);
      // determinar entrada atual (maior entrada)
      const maxEntrada = getMaxEntrada(item.numero);
      fld.entrada.value = maxEntrada || (item.entrada || 1);
      fld.entradaDisplay.value = fld.entrada.value;
      fld.idx.value = ''; // garante criação de novo registro
      container.querySelector('#tra_title').textContent = `Tramitar – ${item.numero || ''}`;
      fld.deleteBtn.style.display = 'none';
      fld.status.disabled = false; // usuário escolhe manualmente
      dlgForm.showModal();
      setTimeout(() => fld.motivo.focus(), 60);
    }

    function openFinalizar(id) {
      // FINALIZAR = cria NOVO trâmite com status CONCLUÍDO (travado) dentro da entrada atual
      const item = data.find(x => String(x.id) === String(id));
      if (!item) return alert('Trâmite não encontrado.');

      currentAction = 'finalizar';
      populateFormWithItem(item);
      // entrada atual
      const maxEntrada = getMaxEntrada(item.numero);
      fld.entrada.value = maxEntrada || (item.entrada || 1);
      fld.entradaDisplay.value = fld.entrada.value;
      fld.idx.value = ''; // garantir criação de novo registro
      container.querySelector('#tra_title').textContent = `Finalizar – ${item.numero || ''}`;
      fld.deleteBtn.style.display = 'none';
      fld.status.value = 'CONCLUÍDO';
      fld.status.disabled = true;
      dlgForm.showModal();
      setTimeout(() => fld.obs.focus(), 60);
    }

    function openNovaEntrada(numero) {
      // cria nova entrada somente se último trâmite estiver CONCLUÍDO (botão somente aparece nessas condições)
      const latest = getLatestForNumero(numero);
      if (!latest) return alert('Processo não encontrado.');
      if (String(latest.status || '').toUpperCase() !== 'CONCLUÍDO') {
        return alert('Só é possível criar nova entrada quando o processo estiver finalizado.');
      }

      const maxEntrada = getMaxEntrada(numero);
      const novaEntrada = maxEntrada + 1;

      // criar um registro base (mas não salvar ainda: o salvamento acontece no onSave quando o usuário clicar salvar)
      currentAction = 'novaEntrada';
      clearForm();
      fld.idx.value = ''; // garantir novo
      fld.numero.value = latest.numero || numero;
      fld.secretaria.value = latest.secretaria || '';
      fld.objeto.value = latest.objeto || '';
      fld.entrada.value = novaEntrada;
      fld.entradaDisplay.value = novaEntrada;
      fld.dataEntrada.value = new Date().toISOString().slice(0, 10);
      fld.deleteBtn.style.display = 'none';
      container.querySelector('#tra_title').textContent = `Nova Entrada ${novaEntrada} – ${numero}`;
      // status livre (o usuário pode escolher), default AGUARDANDO
      fld.status.disabled = false;
      fld.status.value = 'AGUARDANDO';
      dlgForm.showModal();
      setTimeout(() => fld.motivo.focus(), 60);
    }

    function clearForm() {
      form.reset();
      fld.idx.value = '';
      fld.entrada.value = '';
      fld.entradaDisplay.value = '';
      fld.numero.value = '';
      fld.secretaria.value = '';
      fld.objeto.value = '';
      fld.dataEntrada.value = '';
      fld.motivo.value = '';
      fld.responsavel.value = '';
      fld.status.value = 'AGUARDANDO';
      fld.tipoTramite.value = 'INTERNO';
      atualizarDestinosPorTipo();
      fld.destino.value = '';
      fld.obs.value = '';
      fld.deleteBtn.style.display = 'none';
      fld.status.disabled = false;
      currentAction = 'new';
    }

    function populateFormWithItem(item) {
      form.reset();
      fld.idx.value = item.id || '';
      fld.entrada.value = Number(item.entrada || 0) || 1;
      fld.entradaDisplay.value = fld.entrada.value;
      fld.numero.value = item.numero || '';
      fld.secretaria.value = item.secretaria || '';
      fld.objeto.value = item.objeto || '';
      fld.dataEntrada.value = item.dataEntrada && item.dataEntrada.includes('-') ? item.dataEntrada.slice(0,10) : item.dataEntrada;
      fld.motivo.value = item.motivo || '';
      fld.responsavel.value = item.responsavel || '';
      fld.status.value = item.status || 'AGUARDANDO';
      fld.tipoTramite.value = tipoTramiteTexto(item.tipoTramite);
      atualizarDestinosPorTipo(item.destino || '');
      fld.destino.value = item.destino || '';
      fld.obs.value = item.obs || '';
      fld.deleteBtn.style.display = 'none';
      fld.status.disabled = false;
    }

    /* ---------- Modais: fechar / cancelar (sem salvar) ---------- */
    buscaCloseBtn.addEventListener('click', () => dlgBusca.close());
    fld.closeBtn.addEventListener('click', () => {
      dlgForm.close();
      // reset status disabled state
      fld.status.disabled = false;
      currentAction = 'new';
    });
    fld.cancelBtn.addEventListener('click', () => {
      dlgForm.close();
      fld.status.disabled = false;
      currentAction = 'new';
    });

    dlgForm.addEventListener('cancel', (e) => { e.preventDefault(); dlgForm.close(); fld.status.disabled = false; currentAction = 'new'; });
    dlgBusca.addEventListener('cancel', (e) => { e.preventDefault(); dlgBusca.close(); });

    viewCloseBtn.addEventListener('click', () => dlgView.close());
    dlgView.addEventListener('cancel', e => { e.preventDefault(); dlgView.close(); });

    /* ---------- Eventos UI ---------- */
    addBtn.addEventListener('click', openBusca);
    buscaInput.addEventListener('input', (e) => renderResultados(e.target.value));
    qInput.addEventListener('input', () => renderTable());

    fld.saveBtn.addEventListener('click', async (ev) => { if (typeof onSave === 'function') await onSave(ev); });
    fld.deleteBtn.addEventListener('click', async (ev) => { if (typeof onDelete === 'function') await onDelete(ev); });

    // Filtros de status (botões rápidos)
    btnFiltroPendentes.addEventListener('click', () => { filtroAtual = 'pendentes'; renderTable(); });
    btnFiltroConcluidos.addEventListener('click', () => { filtroAtual = 'concluidos'; renderTable(); });
    btnFiltroTodos.addEventListener('click', () => { filtroAtual = 'todos'; renderTable(); });

    // selects do painel
    selLimitDays.addEventListener('change', (e) => {
      limitDays = Number(e.target.value || 15);
      renderTable();
    });

    selStatus.addEventListener('change', (e) => {
      statusFilter = e.target.value || 'todos';
      renderTable();
    });
    selTipo.addEventListener('change', (e) => {
      tipoFilter = e.target.value || 'todos';
      renderTable();
    });
    selSetor.addEventListener('change', (e) => {
      setorFilter = e.target.value || 'todos';
      renderTable();
    });
    selMotivo.addEventListener('change', (e) => {
      motivoFilter = e.target.value || 'todos';
      renderTable();
    });
    selResponsavel.addEventListener('change', (e) => {
      responsavelFilter = e.target.value || 'todos';
      renderTable();
    });
    fld.tipoTramite.addEventListener('change', () => {
      atualizarDestinosPorTipo();
    });

    /* ---------- Inicial render ---------- */
    // popular select Responsável com valores únicos de data
    function populateResponsavelOptions() {
      const nomes = Array.from(new Set((data || []).map(x => (x.responsavel || '').trim()).filter(s => s)));
      // limpar existentes (exceto a opção "todos")
      selResponsavel.querySelectorAll('option:not([value="todos"])').forEach(o => o.remove());
      nomes.sort((a,b) => a.localeCompare(b, 'pt-BR'));
      nomes.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n;
        opt.textContent = n;
        selResponsavel.appendChild(opt);
      });
    }

    populateResponsavelOptions();
    if (selTipo && tipoFilter !== 'todos') selTipo.value = tipoFilter;
    renderTable();

    /* ---------- Save / Delete / Toast ---------- */
    async function onSave(ev) {
      ev?.preventDefault?.();

      // coleta valores do formulário (sempre usar os campos atuais)
      const item = {
        id: fld.idx.value || genId(),
        entrada: Number(fld.entrada.value || 0) || 1,
        numero: fld.numero.value.trim(),
        secretaria: fld.secretaria.value.trim(),
        objeto: fld.objeto.value.trim(),
        dataEntrada: fld.dataEntrada.value.trim(),
        motivo: fld.motivo.value.trim(),
        responsavel: fld.responsavel.value.trim(),
        status: fld.status.value.trim(),
        tipoTramite: tipoTramiteTexto(fld.tipoTramite.value),
        destino: fld.destino.value.trim(),
        obs: fld.obs.value.trim()
      };

      // validações básicas
      if (!item.numero) return alert('Número do processo é obrigatório.');
      if (!item.dataEntrada) return alert('Data de entrada é obrigatória.');

      // garante que existe no módulo licitatório
      const proc = window.getProcessoLicitatorioPorNumero?.(item.numero);
      if (!proc) {
        alert('⚠️ Processo não encontrado nos Processos Licitatórios.');
        return;
      }

      // ao criar novo trâmite (currentAction !== 'edit') verificar regra de "não permitir novo trâmite se já existe AGUARDANDO/EM ANDAMENTO"
      const tramitesMesmoNumero = data.filter(t =>
        String(t.numero).trim().toLowerCase() === String(item.numero).trim().toLowerCase()
      );

      const existePendente = tramitesMesmoNumero.some(t =>
        String(t.status).toUpperCase() === 'AGUARDANDO' ||
        String(t.status).toUpperCase() === 'EM ANDAMENTO'
      );

      // Regra:
      // - Se estamos criando um novo trâmite via NEW (botão 'Novo trâmite') e já existe pendente/andamento no ciclo atual, bloquear.
      // - Se currentAction é 'tramitar' ou 'finalizar' ou 'novaEntrada' então NÃO bloqueamos (porque isso é continuidade ou abertura de novo ciclo).
      // ← Bloqueio somente se for "Novo trâmite" manual (botão Novo trâmite)
      if (currentAction === 'new' && !fld.idx.value) {

        // se estiver criando uma "Nova Entrada", NÃO bloquear
        if (fld.entrada.value > getMaxEntrada(item.numero)) {
            // isto é uma Nova Entrada → permitido
        } else {
            // verificar se existe trâmite pendente na entrada atual
            const maxEntrada = getMaxEntrada(item.numero);
            const tramitesMesmoNumero = data.filter(t =>
                String(t.numero).trim().toLowerCase() === String(item.numero).trim().toLowerCase()
            );
            const tramitesNaEntradaAtual = tramitesMesmoNumero.filter(
                t => Number(t.entrada || 0) === (maxEntrada || 1)
            );
            const existePendenteNaEntradaAtual = tramitesNaEntradaAtual.some(t =>
                String(t.status).toUpperCase() === 'AGUARDANDO' ||
                String(t.status).toUpperCase() === 'EM ANDAMENTO'
            );

            if (existePendenteNaEntradaAtual) {
                alert(`⚠️ Já existe um trâmite em andamento ou aguardando para o processo ${item.numero} na entrada atual.\nConclua o trâmite atual antes de abrir um novo.`);
                return;
            }
        }
      }

      if (currentAction === 'edit') {
        // editar registro existente
        const idx = data.findIndex(x => String(x.id) === String(item.id));
        if (idx >= 0) {
          data[idx] = item;
        } else {
          alert('Registro para edição não encontrado.');
          return;
        }
      } else {
        // criar novo registro (tramitar, finalizar, novaEntrada ou novo)
        // garantir id novo
        item.id = genId();
        // gerar ordem real sequencial
item.ordemReal = Date.now(); 

data.unshift(item);


        // incrementar contador no processo licitatório
        proc.qtdEntradas = Number(proc.qtdEntradas || 0);
        // atualizar qtdEntradas se nova entrada maior que registrada
        const maxEntradaGlobal = getMaxEntrada(proc.numero);
        if (item.entrada > proc.qtdEntradas) {
          proc.qtdEntradas = item.entrada;
        } else {
          // keep existing
        }
        const all = carregarProcessosLicitatorios();
        const idx = all.findIndex(x => x.numero === proc.numero);
        if (idx >= 0) {
          all[idx].qtdEntradas = proc.qtdEntradas;
          processosCache = all;
          window.__processosLicitatoriosData = all;
          if (window.isSupabaseConfigured?.() && window.AppDatabase?.saveProcessoCompleto) {
            await window.AppDatabase.saveProcessoCompleto(all[idx]);
          } else {
            localStorage.setItem('processosLicitatorios', JSON.stringify(all));
          }
        }
        // acionar reload se existir
        window.reloadProcessosLicitatorios?.();
      }

      // 🔐 Garantir data da PRIMEIRA entrada (não muda nunca)
const tramitesDoProcesso = data.filter(t =>
  String(t.numero).trim().toLowerCase() === String(item.numero).trim().toLowerCase()
);

// Se for o PRIMEIRO trâmite da ENTRADA 1
if (item.entrada === 1 && tramitesDoProcesso.length === 0) {
  item.dataPrimeiraEntrada = item.dataEntrada;
} else {
  // herda do primeiro registro do processo
  const primeiro = tramitesDoProcesso.find(t => t.dataPrimeiraEntrada);
  item.dataPrimeiraEntrada = primeiro?.dataPrimeiraEntrada || item.dataEntrada;
}

      // salvar e atualizar UI
      await saveData(data);
      populateResponsavelOptions();
      renderTable();
      dlgForm.close();
      fld.status.disabled = false;
      showToast(currentAction === 'finalizar' ? 'Trâmite finalizado com sucesso!' : 'Trâmite salvo com sucesso!');

      // resetar action
      currentAction = 'new';
    }

    async function onDelete() {
      const id = fld.idx.value;
      if (!id) return;
      if (!confirm('Excluir este trâmite?')) return;
      data = data.filter(x => String(x.id) !== String(id));
      await saveData(data);
      populateResponsavelOptions();
      renderTable();
      dlgForm.close();
      fld.status.disabled = false;
      showToast('Trâmite excluído.');
      currentAction = 'new';
    }

    function showToast(msg, ttl = 2200) {
      const wrap = document.getElementById('toasts') || (() => {
        const w = document.createElement('div');
        w.id = 'toasts';
        w.style.position = 'fixed';
        w.style.bottom = '12px';
        w.style.right = '12px';
        w.style.zIndex = '9999';
        document.body.appendChild(w);
        return w;
      })();

      const el = document.createElement('div');
      el.textContent = msg;
      el.className = 'toast';
      el.style.background = 'var(--primary,#2563eb)';
      el.style.color = '#fff';
      el.style.padding = '10px 14px';
      el.style.borderRadius = '8px';
      el.style.marginTop = '8px';
      el.style.boxShadow = '0 4px 14px rgba(0,0,0,0.15)';
      el.style.opacity = '1';
      el.style.transition = 'opacity .3s';

      wrap.appendChild(el);

      setTimeout(() => el.style.opacity = '0', ttl - 300);
      setTimeout(() => el.remove(), ttl);
    }

    // finalizar initTramites
  }

  function initTramitesInterno(container) {
    return initTramites(container, {
      titulo: 'Trâmites Internos',
      subtitulo: 'Acompanhe os trâmites realizados dentro do setor.',
      tipoInicial: 'INTERNO'
    });
  }

  async function initTramitesGeral(container) {
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) throw new Error('Container inválido para initTramitesGeral');

    const TRAMITES_GERAIS_KEY = 'tramitesGeraisImportados';
    const secretariasPadrao = [
      "AMHARC", "AGETRAT", "FUPHAN", "FMAP", "FUNPREV", "SISP", "SEMED", "SEPRAD", "SMSPDS",
      "PROCON", "FCC", "FUNEC", "FUNDTUR", "SMASC", "SMDES", "SEGES", "SMS", "SELIC"
    ];
    let secretarias = secretariasPadrao.slice();

    if (window.AppDatabase?.listarSecretarias && window.isSupabaseConfigured?.()) {
      try {
        const rows = await window.AppDatabase.listarSecretarias();
        const siglas = rows.map(item => String(item.sigla || '').trim().toUpperCase()).filter(Boolean);
        if (siglas.length) secretarias = siglas;
      } catch (error) {
        console.error('[SUPABASE][secretarias][SELECT][ERRO]', error);
      }
    }

    const esc = (value) => String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    const normalizar = (value) => String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

    let processosGeraisCache = [];
    let tramitesGeraisCache = {};

    async function carregarDadosGeraisSupabase() {
      if (window.isSupabaseConfigured?.() && window.AppDatabase?.loadProcessosCompletos) {
        processosGeraisCache = await window.AppDatabase.loadProcessosCompletos();
      } else {
        processosGeraisCache = carregarProcessosLicitatoriosLocal();
      }

      if (window.isSupabaseConfigured?.() && window.AppDatabase?.listarTramitesGerais) {
        tramitesGeraisCache = await window.AppDatabase.listarTramitesGerais();
      } else {
        tramitesGeraisCache = carregarTramitesGeraisLocal();
      }
    }

    function carregarProcessos() {
      if (window.isSupabaseConfigured?.()) return processosGeraisCache;
      return carregarProcessosLicitatoriosLocal();
    }

    function carregarTramitesGeraisLocal() {
      try { return JSON.parse(localStorage.getItem(TRAMITES_GERAIS_KEY) || '{}'); }
      catch { return {}; }
    }

    function carregarTramitesGerais() {
      if (window.isSupabaseConfigured?.()) return tramitesGeraisCache || {};
      return carregarTramitesGeraisLocal();
    }

    async function salvarTramitesGerais(data) {
      if (window.isSupabaseConfigured?.() && window.AppDatabase?.saveTramitesGerais) {
        tramitesGeraisCache = data || {};
        for (const [numero, registro] of Object.entries(tramitesGeraisCache)) {
          const tramites = Array.isArray(registro) ? registro : (registro?.tramites || []);
          await window.AppDatabase.saveTramitesGerais(numero, tramites);
        }
        return;
      }
      localStorage.setItem(TRAMITES_GERAIS_KEY, JSON.stringify(data || {}));
    }

    function limparTexto(value) {
      return String(value || '')
        .replace(/\r/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    function numeroProcesso(valor, ano) {
      const n = String(valor || '').replace(/\D/g, '').replace(/^0+/, '') || '0';
      return `${n}/${String(ano || '').trim()}`;
    }

    function trechoEntre(texto, inicio, fim) {
      const re = new RegExp(`${inicio}\\s*([\\s\\S]*?)(?=${fim}|$)`, 'i');
      return limparTexto((texto.match(re) || [])[1] || '');
    }

    function parseTramitesTxt(texto) {
      const resultado = {};
      const blocos = String(texto || '')
        .split(/(?=NÚMERO:\s*0*\d+\s*\/\s*\d{4})/i)
        .filter(bloco => /NÚMERO:\s*0*\d+\s*\/\s*\d{4}/i.test(bloco));

      blocos.forEach(bloco => {
        const numMatch = bloco.match(/NÚMERO:\s*0*(\d+)\s*\/\s*(\d{4})/i);
        if (!numMatch) return;
        const numero = numeroProcesso(numMatch[1], numMatch[2]);
        if (!resultado[numero]) resultado[numero] = [];

        const regexItens = /ITEM:\s*(\d+)([\s\S]*?)(?=ITEM:\s*\d+|PREFEITURA MUNICIPAL DE CORUMBÁ|FICHA DO PROTOCOLO\s*\/\s*PROCESSO|$)/gi;
        let itemMatch;
        while ((itemMatch = regexItens.exec(bloco)) !== null) {
          const trecho = itemMatch[0];
          const item = itemMatch[1];
          const data = (trecho.match(/DATA TRAM\.\s*:\s*(\d{2}\/\d{2}\/\d{4})/i) || [])[1] || '';
          const hora = (trecho.match(/HORA TRAM\.\s*:\s*([0-9:]+)/i) || [])[1] || '';
          const recebido = (trecho.match(/RECEBIDO\s*:\s*(\d+)/i) || [])[1] || '';
          const origem = trechoEntre(trecho, 'SETOR ANTERIOR:', 'SETOR ATUAL:|SETOR DESTINO:|RELATOR:|PARECER:|DESCRIÇÃO DO PARACER:|ITEM:');
          const atual = trechoEntre(trecho, 'SETOR ATUAL:', 'SETOR DESTINO:|RELATOR:|PARECER:|DESCRIÇÃO DO PARACER:|ITEM:');
          const destino = trechoEntre(trecho, 'SETOR DESTINO:', 'RELATOR:|PARECER:|DESCRIÇÃO DO PARACER:|ITEM:');
          const relator = trechoEntre(trecho, 'RELATOR:', 'PARECER:|DESCRIÇÃO DO PARACER:|ITEM:');
          let parecer = trechoEntre(trecho, 'PARECER:', 'DESCRIÇÃO DO PARACER:|ITEM:');
          let descricao = trechoEntre(trecho, 'DESCRIÇÃO DO PARACER:', 'SETOR ATUAL:|PARECER:|ITEM:');

          if (recebido === '0' && !parecer && descricao) parecer = 'ENCAMINHAMENTO';
          if (recebido === '0' && !descricao && parecer) descricao = parecer;

          resultado[numero].push({
            item,
            data,
            hora,
            recebido,
            origem,
            atual,
            destino,
            relator,
            parecer: limparTexto(parecer) || 'SEM PARECER',
            descricao: limparTexto(descricao)
          });
        }
      });

      Object.keys(resultado).forEach(numero => {
        const porItem = new Map();
        resultado[numero].forEach(t => porItem.set(String(t.item), t));
        resultado[numero] = Array.from(porItem.values())
          .sort((a, b) => (Number(a.item) || 0) - (Number(b.item) || 0));
      });

      return resultado;
    }

    function ultimoTramite(numero) {
      const registro = carregarTramitesGerais()[numero];
      const tramites = Array.isArray(registro) ? registro : (registro?.tramites || []);
      if (!tramites.length) return null;
      return [...tramites].sort((a, b) => (Number(a.item) || 0) - (Number(b.item) || 0)).at(-1);
    }

    function tramitesDoProcesso(numero) {
      const registro = carregarTramitesGerais()[numero];
      const tramites = Array.isArray(registro) ? registro : (registro?.tramites || []);
      return [...tramites].sort((a, b) => (Number(a.item) || 0) - (Number(b.item) || 0));
    }

    async function importarTramites(files) {
      const processos = carregarProcessos();
      const numerosCadastrados = new Set(processos.map(p => String(p.numero || '').trim()));
      const store = carregarTramitesGerais();
      const atualizados = new Set();
      const ignorados = new Set();
      let tramitesImportados = 0;

      for (const file of Array.from(files || [])) {
        const texto = await file.text();
        const parsed = parseTramitesTxt(texto);

        Object.entries(parsed).forEach(([numero, tramites]) => {
          if (!numerosCadastrados.has(numero)) {
            ignorados.add(numero);
            return;
          }

          const atuais = tramitesDoProcesso(numero);
          const porItem = new Map(atuais.map(t => [String(t.item), t]));
          tramites.forEach(t => porItem.set(String(t.item), t));
          const unidos = Array.from(porItem.values())
            .sort((a, b) => (Number(a.item) || 0) - (Number(b.item) || 0));
          store[numero] = { atualizadoEm: new Date().toISOString(), tramites: unidos };
          atualizados.add(numero);
          tramitesImportados += tramites.length;
        });
      }

      await salvarTramitesGerais(store);
      render();

      let msg = `${atualizados.size} processo(s) atualizado(s).\n${tramitesImportados} trâmite(s) lido(s) do TXT.`;
      if (ignorados.size) msg += `\n\nProcesso(s) ignorado(s), pois não estão cadastrados:\n${Array.from(ignorados).join(', ')}`;
      alert(msg);
    }

    function abrirModalTramites(numero) {
      const proc = carregarProcessos().find(p => String(p.numero || '') === String(numero || ''));
      const tramites = tramitesDoProcesso(numero);
      const dlg = container.querySelector('#tra_geral_modal');
      const title = container.querySelector('#tra_geral_modal_title');
      const body = container.querySelector('#tra_geral_modal_body');
      const search = container.querySelector('#tra_geral_modal_q');
      const de = container.querySelector('#tra_geral_modal_de');
      const ate = container.querySelector('#tra_geral_modal_ate');

      title.textContent = `Processo ${numero}`;
      search.value = '';
      de.value = '';
      ate.value = '';

      function dataParaISO(data) {
        const partes = String(data || '').split('/');
        if (partes.length !== 3) return '';
        return `${partes[2]}-${partes[1]}-${partes[0]}`;
      }

      function renderModal() {
        const termo = normalizar(search.value);
        const dataDe = de.value;
        const dataAte = ate.value;
        const filtrados = tramites.filter(t => {
          const texto = normalizar(`${t.item} ${t.data} ${t.hora} ${t.origem} ${t.atual} ${t.relator} ${t.parecer} ${t.descricao}`);
          if (termo && !texto.includes(termo)) return false;
          const iso = dataParaISO(t.data);
          if (dataDe && (!iso || iso < dataDe)) return false;
          if (dataAte && (!iso || iso > dataAte)) return false;
          return true;
        });

        body.innerHTML = filtrados.length ? filtrados.map(t => `
          <article class="tra-geral-card">
            <header>
              <strong>Item ${esc(t.item || '')} • ${esc(t.data || '')}</strong>
              ${t.hora ? `<span>${esc(t.hora)}</span>` : ''}
            </header>
            <div><strong>Origem:</strong> ${esc(t.origem || '-')}</div>
            <div><strong>Setor Atual:</strong> ${esc(t.atual || '-')}</div>
            <div><strong>Relator:</strong> ${esc(t.relator || '-')}</div>
            <div><span class="tra-geral-chip">${esc(t.parecer || 'SEM PARECER')}</span></div>
            ${t.descricao ? `<p>${esc(t.descricao)}</p>` : ''}
          </article>
        `).join('') : `<div class="empty">Nenhum trâmite encontrado.</div>`;
      }

      container.querySelector('#tra_geral_modal_proc_info').textContent = proc?.objeto ? proc.objeto : '';
      search.oninput = renderModal;
      de.onchange = renderModal;
      ate.onchange = renderModal;
      renderModal();
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', 'open');
    }

    container.innerHTML = `
      <style>
        .tra-geral-actions { display:flex; gap:8px; align-items:center; justify-content:flex-end; flex-wrap:wrap; }
        .tra-geral-motivo { display:inline-block; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:help; }
        .tra-geral-icon-btn { min-width:38px; padding:8px 10px; font-size:16px; line-height:1; }
        #tra_geral_modal { width:min(1120px, 94vw); max-height:88vh; border:0; border-radius:14px; padding:0; }
        #tra_geral_modal::backdrop { background:rgba(15,23,42,.45); }
        .tra-geral-modal-head { display:flex; justify-content:space-between; gap:18px; align-items:flex-start; padding:22px 24px; background:#2563eb; color:#fff; }
        .tra-geral-modal-head .muted { color:rgba(255,255,255,.9); }
        .tra-geral-modal-title { max-width:850px; }
        .tra-geral-modal-title .eyebrow { font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:#dbeafe; }
        .tra-geral-modal-title h2 { margin:4px 0 8px; font-size:26px; line-height:1.15; font-weight:800; letter-spacing:0; color:#fff; }
        .tra-geral-modal-title .objeto { margin-top:6px; max-width:820px; font-size:15px; line-height:1.45; font-weight:600; color:#eff6ff; }
        .tra-geral-modal-body { padding:16px 20px 20px; max-height:calc(88vh - 92px); overflow:auto; }
        .tra-geral-modal-filters { display:grid; grid-template-columns:1fr 180px 180px; gap:10px; margin-bottom:14px; }
        .tra-geral-card { border:1px solid var(--line); border-left:4px solid #2563eb; border-radius:10px; padding:14px 16px; margin-bottom:12px; background:#f8fafc; }
        .tra-geral-card header { display:flex; justify-content:space-between; gap:12px; margin-bottom:10px; }
        .tra-geral-card div { margin:5px 0; }
        .tra-geral-card p { margin:10px 0 0; line-height:1.45; }
        .tra-geral-chip { display:inline-block; margin-top:6px; padding:5px 9px; border-radius:999px; background:#2563eb; color:#fff; font-size:12px; font-weight:700; }
        @media (max-width:800px) {
          .tra-geral-modal-head { flex-direction:column; }
          .tra-geral-modal-filters { grid-template-columns:1fr; }
        }
      </style>
      <section class="wrap">
        <header style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px">
          <div>
            <h2 style="margin:0 0 6px 0">Trâmites em Geral</h2>
            <div class="muted">Visão geral dos processos cadastrados em Processos Licitatórios.</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
            <button id="tra_geral_importar" class="btn primary" type="button">Atualizar trâmites</button>
            <input id="tra_geral_file" type="file" accept=".txt,text/plain" multiple hidden>
            <input id="tra_geral_q" class="input" placeholder="buscar nº processo, objeto, secretaria..." style="min-width:280px">
            <select id="tra_geral_secretaria" class="select" style="min-width:220px">
              <option value="">Secretaria: Todas</option>
              ${secretarias.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
            </select>
          </div>
        </header>

        <div class="card" style="overflow:auto">
          <table id="tra_geral_tbl">
            <thead>
              <tr>
                <th>Nº PROCESSO</th>
                <th>ITEM</th>
                <th>ÚLTIMO TRÂMITE</th>
                <th>MOTIVO</th>
                <th>SECRETARIA</th>
                <th>OBJETO</th>
                <th>RESPONSÁVEL</th>
                <th>AÇÕES</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
          <div id="tra_geral_empty" class="empty">0–0 de 0</div>
        </div>
      </section>

      <dialog id="tra_geral_modal">
        <div class="tra-geral-modal-head">
          <div class="tra-geral-modal-title">
            <div class="eyebrow">Trâmites do processo</div>
            <h2 id="tra_geral_modal_title">Processo</h2>
            <div id="tra_geral_modal_proc_info" class="objeto"></div>
          </div>
          <button id="tra_geral_modal_close" class="btn" type="button">Fechar</button>
        </div>
        <div class="tra-geral-modal-body">
          <div class="tra-geral-modal-filters">
            <input id="tra_geral_modal_q" class="input" placeholder="Pesquisar em qualquer campo...">
            <input id="tra_geral_modal_de" class="input" type="date" title="De">
            <input id="tra_geral_modal_ate" class="input" type="date" title="Até">
          </div>
          <div id="tra_geral_modal_body"></div>
        </div>
      </dialog>
    `;

    const qInput = container.querySelector('#tra_geral_q');
    const secretariaSelect = container.querySelector('#tra_geral_secretaria');
    const tbody = container.querySelector('#tra_geral_tbl tbody');
    const empty = container.querySelector('#tra_geral_empty');
    const importBtn = container.querySelector('#tra_geral_importar');
    const fileInput = container.querySelector('#tra_geral_file');
    const modal = container.querySelector('#tra_geral_modal');

    function render() {
      const q = normalizar(qInput.value);
      const secretaria = secretariaSelect.value;
      const processos = carregarProcessos();
      const filtrados = processos.filter(p => {
        if (secretaria && p.secretaria !== secretaria) return false;
        if (!q) return true;
        const ultimo = ultimoTramite(p.numero || '');
        const texto = normalizar(`${p.numero || ''} ${p.secretaria || ''} ${p.objeto || ''} ${ultimo?.item || ''} ${ultimo?.data || ''} ${ultimo?.parecer || ''} ${ultimo?.descricao || ''} ${ultimo?.atual || ''}`);
        return texto.includes(q);
      });

      tbody.innerHTML = filtrados.map(p => `
        ${(() => {
          const ultimo = ultimoTramite(p.numero || '');
          const total = tramitesDoProcesso(p.numero || '').length;
          return `
        <tr>
          <td><strong>${esc(p.numero || '')}</strong></td>
          <td>${esc(ultimo?.item || '')}</td>
          <td>${esc(ultimo?.data || '')}</td>
          <td>${ultimo ? `<span class="tra-geral-motivo" title="${esc(ultimo.descricao || '')}">${esc(ultimo.parecer || '')}</span>` : ''}</td>
          <td>${esc(p.secretaria || '')}</td>
          <td style="max-width:520px;white-space:normal;line-height:1.35">${esc(p.objeto || '')}</td>
          <td>${esc(ultimo?.atual || '')}</td>
          <td>
            ${total ? `<button class="btn tra-geral-icon-btn" type="button" data-view-tramites="${esc(p.numero || '')}" title="Visualizar trâmites">📒</button>` : ''}
          </td>
        </tr>
          `;
        })()}
      `).join('');

      empty.textContent = `${filtrados.length ? 1 : 0}–${filtrados.length} de ${processos.length}`;
    }

    importBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
      if (!fileInput.files?.length) return;
      try {
        await importarTramites(fileInput.files);
      } catch (err) {
        console.error(err);
        alert('Não foi possível importar o TXT de trâmites. Verifique o arquivo e tente novamente.');
      } finally {
        fileInput.value = '';
      }
    });

    qInput.addEventListener('input', render);
    secretariaSelect.addEventListener('change', render);
    tbody.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-view-tramites]');
      if (!btn) return;
      abrirModalTramites(btn.getAttribute('data-view-tramites'));
    });
    container.querySelector('#tra_geral_modal_close').addEventListener('click', () => {
      if (typeof modal.close === 'function') modal.close();
      else modal.removeAttribute('open');
    });
    try {
      await carregarDadosGeraisSupabase();
    } catch (error) {
      console.error('[SUPABASE][tramites_gerais][INIT][ERRO]', error);
      alert('Não foi possível carregar os trâmites gerais no Supabase.\n\nDetalhe: ' + (error?.message || error));
    }
    render();
  }

  // expor init
  window.initTramites = initTramites;
  window.initTramitesGeral = initTramitesGeral;
  window.initTramitesInterno = initTramitesInterno;

})();

