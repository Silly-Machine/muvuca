---

### Instalar

| Sistema | Arquivo |
|---|---|
| Windows 10 ou 11 | `Muvuca-Windows.exe` |
| macOS com chip Apple (M1 em diante) | `Muvuca-macOS-arm64.dmg` |
| macOS com processador Intel | `Muvuca-macOS-x64.dmg` |
| Linux (64 bits) | `Muvuca-Linux.AppImage` |

Os nomes não mudam de uma versão para outra, então os links `https://github.com/Silly-Machine/muvuca/releases/latest/download/<arquivo>` trazem sempre a mais nova.

Os instaladores ainda não são assinados. Na primeira abertura:
- **Windows:** "Mais informações" e depois "Executar assim mesmo".
- **macOS:** se aparecer "não pode ser aberto", Ajustes do Sistema > Privacidade e Segurança > "Abrir Mesmo Assim".
- **Linux:** `chmod +x Muvuca-Linux.AppImage`; no Ubuntu 22.04 ou mais novo, talvez seja preciso `sudo apt install libfuse2`.

Para usar o Claude de verdade, a tela de boas-vindas mostra como instalar o Claude Code. Sem ele, a demonstração funciona.

Para conferir o arquivo baixado, compare o SHA-256 dele com o de `SHA256SUMS.txt`. Não há atualização automática: para atualizar, instale a versão nova por cima. O seu time, os projetos e a memória continuam.
