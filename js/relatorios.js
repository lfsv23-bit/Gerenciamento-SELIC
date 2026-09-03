// js/relatorios.js
// Módulo Relatórios (atualizado) — UI de filtros estilo "Localizar Trâmite" + Relatório "Processos no Setor" + export XLSX/PDF
(function(){
  // --- helpers existentes (mantive compatibilidade com seu projeto) ---
  function hasXLSX(){ return typeof window.XLSX !== 'undefined'; }

  async function carregarDadosBase() {
    if (window.isSupabaseConfigured?.() && window.AppDatabase) {
      try {
        await window.AppDatabase.requireAuthenticatedUser?.();
        const [procs, tram] = await Promise.all([
          window.AppDatabase.loadProcessosCompletos?.() || [],
          window.AppDatabase.listarTramitesInternos?.() || []
        ]);
        return { procs: Array.isArray(procs) ? procs : [], tram: Array.isArray(tram) ? tram : [] };
      } catch (error) {
        console.error('[SUPABASE][relatorios][LOAD][ERRO]', error);
        alert('Não foi possível carregar dados do Supabase para relatórios.\n\nDetalhe: ' + (error?.message || error));
        return { procs: [], tram: [] };
      }
    }
    return {
      procs: JSON.parse(localStorage.getItem('processosLicitatorios') || '[]'),
      tram: JSON.parse(localStorage.getItem('tramitesProcessos') || '[]')
    };
  }

  function exportToXLSX(filename, sheets) {
    if (!hasXLSX()) {
      alert('Biblioteca SheetJS (XLSX) não encontrada. Coloque js/xlsx.full.min.js na pasta js.');
      return;
    }
    try {
      const wb = XLSX.utils.book_new();
      for (const [name, data] of Object.entries(sheets)) {
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, name.substring(0,31));
      }
      const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
      const blob = new Blob([wbout], {type: 'application/octet-stream'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename || 'relatorios.xlsx';
      document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Erro ao gerar XLSX: ' + e.message);
    }
  }

  function openPrintWindow(html, title) {
    const w = window.open('', '_blank');
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + (title||'Relatório') + '</title>');
    w.document.write('<link rel="stylesheet" href="css/style.css">');
    w.document.write('<style>@media print{ .no-print{display:none;} }</style>');
    w.document.write('</head><body>');
    w.document.write(html);
    w.document.write('</body></html>');
    w.document.close();
    setTimeout(()=> w.print(), 400);
  }

  // --- util --- 
  function parseDateInput(v){
    if (!v) return null;
    // accepts yyyy-mm-dd (from <input type="date">) or dd/mm/yyyy — normalize to Date
    if (v.includes('-')) {
      const [y,m,d] = v.split('-').map(x=>Number(x));
      return new Date(y,m-1,d);
    }
    if (v.includes('/')) {
      const [d,m,y] = v.split('/').map(x=>Number(x));
      return new Date(y,m-1,d);
    }
    const n = Number(v);
    if (!Number.isNaN(n)) return new Date(n);
    return null;
  }
  function fmtDateISO(d){
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    const dd = String(dt.getDate()).padStart(2,'0');
    const mm = String(dt.getMonth()+1).padStart(2,'0');
    const yy = dt.getFullYear();
    return `${dd}/${mm}/${yy}`;
  }
  function daysBetween(dateStr){
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    const now = new Date();
    const diff = Math.floor((now - d) / (1000*60*60*24));
    return diff;
  }

  // pega último trâmite por processo (por dataEntrada)
  function lastTramiteForProcess(tramites, numero){
    const all = tramites.filter(t => String(t.numero||'').trim().toLowerCase() === String(numero||'').trim().toLowerCase());
    if (!all.length) return null;
    // se dataEntrada for em formato dd/mm/yyyy ou yyyy-mm-dd, tentar ordenar com Date
    all.sort((a,b)=>{
      const da = new Date(a.dataEntrada);
      const db = new Date(b.dataEntrada);
      if (!isNaN(da) && !isNaN(db)) return db - da;
      // fallback: string compare
      return (String(b.dataEntrada||'')).localeCompare(String(a.dataEntrada||''));
    });
    return all[0];
  }

  // --- UI / initRelatorios ---
  async function initRelatorios(container){
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) throw new Error('Container inválido para initRelatorios');

    container.innerHTML = `
      <section class="wrap">
        <h2>📊 Relatórios</h2>
        <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">
          <button id="rel_open_filtros" class="btn">🔎 Localizar Trâmite / Filtrar</button>
          <button id="rel_export_xlsx" class="btn primary">Exportar XLSX</button>
          <button id="rel_export_pdf" class="btn">Exportar PDF</button>
          <label style="margin-left:8px;font-size:13px;color:var(--muted)"><input type="checkbox" id="rel_show_concluidos"> Mostrar concluídos</label>
        </div>

        <div id="rel_area"></div>
      </section>

      <!-- Modal / painel de filtros (estilo da imagem enviada) -->
      <dialog id="rel_filtros" style="width:95%;max-width:1100px;">
        <div class="modal-head" style="display:flex;justify-content:space-between;align-items:center">
          <strong>Localizar Trâmite — Processos no Setor</strong>
          <button id="rel_filtros_close" class="btn ghost" type="button">Fechar</button>
        </div>
        <div class="modal-body">
          <div class="grid" style="grid-template-columns: repeat(4, 1fr); gap:10px;">
            <div class="field"><label>Nº do Processo</label><input id="f_numero" class="input" placeholder="ex: 22164/2024"></div>
            <div class="field"><label>Data de entrada (De)</label><input id="f_data_de" type="date" class="input"></div>
            <div class="field"><label>Data de entrada (Até)</label><input id="f_data_ate" type="date" class="input"></div>
            <div class="field"><label>Responsável</label><input id="f_responsavel" class="input" placeholder="Nome do responsável"></div>

            <div class="field"><label>Motivo</label><input id="f_motivo" class="input" placeholder="Motivo"></div>
            <div class="field"><label>Secretaria</label><input id="f_secretaria" class="input" placeholder="Secretaria"></div>
            <div class="field"><label>Setor atual (Destino)</label><input id="f_setor" class="input" placeholder="Ex: LICITAÇÃO"></div>
            <div class="field"><label>Status</label>
              <select id="f_status" class="select">
                <option value="">Todos</option>
                <option value="AGUARDANDO">AGUARDANDO</option>
                <option value="EM ANDAMENTO">EM ANDAMENTO</option>
                <option value="CONCLUÍDO">CONCLUÍDO</option>
              </select>
            </div>

            <div class="field" style="grid-column:1/-1"><label>Busca livre</label><input id="f_q" class="input" placeholder="Pesquisar por objeto, trecho do parecer, etc."></div>
          </div>
        </div>
        <div class="modal-foot" style="display:flex;justify-content:flex-end;gap:8px">
          <button id="rel_f_clear" class="btn">Limpar</button>
          <button id="rel_f_apply" class="btn primary">Pesquisar</button>
        </div>
      </dialog>
    `;

    // -- referências DOM --
    const relArea = container.querySelector('#rel_area');
    const btnFiltros = container.querySelector('#rel_open_filtros');
    const btnX = container.querySelector('#rel_export_xlsx');
    const btnP = container.querySelector('#rel_export_pdf');
    const chkShowConcluidos = container.querySelector('#rel_show_concluidos');

    // filtros modal
    const dlgFiltros = container.querySelector('#rel_filtros');
    const f_numero = container.querySelector('#f_numero');
    const f_data_de = container.querySelector('#f_data_de');
    const f_data_ate = container.querySelector('#f_data_ate');
    const f_responsavel = container.querySelector('#f_responsavel');
    const f_motivo = container.querySelector('#f_motivo');
    const f_secretaria = container.querySelector('#f_secretaria');
    const f_setor = container.querySelector('#f_setor');
    const f_status = container.querySelector('#f_status');
    const f_q = container.querySelector('#f_q');
    const f_clear = container.querySelector('#rel_f_clear');
    const f_apply = container.querySelector('#rel_f_apply');
    const f_close = container.querySelector('#rel_filtros_close');

    const { procs, tram } = await carregarDadosBase();

    // gera dataset unificado: cada trâmite vira uma linha com referência ao processo; usamos último trâmite para estado "atual"
    // mas mostramos todas as entradas (se quiser histórico, depois adaptamos). Aqui vamos listar cada processo com seu último trâmite.
    function buildDataset(){
      const out = [];
      // índice para performance
      const tramIndex = {};
      for (const t of tram) {
        const num = String(t.numero||'').trim().toLowerCase();
        if (!tramIndex[num]) tramIndex[num] = [];
        tramIndex[num].push(t);
      }
      for (const p of procs) {
  const num = String(p.numero||'').trim().toLowerCase();

  // pega o último trâmite
  const last = tramIndex[num] ? lastTramiteForProcess(tramIndex[num], p.numero) : null;

  // 🔥 NOVO: se não tiver nenhum trâmite → NÃO exibe na listagem
  if (!last) continue;

  out.push({
  numero: p.numero || '',
  dataEntrada: last.dataEntrada,
  responsavel: last.responsavel || '',
  motivo: last.motivo || '',
  parecer: last.obs || '',
  observacao: last.obs || '',   // 🔥 NOVO
  secretaria: p.secretaria || '',
  objetoResumo: (p.objeto || '').slice(0,300),
  setorAtual: last.destino || '',
  status: last.status || '',
  diasNoSetor: daysBetween(last.dataEntrada),
  processoObjFull: p.objeto || '',
  processoDescFull: p.descricaoCompleta || '',
  processoId: p.id || ''
});

}

      return out;
    }

    // render da tabela (resultado)
    function renderTable(dataset){
      // build table HTML
      const html = `
        <div class="card table-wrap">
          <table id="rel_tbl">
            <thead>
              <tr>
                <th>Nº Processo</th>
                <th>Data Entrada</th>
                <th>Dias no Setor</th>
                <th>Responsável</th>
                <th>Motivo</th>
                <th>Parecer</th>
                <th>Observação</th>
                <th>Secretaria</th>
                <th>Objeto resumido</th>
                <th>Setor atual</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${dataset.map(r => `
                <tr data-num="${r.numero}">
                  <td><strong>${r.numero}</strong></td>
                  <td>${fmtDateISO(r.dataEntrada)}</td>
                  <td>${r.diasNoSetor}</td>
                  <td>${(r.responsavel||'')}</td>
                  <td>${(r.motivo||'')}</td>
                  <td style="white-space:pre-wrap;">${(r.parecer||'')}</td>
<td style="white-space:pre-wrap;">${(r.observacao||'')}</td>
                  <td>${(r.secretaria||'')}</td>
                  <td>${(r.objetoResumo||'')}</td>
                  <td>${(r.setorAtual||'')}</td>
                  <td>${(r.status||'')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div style="margin-top:8px;color:var(--muted)">${dataset.length} processos listados</div>
      `;
      relArea.innerHTML = html;

      // torna linhas clicáveis para abrir impressão rápida/visualização (pode estender)
      const tbody = relArea.querySelector('#rel_tbl tbody');
      tbody.querySelectorAll('tr').forEach(tr=>{
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', ()=>{
          // abre janela de impressão com detalhe do processo + último trâmite
          const num = tr.dataset.num;
          openDetailPrint(num);
        });
      });
    }

    // função que abre página de impressão detalhada para um processo
    function openDetailPrint(numero){
      const proc = procs.find(p => String(p.numero||'').trim().toLowerCase() === String(numero||'').trim().toLowerCase());
      const last = tram.filter(t => String(t.numero||'').trim().toLowerCase() === String(numero||'').trim().toLowerCase())
                      .sort((a,b)=> new Date(b.dataEntrada) - new Date(a.dataEntrada))[0];
      let html = `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><div><h3>Processo: ${numero}</h3><div class="muted">Relatório detalhado</div></div></div>`;
      if (proc) {
        html += `<div style="margin-top:8px"><strong>Secretaria:</strong> ${proc.secretaria||''}</div>`;
        html += `<div style="margin-top:6px"><strong>Objeto:</strong><div style="white-space:pre-wrap;margin-top:6px">${proc.objeto||''}</div></div>`;
        html += `<div style="margin-top:6px"><strong>Descrição completa:</strong><div style="white-space:pre-wrap;margin-top:6px">${proc.descricaoCompleta||''}</div></div>`;
      } else {
        html += `<div class="empty" style="margin-top:6px">Processo não encontrado em Processos Licitatórios.</div>`;
      }
      if (last) {
        html += `<hr style="margin:12px 0"><div><strong>Último Trâmite:</strong></div>`;
        html += `<div><strong>Data Entrada:</strong> ${fmtDateISO(last.dataEntrada)||''}</div>`;
        html += `<div><strong>Setor / Destino:</strong> ${last.destino||''}</div>`;
        html += `<div><strong>Motivo:</strong> ${last.motivo||''}</div>`;
        html += `<div><strong>Responsável:</strong> ${last.responsavel||''}</div>`;
        html += `<div style="margin-top:6px"><strong>Parecer:</strong><div style="white-space:pre-wrap;margin-top:6px">${last.obs||''}</div></div>`;
      } else {
        html += `<div class="empty" style="margin-top:12px">Nenhum trâmite encontrado para este processo.</div>`;
      }
      html += `</div>`;
      openPrintWindow(html, 'Detalhe processo ' + numero);
    }

    // função que aplica filtros e atualiza render
    function applyFilters(){
      const dataset = buildDataset();
      const qNumero = (f_numero.value || '').trim().toLowerCase();
      const qDe = parseDateInput(f_data_de.value);
      const qAte = parseDateInput(f_data_ate.value);
      const qResp = (f_responsavel.value || '').trim().toLowerCase();
      const qMotivo = (f_motivo.value || '').trim().toLowerCase();
      const qSec = (f_secretaria.value || '').trim().toLowerCase();
      const qSetor = (f_setor.value || '').trim().toLowerCase();
      const qStatus = (f_status.value || '').trim().toUpperCase();
      const qFree = (f_q.value || '').trim().toLowerCase();
      const showConcl = chkShowConcluidos.checked;

      const filtered = dataset.filter(r => {
        if (qNumero && String(r.numero||'').toLowerCase().indexOf(qNumero) === -1) return false;
        if (qResp && String(r.responsavel||'').toLowerCase().indexOf(qResp) === -1) return false;
        if (qMotivo && String(r.motivo||'').toLowerCase().indexOf(qMotivo) === -1) return false;
        if (qSec && String(r.secretaria||'').toLowerCase().indexOf(qSec) === -1) return false;
        if (qSetor && String(r.setorAtual||'').toLowerCase().indexOf(qSetor) === -1) return false;
        if (qStatus && String(r.status||'').toUpperCase() !== qStatus) return false;
        if (!showConcl && String(r.status||'').toUpperCase() === 'CONCLUÍDO') return false;
        // date range on dataEntrada
        if (qDe || qAte) {
          if (!r.dataEntrada) return false;
          const d = parseDateInput(r.dataEntrada);
          if (qDe && d && d < qDe) return false;
          if (qAte && d && d > qAte) return false;
        }
        if (qFree) {
          const blob = `${r.numero} ${r.responsavel} ${r.motivo} ${r.parecer} ${r.observacao} ${r.secretaria} ${r.objetoResumo} ${r.setorAtual} ${r.status}`.toLowerCase();

          if (!blob.includes(qFree)) return false;
        }
        return true;
      });

      renderTable(filtered);
    }

    // limpar filtros
    function clearFilters(){
      f_numero.value = '';
      f_data_de.value = '';
      f_data_ate.value = '';
      f_responsavel.value = '';
      f_motivo.value = '';
      f_secretaria.value = '';
      f_setor.value = '';
      f_status.value = '';
      f_q.value = '';
    }

    // --- event binding ---
    btnFiltros.onclick = () => dlgFiltros.showModal();
    f_close.onclick = () => dlgFiltros.close();
    f_clear.onclick = () => { clearFilters(); applyFilters(); };
    f_apply.onclick = () => { applyFilters(); dlgFiltros.close(); };

    // export XLSX: gera duas sheets (Processos e Tramites) + flat relatorio
    btnX.onclick = () => {
      const dataset = buildDataset();
      // sheet Processos (originais)
      const sheetProcs = procs.map(p => ({
        id: p.id||'', numero: p.numero||'', secretaria: p.secretaria||'',
        dataCriacao: p.dataCriacao||'', objeto: p.objeto||'', situacao: p.situacao||'',
        modalidade: p.modalidade||'', fase: p.fase||'', valorEstimado: p.valorEstimado||'',
        recurso: Array.isArray(p.recurso)?p.recurso.join('; '):(p.recurso||''),
        descricaoCompleta: p.descricaoCompleta||'', observacao: p.observacao||''
      }));
      const sheetTram = tram.map(t => ({
        id: t.id||'', numero: t.numero||'', secretaria: t.secretaria||'', dataEntrada: t.dataEntrada||'',
        motivo: t.motivo||'', responsavel: t.responsavel||'', status: t.status||'', destino: t.destino||'', obs: t.obs||''
      }));
      const sheetRel = dataset.map(r => ({
        numero: r.numero, dataEntrada: r.dataEntrada, diasNoSetor: r.diasNoSetor, responsavel: r.responsavel,
        motivo: r.motivo, parecer: r.parecer, secretaria: r.secretaria, objetoResumo: r.objetoResumo, setorAtual: r.setorAtual, status: r.status, observacao: r.observacao
      }));

      exportToXLSX('relatorio_processos_no_setor.xlsx', {Processos: sheetProcs, Tramites: sheetTram, 'Processos no Setor': sheetRel});
    };

    btnP.onclick = () => {
      // imprimir a área atual (aplica filtros antes)
      const currentDataset = (function(){ // safe snapshot with current filters
        const ds = buildDataset();
        // apply the same filter logic as applyFilters (quick reuse)
        f_apply.click(); // triggers apply and render; but we need the HTML to print
        const htmlToPrint = relArea.innerHTML;
        openPrintWindow(htmlToPrint, 'Relatório — Processos no Setor');
      })();
    };

    // show/hide concluidos checkbox -> re-aplica filtros
    chkShowConcluidos.onchange = () => applyFilters();

    // inicializa com filtros vazios e aplica (padrão: ocultar concluídos)
    clearFilters();
    applyFilters();
  }

  // exporta initRelatorios globalmente
  window.initRelatorios = initRelatorios;
})();
