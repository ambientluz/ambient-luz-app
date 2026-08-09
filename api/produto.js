export const config = { runtime: 'edge' };

async function renovarToken(refreshToken, clientId, clientSecret) {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const resp = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return data.access_token || null;
}

export default async function handler(req) {
  const url = new URL(req.url);
  const codigo = url.searchParams.get('codigo');
  const debug = url.searchParams.get('debug') === '1';

  if (!codigo) {
    return new Response(JSON.stringify({ error: 'Código não informado' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k.trim(), v.join('=')];
    })
  );

  let accessToken = cookies.bling_access;

  // Renova token se necessário
  if (!accessToken && cookies.bling_refresh) {
    accessToken = await renovarToken(
      cookies.bling_refresh,
      process.env.BLING_CLIENT_ID,
      process.env.BLING_CLIENT_SECRET
    );
  }

  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'Não autenticado', redirect: '/api/autorizar' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    });
  }

  // Busca produto por código
  const blingResp = await fetch(
    `https://www.bling.com.br/Api/v3/produtos?codigo=${encodeURIComponent(codigo)}&limite=1`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      }
    }
  );

  const blingData = await blingResp.json();

  // Modo debug — retorna JSON bruto para diagnóstico
  if (debug) {
    return new Response(JSON.stringify(blingData), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!blingResp.ok || !blingData.data?.length) {
    return new Response(JSON.stringify({ error: 'Produto não encontrado', codigo }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    });
  }

  const p = blingData.data[0];

  // Extrai foto — tenta múltiplos campos possíveis
  const foto =
    p.imagemURL ||
    p.imagem ||
    p.urlImagem ||
    p.midia?.imagens?.[0]?.link ||
    p.midia?.imagens?.[0]?.url ||
    p.imagens?.[0]?.link ||
    p.imagens?.[0]?.url ||
    null;

  // Extrai custo — tenta múltiplos campos possíveis
  const precoCusto =
    p.precoCusto ??
    p.preco_custo ??
    p.custoMedio ??
    p.custo ??
    null;

  return new Response(JSON.stringify({
    id: p.id,
    codigo: p.codigo,
    nome: p.nome,
    preco: p.preco,
    precoCusto,
    foto,
    // Campos brutos para diagnóstico
    _campos: Object.keys(p),
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
