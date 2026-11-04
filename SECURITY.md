# Política de segurança — VELA Browser 0.1.0

## Controles implementados

- `nodeIntegration: false`, `contextIsolation: true` e `sandbox: true` na interface e nas páginas remotas.
- `webSecurity: true`; conteúdo misto não é habilitado.
- `WebContentsView` no lugar de misturar conteúdo remoto ao DOM da interface.
- API preload reduzida: nenhuma exposição direta de `ipcRenderer` ou APIs do Node.
- IPC com verificação do `event.sender` e validação dos argumentos de navegação.
- Navegação e pop-ups limitados a HTTP(S); esquemas como `javascript:`, `data:` e `file:` não são aceitos pela barra de endereço.
- Permissões dos sites negadas por padrão, tanto em pedido quanto em verificação.
- Sessão privada sem prefixo `persist:` e limpeza do armazenamento/cache ao fechar a última guia privada.
- CSP restritiva para a interface local.
- Downloads solicitam um caminho de salvamento ao usuário.

## Limites importantes

1. HTTP continua permitido por compatibilidade, mas não oferece criptografia. O indicador da interface diferencia HTTP de HTTPS.
2. A política atual não inclui uma lista de trackers ou bloqueio de anúncios.
3. As permissões de câmera, microfone, localização, notificações e captura de tela são bloqueadas globalmente. Não há fluxo visual para autorizar um site específico.
4. Não existe uma base de reputação para phishing, malware ou certificados comprometidos além dos mecanismos padrão do Chromium/Electron.
5. A aplicação ainda não foi submetida a pentest, fuzzing, revisão independente ou testes automatizados de integração.
6. Os instaladores ainda precisam de assinatura, processo de atualização seguro e pipeline de release reproduzível antes de distribuição pública.

## Antes de uma versão pública

- Atualizar Electron e dependências regularmente e monitorar avisos de segurança upstream.
- Revisar IPC, navegação, permissões, downloads e isolamento de processos.
- Adicionar testes de integração para pop-ups, redirects, iframes, downloads e tentativas de navegação por esquemas proibidos.
- Avaliar Electron fuses e desabilitar recursos não utilizados.
- Assinar os binários e validar atualizações criptograficamente.
- Executar análise estática, auditoria de dependências, testes de regressão e pentest independente.

Relate vulnerabilidades ao mantenedor do projeto por um canal privado antes de publicar detalhes técnicos.
