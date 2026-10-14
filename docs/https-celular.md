# HTTPS na rede interna e câmera do celular

O navegador só libera a câmera em endereço seguro (HTTPS). Por isso o sistema pode abrir uma segunda porta, **3443**, com HTTPS. A porta 3000 (HTTP) continua funcionando como sempre.

Tudo é gratuito e local: o certificado é criado no próprio computador, por uma "autoridade" própria.

## 1. Gerar o certificado (uma vez, no computador do sistema)

Na primeira vez que o sistema inicia, ele **tenta gerar o certificado sozinho**. Se o OpenSSL não for encontrado, segue só com HTTP e avisa na janela. Para desligar o HTTPS, coloque `HTTPS=desligado` no `.env`. O passo a passo manual abaixo vale para gerar de novo (ex.: IP mudou).

1. Precisa do OpenSSL, que vem junto com o **Git para Windows** (https://git-scm.com).
2. Dê dois cliques em `gerar-certificado.bat` (ou, na pasta `backend`, `npm run gerar-certificado`).
3. Reinicie o sistema (`parar-estoque.bat` e abra de novo). Na janela deve aparecer `HTTPS (câmera do celular): https://192.168.x.x:3443`.
4. Libere a porta no Firewall do Windows (PowerShell **como administrador**):
   `netsh advfirewall firewall add rule name="Estoque HTTPS" dir=in action=allow protocol=TCP localport=3443`

Os arquivos ficam em `C:\estoque-dados\certs`. **Nunca copie nem envie essa pasta**: `ca.key` é a chave da autoridade.

> **IP fixo:** o certificado vale para os IPs que o computador tinha ao gerar. Se o roteador mudar o IP do computador, rode `gerar-certificado.bat` de novo (a autoridade é reaproveitada, o celular não reinstala nada). O ideal é reservar o IP do computador no roteador.

## 2. Instalar o certificado no iPhone (uma vez por aparelho)

1. No Safari do iPhone abra `http://IP-DO-COMPUTADOR:3000/estoque-ca.crt` → toque em **Permitir** (baixar perfil).
2. **Ajustes → Perfil baixado → Instalar** (pede a senha do iPhone).
3. **Ajustes → Geral → Sobre → Ajustes de Confiança de Certificado** → ligue **Controle de Estoque - Autoridade local**. *Sem este passo o iPhone não confia no certificado.*
4. Abra `https://IP-DO-COMPUTADOR:3443`, entre e, na tela Bipar, toque em **Câmera** (permita o uso da câmera).

## Android

Abra `http://IP-DO-COMPUTADOR:3000/estoque-ca.crt` → instale como **Certificado de CA** (Ajustes → Segurança → Criptografia e credenciais → Instalar certificado). Depois abra `https://IP-DO-COMPUTADOR:3443`. Se preferir não instalar o certificado, o Chrome permite continuar mesmo com o aviso e a câmera funciona.

## Como ler com a câmera

- Aponte de forma que a linha vermelha cruze **todas** as barras, com boa luz e sem tremer.
- O código só é aceito depois de lido duas vezes seguidas, e o dígito verificador é conferido.
- O mesmo produto parado na frente da câmera conta **uma vez**. Para contar de novo, afaste o código por um instante. Para várias unidades, use o campo Quantidade.
- Lê EAN-13, EAN-8 e UPC-A. O leitor próprio (`frontend/js/ean.js`) não depende de internet nem de bibliotecas, e funciona também no Safari do iPhone.

## Segurança

- O tráfego na porta 3443 é criptografado; a senha deixa de trafegar em texto puro na rede.
- A autoridade só serve para este sistema, mas quem tiver o `ca.key` poderia emitir certificados que o celular aceita. Por isso a pasta `certs` fica fora do projeto e do GitHub.
