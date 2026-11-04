# VELA Browser

Navegador desktop experimental baseado no Chromium distribuído pelo Electron. A versão 0.1.0 é um ponto de partida funcional para evoluir a interface, a experiência de navegação e as camadas de privacidade.

## Stack

- **Electron 45.2.2** — runtime desktop com Chromium 156 e Node.js 24.22.2.
- **WebContentsView** — renderização de sites em processos/contexts separados da interface do navegador.
- **HTML, CSS e JavaScript** — interface local, sem framework ou dependência de CDN.
- **electron-builder 26.18.1** — empacotamento para Windows, macOS e Linux.

## Requisitos

- Node.js 24 ou superior.
- npm compatível com a versão do Node.
- Windows 10/11, macOS ou uma distribuição Linux compatível com Electron.

## Executar no Windows

1. Extraia o projeto.
2. Abra um terminal na pasta `vela-browser`.
3. Instale as dependências:

   ```bash
   npm install
   ```

4. Execute os testes da política de endereços:

   ```bash
   npm test
   ```

5. Inicie o navegador:

   ```bash
   npm start
   ```

## Gerar instalador

No sistema operacional de destino, execute:

```bash
# Windows — instalador NSIS
npm run dist:win

# macOS — imagem DMG
npm run dist:mac

# Linux — AppImage
npm run dist:linux
```

Os artefatos são gravados na pasta `release/`. O empacotamento deve ser feito e testado em cada sistema/arquitetura de destino. No macOS, distribuição pública requer assinatura e notarização apropriadas; no Windows, recomenda-se assinatura Authenticode.

## Estrutura

```text
vela-browser/
├── package.json
├── README.md
├── SECURITY.md
├── src/
│   ├── main/
│   │   ├── main.js          # Janela, abas, sessões, IPC e navegação
│   │   └── url-policy.js    # Validação e resolução da barra de endereços
│   ├── preload/
│   │   └── preload.js       # API mínima exposta à interface
│   └── renderer/
│       ├── index.html       # Shell local do navegador
│       ├── renderer.js      # Estado e interação da interface
│       └── styles.css       # Identidade visual VELA
└── test/
    └── url-policy.test.js  # Testes automatizados da política de URLs
```

## Recursos presentes nesta versão

- Abas, alternância e fechamento.
- Navegação voltar/avançar/recarregar.
- Barra de endereço com pesquisa DuckDuckGo.
- Favoritos salvos localmente no perfil da interface.
- Guias privadas usando uma sessão Electron sem persistência em disco; ao fechar a última guia privada, o VELA solicita a limpeza de armazenamento e cache dessa sessão.
- Downloads com diálogo para escolha do destino.
- Bloqueio padrão de pedidos de permissão de sites.
- Atalhos: `Ctrl+L`, `Ctrl+T`, `Ctrl+Shift+T`, `Ctrl+W`, `Ctrl+R`, `Ctrl+D`, `Ctrl+Tab`, `Alt+←` e `Alt+→` (no macOS, `Command` substitui `Ctrl` quando aplicável).

## Limitações conhecidas

Esta é uma base inicial, não um navegador pronto para distribuição ao público. Ainda faltam, entre outros itens: bloqueador de anúncios/rastreadores com listas mantidas, centro de permissões por origem, sincronização, importação de dados, gerenciador avançado de downloads, proteção contra phishing/malware, atualização automática assinada, testes E2E, auditoria de dependências, fuzzing e avaliação de segurança independente.

A sessão de navegação normal é persistente. A sessão privada é temporária, mas não equivale a anonimato: sites, provedores de internet, redes corporativas e serviços DNS ainda podem observar parte da atividade. O mecanismo de busca padrão desta versão é DuckDuckGo.
