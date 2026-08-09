export const config = { runtime: 'edge' };

export default async function handler(req) {
  const clientId = process.env.BLING_CLIENT_ID;
  const redirectUri = 'https://ambient-luz-app.vercel.app/api/callback';
  const state = crypto.randomUUID();
  
  const url = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  
  const headers = new Headers();
  headers.set('Location', url);
  headers.set('Set-Cookie', `bling_state=${state}; Path=/; HttpOnly; Secure; Max-Age=300`);
  
  return new Response(null, { status: 302, headers });
}
