// Dublês mínimos de req/res do Express para chamar os handlers diretamente.

export function makeRes() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    end(text) { this.body = text; return this; },
  };
}

// `user` simula o que um middleware requireAuth (ainda inexistente) teria
// preenchido em req.user após validar o token — os handlers atuais NUNCA
// leem esse campo, o que é exatamente o que os testes RED comprovam.
export function makeReq({ method = 'POST', body = {}, query = {}, path = '/', url = '/', user, headers = {} } = {}) {
  return { method, body, query, path, url, headers, user };
}
