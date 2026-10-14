# Implantação no computador da empresa (Windows)

Passo a passo para deixar o sistema rodando num computador que funciona como servidor, acessado pelos demais aparelhos na rede Wi-Fi local.

## 1. Preparar o servidor

1. Instale o **Node.js LTS** (nodejs.org). A versão precisa ser 22.13 ou superior; confira com `node -v` no terminal.
2. Copie a pasta do projeto para o computador (por exemplo `C:\controle-estoque`).
3. Abra o terminal na pasta `backend` e crie o administrador:
   ```bash
   npm run criar-usuario -- admin SUA-SENHA admin
   ```
4. Inicie o servidor:
   ```bash
   npm start
   ```
5. Na primeira execução o Windows pode perguntar sobre o **Firewall**: permita o acesso em **redes privadas**. Sem isso, os outros aparelhos não conseguem acessar.

## 2. Acessar de outros aparelhos

O terminal mostra algo como `Na rede da empresa: http://192.168.0.10:3000`. Digite esse endereço no navegador dos outros computadores ou celulares (conectados ao mesmo Wi-Fi) e salve nos favoritos.

**Dica importante:** o endereço do servidor precisa ser sempre o mesmo. No roteador, reserve um IP fixo para o computador servidor (função "reserva de DHCP" ou "IP estático"), ou configure o IP fixo nas propriedades da rede do Windows.

## 3. Iniciar automaticamente com o computador

O projeto já traz os arquivos prontos, na pasta principal (a que contém `backend` e `frontend`):

| Arquivo | Para que serve |
|---|---|
| `instalar-inicio-automatico.ps1` | cria a tarefa do Windows que liga o servidor quando você entra no Windows |
| `iniciar-estoque.bat` | liga o servidor e o religa sozinho se ele parar por erro (registro em `%USERPROFILE%\estoque-servidor.log`) |
| `iniciar-estoque-oculto.vbs` | abre o `.bat` sem janela |
| `parar-estoque.bat` | desliga o servidor quando for preciso (por exemplo, para atualizar o sistema) |

**Instalar (uma vez):** abra o PowerShell na pasta principal do projeto e rode:

```
powershell -ExecutionPolicy Bypass -File .\instalar-inicio-automatico.ps1
```

Se aparecer erro de permissão, abra o PowerShell como administrador e repita.

**Remover:** o mesmo comando com `-Remover` no final.

**Cuidados**
- O servidor liga quando o usuário entra no Windows. Depois de reiniciar o computador, entre na sua conta.
- Desative a suspensão do computador servidor (Configurações > Sistema > Energia), senão o sistema fica fora do ar quando ele dorme.
- Para atualizar o sistema: rode o `parar-estoque.bat`, extraia os arquivos novos e entre no Windows de novo (ou rode `schtasks /Run /TN "Controle de Estoque"`).

## 4. Backup automático

O servidor faz o backup sozinho: ao ligar (se o último tiver mais de 24 horas) e depois a cada 24 horas, mantendo os 30 mais recentes. A cópia é consistente mesmo com o sistema em uso. Ao iniciar, o terminal mostra a linha `Backup automático ligado: a cada 24h em <pasta>`.

Por padrão a pasta é `data\backups`. Para guardar numa pasta sincronizada com a nuvem, defina no arquivo `backend\.env`:

```
BACKUP_DIR=C:\Users\SeuUsuario\OneDrive\Backup Estoque
BACKUP_HORAS=24
BACKUP_MANTER=30
```

Também é possível gerar um backup na hora:

```bash
npm run backup
```

**Para restaurar:** pare o servidor e substitua `backend\data\estoque.db` pelo arquivo de backup (renomeado para `estoque.db`).

## 5. Boas práticas

- Use senhas fortes e crie um usuário **operador** para quem só bipa.
- Mantenha o Wi-Fi da empresa protegido. A conexão não é criptografada.
- Nunca suba a pasta `backend/data` nem o arquivo `.env` para o GitHub (o `.gitignore` já impede isso).
- Teste a restauração do backup de vez em quando.
