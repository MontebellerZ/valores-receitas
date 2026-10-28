---
description: "Use when creating or changing frontend React screens, UI components, forms, tables, dialogs or SCSS. Keep the project's screens consistent by reusing existing components."
applyTo: "**/*.tsx,**/*.scss"
---

# Reutilizacao de componentes do frontend

- Antes de escrever JSX ou estilos de um padrao visual, consulte `src/components` e o catalogo de componentes no `README.md`.
- Reutilize o componente existente. Se a necessidade for semelhante, adapte-o levemente com props tipadas e variantes explicitas, preservando os demais consumidores.
- Nao copie markup ou estilos de botoes, campos, buscas, selects, tabelas, estados vazios, resumos ou modais para uma pagina. Use os componentes de `src/components/ui`.
- Componentes novos devem representar uma responsabilidade visual clara e ser utilizados nos pontos equivalentes existentes, nao apenas na tela que motivou sua criacao.
- Mantenha regras de negocio, validacao de dominio e chamadas de API fora dos componentes genericos de UI.
- Cada componente tem `index.tsx` e `styles.module.scss`. Estilos visuais pertencem ao componente; nas telas, mantenha apenas composicao e ajustes locais de layout.
- Preserve labels, atributos nativos, acessibilidade, estados desabilitados, teclado e comportamento de envio dos formularios.
- Ao alterar um componente compartilhado, valide seus contratos e os consumidores afetados. Execute `npm test`, `npm run build` e `npm run lint`.
