# Arquitetura do VELA Browser

## Princípio central

A interface confiável do navegador e o conteúdo remoto da internet não compartilham contexto JavaScript nem APIs privilegiadas.

## Componentes

### 1. Processo principal (`src/main/main.js`)

Responsável por criar a janela, instanciar `WebContentsView`, administrar as abas, manter as sessões, tratar permissões, validar mensagens IPC, controlar downloads e aplicar atalhos globais.

### 2. Shell local (`src/renderer/`)

Interface visual servida pela origem customizada `vela://app`. O protocolo aceita somente `index.html`, `renderer.js` e `styles.css`, com CSP restritiva. Favoritos são salvos no armazenamento local do shell.

### 3. Preload (`src/preload/preload.js`)

Expõe somente operações explícitas para o shell local: estado, criação/fechamento/seleção de abas, navegação, histórico e recarga. O preload não é carregado nas páginas remotas.

### 4. Conteúdo web (`WebContentsView`)

Cada aba tem seu próprio `WebContentsView`, usando `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` e `webSecurity: true`. Pop-ups HTTP(S) são convertidos em novas abas; demais esquemas são recusados.

### 5. Sessões

- Normal: `persist:vela-main`, para manter cookies e armazenamento entre execuções.
- Privada: `vela-private`, sem o prefixo persistente. A última guia privada fechada dispara limpeza de cache e armazenamento.

## Fluxo simplificado

```text
Usuário
  ├── Interface local (vela://app)
  │     └── Preload mínimo
  │            └── IPC validado pelo processo principal
  │
  └── Aba web (WebContentsView)
        ├── Chromium isolado
        ├── Sem preload do VELA
        ├── Sem Node.js
        └── Permissões negadas por padrão
```

## Ciclo de navegação

1. A interface envia texto de endereço pelo preload.
2. O processo principal valida o remetente IPC e limita o tamanho do texto.
3. `url-policy.js` converte domínio em HTTPS, transforma texto comum em busca DuckDuckGo ou rejeita esquemas não HTTP(S).
4. O `WebContentsView` executa `loadURL`.
5. Eventos da aba atualizam o snapshot enviado ao shell.

## Próximos módulos recomendados

1. **Privacy Engine:** filtro de rede com listas EasyList/EasyPrivacy assinadas/atualizadas, exceções por site e painel de requisições bloqueadas.
2. **Permission Center:** câmera, microfone, localização, notificações e captura de tela com decisão por origem, sessão e duração.
3. **Safe Browsing:** integração com feed de reputação e interstitials para phishing/malware, sem confiar em listas embutidas obsoletas.
4. **Download Manager:** fila, pausa/retomada, validação de nomes, hash, quarentena opcional e abertura segura.
5. **Data Manager:** histórico, cookies, cache, limpeza seletiva e importação/exportação.
6. **Update Service:** atualizações assinadas, verificação de integridade, rollback e canal estável/beta.
7. **Quality Gate:** testes unitários, E2E, fuzzing de IPC/URL, análise estática, auditoria de dependências e pentest independente.
