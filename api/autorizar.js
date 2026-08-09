export const config = { runtime: 'edge' };

export default async function handler(req) {
  const clientId = process.env.BLING_CLIENT_ID;
  const redirectUri = 'https://ambient-luz-app.vercel.app/api/callback';
  
  const url = `https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  return Response.redirect(url, 302);
}
