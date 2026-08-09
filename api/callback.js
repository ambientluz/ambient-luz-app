export const config = { runtime: 'edge' };

export default async function handler(req) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  
  if (!code) {
    return new Response('Código não encontrado', { status: 400 });
  }

  const clientId = process.env.BLING_CLIENT_ID;
  const clientSecret = process.env.BLING_CLIENT_SECRET;
  const redirectUri = 'https://ambient-luz-app.vercel.app/api/callback';

  const credentials = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return new Response(JSON.stringify({ error: 'Falha ao obter token', details: data }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Salva os tokens em cookies seguros
  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;
  const expiresIn = data.expires_in || 3600;

  const headers = new Headers();
  headers.append('Set-Cookie', `bling_access=${accessToken}; Path=/; HttpOnly; Secure; Max-Age=${expiresIn}`);
  headers.append('Set-Cookie', `bling_refresh=${refreshToken}; Path=/; HttpOnly; Secure; Max-Age=2592000`);
  headers.set('Location', '/?bling=conectado');

  return new Response(null, { status: 302, headers });
}
