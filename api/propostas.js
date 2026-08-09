export const config = { runtime: 'edge' };

const STORE_KEY = 'aluz:propostas';

async function kvGet(url, token, key) {
  const resp = await fetch(`${url}/get/${key}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await resp.json();
  return data.result ? JSON.parse(data.result) : null;
}

async function kvSet(url, token, key, value) {
  await fetch(`${url}/set/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(value)
  });
}

export default async function handler(req) {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (!kvUrl || !kvToken) {
    return new Response(JSON.stringify({ error: 'KV não configurado' }), { status: 500, headers });
  }

  if (req.method === 'GET') {
    const propostas = await kvGet(kvUrl, kvToken, STORE_KEY) || [];
    return new Response(JSON.stringify(propostas), { status: 200, headers });
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { action, proposta, id, updates } = body;

      const propostas = await kvGet(kvUrl, kvToken, STORE_KEY) || [];

      if (action === 'salvar') {
        // Adiciona nova proposta
        const nova = { ...proposta, id: Date.now(), criadoEm: new Date().toISOString(), status: 'aguardando_custo' };
        propostas.push(nova);
        await kvSet(kvUrl, kvToken, STORE_KEY, propostas);
        return new Response(JSON.stringify(nova), { status: 201, headers });
      }

      if (action === 'atualizar') {
        // Atualiza proposta existente (custo, forma de pagamento, etc.)
        const idx = propostas.findIndex(p => p.id === id);
        if (idx === -1) return new Response(JSON.stringify({ error: 'Não encontrada' }), { status: 404, headers });
        propostas[idx] = { ...propostas[idx], ...updates };
        await kvSet(kvUrl, kvToken, STORE_KEY, propostas);
        return new Response(JSON.stringify(propostas[idx]), { status: 200, headers });
      }

      return new Response(JSON.stringify({ error: 'Ação inválida' }), { status: 400, headers });
    } catch(e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}
