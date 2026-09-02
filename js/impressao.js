
// js/impressao.js
// Módulo Impressão — filtros, preview e export (XLSX/PDF)
(function(){
  function hasXLSX(){ return typeof window.XLSX !== 'undefined'; }

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
      a.href = url; a.download = filename || 'impressao.xlsx';
      document.body.appendChild(a); a.click();
      a.remove(); URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Erro ao gerar XLSX: ' + e.message);
    }
  }

  function openPrintWindow(html, title) {
    const w = window.open('', '_blank');
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + (title||'Impressão') + '</title>');
    w.document.write('<link rel="stylesheet" href="css/style.css">');
    w.document.write('<style>@media print{ .no-print{display:none;} }</style>');
    w.document.write('</head><body>');
    w.document.write(html);
    w.document.write('</body></html>');
    w.document.close();
    setTimeout(()=> w.print(), 400);
  }

  function initImpressao(container){
    if (typeof container === 'string') container = document.getElementById(container);

    container.innerHTML = `
      <section class="wrap">
        <h2>🖨️ Impressão</h2>
        <p class="muted">Filtre, visualize e exporte relatórios / dashboards</p>

        <div style="display:flex;gap:8px;margin-bottom:12px">
          <select id="imp_select" class="select">
            <option value="">-- selecione --</option>
            <option value="processos">Relatório — Processos</option>
            <option value="tramites">Relatório — Trâmites</option>
            <option value="dashboard">Dashboard (visual)</option>
          </select>

          <input id="imp_filter" class="input" placeholder="Termo de filtro (nº, secretaria, destino...)">
          <button id="imp_preview_btn" class="btn">Gerar Prévia</button>
          <button id="imp_export_xlsx" class="btn">Exportar XLSX</button>
          <button id="imp_export_pdf" class="btn primary">Exportar PDF</button>
        </div>

        <div id="imp_preview" class="card" style="padding:12px"></div>
      </section>
    `;

    const sel = container.querySelector('#imp_select');
    const filter = container.querySelector('#imp_filter');
    const previewBtn = container.querySelector('#imp_preview_btn');
    const preview = container.querySelector('#imp_preview');
    const btnX = container.querySelector('#imp_export_xlsx');
    const btnP = container.querySelector('#imp_export_pdf');

    function buildPreview(type, q) {
      const procs = JSON.parse(localStorage.getItem('processosLicitatorios') || '[]');
      const tram = JSON.parse(localStorage.getItem('tramitesProcessos') || '[]');
      q = (q||'').toLowerCase().trim();

      if (type === 'processos') {
        const rows = procs.filter(p => {
          const blob = `${p.numero||''} ${p.secretaria||''} ${p.objeto||''} ${p.modalidade||''}`.toLowerCase();
          return !q || blob.includes(q);
        });
        if (!rows.length) return '<div class="empty">Nenhum processo encontrado.</div>';
        return `
          <div><strong>${rows.length} processos</strong></div>
          <table style="width:100%;border-collapse:collapse;margin-top:8px">
            <thead><tr><th>Nº</th><th>Secretaria</th><th>Data</th><th>Objeto</th><th>Situação</th></tr></thead>
            <tbody>
              ${rows.map(r=>`<tr><td>${r.numero||''}</td><td>${r.secretaria||''}</td><td>${r.dataCriacao||''}</td><td>${(r.objeto||'').slice(0,120)}</td><td>${r.situacao||''}</td></tr>`).join('')}
            </tbody>
          </table>
        `;
      }

      if (type === 'tramites') {
        const rows = tram.filter(t=>{
          const blob = `${t.numero||''} ${t.motivo||''} ${t.destino||''} ${t.responsavel||''}`.toLowerCase();
          return !q || blob.includes(q);
        });
        if (!rows.length) return '<div class="empty">Nenhum trâmite encontrado.</div>';
        return `
          <div><strong>${rows.length} trâmites</strong></div>
          <table style="width:100%;border-collapse:collapse;margin-top:8px">
            <thead><tr><th>Nº</th><th>Data</th><th>Motivo</th><th>Destino</th><th>Status</th></tr></thead>
            <tbody>
              ${rows.map(r=>`<tr><td>${r.numero||''}</td><td>${r.dataEntrada||''}</td><td>${r.motivo||''}</td><td>${r.destino||''}</td><td>${r.status||''}</td></tr>`).join('')}
            </tbody>
          </table>
        `;
      }

      if (type === 'dashboard') {
        // reuse a small summary
        const totalProcs = procs.length;
        const totalTram = tram.length;
        const bySec = {};
        procs.forEach(p=> bySec[p.secretaria = (p.secretaria||'Não informado')] = (bySec[p.secretaria]||0)+1);
        return `
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <div class="card"><div class="muted">Processos</div><div style="font-size:22px">${totalProcs}</div></div>
            <div class="card"><div class="muted">Trâmites</div><div style="font-size:22px">${totalTram}</div></div>
          </div>
        `;
      }

      return '<div class="empty">Selecione um tipo.</div>';
    }

    previewBtn.onclick = () => {
      const type = sel.value;
      preview.innerHTML = buildPreview(type, filter.value);
    };

    btnX.onclick = () => {
      const type = sel.value;
      if (!type) return alert('Selecione o tipo para exportar.');
      const procs = JSON.parse(localStorage.getItem('processosLicitatorios') || '[]');
      const tram = JSON.parse(localStorage.getItem('tramitesProcessos') || '[]');
      if (type === 'processos') {
        const rows = procs.filter(p=>{
          const q = (filter.value||'').toLowerCase();
          const blob = `${p.numero||''} ${p.secretaria||''} ${p.objeto||''}`.toLowerCase();
          return !q || blob.includes(q);
        }).map(p=>({
          numero: p.numero||'', secretaria: p.secretaria||'', dataCriacao: p.dataCriacao||'', objeto: p.objeto||'', situacao: p.situacao||''
        }));
        exportToXLSX('processos_export.xlsx', {Processos: rows});
      } else if (type === 'tramites') {
        const rows = tram.filter(t=>{
          const q = (filter.value||'').toLowerCase();
          const blob = `${t.numero||''} ${t.motivo||''} ${t.destino||''}`.toLowerCase();
          return !q || blob.includes(q);
        }).map(t=>({
          numero: t.numero||'', dataEntrada: t.dataEntrada||'', motivo: t.motivo||'', destino: t.destino||'', status: t.status||''
        }));
        exportToXLSX('tramites_export.xlsx', {Tramites: rows});
      } else if (type === 'dashboard') {
        // small export
        const p = procs.map(x=>({numero:x.numero||'', secretaria:x.secretaria||'', situacao:x.situacao||''}));
        exportToXLSX('dashboard_export.xlsx', {Processos: p});
      }
    };

    btnP.onclick = () => {
      const type = sel.value;
      if (!type) return alert('Selecione o tipo para imprimir.');
      const html = preview.innerHTML || buildPreview(type, filter.value);
      openPrintWindow(html, 'Impressão — ' + (type||''));
    };
  }

  window.initImpressao = initImpressao;
})();
