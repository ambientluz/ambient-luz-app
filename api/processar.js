export const config = { runtime: 'nodejs', maxDuration: 300 };

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
2. Truncamento: DOWNLIGHT→"Downlight embutir" | FITA DE LED→"Fita de led" | FIO DE LUZ/PERFIL→"Fio de luz" | FONTE→"Fonte" | SPOT LED EMBUTIDO→"Spot led embutido" | SPOT DIRECIONÁVEL→"Spot direcionável" | SPOT SOBREPOR→"Spot sobrepor" | SPOT DE TRILHO→"Spot de trilho" | PENDENTE→"Pendente" | BALIZADOR→"Balizador" | ARANDELA→"Arandela" | LÂMPADA→"Lâmpada" | TRILHO→"Trilho" | PRESILHA→"Presilha" | EMBUTIDO RECUADO→"Embutido recuado" | PLAFON→"Plafon" | INSTALAÇÃO→vai para extras | Outros→3 primeiras palavras
3. INSTALAÇÃO e FRETE vão no array extras com tipo "instalacao" ou "frete"
4. codigo vazio = ""
5. extras pode ser []`;

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { pdfBase64 } = await req.json();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
            { type: 'text', text: 'Extraia todos os dados desta proposta e retorne o JSON.' }
          ]
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Erro na API');

    const texto = data.content.find(b => b.type === 'text')?.text || '';
    const clean = texto.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
