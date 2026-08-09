import { useState, useEffect, useRef } from "react";

const TAXAS = [
  { label: "Pix / À vista (-5%)", taxa: 0, desconto_extra: 5 },
  { label: "Débito", taxa: 0.0095, desconto_extra: 0 },
  { label: "Crédito 1x", taxa: 0.0314, desconto_extra: 0 },
  { label: "Crédito 2x", taxa: 0.0438, desconto_extra: 0 },
  { label: "Crédito 3x", taxa: 0.0439, desconto_extra: 0 },
  { label: "Crédito 4x", taxa: 0.0619, desconto_extra: 0 },
  { label: "Crédito 5x", taxa: 0.0698, desconto_extra: 0 },
  { label: "Crédito 6x", taxa: 0.0699, desconto_extra: 0 },
  { label: "Crédito 7x", taxa: 0.0909, desconto_extra: 0 },
  { label: "Crédito 8x", taxa: 0.0924, desconto_extra: 0 },
  { label: "Crédito 9x", taxa: 0.0948, desconto_extra: 0 },
  { label: "Crédito 10x", taxa: 0.0949, desconto_extra: 0 },
  { label: "Crédito 12x", taxa: 0.1049, desconto_extra: 0 },
  { label: "Crédito 18x", taxa: 0.1504, desconto_extra: 0 },
];

const SYSTEM_PROMPT = `Você é um parser de propostas comerciais da Ambient Luz. Retorne APENAS JSON válido, sem markdown, sem texto antes ou depois.

Formato:
{
  "numero": 40,
  "cliente": "Nome",
  "vendedor": "Nome",
  "data": "dd/mm/aaaa",
  "total": 44062.80,
  "grupos": [
    {
      "ambiente": "Nome do ambiente",
      "items": [
        {
          "codigo": "COD-001",
          "nomeOriginal": "NOME COMPLETO DO PRODUTO",
          "nome": "Nome truncado",
          "un": "UN",
          "qtd": 2,
          "preco": 469.90,
          "total": 939.80
        }
      ]
    }
  ],
  "extras": [
    {
      "tipo": "instalacao",
      "descricao": "Instalação de produtos",
      "qtd": 1,
      "total": 5251.40
    }
  ]
}

Regras:
1. Ambientes = linhas sem código e preço zero. Agrupe produtos abaixo de cada ambiente.
2. Truncamento: DOWNLIGHT→"Downlight embutir" | FITA DE LED→"Fita de led" | FIO DE LUZ/PERFIL→"Fio de luz" | FONTE→"Fonte" | SPOT LED EMBUTIDO→"Spot led embutido" | SPOT DIRECIONÁVEL→"Spot direcionável" | SPOT SOBREPOR→"Spot sobrepor" | SPOT DE TRILHO→"Spot de trilho" | PENDENTE→"Pendente" | BALIZADOR→"Balizador" | ARANDELA→"Arandela" | LÂMPADA→"Lâmpada" | TRILHO→"Trilho" | PRESILHA→"Presilha" | EMBUTIDO RECUADO→"Embutido recuado" | PLAFON→"Plafon" | PASTILHA→"Pastilha" | INSTALAÇÃO→vai para extras | Outros→3 primeiras palavras
3. INSTALAÇÃO e FRETE vão no array extras com tipo "instalacao" ou "frete"
4. codigo vazio = ""
5. extras pode ser []`;

const fmtBRL = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtPct = (v) => `${Number(v).toFixed(1)}%`;
const margemCor = (m) => m >= 60 ? "#16a34a" : m >= 45 ? "#d97706" : "#dc2626";
const STORAGE_KEY = "aluz_propostas_v2";
function loadPropostas() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; } }
function savePropostas(list) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {} }
const SENHAS = { "123456": "gestor", "12345": "projetista" };
function getRole() { try { return sessionStorage.getItem("aluz_role") || null; } catch { return null; } }
function setRole(r) { try { sessionStorage.setItem("aluz_role", r); } catch {} }
function clearRole() { try { sessionStorage.removeItem("aluz_role"); } catch {} }

// ── BLING API ─────────────────────────────────────────────────────────────────
async function buscarProdutoBling(codigo) {
  if (!codigo || codigo.trim() === "") return null;
  try {
    const resp = await fetch(`/api/produto?codigo=${encodeURIComponent(codigo)}`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

// ── GERADOR HTML ──────────────────────────────────────────────────────────────
function gerarHTMLCliente(proposta) {
  const extras = proposta.extras || [];
  const total = proposta.total || 0;
  const temFoto = proposta.grupos.some(g => g.items.some(i => i.foto));

  const gruposHTML = proposta.grupos.map(g => `
    <tr><td colspan="${temFoto?4:3}" style="background:#374151;color:#fff;font-weight:900;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;padding:12px 14px;border-top:8px solid #f4f4f5;">${g.ambiente.toUpperCase()}</td></tr>
    ${g.items.map((item, ii) => `
    <tr style="background:${ii%2===0?'#fff':'#f9fafb'}">
      ${temFoto ? `<td style="padding:6px 10px;width:60px;">${item.foto ? `<img src="${item.foto}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;">` : '<div style="width:50px;height:50px;background:#f3f4f6;border-radius:4px;"></div>'}</td>` : ''}
      <td style="padding:10px 14px;font-size:12px;font-weight:600;border-bottom:1px solid #f3f4f6;">${item.nome}</td>
      <td style="padding:10px 14px;font-size:12px;color:#6b7280;text-align:center;border-bottom:1px solid #f3f4f6;">${item.un||''} × ${item.qtd}</td>
      <td style="padding:10px 14px;font-size:12px;font-weight:700;text-align:right;border-bottom:1px solid #f3f4f6;">${fmtBRL(item.total||0)}</td>
    </tr>`).join('')}
  `).join('');

  const extrasHTML = extras.length > 0 ? `
    <div style="margin-top:20px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <div style="background:#1a1a1a;color:#fff;padding:10px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;">Serviços adicionais</div>
      ${extras.map((e,ii) => `<div style="display:flex;justify-content:space-between;padding:10px 14px;background:${ii%2===0?'#fff':'#f9fafb'};border-bottom:1px solid #f3f4f6;">
        <span style="font-size:12px;font-weight:600;">${e.tipo==='instalacao'?'🔧':'🚚'} ${e.descricao}</span>
        <span style="font-size:12px;font-weight:700;">${fmtBRL(e.total||0)}</span>
      </div>`).join('')}
    </div>` : '';

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Proposta Nº ${proposta.numero} — ${proposta.cliente}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;padding:40px;max-width:820px;margin:0 auto}@media print{body{padding:20px}@page{margin:1cm}}</style>
</head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:2px solid #1a1a1a;">
  <div><div style="font-size:22px;font-weight:800;">aluz <span style="color:#6b7280;font-weight:300;font-size:18px;">projetos luminotécnicos</span></div>
  <div style="font-size:9px;color:#6b7280;line-height:1.8;margin-top:8px;">Ambient Luz Projetos Ltda<br>Rua Frederico de Menezes, Nº 0, Lote 18 — Rio de Janeiro, RJ<br>CNPJ: 26.208.551/0001-39</div></div>
  <div style="text-align:right;"><div style="font-size:20px;font-weight:700;">Proposta Nº ${proposta.numero}</div><div style="font-size:10px;color:#6b7280;margin-top:4px;">Data: ${proposta.data}</div></div>
</div>
<div style="display:flex;justify-content:space-between;margin-bottom:28px;">
  <div><div style="font-size:8px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Para</div><div style="font-size:14px;font-weight:700;">${proposta.cliente}</div></div>
  <div><div style="font-size:8px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Responsável</div><div style="font-size:12px;">${proposta.vendedor}</div></div>
  <div><div style="font-size:8px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">Validade</div><div style="font-size:12px;">7 dias corridos</div></div>
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
  <thead><tr style="background:#1a1a1a;">
    ${temFoto ? '<th style="width:60px;padding:10px;"></th>' : ''}
    <th style="padding:10px 14px;font-size:9px;font-weight:700;text-transform:uppercase;color:#fff;text-align:left;">Produto</th>
    <th style="padding:10px 14px;font-size:9px;font-weight:700;text-transform:uppercase;color:#fff;text-align:center;">Un. × Qtd.</th>
    <th style="padding:10px 14px;font-size:9px;font-weight:700;text-transform:uppercase;color:#fff;text-align:right;">Total</th>
  </tr></thead>
  <tbody>${gruposHTML}</tbody>
</table>
${extrasHTML}
<div style="display:flex;justify-content:flex-end;margin-top:24px;margin-bottom:28px;">
  <div style="border:2px solid #1a1a1a;border-radius:10px;padding:16px 24px;min-width:220px;text-align:right;">
    <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">Total da proposta</div>
    <div style="font-size:26px;font-weight:900;">${fmtBRL(total)}</div>
  </div>
</div>
<div style="font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">Formas de pagamento</div>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px;">
  <div style="background:#1a1a1a;border-radius:8px;padding:12px 16px;"><div style="font-size:9px;color:#9ca3af;margin-bottom:4px;">Pix ou espécie</div><div style="font-size:13px;font-weight:700;color:#fff;">${fmtBRL(total*0.95)} <span style="font-size:10px;opacity:0.7;">(-5%)</span></div></div>
  <div style="background:#f9fafb;border-radius:8px;padding:12px 16px;border:1px solid #e5e7eb;"><div style="font-size:9px;color:#6b7280;margin-bottom:4px;">Boleto bancário</div><div style="font-size:12px;font-weight:600;">Até 3x sem juros (1+2)</div></div>
  <div style="background:#f9fafb;border-radius:8px;padding:12px 16px;border:1px solid #e5e7eb;"><div style="font-size:9px;color:#6b7280;margin-bottom:4px;">Cartão de crédito</div><div style="font-size:12px;font-weight:600;">Até 10x sem juros</div></div>
</div>
<div style="background:#f9fafb;border-radius:8px;padding:14px 18px;margin-bottom:24px;font-size:10px;color:#374151;line-height:1.8;">
  <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9ca3af;margin-bottom:6px;">Observações</div>
  Esta proposta contempla o fornecimento dos produtos de iluminação conforme projeto luminotécnico aprovado. Os ambientes e quantidades descritos seguem especificação do projeto. Valores sujeitos à disponibilidade de estoque na data do pedido.
</div>
<div style="border-top:1px solid #e5e7eb;padding-top:14px;display:flex;justify-content:space-between;">
  <div style="font-size:10px;line-height:1.7;">Atenciosamente,<br><strong>${proposta.vendedor}</strong><br>Departamento de Vendas — Ambient Luz</div>
  <div style="font-size:9px;color:#dc2626;font-weight:600;">⚠ Válida por 7 dias corridos a partir de ${proposta.data}</div>
</div>
</body></html>`;
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function VisualizarModal({ proposta, onFechar }) {
  const html = gerarHTMLCliente(proposta);
  const iframeRef = useRef();
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:9999, display:"flex", flexDirection:"column" }}>
      <div style={{ background:"#1a1a1a", padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <span style={{ color:"#fff", fontWeight:600, fontSize:14 }}>Proposta Nº {proposta.numero} — {proposta.cliente}</span>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={() => iframeRef.current?.contentWindow?.print()} style={{ padding:"8px 20px", background:"#fff", color:"#1a1a1a", border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer" }}>🖨 Imprimir / Salvar PDF</button>
          <button onClick={onFechar} style={{ padding:"8px 14px", background:"transparent", color:"#9ca3af", border:"1px solid #374151", borderRadius:8, fontSize:13, cursor:"pointer" }}>✕ Fechar</button>
        </div>
      </div>
      <div style={{ flex:1, overflow:"hidden", background:"#525659", padding:"20px 0" }}>
        <iframe ref={iframeRef} srcDoc={html} sandbox="allow-same-origin allow-scripts allow-modals"
          style={{ width:"820px", maxWidth:"100%", height:"100%", border:"none", margin:"0 auto", display:"block", boxShadow:"0 4px 32px rgba(0,0,0,0.4)", borderRadius:4 }} />
      </div>
      <div style={{ background:"#111", padding:"10px 20px", textAlign:"center" }}>
        <p style={{ color:"#6b7280", fontSize:12 }}>Clique em <strong style={{ color:"#fff" }}>🖨 Imprimir / Salvar PDF</strong> → <strong style={{ color:"#fff" }}>"Salvar como PDF"</strong></p>
      </div>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [senha, setSenha] = useState(""); const [erro, setErro] = useState(""); const [loading, setLoading] = useState(false);
  const handleLogin = () => {
    setLoading(true); setErro("");
    setTimeout(() => {
      const role = SENHAS[senha];
      if (role) { setRole(role); onLogin(role); } else setErro("Senha incorreta.");
      setLoading(false);
    }, 400);
  };
  return (
    <div style={{ minHeight:"100vh", background:"#f4f4f5", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:16, padding:"40px 48px", width:380, boxShadow:"0 4px 32px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:28, fontWeight:800, letterSpacing:-1, marginBottom:4 }}>aluz</div>
          <div style={{ fontSize:13, color:"#6b7280" }}>Gestão de propostas</div>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12, fontWeight:600, color:"#374151", display:"block", marginBottom:6 }}>Senha de acesso</label>
          <input type="password" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key==="Enter"&&handleLogin()} placeholder="Digite sua senha"
            style={{ width:"100%", padding:"11px 14px", border:"1px solid #d1d5db", borderRadius:8, fontSize:14, outline:"none", boxSizing:"border-box" }} />
        </div>
        {erro && <div style={{ color:"#dc2626", fontSize:13, marginBottom:12 }}>{erro}</div>}
        <button onClick={handleLogin} disabled={loading}
          style={{ width:"100%", padding:"11px", background:"#1a1a1a", color:"#fff", border:"none", borderRadius:8, fontSize:14, fontWeight:600, cursor:"pointer", opacity:loading?0.7:1 }}>
          {loading?"Entrando...":"Entrar"}
        </button>
      </div>
    </div>
  );
}

// ── TOPBAR ────────────────────────────────────────────────────────────────────
function TopBar({ aba, setAba, role, onLogout }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 24px", borderBottom:"1px solid #e5e7eb", background:"#fff", position:"sticky", top:0, zIndex:10 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:28, height:28, borderRadius:6, background:"#1a1a1a", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ color:"#fff", fontSize:14, fontWeight:600 }}>A</span>
        </div>
        <span style={{ fontWeight:600, fontSize:15 }}>Ambient Luz</span>
        <span style={{ color:"#d1d5db", margin:"0 4px" }}>|</span>
        <span style={{ fontSize:13, color:"#6b7280" }}>Gestão de propostas</span>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        {role==="gestor" && (
          <div style={{ display:"flex", gap:2, background:"#f3f4f6", borderRadius:8, padding:3 }}>
            {["Projetista","Gestor"].map(t => (
              <button key={t} onClick={() => setAba(t)} style={{ padding:"6px 18px", border:"none", borderRadius:6, background:aba===t?"#fff":"transparent", color:aba===t?"#1a1a1a":"#6b7280", fontWeight:aba===t?600:400, fontSize:13, cursor:"pointer", boxShadow:aba===t?"0 1px 3px rgba(0,0,0,0.08)":"none" }}>{t}</button>
            ))}
          </div>
        )}
        {role==="projetista" && <span style={{ fontSize:12, background:"#f3f4f6", padding:"4px 12px", borderRadius:6, color:"#374151" }}>Projetista</span>}
        <button onClick={onLogout} style={{ fontSize:12, color:"#6b7280", background:"none", border:"none", cursor:"pointer" }}>Sair</button>
      </div>
    </div>
  );
}

// ── ABA PROJETISTA ────────────────────────────────────────────────────────────
function AbaProjetista({ historico, setHistorico }) {
  const [etapa, setEtapa] = useState("upload");
  const [proposta, setProposta] = useState(null);
  const [progresso, setProgresso] = useState("");
  const [erro, setErro] = useState("");
  const [verModal, setVerModal] = useState(null);
  const inputRef = useRef();

  const handleFile = (file) => {
    if (!file || file.type!=="application/pdf") { alert("Envie um arquivo PDF."); return; }
    const reader = new FileReader();
    reader.onload = (e) => processarPDF(e.target.result);
    reader.readAsDataURL(file);
  };

  const processarPDF = async (base64Data) => {
    setEtapa("processando"); setProgresso("Lendo o PDF com IA..."); setErro("");
    try {
      const base64Content = base64Data.split(",")[1];
      const response = await fetch("/api/processar", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ pdfBase64: base64Content })
      });
      const parsed = await response.json();
      if (!response.ok) throw new Error(parsed.error||"Erro no servidor");

      // Busca fotos e custos no Bling para cada produto com código
      setProgresso("Buscando fotos e custos no Bling...");
      const grupos = await Promise.all(parsed.grupos.map(async (grupo) => ({
        ...grupo,
        items: await Promise.all(grupo.items.map(async (item) => {
          if (!item.codigo) return item;
          const blingData = await buscarProdutoBling(item.codigo);
          return { ...item, foto: blingData?.foto || null, precoCusto: blingData?.precoCusto || null };
        }))
      })));
      setProposta({ ...parsed, grupos });
      setEtapa("revisao");
    } catch(e) { setErro(`Erro: ${e.message}`); setEtapa("upload"); }
  };

  const atualizarNome = (gi, ii, val) => {
    const p = JSON.parse(JSON.stringify(proposta));
    p.grupos[gi].items[ii].nome = val;
    setProposta(p);
  };

  const enviarAoGestor = () => {
    const entry = { id:Date.now(), ...proposta, custo:null, desconto:0, status:"aguardando_custo", criadoEm: new Date().toISOString() };
    const novo = [...historico, entry];
    setHistorico(novo); savePropostas(novo); setEtapa("enviado");
  };

  if (etapa==="processando") return (
    <div style={{ padding:48, textAlign:"center" }}>
      <div style={{ fontSize:40, marginBottom:16 }}>⏳</div>
      <h2 style={{ fontSize:18, fontWeight:600, marginBottom:8 }}>Processando...</h2>
      <p style={{ fontSize:14, color:"#6b7280" }}>{progresso}</p>
    </div>
  );

  if (etapa==="enviado") return (
    <div style={{ padding:48, textAlign:"center", maxWidth:480, margin:"0 auto" }}>
      {verModal && <VisualizarModal proposta={verModal} onFechar={() => setVerModal(null)} />}
      <div style={{ fontSize:48, marginBottom:16 }}>✓</div>
      <h2 style={{ fontSize:20, fontWeight:600, marginBottom:8 }}>Enviado ao gestor!</h2>
      <p style={{ fontSize:14, color:"#6b7280", marginBottom:24 }}>Proposta Nº {proposta?.numero} salva.</p>
      <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
        <button onClick={() => setVerModal(proposta)} style={{ padding:"10px 20px", background:"#374151", color:"#fff", border:"none", borderRadius:8, fontSize:13, cursor:"pointer", fontWeight:500 }}>👁 Ver proposta</button>
        <button onClick={() => { setEtapa("upload"); setProposta(null); }} style={{ padding:"10px 20px", background:"#1a1a1a", color:"#fff", border:"none", borderRadius:8, fontSize:13, cursor:"pointer", fontWeight:500 }}>Nova proposta</button>
      </div>
    </div>
  );

  if (etapa==="revisao") return (
    <div style={{ padding:"24px 32px" }}>
      {verModal && <VisualizarModal proposta={verModal} onFechar={() => setVerModal(null)} />}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:600, marginBottom:4 }}>Proposta Nº {proposta.numero} — {proposta.cliente}</h2>
          <div style={{ fontSize:13, color:"#6b7280" }}>{proposta.data} · {proposta.vendedor} · {fmtBRL(proposta.total||0)}</div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <button onClick={() => setEtapa("upload")} style={{ padding:"8px 16px", border:"1px solid #e5e7eb", borderRadius:8, background:"#fff", fontSize:13, cursor:"pointer" }}>← Voltar</button>
          <button onClick={() => setVerModal(proposta)} style={{ padding:"8px 20px", background:"#374151", color:"#fff", border:"none", borderRadius:8, fontSize:13, cursor:"pointer", fontWeight:500 }}>👁 Ver / Imprimir</button>
          <button onClick={enviarAoGestor} style={{ padding:"8px 20px", background:"#1a1a1a", color:"#fff", border:"none", borderRadius:8, fontSize:13, cursor:"pointer", fontWeight:500 }}>↑ Enviar ao gestor</button>
        </div>
      </div>
      <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, padding:"10px 14px", marginBottom:20, fontSize:13, color:"#92400e" }}>
        ✏️ Clique em qualquer nome para editar antes de enviar.
      </div>
      {proposta.grupos.map((grupo, gi) => (
        <div key={gi} style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, background:"#374151", color:"#fff", padding:"11px 16px", borderRadius:"10px 10px 0 0" }}>
            <span>📍</span>
            <span style={{ fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" }}>{grupo.ambiente}</span>
            <span style={{ marginLeft:"auto", fontSize:11, color:"#9ca3af" }}>{grupo.items.length} {grupo.items.length===1?"item":"itens"}</span>
          </div>
          <div style={{ border:"1px solid #e5e7eb", borderTop:"none", borderRadius:"0 0 10px 10px", overflow:"hidden" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr style={{ background:"#f9fafb" }}>
                <th style={{ padding:"8px 12px", fontSize:11, fontWeight:600, color:"#6b7280", textAlign:"left", borderBottom:"1px solid #e5e7eb", textTransform:"uppercase" }}>Produto</th>
                {["Un.","Qtd.","Preço un.","Total"].map((h,i) => (
                  <th key={i} style={{ padding:"8px 12px", fontSize:11, fontWeight:600, color:"#6b7280", textAlign:"right", borderBottom:"1px solid #e5e7eb", textTransform:"uppercase" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {grupo.items.map((item, ii) => (
                  <tr key={ii} style={{ borderBottom:ii<grupo.items.length-1?"1px solid #f3f4f6":"none", background:ii%2===0?"#fff":"#fafafa" }}>
                    <td style={{ padding:"8px 12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        {item.foto && <img src={item.foto} style={{ width:40, height:40, objectFit:"cover", borderRadius:4, flexShrink:0 }} />}
                        <div>
                          <input value={item.nome} onChange={e => atualizarNome(gi,ii,e.target.value)}
                            style={{ border:"none", background:"transparent", fontSize:13, color:"#1a1a1a", width:"100%", padding:"2px 6px", borderRadius:4, outline:"none" }}
                            onFocus={e => { e.target.style.background="#eff6ff"; e.target.style.outline="1.5px solid #3b82f6"; }}
                            onBlur={e => { e.target.style.background="transparent"; e.target.style.outline="none"; }}
                          />
                          {item.nomeOriginal && <div style={{ fontSize:11, color:"#9ca3af", paddingLeft:6, marginTop:1 }}>{item.codigo&&`${item.codigo} · `}{item.nomeOriginal}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:"8px 12px", fontSize:13, color:"#6b7280", textAlign:"right" }}>{item.un}</td>
                    <td style={{ padding:"8px 12px", fontSize:13, color:"#6b7280", textAlign:"right" }}>{item.qtd}</td>
                    <td style={{ padding:"8px 12px", fontSize:13, textAlign:"right" }}>{fmtBRL(item.preco||0)}</td>
                    <td style={{ padding:"8px 12px", fontSize:13, fontWeight:600, textAlign:"right" }}>{fmtBRL(item.total||0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {(proposta.extras||[]).length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, background:"#1a1a1a", color:"#fff", padding:"11px 16px", borderRadius:"10px 10px 0 0" }}>
            <span>🔧</span><span style={{ fontSize:12, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" }}>Serviços adicionais</span>
          </div>
          <div style={{ border:"1px solid #e5e7eb", borderTop:"none", borderRadius:"0 0 10px 10px", overflow:"hidden" }}>
            {(proposta.extras||[]).map((e,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"12px 16px", borderBottom:i<proposta.extras.length-1?"1px solid #f3f4f6":"none", background:i%2===0?"#fff":"#fafafa" }}>
                <span style={{ fontSize:13 }}>{e.tipo==="instalacao"?"🔧":"🚚"} {e.descricao}</span>
                <span style={{ fontSize:13, fontWeight:700 }}>{fmtBRL(e.total||0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", borderTop:"1px solid #e5e7eb", paddingTop:16 }}>
        <button onClick={() => setVerModal(proposta)} style={{ padding:"10px 24px", background:"#374151", color:"#fff", border:"none", borderRadius:8, fontSize:14, cursor:"pointer", fontWeight:500 }}>👁 Ver / Imprimir proposta</button>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:13, color:"#6b7280", marginBottom:4 }}>Total</div>
          <div style={{ fontSize:24, fontWeight:700 }}>{fmtBRL(proposta.total||0)}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding:32, maxWidth:620, margin:"0 auto" }}>
      {verModal && <VisualizarModal proposta={verModal} onFechar={() => setVerModal(null)} />}
      {erro && <div style={{ marginBottom:16, background:"#fef2f2", border:"1px solid #fecaca", borderRadius:8, padding:"10px 14px", fontSize:13, color:"#dc2626" }}>⚠️ {erro}</div>}
      <h2 style={{ fontSize:20, fontWeight:600, marginBottom:6 }}>Nova proposta</h2>
      <p style={{ fontSize:14, color:"#6b7280", marginBottom:24 }}>Envie o PDF exportado do Bling.</p>
      <div onClick={() => inputRef.current.click()}
        style={{ border:"2px dashed #d1d5db", borderRadius:12, padding:"52px 32px", textAlign:"center", cursor:"pointer", background:"#fff" }}>
        <div style={{ fontSize:36, marginBottom:12 }}>📄</div>
        <div style={{ fontWeight:600, fontSize:15, marginBottom:6 }}>Clique para selecionar o PDF</div>
        <div style={{ fontSize:13, color:"#9ca3af", marginBottom:20 }}>ou arraste e solte aqui</div>
        <div style={{ display:"inline-block", background:"#1a1a1a", color:"#fff", padding:"9px 22px", borderRadius:8, fontSize:13, fontWeight:500 }}>Selecionar PDF</div>
        <input ref={inputRef} type="file" accept="application/pdf" style={{ display:"none" }} onChange={e => handleFile(e.target.files[0])} />
      </div>
      {historico.length > 0 && (
        <div style={{ marginTop:32 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Propostas anteriores</div>
          {historico.slice().reverse().map((p, i) => (
            <div key={p.id||i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", border:"1px solid #e5e7eb", borderRadius:10, marginBottom:8, background:"#fff" }}>
              <div>
                <div style={{ fontWeight:600, fontSize:13, marginBottom:2 }}>Nº {p.numero} — {p.cliente}</div>
                <div style={{ fontSize:12, color:"#6b7280" }}>{p.data} · {fmtBRL(p.total)}</div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={() => { setProposta(JSON.parse(JSON.stringify(p))); setEtapa("revisao"); }}
                  style={{ padding:"6px 12px", border:"1px solid #e5e7eb", borderRadius:8, background:"#fff", fontSize:12, cursor:"pointer" }}>Reabrir</button>
                <button onClick={() => setVerModal(p)}
                  style={{ padding:"6px 12px", border:"none", borderRadius:8, background:"#1a1a1a", fontSize:12, cursor:"pointer", color:"#fff", fontWeight:500 }}>👁 Ver</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ABA GESTOR ────────────────────────────────────────────────────────────────
function AbaGestor({ historico, setHistorico }) {
  const [selecionada, setSelecionada] = useState(null);
  const [verModal, setVerModal] = useState(null);

  // Configurações financeiras
  const [desconto, setDesconto] = useState(0);
  const [formaPgto, setFormaPgto] = useState("Pix / À vista (-5%)");
  const [temRT, setTemRT] = useState(false);
  const [temCasaPremium, setTemCasaPremium] = useState(false);

  const proposta = selecionada!=null ? historico[selecionada] : null;

  // Calcula margem considerando todos os fatores
  const calcularMargem = (p, desc, forma, rt, casaPremium) => {
    if (!p) return null;
    const taxaInfo = TAXAS.find(t => t.label === forma) || TAXAS[0];
    const descontoComercial = (desc||0) + taxaInfo.desconto_extra;
    const totalComDesc = p.total * (1 - descontoComercial/100);
    const totalAposMaquina = totalComDesc * (1 - taxaInfo.taxa);
    const totalAposRT = rt ? totalAposMaquina * 0.90 : totalAposMaquina;
    const totalAposCasaPremium = casaPremium ? totalAposRT * (1 - 0.035) : totalAposRT;
    const receitaLiquida = totalAposCasaPremium;

    // Custo por produto via precoCusto do Bling
    let custoTotal = 0;
    let itensSemCusto = 0;
    const grupos = p.grupos.map(g => ({
      ...g,
      items: g.items.map(item => {
        const custo = item.precoCusto ? item.precoCusto * item.qtd : null;
        if (custo === null) itensSemCusto++;
        else custoTotal += custo;
        const margem = custo && item.total > 0 ? ((item.total - custo) / item.total) * 100 : null;
        return { ...item, custoTotal: custo, margem };
      })
    }));

    const margemBruta = custoTotal > 0 ? ((p.total - custoTotal) / p.total) * 100 : null;
    const lucroLiquido = receitaLiquida - custoTotal;
    const margemLiquida = receitaLiquida > 0 && custoTotal > 0 ? (lucroLiquido / receitaLiquida) * 100 : null;

    return {
      totalBruto: p.total, totalComDesc, totalAposMaquina, totalAposRT, totalAposCasaPremium: receitaLiquida,
      custoTotal, margemBruta, lucroLiquido, margemLiquida, grupos, itensSemCusto,
      descontoComercial, taxaMaquina: taxaInfo.taxa, rtDesc: rt?10:0, casaDesc: casaPremium?3.5:0
    };
  };

  const calc = proposta ? calcularMargem(proposta, desconto, formaPgto, temRT, temCasaPremium) : null;

  const salvarConfig = () => {
    if (!proposta) return;
    const idx = historico.length - 1 - historico.slice().reverse().findIndex((_, i) => selecionada === historico.length-1-i);
    const novo = historico.map((p,i) => i===selecionada ? {...p, desconto, formaPgto, temRT, temCasaPremium, status:"com_custo"} : p);
    setHistorico(novo); savePropostas(novo);
  };

  useEffect(() => {
    if (proposta) {
      setDesconto(proposta.desconto||0);
      setFormaPgto(proposta.formaPgto||"Pix / À vista (-5%)");
      setTemRT(proposta.temRT||false);
      setTemCasaPremium(proposta.temCasaPremium||false);
    }
  }, [selecionada]);

  if (historico.length===0) return (
    <div style={{ padding:48, textAlign:"center", color:"#6b7280" }}>
      <div style={{ fontSize:40, marginBottom:12 }}>📭</div>
      <p>Nenhuma proposta recebida ainda.</p>
    </div>
  );

  if (proposta) return (
    <div style={{ padding:"24px 32px" }}>
      {verModal && <VisualizarModal proposta={proposta} onFechar={() => setVerModal(null)} />}

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
        <button onClick={() => setSelecionada(null)} style={{ padding:"7px 14px", border:"1px solid #e5e7eb", borderRadius:8, background:"#fff", fontSize:13, cursor:"pointer" }}>← Voltar</button>
        <div>
          <div style={{ fontWeight:600, fontSize:16 }}>Proposta Nº {proposta.numero} — {proposta.cliente}</div>
          <div style={{ fontSize:13, color:"#6b7280" }}>{proposta.data} · {proposta.vendedor} · {fmtBRL(proposta.total)}</div>
        </div>
        <button onClick={() => setVerModal(true)} style={{ marginLeft:"auto", padding:"7px 16px", border:"1px solid #e5e7eb", borderRadius:8, background:"#fff", fontSize:13, cursor:"pointer" }}>👁 Ver proposta</button>
      </div>

      {/* Configurações financeiras */}
      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"20px 24px", marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#374151", marginBottom:16, textTransform:"uppercase", letterSpacing:"0.06em" }}>Configurações do fechamento</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:"#6b7280", display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>Desconto comercial (%)</label>
            <input type="number" value={desconto} onChange={e => setDesconto(parseFloat(e.target.value)||0)} min="0" max="30"
              style={{ width:"100%", padding:"10px 14px", border:"1px solid #d1d5db", borderRadius:8, fontSize:15, outline:"none", boxSizing:"border-box" }} />
          </div>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:"#6b7280", display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.05em" }}>Forma de pagamento</label>
            <select value={formaPgto} onChange={e => setFormaPgto(e.target.value)}
              style={{ width:"100%", padding:"10px 14px", border:"1px solid #d1d5db", borderRadius:8, fontSize:13, outline:"none", boxSizing:"border-box", background:"#fff" }}>
              {TAXAS.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:"flex", gap:16 }}>
          <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", padding:"10px 16px", border:`1.5px solid ${temRT?"#1a1a1a":"#e5e7eb"}`, borderRadius:8, background:temRT?"#1a1a1a":"#fff", color:temRT?"#fff":"#374151", fontSize:13, fontWeight:500, transition:"all 0.15s" }}>
            <input type="checkbox" checked={temRT} onChange={e => setTemRT(e.target.checked)} style={{ display:"none" }} />
            {temRT?"✓ ":""}RT (−10%)
          </label>
          <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", padding:"10px 16px", border:`1.5px solid ${temCasaPremium?"#1a1a1a":"#e5e7eb"}`, borderRadius:8, background:temCasaPremium?"#1a1a1a":"#fff", color:temCasaPremium?"#fff":"#374151", fontSize:13, fontWeight:500, transition:"all 0.15s" }}>
            <input type="checkbox" checked={temCasaPremium} onChange={e => setTemCasaPremium(e.target.checked)} style={{ display:"none" }} />
            {temCasaPremium?"✓ ":""}Casa Premium (−3,5%)
          </label>
          <button onClick={salvarConfig} style={{ marginLeft:"auto", padding:"10px 20px", background:"#1a1a1a", color:"#fff", border:"none", borderRadius:8, fontSize:13, cursor:"pointer", fontWeight:500 }}>Calcular</button>
        </div>
      </div>

      {calc && (
        <>
          {/* Fluxo de descontos */}
          <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"20px 24px", marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#374151", marginBottom:16, textTransform:"uppercase", letterSpacing:"0.06em" }}>Fluxo do valor</div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {[
                { label:"Total bruto", val:calc.totalBruto, desc:null },
                { label:`Desconto comercial (${calc.descontoComercial.toFixed(1)}%)`, val:calc.totalComDesc, desc:`−${fmtBRL(calc.totalBruto-calc.totalComDesc)}` },
                { label:`Taxa maquininha (${(calc.taxaMaquina*100).toFixed(2)}%)`, val:calc.totalAposMaquina, desc:calc.taxaMaquina>0?`−${fmtBRL(calc.totalComDesc-calc.totalAposMaquina)}`:null },
                temRT && { label:"RT (−10%)", val:calc.totalAposRT, desc:`−${fmtBRL(calc.totalAposMaquina-calc.totalAposRT)}` },
                temCasaPremium && { label:"Casa Premium (−3,5%)", val:calc.totalAposCasaPremium, desc:`−${fmtBRL(calc.totalAposRT-calc.totalAposCasaPremium)}` },
              ].filter(Boolean).map((row, i, arr) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:i===arr.length-1?"#f0fdf4":"#f9fafb", borderRadius:8, border:i===arr.length-1?"1px solid #bbf7d0":"1px solid #f3f4f6" }}>
                  <span style={{ fontSize:13, color:i===arr.length-1?"#166534":"#374151", fontWeight:i===arr.length-1?600:400 }}>{row.label}</span>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:14, fontWeight:700, color:i===arr.length-1?"#166534":"#1a1a1a" }}>{fmtBRL(row.val)}</div>
                    {row.desc && <div style={{ fontSize:11, color:"#dc2626" }}>{row.desc}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cards de margem */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
            {[
              { label:"Custo total (Bling)", val:calc.custoTotal>0?fmtBRL(calc.custoTotal):"Sem custo", cor:"#1a1a1a" },
              { label:"Receita líquida", val:fmtBRL(calc.totalAposCasaPremium), cor:"#1a1a1a" },
              { label:"Margem bruta", val:calc.margemBruta!=null?fmtPct(calc.margemBruta):"—", cor:calc.margemBruta!=null?margemCor(calc.margemBruta):"#9ca3af" },
              { label:"Margem líquida", val:calc.margemLiquida!=null?fmtPct(calc.margemLiquida):"—", cor:calc.margemLiquida!=null?margemCor(calc.margemLiquida):"#9ca3af" },
            ].map((c,i) => (
              <div key={i} style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:8, padding:"14px 16px" }}>
                <div style={{ fontSize:12, color:"#6b7280", marginBottom:6 }}>{c.label}</div>
                <div style={{ fontSize:20, fontWeight:700, color:c.cor }}>{c.val}</div>
              </div>
            ))}
          </div>

          {calc.itensSemCusto > 0 && (
            <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, padding:"10px 14px", marginBottom:20, fontSize:13, color:"#92400e" }}>
              ⚠ {calc.itensSemCusto} {calc.itensSemCusto===1?"item sem":"itens sem"} custo cadastrado no Bling — margem parcial.
            </div>
          )}

          {/* Tabela item por item */}
          <div style={{ fontSize:13, fontWeight:700, color:"#374151", marginBottom:12, textTransform:"uppercase", letterSpacing:"0.06em" }}>Margem por produto</div>
          {calc.grupos.map((grupo, gi) => (
            <div key={gi} style={{ marginBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"#374151", color:"#fff", padding:"8px 14px", borderRadius:"8px 8px 0 0" }}>
                <span style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase" }}>📍 {grupo.ambiente}</span>
              </div>
              <div style={{ border:"1px solid #e5e7eb", borderTop:"none", borderRadius:"0 0 8px 8px", overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr style={{ background:"#f9fafb" }}>
                    {["Produto","Qtd","Venda un.","Total venda","Custo un.","Total custo","Margem"].map((h,i) => (
                      <th key={i} style={{ padding:"7px 12px", fontSize:10, fontWeight:600, color:"#6b7280", textAlign:i===0?"left":"right", borderBottom:"1px solid #e5e7eb", textTransform:"uppercase" }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {grupo.items.map((item, ii) => (
                      <tr key={ii} style={{ borderBottom:ii<grupo.items.length-1?"1px solid #f3f4f6":"none", background:ii%2===0?"#fff":"#fafafa" }}>
                        <td style={{ padding:"8px 12px" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            {item.foto && <img src={item.foto} style={{ width:32, height:32, objectFit:"cover", borderRadius:4, flexShrink:0 }} />}
                            <span style={{ fontSize:12, fontWeight:500 }}>{item.nome}</span>
                          </div>
                        </td>
                        <td style={{ padding:"8px 12px", fontSize:12, textAlign:"right", color:"#6b7280" }}>{item.qtd}</td>
                        <td style={{ padding:"8px 12px", fontSize:12, textAlign:"right" }}>{fmtBRL(item.preco||0)}</td>
                        <td style={{ padding:"8px 12px", fontSize:12, textAlign:"right", fontWeight:500 }}>{fmtBRL(item.total||0)}</td>
                        <td style={{ padding:"8px 12px", fontSize:12, textAlign:"right", color:"#6b7280" }}>{item.precoCusto?fmtBRL(item.precoCusto):"—"}</td>
                        <td style={{ padding:"8px 12px", fontSize:12, textAlign:"right", color:"#6b7280" }}>{item.custoTotal?fmtBRL(item.custoTotal):"—"}</td>
                        <td style={{ padding:"8px 12px", textAlign:"right" }}>
                          {item.margem!=null
                            ? <span style={{ background:margemCor(item.margem)+"18", color:margemCor(item.margem), fontWeight:700, fontSize:12, padding:"2px 8px", borderRadius:5 }}>{fmtPct(item.margem)}</span>
                            : <span style={{ color:"#9ca3af", fontSize:12 }}>—</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Meta */}
          <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, padding:"12px 16px", fontSize:13, color:"#166534", marginBottom:24 }}>
            <strong>Meta Ambient Luz — 70% de margem:</strong> custo máximo {fmtBRL(calc.totalAposCasaPremium*0.30)} · markup mínimo 3,33x
          </div>
        </>
      )}
    </div>
  );

  // Lista de propostas
  return (
    <div style={{ padding:"24px 32px" }}>
      {verModal && <VisualizarModal proposta={verModal} onFechar={() => setVerModal(null)} />}
      <h2 style={{ fontSize:18, fontWeight:600, marginBottom:6 }}>Propostas recebidas</h2>
      <p style={{ fontSize:13, color:"#6b7280", marginBottom:20 }}>Clique para analisar a margem.</p>
      {historico.slice().reverse().map((p,i) => {
        const idx = historico.length-1-i;
        return (
          <div key={p.id||i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", border:"1px solid #e5e7eb", borderRadius:10, marginBottom:10, background:"#fff", cursor:"pointer" }}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="#1a1a1a"}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="#e5e7eb"}}
            onClick={() => setSelecionada(idx)}
          >
            <div>
              <div style={{ fontWeight:600, fontSize:14, marginBottom:3 }}>Nº {p.numero} — {p.cliente}</div>
              <div style={{ fontSize:12, color:"#6b7280" }}>{p.data} · {p.vendedor} · {fmtBRL(p.total)}</div>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ background:"#fef3c7", color:"#92400e", fontSize:12, fontWeight:600, padding:"4px 10px", borderRadius:6 }}>
                {p.status==="com_custo"?"✓ Analisado":"Aguardando análise"}
              </span>
              <span style={{ color:"#9ca3af" }}>›</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [role, setRoleState] = useState(getRole);
  const [aba, setAba] = useState("Projetista");
  const [historico, setHistorico] = useState(loadPropostas);
  const handleLogin = (r) => setRoleState(r);
  const handleLogout = () => { clearRole(); setRoleState(null); };
  if (!role) return <LoginScreen onLogin={handleLogin} />;
  return (
    <div style={{ minHeight:"100vh", background:"#f4f4f5", fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <TopBar aba={aba} setAba={setAba} role={role} onLogout={handleLogout} />
      {role==="gestor"
        ? (aba==="Projetista" ? <AbaProjetista historico={historico} setHistorico={setHistorico} /> : <AbaGestor historico={historico} setHistorico={setHistorico} />)
        : <AbaProjetista historico={historico} setHistorico={setHistorico} />
      }
    </div>
  );
}
