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

### Mercado

Cadastro de ingredientes e insumos com nome, unidade, quantidade da embalagem e preço de compra. O custo por unidade é calculado automaticamente e os itens podem ser pesquisados.

### Receitas

- Cadastro de nome, categoria, rendimento por lote e horas de preparo.
- Seleção dos ingredientes do mercado e das quantidades utilizadas por lote.
- Cálculo automático do custo da ficha técnica com os preços atuais.
- Listagem resumida com acesso à visualização e edição completa pelo ícone de olho.

### Produção

- Registro de data, receita, quantidade de lotes, rendimento obtido, perdas e quantidade por pacote.
- Registro do custo e do rendimento da ficha técnica no momento da criação da produção.
- Preço sugerido a partir do lucro desejado sobre o custo.
- **Venda esperada:** preço desejado por pacote, faturamento, resultado, margens e pacotes necessários para cobrir o custo. O preço informado é salvo por produção.
- **Venda realizada:** pacotes vendidos e disponíveis, faturamento, recebimentos, resultado e histórico cronológico com faturamento acumulado.
- Listagem resumida e tela separada de visualização e edição.

### Vendas

- Registro vinculado a uma produção, com data, quantidade de pacotes e preço real praticado.
- Cliente e observações opcionais.
- Indicação de pagamento recebido ou pendente.
- Histórico editável, pesquisa e filtro por produção.
- Saldo de pacotes por produção e exclusão de vendas com confirmação.
- Preservação do custo por pacote no momento do registro da venda.

## Fluxo de uso

1. Cadastre os ingredientes e os preços de compra em **Mercado**.
2. Monte a ficha técnica em **Receitas**, incluindo ingredientes e rendimento.
3. Registre uma fabricação em **Produção** e informe o rendimento efetivamente obtido.
4. Consulte o preço sugerido ou defina um preço em **Venda esperada**.
5. Registre cada venda em **Vendas**, usando a quantidade e o preço realmente praticados.
6. Acompanhe o saldo, os recebimentos e os resultados na produção e na **Visão geral**.

## Regras dos cálculos

| Indicador | Regra |
| --- | --- |
| Custo por unidade do ingrediente | Preço da embalagem dividido pela quantidade comprada. |
| Custo por lote da receita | Soma do custo das quantidades de ingredientes utilizadas. |
| Custo da produção | Custo registrado por lote multiplicado pela quantidade de lotes. |
| Rendimento líquido | Rendimento obtido menos perdas, com mínimo de zero. |
| Pacotes possíveis | Rendimento líquido dividido pela quantidade por pacote, arredondado para baixo. |
| Custo por pacote | Custo total da produção dividido pelos pacotes possíveis. |
| Preço sugerido | Custo por pacote com o acréscimo percentual informado na produção. |
| Faturamento esperado | Preço desejado multiplicado pela quantidade de pacotes possíveis. |
| Pacotes para cobrir o custo | Custo total dividido pelo preço desejado, arredondado para cima. Com custo positivo e preço zero, a venda não cobre o custo. |
| Faturamento vendido | Soma da quantidade de pacotes de cada venda multiplicada pelo preço real praticado. |
| Resultado das vendas | Faturamento vendido menos o custo histórico de ingredientes dos pacotes vendidos. |
| Potencial do estoque restante | Pacotes disponíveis multiplicados pelo preço desejado ou, na ausência dele, pelo preço sugerido. |

**Acréscimo sobre custo não é margem sobre venda.** Por exemplo, um pacote que custa R$ 4,00 e recebe acréscimo de 50% tem preço sugerido de R$ 6,00. O resultado de R$ 2,00 representa aproximadamente 33,3% do preço de venda.

### Limites dos resultados

- Os custos e resultados consideram apenas os ingredientes registrados. Embalagem, mão de obra, energia, taxas, impostos e outras despesas não cadastradas não são descontados.
- As horas de preparo são informativas; não são convertidas em custo de mão de obra.
- O resultado das vendas desconta apenas os ingredientes dos pacotes vendidos, não o custo integral de uma produção ainda parcialmente em estoque.
- O controle de pagamento é binário: recebido ou pendente. Não há recebimentos parciais.
- Alterações no mercado atualizam as fichas técnicas, mas não reprecificam automaticamente produções já registradas.
- Editar uma venda mantendo a mesma produção preserva seu custo histórico. Ao trocar a produção vinculada, o custo passa a ser o da nova produção.

### Proteção do estoque e do histórico

- A quantidade vendida deve ser inteira, positiva e não pode superar os pacotes disponíveis. O preço real pode ser zero.
- A data da venda não pode ser anterior à data da produção.
- Excluir uma venda devolve seus pacotes ao saldo disponível e recalcula os totais.
- Uma produção com vendas vinculadas não pode ser excluída, trocar de receita ou mudar a quantidade por pacote.
- O rendimento disponível não pode ser reduzido abaixo do total já vendido.
- A data da produção não pode ser alterada para uma data posterior às vendas vinculadas.

### Períodos da visão geral

A última semana inclui hoje e os seis dias anteriores. Os demais períodos são janelas móveis de 1, 6 ou 12 meses, com ajuste para o último dia de meses mais curtos. O intervalo efetivo aparece ao lado do seletor.

Vendas são filtradas pela **data da venda** e produções pela **data da produção**. Assim, uma venda recente de uma produção antiga continua entrando nos indicadores financeiros. O estoque das produções selecionadas desconta todas as vendas vinculadas, mesmo fora do intervalo. Os valores recebidos e pendentes refletem o estado atual do pagamento das vendas do período, não a data em que o pagamento ocorreu.

## Armazenamento

Os dados de mercado, receitas, produções e vendas são salvos automaticamente no `localStorage` do navegador. A aplicação inicia vazia quando não há dados salvos.

**Não há backend, autenticação, banco de dados remoto ou sincronização entre dispositivos.** Os registros pertencem ao navegador e à origem usada para acessar o aplicativo. Outro navegador, perfil, domínio ou porta pode apresentar dados diferentes. Limpar os dados do site pode apagar os registros.

## Planilhas

### Exportação

O botão **Exportar Excel** gera `conta-de-chef.xlsx`, com as abas:

- Mercado.
- Receitas.
- Ingredientes.
- Produções, com parâmetros e resultados pelo preço sugerido.
- Vendas, com valores reais, pagamento, custos dos pacotes vendidos e resultado.

### Importação

A visão geral aceita arquivos `.xlsx`, `.xls` e `.csv`. A importação reconhece colunas de mercado e receitas, incluindo ingredientes e quantidades utilizadas.

Exemplos de colunas reconhecidas:

| Cadastro | Colunas |
| --- | --- |
| Mercado | Item, Unidade, Qtd pacote, Valor pacote. |
| Receita | Receita, Categoria, Rendimento, Horas por receita. |
| Ingredientes da receita | Receita, Item, Quantidade ingrediente ou Quantidade usada. |

**Importar substitui os cadastros de mercado e/ou receitas reconhecidos no arquivo; não mescla com os existentes.** Produções e vendas não são importadas nem restauradas por esse fluxo.

A exportação é um relatório, **não um backup completo restaurável**: não preserva todos os identificadores e dados internos, nem inclui o preço desejado de cada produção. As colunas de ingredientes exportadas também não correspondem integralmente às reconhecidas na importação. Portanto, importar o Excel exportado não restaura o estado original da aplicação.

## Executar localmente

Pré-requisitos: Node.js 22.12 ou superior e npm.

```bash
npm install
npm run dev
```

Abra o endereço exibido pelo Vite no terminal, normalmente `http://localhost:5173`. Se a porta estiver ocupada, o Vite pode usar outra.

### Comandos

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento. |
| `npm run build` | Verifica os tipos TypeScript e gera a versão de produção em `dist/`. |
| `npm run preview` | Serve localmente o build gerado para conferência. Não é um servidor de produção. |
| `npm run lint` | Executa o ESLint. |

Para conferir o build:

```bash
npm run build
npm run preview
```

O projeto pode ser publicado como site estático a partir de `dist/`. Os dados continuam locais ao navegador; a publicação não cria armazenamento compartilhado.

## Tecnologias e organização

- React 19 e TypeScript.
- Vite 8 e React Compiler.
- CSS responsivo, sem framework de estilos.
- Lucide React para ícones e SheetJS (`xlsx`) para planilhas.
- ESLint para análise estática.

| Arquivo ou pasta | Responsabilidade |
| --- | --- |
| [src/App.tsx](src/App.tsx) | Navegação, cadastros, cálculos de produção, persistência e integração das telas. |
| [src/Overview.tsx](src/Overview.tsx) | Visão geral, indicadores, planejamento e filtro de período. |
| [src/Sales.tsx](src/Sales.tsx) | Registro, edição, consulta e resumo das vendas. |
| [src/App.css](src/App.css) | Identidade visual e layouts responsivos. |
| [src/main.tsx](src/main.tsx) | Inicialização da aplicação React. |
| [public/brand](public/brand) | Logos horizontal, vertical, símbolo e favicon do Conta de Chef. |
| [vite.config.ts](vite.config.ts) | Configuração do Vite e do React Compiler. |

Não há uma suíte automatizada de testes ou comando `npm test` configurado atualmente. Os comandos disponíveis para validação estática são `npm run build` e `npm run lint`.
