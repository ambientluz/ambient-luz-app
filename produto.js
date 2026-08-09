export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const codigo = url.searchParams.get('codigo');
  
  if (!codigo) {
    return new Response(JSON.stringify({ error: 'Código não informado' }), { status: 400 });
  }

  // Pega o token do cookie
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = Object.fromEntries(cookieHeader.split(';').map(c => {
    const [k, ...v] = c.trim().split('=');
    return [k, v.join('=')];
  }));
  
  let accessToken = cookies.bling_access;

  // Se não tem token, tenta renovar com refresh token
  if (!accessToken && cookies.bling_refresh) {
    const clientId = process.env.BLING_CLIENT_ID;
    const clientSecret = process.env.BLING_CLIENT_SECRET;
    const credentials = btoa(`${clientId}:${clientSecret}`);

    const refreshResp = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: cookies.bling_refresh,
      }),
    });

    const refreshData = await refreshResp.json();
    if (refreshResp.ok) {
      accessToken = refreshData.access_token;
    }
  }

  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'Não autenticado', redirect: '/api/autorizar' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Busca produto no Bling pelo código
  const blingResp = await fetch(
    `https://www.bling.com.br/Api/v3/produtos?codigo=${encodeURIComponent(codigo)}&limite=1`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    }
  );

  const blingData = await blingResp.json();

  if (!blingResp.ok || !blingData.data?.length) {
    return new Response(JSON.stringify({ error: 'Produto não encontrado' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const produto = blingData.data[0];
  
  return new Response(JSON.stringify({
    codigo: produto.codigo,
    nome: produto.nome,
    preco: produto.preco,
    precoCusto: produto.precoCusto,
    foto: produto.imagemURL || produto.midia?.imagens?.[0]?.link || null,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
