// Dashboard com Chart.js 4.x — com ABAS (Processos / Trâmites)
(function(){
  // Paleta global de cores variadas (tema bonito)
const palette = [
  "#60a5fa", // azul claro
  "#34d399", // verde
  "#fbbf24", // amarelo
  "#ef4444", // vermelho
  "#a78bfa", // roxo
  "#f472b6", // rosa
  "#2dd4bf", // turquesa
  "#fb923c", // laranja
];


// --- utilitários ---
function hasXLSX(){ return typeof XLSX !== 'undefined'; }

function exportToXLSX(filename, sheets){
  if(!hasXLSX()){
    alert("SheetJS não encontrado. Coloque js/xlsx.full.min.js");
    return;
  }
  const wb = XLSX.utils.book_new();
  for(const [name,data] of Object.entries(sheets)){
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, name.substring(0,31));
  }
  const out = XLSX.write(wb,{bookType:'xlsx',type:'array'});
  const blob = new Blob([out],{type:"application/octet-stream"});
  const url = URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;
  a.download=filename;
  a.click();
  URL.revokeObjectURL(url);
}

function timelineGroup(list, dateField){
  const map={};
  list.forEach(t=>{
    const raw=t[dateField] || t.data || t.dataEntrada;
    if(!raw) return;
    const d=new Date(raw);
    if(isNaN(d)) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    map[key]=(map[key]||0)+1;
  });
  return Object.keys(map).sort().map(k=>({label:k,value:map[k]}));
}

function groupCount(list, key){
  const m={};
  list.forEach(i=>{
    const v=i[key]||"Não informado";
    m[v]=(m[v]||0)+1;
  });
  return Object.entries(m)
    .map(([label,value])=>({label,value}))
    .sort((a,b)=>b.value-a.value);
}

function timelineGroupDaily(list, dateField){
  const map = {};
  list.forEach(t => {
    const raw = t[dateField];
    if(!raw) return;
    const d = new Date(raw);
    if(isNaN(d)) return;
    const key = d.toISOString().slice(0,10); // yyyy-mm-dd
    map[key] = (map[key] || 0) + 1;
  });
  return Object.keys(map).sort().map(k => ({ label: k, value: map[k] }));
}

// ===============================================
// INÍCIO DO DASHBOARD PRINCIPAL
// ===============================================
function initDashboardChart(container){

  if(typeof container==="string") container=document.getElementById(container);

  const procs = JSON.parse(localStorage.getItem("processosLicitatorios")||"[]");
  const tram  = JSON.parse(localStorage.getItem("tramitesProcessos")||"[]");

  // --- SOMENTE PENDENTES ---
  const tramPendentes = tram.filter(t => 
    (t.status || "").toUpperCase() !== "CONCLUÍDO"
  );

  const totalProcs = procs.length;
  const totalTram = tram.length;
  const totalPendentes = tramPendentes.length;

  // Processos
  const bySecProcs = groupCount(procs, "secretaria").slice(0,10);
  const byModalidade = groupCount(procs, "modalidade").slice(0,10);

  // Trâmites (pendentes)
  const byDest = groupCount(tramPendentes, "destino").slice(0,10);
  const byMot = groupCount(tramPendentes, "motivo").slice(0,10);
  const timeline = timelineGroup(tramPendentes, "dataEntrada");

  container.innerHTML = `
  <section class="pb-dark">

    <header class="pb-header">
      <h2>Dashboard</h2>
      <div class="pb-actions">
        <button id="expX" class="btn">Exportar XLSX</button>
        <button id="expP" class="btn">Exportar PDF</button>
        <button id="refresh" class="btn">Atualizar</button>
      </div>
    </header>

    <!-- ABAS -->
    <div class="pb-tabs">
        <div class="pb-tab active" id="tabProc">Processos Licitatórios</div>
        <div class="pb-tab" id="tabTram">Trâmites</div>
    </div>

    <!-- CARDS -->
    <div class="pb-cards">
      <div class="pb-card large">
        <div class="pb-card-title">Processos cadastrados</div>
        <div class="pb-card-value">${totalProcs}</div>
      </div>
      <div class="pb-card large">
        <div class="pb-card-title">Trâmites registrados</div>
        <div class="pb-card-value">${totalTram}</div>
      </div>
      <div class="pb-card large">
        <div class="pb-card-title">Trâmites pendentes</div>
        <div class="pb-card-value">${totalPendentes}</div>
      </div>
    </div>

    <div class="pb-grid" id="chartArea"></div>

  </section>
  `;

  const chartArea = container.querySelector("#chartArea");

  // ===============================================
  // ABA DE PROCESSOS
  // ===============================================
  function renderProcessCharts(){
    chartArea.innerHTML = `
      <div class="pb-chart-card full"><h3>Processos por Secretaria</h3><div class="chart-container"><canvas id="c1"></canvas></div></div>
      <div class="pb-chart-card full"><h3>Processos por Modalidade</h3><div class="chart-container"><canvas id="c2"></canvas></div></div>
    `;

    const tickCfg = { color:"#fff", maxRotation:20, minRotation:0 };

    new Chart(document.getElementById("c1"),{
  type:"bar",
  data:{ 
    labels: bySecProcs.map(x=>x.label),
    datasets:[{
      data: bySecProcs.map(x=>x.value),
      backgroundColor: palette.slice(0, bySecProcs.length)
    }]
  },
  options:{ plugins:{legend:{display:false}}, scales:{ x:{ticks:tickCfg}, y:{ticks:{color:"#fff"}} } }
});


    new Chart(document.getElementById("c2"),{
  type:"bar",
  data:{ 
    labels: byModalidade.map(x=>x.label),
    datasets:[{
      data: byModalidade.map(x=>x.value),
      backgroundColor: palette.slice(0, byModalidade.length)
    }]
  },
  options:{ plugins:{legend:{display:false}}, scales:{ x:{ticks:tickCfg}, y:{ticks:{color:"#fff"}} } }
});

  }

  // ===============================================
  // ABA DE TRÂMITES
  // ===============================================
  function renderTramCharts(){
    const timelineDaily = timelineGroupDaily(tramPendentes, "dataEntrada");


    const tickCfg = { color:"#fff", maxRotation:20, minRotation:0 };

    const byStatus = groupCount(tramPendentes, "status");
    const bySecTram = groupCount(tramPendentes, "secretaria");

    const secStatusMap = {};
    tramPendentes.forEach(t=>{
      const sec = t.secretaria || "Não informado";
      const st = t.status || "Indefinido";
      if(!secStatusMap[sec]) secStatusMap[sec] = {};
      secStatusMap[sec][st] = (secStatusMap[sec][st] || 0) + 1;
    });

    const secLabels = Object.keys(secStatusMap);
    const allStatuses = [...new Set(tramPendentes.map(t=>t.status))];

    // CORES FIXAS POR STATUS
const statusColors = {
  "AGUARDANDO": "#fbbf24",   // amarelo
  "EM ANDAMENTO": "#3b82f6", // azul
};

// gerar datasets com cores específicas
const datasetsGrouped = allStatuses.map(st => ({
  label: st,
  backgroundColor: statusColors[st.toUpperCase()] || "#9ca3af", // cinza para outros
  data: secLabels.map(sec => secStatusMap[sec][st] || 0)
}));


    // --- MONTAR OS GRÁFICOS EM LINHAS SEPARADAS ---
    chartArea.innerHTML = `

      <div class="pb-chart-card full">
        <h3>Setor</h3>
        <div class="chart-container"><canvas id="c3"></canvas></div>
      </div>

      <div class="pb-chart-card full">
        <h3>Motivo</h3>
        <div class="chart-container"><canvas id="c4"></canvas></div>
      </div>

      <div class="pb-chart-card full">
        <h3>Mês</h3>
        <div class="chart-container"><canvas id="c5"></canvas></div>
      </div>

      <div class="pb-chart-card full">
        <h3>Status</h3>
        <div class="chart-container"><canvas id="c10"></canvas></div>
      </div>

      <div class="pb-chart-card full">
        <h3>Secretaria</h3>
        <div class="chart-container"><canvas id="c11"></canvas></div>
      </div>

      <div class="pb-chart-card full">
        <h3>Trâmites Pendentes — Secretaria x Status</h3>
        <div class="chart-container"><canvas id="c12"></canvas></div>
      </div>

    `;

    // --- Destino ---
   new Chart(document.getElementById("c3"),{
  type:"bar",
  data:{
    labels: byDest.map(x=>x.label),
    datasets:[{
      data: byDest.map(x=>x.value),
      backgroundColor: palette.slice(0, byDest.length)
    }]
  },
  options:{ plugins:{legend:{display:false}}, scales:{ x:{ticks:tickCfg}, y:{ticks:{color:"#fff"}} } }
});


    // --- Motivo ---
   new Chart(document.getElementById("c4"),{
  type:"bar",
  data:{
    labels: byMot.map(x=>x.label),
    datasets:[{
      data: byMot.map(x=>x.value),
      backgroundColor: palette.slice(0, byMot.length)
    }]
  },
  options:{ plugins:{legend:{display:false}}, scales:{ x:{ticks:tickCfg}, y:{ticks:{color:"#fff"}} } }
});

    // --- Por Mês ---
    // --- Área: Entradas Pendentes por Dia ---
new Chart(document.getElementById("c5"),{
  type: "line",
  data: { 
    labels: timelineDaily.map(x => x.label),
    datasets: [{
      label: "Entradas por dia",
      data: timelineDaily.map(x => x.value),
      fill: true,
      backgroundColor: "rgba(96,165,250,0.35)",  // azul transparente
      borderColor: "#60a5fa",
      tension: 0.4,
      pointRadius: 3,
      pointBackgroundColor: "#60a5fa"
    }] 
  },
  options:{
    plugins:{
      legend:{ labels:{ color:"#fff" } }
    },
    scales:{
      x:{ 
        ticks:{ 
          color:"#fff",
          maxRotation: 45,
          minRotation: 0 
        }
      },
      y:{ ticks:{ color:"#fff" } }
    }
  }
});


    // --- Status ---
    // Gráfico STATUS com cores fixas
new Chart(document.getElementById("c10"),{
  type:"bar",
  data:{ 
    labels: byStatus.map(x => x.label),
    datasets: [{
      data: byStatus.map(x => x.value),
      backgroundColor: byStatus.map(x => {
        const st = x.label.toUpperCase();
        if (st === "AGUARDANDO") return "#fbbf24";    // amarelo
        if (st === "EM ANDAMENTO") return "#3b82f6";  // azul
        return "#9ca3af"; // cinza para outros
      })
    }]
  },
  options:{
    plugins:{ legend:{ display:false } },
    scales:{
      x:{ ticks: tickCfg },
      y:{ ticks:{ color:"#fff" } }
    }
  }
});


    // --- Secretaria ---
    new Chart(document.getElementById("c11"),{
  type:"bar",
  data:{
    labels: bySecTram.map(x=>x.label),
    datasets:[{
      data: bySecTram.map(x=>x.value),
      backgroundColor: palette.slice(0, bySecTram.length)
    }]
  },
  options:{ plugins:{legend:{display:false}}, scales:{ x:{ticks:tickCfg}, y:{ticks:{color:"#fff"}} } }
});


    // --- Secretaria x Status ---
    new Chart(document.getElementById("c12"),{
      type:"bar",
      data:{ labels:secLabels, datasets:datasetsGrouped },
      options:{
        plugins:{ legend:{ labels:{ color:"#fff" } } },
        scales:{ x:{ticks:tickCfg}, y:{ticks:{color:"#fff"}} }
      }
    });

  }

  // Aba inicial
  renderProcessCharts();

  // Controle de abas
  const tabProc=document.getElementById("tabProc");
  const tabTram=document.getElementById("tabTram");

  tabProc.onclick=()=>{
    tabProc.classList.add("active");
    tabTram.classList.remove("active");
    renderProcessCharts();
  };
  tabTram.onclick=()=>{
    tabTram.classList.add("active");
    tabProc.classList.remove("active");
    renderTramCharts();
  };

  document.getElementById("expX").onclick=()=>{
    exportToXLSX("dashboard.xlsx",{Processos:procs,Tramites:tram});
  };
  document.getElementById("expP").onclick=()=>window.print();
  document.getElementById("refresh").onclick=()=>initDashboardChart(container);
}

window.initDashboard = initDashboardChart;
window.initDashboardChart = initDashboardChart;

})();

