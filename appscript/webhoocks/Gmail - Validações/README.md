# Gmail - Validacoes CEF IPTU e Condominio

Projeto Apps Script:
https://script.google.com/home/projects/1CwgxINrriR9AtKFUSNiFEpdXR0h4iAjfF48-TLUCVBro5DQda0aJZlot/edit

## Objetivo

Esta automacao faz a leitura de e-mails do Gmail relacionados a devolutivas da CEF/Caixa para IPTU e condominio, valida os dados extraidos e atualiza negocios no Pipedrive. O fluxo tambem trata o primeiro ateste de pagamento quando o assunto do e-mail segue o padrao esperado.

## Arquivo principal

O fluxo principal esta em `iptu.js`.

Funcao principal:

```js
processarDevolutivasCefIptuCondominio()
```

Essa funcao deve ser usada no trigger recorrente do Apps Script. Ela pesquisa mensagens elegiveis no Gmail, evita reprocessamento por `messageId`, classifica o tipo de fluxo e executa as acoes no Pipedrive.

## Fluxos tratados

### Devolutiva comum

O script identifica e-mails de devolutiva por assunto ou labels esperadas, valida origem CEF/Caixa, extrai o codigo do imovel/BEM e classifica a relacao como IPTU ou condominio. Depois localiza o negocio correspondente no Pipedrive, atualiza status/tag da pendencia e cria atividade de orientacao para o responsavel configurado.

### Primeiro ateste

O primeiro ateste so entra no fluxo quando o assunto corresponde ao padrao de ateste de pagamento. Labels contendo "Ateste de pagamento ID" nao tornam a mensagem elegivel sozinhas, evitando que um e-mail mal classificado caia como devolutiva comum.

Quando o primeiro ateste e valido, o script localiza o negocio no Pipedrive e preenche a data do primeiro ateste de IPTU ou condominio. Se a despesa nao for encontrada ou nao for suportada, a mensagem fica marcada como erro e nao como processada, permitindo reprocessamento apos correcao do parser.

## Teste manual

Foi mantida apenas uma funcao publica de teste:

```js
testarFluxoCompletoIptuCondominioEmailEspecifico()
```

Propriedades usadas no teste:

- `CEF_DEVOLUTIVA_TEST_MESSAGE_ID`: obrigatoria. Deve conter o ID da mensagem do Gmail que sera testada.
- `CEF_DEVOLUTIVA_TEST_EXECUTE_FLUXO_COMPLETO`: quando `true`, executa o fluxo real. Sem essa flag, o teste apenas valida e retorna o diagnostico.

## Configuracao esperada

As credenciais e URLs devem ficar nas Script Properties do Apps Script. O arquivo principal aceita as chaves de Pipedrive usadas no projeto, incluindo:

- `BASE_URL` ou `PIPEDRIVE_BASE_URL`
- `PIPEDRIVE_TOKEN` ou `PIPEDRIVE_API_TOKEN`
- `PIPEDRIVE_DOMAIN`, quando aplicavel

## Arquivo de apoio mantido

O arquivo `validacao-1-ateste` foi mantido apenas como referencia historica para primeiro ateste. O fluxo atual consolidado esta em `iptu.js`.

Nao mantenha triggers ativos dos dois fluxos ao mesmo tempo no mesmo projeto Apps Script, pois isso pode gerar processamento duplicado de primeiro ateste.
