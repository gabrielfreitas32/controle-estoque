// Erro de regra de negócio: a mensagem é mostrada ao usuário e o status HTTP é respeitado.
class ErroNegocio extends Error {
  constructor(mensagem, { status = 400, codigo = 'REGRA_NEGOCIO' } = {}) {
    super(mensagem);
    this.name = 'ErroNegocio';
    this.status = status;
    this.codigo = codigo;
  }
}

module.exports = { ErroNegocio };
