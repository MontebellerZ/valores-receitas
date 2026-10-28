# Conta de Chef

<img src="src/assets/brand/conta-de-chef-horizontal.png" alt="Conta de Chef" width="360" />

Aplicação web para acompanhar receitas culinárias, custos de ingredientes, produções e vendas. Feita para pequenos negócios de culinária e confeitaria que precisam entender quanto custa produzir, planejar preços e acompanhar os resultados reais das vendas.

O projeto separa **preço sugerido**, **venda esperada** e **venda realizada**, sem substituir os cálculos de referência pelos valores informados ou pelas vendas registradas.

## Funcionalidades

### Visão geral

- Faturamento vendido, valores recebidos, valores a receber e resultado das vendas.
- Pacotes produzidos e disponíveis, custos registrados e perdas.
- Acompanhamento das vendas por produção e histórico de vendas recentes.
- Potencial financeiro do estoque restante, sem contar novamente os pacotes já vendidos.
- Referências do planejamento original disponíveis em uma seção recolhível.
- Filtro por última semana, último mês, últimos 6 meses, último ano ou desde sempre.

Os resumos priorizam **vendas realizadas → preço desejado → preço sugerido**. Quando existem vendas para uma produção no período selecionado, o resumo mostra os valores reais e o preço médio praticado. Sem vendas nesse período, usa o preço desejado salvo ou, se ele não foi definido, o preço sugerido pelo acréscimo sobre o custo.

### Insumos

Cadastro apenas de nome e unidade, sem dados de embalagem ou preços. Um mesmo insumo pode ser comprado em embalagens de tamanhos diferentes. Depois de registrar uma compra, a unidade fica bloqueada. A antiga URL `/mercado` redireciona para `/insumos`.

### Estoque

- Ao abrir, a tabela mostra as compras da data mais recente para a mais antiga. No mesmo dia, entradas cadastradas mais recentemente aparecem primeiro.
- Nas tabelas do projeto, clique no cabeçalho de uma coluna de dados para ordenar em ordem crescente e clique novamente para inverter. A seta indica a direção; Enter e Espaço também funcionam. A ordenação usa os números e datas originais, permanece ao filtrar e afeta somente a apresentação, sem mudar consumos FIFO ou valores históricos. Nas prévias de correção, preço e saldo são ordenados pelos valores atuais, antes da correção.

- Entrada de cada pacote comprado a partir de um insumo cadastrado, com data, quantidade na unidade do insumo e preço pago. Por exemplo, compras de manteiga de 200 g e 500 g usam o mesmo insumo e preservam seus próprios preços por unidade.
- Informe a **Quantidade de pacotes** para cadastrar vários de uma vez. A quantidade no pacote e o preço são individuais: 4 pacotes de 200 g a R$ 7,98 criam 4 registros de 200 g, com saldo total de 800 g e compra de R$ 31,92. Todos são salvos juntos, sem cadastro parcial em caso de falha.
- Saldo total por insumo e saldo restante de cada pacote.
- Baixa parcial ou total com motivo, sem apagar registros.
- As ações das linhas usam ícones com descrição ao passar o mouse e rótulos acessíveis: **Editar pacote**, **Editar compra**, **Dar baixa / ajustar** e **Excluir pacote**.
- **Editar pacote** corrige insumo, data da compra, quantidade e preço. **Editar compra** abre todos os pacotes cadastrados juntos, incluindo os esgotados (até 1.000 por correção). Não há seleção manual: compras distintas, subconjuntos de vários pacotes e insumos diferentes não podem ser editados em conjunto, inclusive pela API. Se um pacote foi corrigido individualmente para outro insumo, a edição conjunta fica indisponível enquanto os insumos forem diferentes.
- Na edição, somente os campos marcados são aplicados aos pacotes da edição; os demais valores são preservados. O motivo é obrigatório, há prévia dos saldos e o salvamento é atômico.
- Ative **Mostrar pacotes esgotados** para corrigir entradas antigas. O saldo corrigido é a nova quantidade comprada menos todas as saídas anteriores, incluindo baixas manuais. Quantidades menores que as saídas são recusadas; um pacote pode voltar a ter saldo.
- O preço corrigido vale para consumos futuros. Custos e dados de compra apresentados nos consumos de produções anteriores são preservados, assim como as vendas. Pacotes usados em produção não podem trocar de insumo, nem receber data posterior à produção; pacotes com baixas manuais não podem trocar para unidade diferente.
- Corrigir não muda a quantidade de pacotes já cadastrados: registre compras faltantes ou exclua os pacotes extras sem movimentações. A correção guarda os dados anteriores e novos no histórico do servidor.
- **Excluir pacote** pede confirmação e remove somente aquele registro, atualizando o saldo e mantendo os demais pacotes da compra. A exclusão é permanente e só é permitida se não houve consumo (mesmo estornado), baixa ou correção. Pacotes com histórico devem ser corrigidos ou receber baixa, nunca apagados.
- Consumo FIFO: primeiro a compra mais antiga, com desempate pela ordem de entrada.
- Pacotes esgotados ficam inativos automaticamente e saem da listagem disponível.
- Insumos com histórico não podem ser excluídos ou mudar de unidade. O tamanho e o preço ficam registrados em cada lote, sem alterar compras anteriores.

### Receitas

- Cadastro de nome, categoria, rendimento por lote e horas de preparo.
- Seleção dos insumos e das quantidades utilizadas por lote.
- A ficha técnica contém quantidades, não valores. O custo pertence à produção.
- Listagem resumida com acesso à visualização e edição completa pelo ícone de olho.

### Produção

- Registro de data, receita, quantidade de lotes, rendimento obtido, perdas e quantidade por pacote.
- Rascunho sem baixas; o botão **Salvar produção e consumir estoque** confirma a fabricação.
- Custo calculado pelo servidor usando as quantidades e os preços dos lotes efetivamente consumidos.
- Relação dos lotes consumidos na tela de detalhes, inclusive quando já estão inativos.
- Estoque insuficiente recusa a produção inteira, sem baixas parciais.
- Receita e quantidade ficam imutáveis após salvar; o custo não é recalculado por compras futuras ou alterações na ficha.
- **Pacotes perdidos:** nos detalhes de uma produção salva, informe quantos pacotes prontos foram perdidos depois da produção (vencimento, roubo ou descarte). Eles saem do saldo disponível para venda e do faturamento esperado, mas o custo por pacote não muda. Não é possível marcar como perdidos mais pacotes do que os que ainda não foram vendidos. A tela de vendas mostra os perdidos no saldo por produção.
- **Produção avulsa:** a seta à direita do botão **Registrar produção** abre as opções *Registrar produção* (fluxo normal) e *Registrar produção avulsa*. A avulsa serve para produções feitas antes de usar o site: não consome nem exige estoque e a ficha não precisa de insumos. O custo total é informado manualmente e pode ser corrigido no detalhe; a lista a identifica como "(avulsa)".
- Preço sugerido a partir do lucro desejado sobre o custo.
- **Venda esperada:** preço desejado por pacote, faturamento, resultado, margens e pacotes necessários para cobrir o custo. O preço informado é salvo por produção.
- **Venda realizada:** pacotes vendidos e disponíveis, faturamento, recebimentos, resultado e histórico cronológico com faturamento acumulado.
- Listagem resumida e tela separada de visualização e edição.

### Vendas

- Registro vinculado a uma produção, com data, quantidade de pacotes e preço real praticado.
- O cadastro funciona como um carrinho: **Adicionar outra venda** inclui e seleciona uma nova venda, mantendo a produção e a data da venda que estava selecionada. Os demais campos começam com os valores iniciais: um pacote, preço previsto da produção, cliente e observações vazios e pagamento recebido. Todos os campos continuam editáveis e independentes. Apenas a venda selecionada aparece nos campos. A lista à direita mostra cliente, produção, pacotes e total; clique em uma venda para editá-la ou remova itens antes de **Confirmar vendas**. Quando há muitas vendas, só a lista do carrinho ganha rolagem própria e o restante do modal fica fixo. No celular, a lista fica abaixo dos campos, com altura limitada e rolagem própria. Dados inválidos na confirmação selecionam a venda que precisa de correção.
- O carrinho mostra o total de cada venda e o total geral, desconta as quantidades reservadas nas outras vendas da mesma produção e salva tudo em uma única operação, sem cadastro parcial. Cancelar a confirmação ou uma falha mantém os dados para nova tentativa. A edição de uma venda existente continua individual e também abre em um modal sobre a lista de vendas.
- Cliente e observações opcionais.
- Indicação de pagamento recebido ou pendente.
- Histórico editável, pesquisa e filtro por produção.
- Saldo de pacotes por produção e exclusão de vendas com confirmação.
- Preservação do custo por pacote no momento do registro da venda.

## Fluxo de uso

1. Cadastre os itens em **Insumos** e registre os pacotes comprados em **Estoque**.
2. Monte a ficha técnica em **Receitas**, incluindo ingredientes e rendimento.
3. Preencha uma fabricação em **Produção**, informe o rendimento obtido e salve para calcular o custo e baixar o estoque.
4. Consulte o preço sugerido ou defina um preço em **Venda esperada**.
5. Registre cada venda em **Vendas**, usando a quantidade e o preço realmente praticados.
6. Acompanhe o saldo, os recebimentos e os resultados na produção e na **Visão geral**.

## Regras dos cálculos

| Indicador                        | Regra                                                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Custo por unidade do ingrediente | Preço da embalagem dividido pela quantidade comprada.                                                                        |
| Consumo da produção              | Quantidade de cada insumo na receita multiplicada pela quantidade de receitas feitas.                                        |
| Custo da produção                | Soma de quantidade consumida × preço do pacote ÷ quantidade original, em cada lote usado por FIFO.                           |
| Rendimento líquido               | Rendimento obtido menos perdas, com mínimo de zero.                                                                          |
| Pacotes possíveis                | Rendimento líquido dividido pela quantidade por pacote, arredondado para baixo.                                              |
| Custo por pacote                 | Custo total da produção dividido pelos pacotes possíveis.                                                                    |
| Preço sugerido                   | Custo por pacote com o acréscimo percentual informado na produção.                                                           |
| Faturamento esperado             | Preço desejado multiplicado pelos pacotes possíveis menos os pacotes perdidos.                                               |
| Pacotes para cobrir o custo      | Custo total dividido pelo preço desejado, arredondado para cima. Com custo positivo e preço zero, a venda não cobre o custo. |
| Faturamento vendido              | Soma da quantidade de pacotes de cada venda multiplicada pelo preço real praticado.                                          |
| Resultado das vendas             | Faturamento vendido menos o custo histórico de ingredientes dos pacotes vendidos.                                            |
| Potencial do estoque restante    | Pacotes disponíveis (possíveis − perdidos − vendidos) multiplicados pelo preço desejado ou, na ausência dele, pelo sugerido.  |

**Acréscimo sobre custo não é margem sobre venda.** Por exemplo, um pacote que custa R$ 4,00 e recebe acréscimo de 50% tem preço sugerido de R$ 6,00. O resultado de R$ 2,00 representa aproximadamente 33,3% do preço de venda.

### Limites dos resultados

- Os custos e resultados consideram apenas os ingredientes registrados. Embalagem, mão de obra, energia, taxas, impostos e outras despesas não cadastradas não são descontados.
- As horas de preparo são informativas; não são convertidas em custo de mão de obra.
- O resultado das vendas desconta apenas os ingredientes dos pacotes vendidos, não o custo integral de uma produção ainda parcialmente em estoque.
- O controle de pagamento é binário: recebido ou pendente. Não há recebimentos parciais.
- Alterações nos insumos, receitas ou preços de compras não reprecificam produções já salvas.
- Editar uma venda mantendo a mesma produção preserva seu custo histórico. Ao trocar a produção vinculada, o custo passa a ser o da nova produção.

### Proteção do estoque e do histórico

- A quantidade vendida deve ser inteira, positiva e não pode superar os pacotes disponíveis. O preço real pode ser zero.
- O seletor de produção do cadastro de vendas mostra apenas produções com pacotes disponíveis, considerando também as outras vendas do carrinho. A produção já selecionada na venda continua visível.
- Marque **Doado** para registrar pacotes dados de graça: o preço fica fixo em R$ 0,00, a venda não fica a receber e aparece como "Doado" nas listagens. Os pacotes doados continuam saindo do saldo da produção e o custo entra no resultado. Ao desmarcar, o preço previsto da produção volta a ser sugerido.
- A data da venda não pode ser anterior à data da produção.
- Excluir uma venda devolve seus pacotes ao saldo disponível e recalcula os totais.
- Uma produção com vendas vinculadas não pode ser excluída nem mudar a quantidade por pacote.
- Toda produção salva tem receita e quantidade de receitas imutáveis. Removê-la apenas oculta o registro: não desfaz consumo real nem apaga o histórico.
- Produções anteriores ao controle de estoque mantêm o custo histórico, sem baixas retroativas. Os saldos iniciais devem ser cadastrados como entradas reais.
- Alterações são serializadas e usam uma revisão do servidor. Em conflito com outra sessão, recarregue a página; não há baixa offline nem sobrescrita silenciosa de estoque.
- O rendimento disponível não pode ser reduzido abaixo do total já vendido.
- A data da produção não pode ser alterada para uma data posterior às vendas vinculadas.

### Períodos da visão geral

A última semana inclui hoje e os seis dias anteriores. Os demais períodos são janelas móveis de 1, 6 ou 12 meses, com ajuste para o último dia de meses mais curtos. O intervalo efetivo aparece ao lado do seletor.

Vendas são filtradas pela **data da venda** e produções pela **data da produção**. Assim, uma venda recente de uma produção antiga continua entrando nos indicadores financeiros. O estoque das produções selecionadas desconta todas as vendas vinculadas, mesmo fora do intervalo. Os valores recebidos e pendentes refletem o estado atual do pagamento das vendas do período, não a data em que o pagamento ocorreu.

## Armazenamento

Os dados de insumos, estoque, receitas, produções e vendas são salvos pela API ASP.NET Core no SQL Server, por usuário autenticado. O navegador mantém uma cópia local dos cadastros por conta para contingência; essa cópia não substitui o saldo autoritativo do servidor. Cadastro e login dependem da API; a confirmação de email depende do SMTP configurado no backend.

## Planilhas

### Exportação

O botão **Exportar Excel** gera `conta-de-chef.xlsx`, com as abas:

- Insumos, sem preços de compra.
- Receitas.
- Ingredientes.
- Produções, com parâmetros e resultados pelo preço sugerido.
- Vendas, com valores reais, pagamento, custos dos pacotes vendidos e resultado.

### Importação

A visão geral aceita arquivos `.xlsx`, `.xls` e `.csv`. A importação reconhece colunas de insumos e receitas, incluindo ingredientes e quantidades utilizadas. Planilhas antigas com preços continuam aceitas, mas não criam entradas de estoque.

Exemplos de colunas reconhecidas:

| Cadastro                | Colunas                                                    |
| ----------------------- | ---------------------------------------------------------- |
| Insumos                 | Item, Unidade.                                              |
| Receita                 | Receita, Categoria, Rendimento, Horas por receita.         |
| Ingredientes da receita | Receita, Item, Quantidade ingrediente ou Quantidade usada. |

**Importar mescla insumos e receitas por nome normalizado**, preservando os identificadores de itens existentes e os vínculos de estoque. Não remove cadastros ausentes do arquivo. Produções, compras, baixas e vendas não são importadas nem restauradas por esse fluxo.

A exportação é um relatório, **não um backup completo restaurável**: não preserva todos os identificadores e dados internos, nem inclui o preço desejado de cada produção. As colunas de ingredientes exportadas também não correspondem integralmente às reconhecidas na importação. Portanto, importar o Excel exportado não restaura o estado original da aplicação.

## Executar localmente

Pré-requisitos: Node.js 22.12 ou superior e npm.

```bash
npm install
npm run dev
```

Abra o endereço exibido pelo Vite no terminal, normalmente `http://localhost:5173`. Se a porta estiver ocupada, o Vite pode usar outra.

O desenvolvimento roda na raiz `/`, sem prefixo do nome do projeto. Configure o endereço da API no arquivo `.env` desta pasta:

```dotenv
VITE_API_URL=http://localhost:5232/api
```

Informe o endereço completo da base da API, incluindo `/api` no final. O Axios lê `VITE_API_URL` e envia as requisições diretamente para esse endereço, sem proxy do Vite. Os cookies são enviados com `withCredentials: true`. Não coloque credenciais nesta variável: valores com prefixo `VITE_` ficam públicos no JavaScript do navegador.

O `.env` local é ignorado pelo Git; `.env.example` contém o modelo. Se alterar o endereço, reinicie o Vite; para `preview`, gere o build novamente. Inicie a API separadamente no endereço configurado. Para que os links de confirmação de email retornem para a tela correta, mantenha `Frontend:BaseUrl` na API igual à URL local do front.

Como a comunicação é direta entre origens diferentes, configure `Cors:AllowedOrigins` no `appsettings.json` da API com a origem exata do front (incluindo porta) e mantenha a permissão de credenciais. A configuração local permite `http://localhost:5173` e `http://localhost:4173`, além dos equivalentes em `127.0.0.1`. Use o mesmo host para front e API: com a API em `localhost`, acesse o front também por `localhost`, para preservar os cookies `SameSite=Lax`.

### Comandos

| Comando           | Finalidade                                                                       |
| ----------------- | -------------------------------------------------------------------------------- |
| `npm run dev`     | Inicia o servidor de desenvolvimento.                                            |
| `npm run build`   | Verifica os tipos TypeScript e gera a versão de produção em `dist/`.             |
| `npm run preview` | Serve localmente o build gerado para conferência. Não é um servidor de produção. |
| `npm run lint`    | Executa o ESLint.                                                                |
| `npm test`        | Executa os testes de domínio, serviços, componentes e estilos, sem API ou banco. |

Para conferir o build:

```bash
npm run build
npm run preview
```

O projeto está configurado para execução local. Não há workflow de deploy no GitHub Pages nem configuração de prefixo por ambiente. Sirva o build em `dist/` por HTTP (por exemplo, com `npm run preview`), não abra diretamente como arquivo HTML. A URL da API é incorporada ao build a partir do `.env` e não depende do servidor Vite para encaminhamento.

## Tecnologias e organização

- React 19 e TypeScript.
- React Router com BrowserRouter, rotas protegidas e detalhes identificados pela URL.
- Axios com cliente compartilhado em `src/services/http.ts`, envio de cookies e tratamento das mensagens de erro da API.
- Vite 8 e React Compiler.
- SCSS Modules responsivos, compilados com Sass, sem framework de estilos.
- Lucide React para ícones e SheetJS (`xlsx`) para planilhas.
- ESLint para análise estática.

| Arquivo ou pasta                                   | Responsabilidade                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------ |
| [src/app/index.tsx](src/app/index.tsx)             | Escolhe entre autenticação e workspace conforme a sessão.                |
| [src/app/Workspace](src/app/Workspace)             | Compõe layout, navegação e telas do usuário autenticado.                 |
| [src/app/routes](src/app/routes)                   | Adaptadores entre URLs, contexto do workspace e páginas.                |
| [src/pages](src/pages)                             | Telas acessadas pelo usuário, separadas por área.                        |
| [src/components](src/components)                   | Componentes visuais compartilhados e partes especializadas de telas.     |
| [src/hooks](src/hooks)                             | Estado React, sessão, sincronização e ações dos cadastros.               |
| [src/services](src/services)                       | Cliente Axios, endpoints de autenticação/dados, cache local e planilhas. |
| [src/domain](src/domain)                           | Modelos, cálculos, resumos e regras de estoque/datas, sem React ou HTTP. |
| [src/utils](src/utils)                             | Formatação e parsing compartilhados.                                     |
| [src/types/navigation.ts](src/types/navigation.ts) | Contratos de navegação e confirmação de exclusão.                        |
| [src/styles/_shared.scss](src/styles/_shared.scss) | Mixins reutilizados pelos módulos, sem emitir CSS global por conta própria. |
| [src/index.css](src/index.css)                     | Tema, fontes e resets básicos do documento.                             |
| [src/main.tsx](src/main.tsx)                       | Montagem do React, roteador e notificações.                              |
| [src/assets/brand](src/assets/brand)               | Logos importadas pelo Vite.                                              |
| [vite.config.ts](vite.config.ts)                   | Configuração do Vite e do React Compiler.                                |

### Separação de responsabilidades

```text
src/
	app/                 Componente raiz, workspace e adaptadores de rotas
	components/
		layout/            Estrutura compartilhada da aplicação
		ui/                Cabeçalho, indicadores, badge, ícones, diálogo e select com pesquisa
		production/        Campos de produção, simulação de preço e vendas realizadas
		recipes/           Campos de receita e editor de ingredientes
		sales/             Formulário de venda
		workbook/          Seleção de arquivo para importação
	domain/              Modelos, cálculos e regras puras
	hooks/               Sessão, formulário, dados e ações
	pages/
		auth/              Login e cadastro
		overview/          Visão geral
		market/            Insumos (nome interno preservado)
		stock/             Entradas, saldos e baixas de estoque
		recipes/           Lista e detalhe de receitas
		production/        Lista e detalhe de produção
		sales/             Histórico e controle de vendas
	services/            HTTP, endpoints, armazenamento e planilhas
	styles/              Mixins SCSS compartilhados, usados dentro dos módulos
	types/               Contratos de interface
	utils/               Formatação e parsing
```

As telas não conhecem endpoints nem acessam o armazenamento diretamente. Os componentes de UI recebem dados e callbacks; os hooks coordenam estado e efeitos; serviços fazem I/O; regras e cálculos ficam no domínio. Os padrões visuais são componentes compartilhados, sem duplicar seu HTML nas telas. As telas de lista e detalhe são componentes independentes, acessados por rotas do React Router.

### Catálogo de componentes compartilhados

| Componente | Responsabilidade e usos |
| ---------- | ----------------------- |
| [Button e ButtonLink](src/components/ui/Button/index.tsx) | Ações primárias, secundárias, textuais e inline; links preservam a navegação do Router. Usados nos cadastros, layout, exportação/importação e navegação. |
| [IconButton](src/components/ui/IconButton/index.tsx) | Ações com ícone e nome acessível obrigatório; tamanhos padrão, pequeno e visualização, com estado de perigo. |
| [BackButton](src/components/ui/BackButton/index.tsx) | Retorno com seta e espaçamento consistente nos detalhes de receitas, produção e venda. |
| [FormField](src/components/ui/FormField/index.tsx) | Rótulo e composição de campo, nas variantes padrão, cadastro e horizontal; envolve o controle e preserva `htmlFor`. |
| [FormControl](src/components/ui/FormControl/index.tsx) | Inputs e textarea, com ícones, prefixos, sufixos e tamanhos. |
| [SearchField](src/components/ui/SearchField/index.tsx) | Busca com ícone e nome acessível; usado em insumos, estoque e vendas. O filtro continua sob responsabilidade da tela. |
| [SearchableSelect](src/components/ui/SearchableSelect/index.tsx) | Todos os selects, com pesquisa, validação de seleção e navegação por teclado. |
| [FormActions](src/components/ui/FormActions/index.tsx) | Rodapé de cancelar/enviar nos cadastros de insumos, estoque, receitas, produção e vendas; recebe conteúdo, estado de bloqueio e classe de composição. |
| [FormLayout e FormGrid](src/components/ui/FormLayout/index.tsx) | Estrutura de formulário com fieldset desabilitável e grade responsiva ou flexível. Usados nos cadastros, ajustes de estoque e formulário de venda; as telas não importam estilos internos do modal. |
| [Panel](src/components/ui/Panel/index.tsx) | Seções com título associado por ID único, descrição e ações. Variantes card, plain e inset, usadas em insumos, estoque, receitas, produção, vendas e visão geral. |
| [DataTable](src/components/ui/DataTable/index.tsx) | Tabela com rolagem horizontal e variantes padrão, vendas e compacta. Cabeçalhos de dados alternam entre ordem crescente e decrescente, com indicador visual, teclado e `aria-sort`. Recebe elementos nativos; cada `td` informa seu valor bruto em `data-sort-value` (número, texto ou data ISO). Colunas sem esse atributo, como ações, não são ordenáveis. `defaultSort={{ column: 1, direction: "descending" }}` define a coluna inicial pelo índice, começando em zero. |
| [EmptyState](src/components/ui/EmptyState/index.tsx) | Mensagem vazia inline ou painel de editor, com título, ícone e ação opcionais. |
| [SummaryItem e SummaryList](src/components/ui/SummaryItem/index.tsx) | Listas de receitas e produções, com identificação, métricas e ação de visualização; responsividade definida uma única vez. |
| [Dialog](src/components/ui/Dialog/index.tsx) | Base de modal: semântica acessível, foco inicial, contenção de Tab/Shift+Tab, restauração do foco, Escape e clique no fundo. Reutilizado por `RegistrationModal` e `ConfirmDeleteDialog`; o Escape do select fecha primeiro suas opções. |
| [RegistrationModal](src/components/ui/RegistrationModal/index.tsx) | Apenas janela e cabeçalho dos cadastros. `busy` desabilita fechamento por botão, Escape e fundo durante o envio. Formulários e estilos de domínio pertencem aos respectivos componentes. |
| [ConfirmDeleteDialog](src/components/ui/ConfirmDeleteDialog/index.tsx) | Confirmações e mensagens específicas para cada tipo de exclusão. |
| [PageHeader](src/components/ui/PageHeader/index.tsx), [MetricCard](src/components/ui/MetricCard/index.tsx) e [PaymentBadge](src/components/ui/PaymentBadge/index.tsx) | Cabeçalhos, indicadores e estados de pagamento compartilhados. |
| [MetricCard e MetricGrid](src/components/ui/MetricCard/index.tsx) | Indicadores padrão, overview, compactos e saldo de insumos (stock), com legenda opcional e valores negativos. Grades de cartões, resultados, simulação e faixa de estoque centralizam a responsividade, sem refazer blocos de rótulo/valor nas telas. |
| [ProductionFields](src/components/production/ProductionFields/index.tsx) | Mesmos campos no cadastro e detalhe; mantém rendimento ao trocar receita/lotes, limites numéricos e bloqueio de receita/quantidade após consumo. Em produções avulsas exibe o custo total manual. Não salva dados nem chama API. |
| [SplitButton](src/components/ui/SplitButton/index.tsx) | Botão principal com seta que abre um menu de opções (fecha com Escape ou clique fora). Reutiliza `Button`; usado em **Registrar produção**. |
| [RecipeFields](src/components/recipes/RecipeFields/index.tsx) | Nome, categoria, rendimento e horas com os mesmos controles e restrições no cadastro e na ficha técnica. |
| [StockEntryFields](src/components/stock/StockEntryFields/index.tsx) | Insumo, data, quantidade e preço compartilhados no cadastro e na correção de compras. A quantidade de pacotes aparece somente no cadastro; campos optativos de correção usam seleção explícita, sem sobrescrever dados não marcados. |
| [RecipeIngredientsEditor](src/components/recipes/RecipeIngredientsEditor/index.tsx) | Tabela compacta compartilhada no cadastro e na ficha técnica: seleção ordenada, bloqueio de insumos repetidos, quantidade, unidade, inclusão e remoção. A confirmação da remoção de ingrediente salvo continua na tela. |

**Regra de evolução:** antes de criar um trecho de UI, procure no catálogo e em `src/components`. Reutilize o componente existente ou faça uma adaptação pequena com props tipadas e variantes explícitas. Não recrie o mesmo padrão em outra tela. Extrações novas devem migrar os usos equivalentes existentes, e não deixar um componente isolado ao lado das cópias antigas. Não transforme regras distintas de negócio em uma configuração genérica apenas para reduzir linhas.

Os [testes de componentes](tests/components.test.mjs) verificam os contratos, a reutilização em múltiplos consumidores e a ausência de tabelas, modais e classes dos padrões compartilhados copiados nas telas. Também impedem a importação do SCSS interno de outro componente. Os [testes de componentização](tests/componentization.test.mjs) cobrem atualização de rendimento, bloqueios de produção salva, ingredientes duplicados, restrições dos campos, formulário desabilitado, painéis e indicadores. A orientação também está registrada nas [instruções de componentização](.github/instructions/component-reuse.instructions.md).

O cadastro e o detalhe de receitas utilizam agora a mesma grade de campos e tabela de ingredientes. Rótulos de lotes e pacotes são iguais no cadastro e detalhe de produção. São ajustes intencionais de apresentação; cálculos, consumo FIFO, custo histórico, persistência e confirmação de exclusão não foram substituídos. A implementação antiga e não utilizada de autenticação foi removida; login e cadastro continuam em `src/pages/auth/AuthPage`, com `useAuthForm`.

### Organização dos componentes e estilos

Cada componente, página e adaptador de rota tem sua própria pasta, contendo no mínimo:

```text
NomeDoComponente/
	index.tsx
	styles.module.scss
```

Componentes com apresentação própria importam seu módulo de estilos e usam as classes pelo objeto `styles`, inclusive para estados condicionais. Os imports dos componentes apontam para a pasta, sem precisar informar `index.tsx`. Componentes que apenas compõem outros (como adaptadores de rotas, workspace e importação de planilha) mantêm o módulo reservado, sem estilos artificiais.

Regras de botões, campos, tabelas e outros padrões pertencem ao módulo do componente compartilhado. Mixins de `src/styles/_shared.scss` apoiam esses componentes e os layouts; não devem ser incluídos numa tela para reproduzir uma UI já existente. Regras responsivas permanecem junto ao componente responsável. Nas telas ficam composição, larguras e ajustes locais de layout. Use `className` ou `containerClassName` para esses ajustes, sem depender de classes internas de outro CSS Module.

O CSS global contém apenas fontes, variáveis do tema e resets do documento. As personalizações do React Toastify ficam no módulo de `Notifications`, com `:global` restrito aos seletores da biblioteca dentro do contêiner local.

### Campos de formulário

Inputs de texto, números, datas e senhas e áreas de texto usam [FormControl](src/components/ui/FormControl/index.tsx), com rótulos compostos por [FormField](src/components/ui/FormField/index.tsx). Todos os selects usam [SearchableSelect](src/components/ui/SearchableSelect/index.tsx), extraído do seletor de insumos das receitas, que reutiliza o mesmo FormControl. Buscas usam [SearchField](src/components/ui/SearchField/index.tsx). O estilo compartilhado centraliza bordas, espaçamento, foco, placeholder, estados desabilitados e indicação de erro.

```tsx
<FormField label="Horas por receita">
  <FormControl
    type="number"
    min="0"
    step="0.1"
    suffix="horas"
    value={hours}
    onChange={(event) => setHours(Number(event.target.value))}
  />
</FormField>
<SearchableSelect
  value={unit}
  onChange={setUnit}
  options={[{ value: "g", label: "Gramas" }]}
  placeholder="Selecione uma unidade"
  required
/>
<FormControl as="textarea" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
```

`as` seleciona o elemento nativo e tipa seus atributos, eventos e `ref`. `prefix` e `suffix` recebem ícones, moeda ou unidade; `controlSize` permite as alturas `compact`, `default` e `large`. `className` personaliza o contêiner externo para ajustes de layout, enquanto atributos nativos (`id`, `name`, `required`, `min`, `max`, `aria-*`, etc.) e callbacks são repassados ao campo. Rótulos usam `FormField`; checkbox de pagamento e input de arquivo permanecem nativos, pois não são campos textuais.

`SearchableSelect` recebe opções `{ value, label, disabled? }` e retorna o valor selecionado em `onChange`. A pesquisa ignora acentos e diferenças de maiúsculas/minúsculas. Setas navegam pelas opções disponíveis, Enter seleciona sem enviar o formulário, Tab fecha a lista e Escape fecha a pesquisa antes de fechar um modal. A lista é renderizada em portal para não ser cortada por tabelas ou modais. `required` valida a seleção real, não o texto digitado; filtros podem usar uma opção com `value: ""` para representar todos os registros.

### Navegação

| URL                       | Tela                                    |
| ------------------------- | --------------------------------------- |
| `/login`                  | Acesso à conta.                         |
| `/cadastro`               | Cadastro de usuário.                    |
| `/`                       | Visão geral.                            |
| `/receitas`               | Lista de receitas.                      |
| `/receitas/:recipeId`     | Detalhe da receita identificada na URL. |
| `/producao`               | Lista de produções.                     |
| `/producao/:productionId` | Detalhe da produção.                    |
| `/insumos`                | Cadastro de insumos.                    |
| `/mercado`                | Redireciona para `/insumos`.             |
| `/estoque`                | Entradas, saldos e baixas de estoque.    |
| `/vendas`                 | Histórico de vendas.                    |
| `/vendas/nova`            | Lista de vendas com o modal de cadastro aberto. |
| `/vendas/:saleId/editar`  | Lista de vendas com o modal de edição aberto.   |

As telas do workspace exigem sessão. Ao acessar uma URL privada sem login, o usuário é encaminhado para `/login` e retorna ao endereço solicitado depois de autenticar. Isso não substitui a autorização da API. Links de confirmação de email recebidos na raiz continuam funcionando e são direcionados para o login com o token removido da URL após o processamento.

O menu utiliza NavLink e destaca a seção ativa inclusive nos detalhes. Voltar/avançar do navegador e recarregamento de links diretos são suportados. Durante o carregamento de um detalhe, a tela aguarda os dados antes de decidir se o registro existe; URLs e IDs desconhecidos exibem uma página de não encontrado, sem selecionar outro registro como fallback.

Vite dev e preview já servem o `index.html` para as rotas da SPA. Se o build for servido por outro servidor no futuro, ele precisará de fallback para `index.html` nas URLs do front, preservando as rotas da API e dos assets.

### Testes

Execute `npm test`, `npm run lint` e `npm run build`. A suíte em [tests/domain.test.mjs](tests/domain.test.mjs) usa o test runner nativo do Node e o Vite para carregar os módulos TypeScript. Os casos cobrem cálculos, estoque, datas, histórico de custo, resumos, cache por conta e importação XLSX em memória. Não iniciam a API, não enviam emails e não alteram o SQL Server.
