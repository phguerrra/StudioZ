# Studio Z – Sistema de Personalização de Produtos Térmicos

## Sobre o Projeto
O Studio Z é um sistema web desenvolvido para permitir a personalização de produtos térmicos, como canecas, copos térmicos e garrafas térmicas. O sistema permite que o cliente envie uma imagem, adicione um texto, visualize uma prévia do produto e realize pedidos online.

O sistema também possui uma área administrativa para gerenciamento de pedidos, produtos, preços e mensagens de contato.

Este projeto foi desenvolvido como parte do Projeto Integrador do curso de Ciência da Computação.

---

## Funcionalidades

### Área do Cliente
- Cadastro de usuário
- Login
- Personalização de produtos
- Upload de imagem
- Inserção de texto
- Escolha de fonte
- Escolha de posição do texto
- Seleção de cor do produto
- Cálculo automático de preço
- Pré-visualização do produto
- Registro de pedidos
- Acompanhamento de pedidos

### Área Administrativa
- Login administrativo
- Dashboard com estatísticas
- Visualização de pedidos
- Alteração de status dos pedidos
- Alteração de preços dos produtos
- Visualização de mensagens de contato
- Visualização de detalhes do pedido

---

## Tecnologias Utilizadas

| Tecnologia | Descrição |
|------------|-----------|
| HTML | Estrutura do site |
| CSS | Estilização |
| JavaScript | Lógica do sistema |
| API REST | Comunicação com o servidor |
| Canvas | Pré-visualização do produto |
| LocalStorage | Sessão do usuário |
| Docker | Container da aplicação |
| GitHub | Versionamento |

---

## Arquitetura do Sistema

O sistema segue o modelo Cliente-Servidor, utilizando:
- Front-end: HTML, CSS e JavaScript
- Back-end: API REST
- Banco de dados: armazenamento de usuários, pedidos e produtos
- Docker: containerização da aplicação

Fluxo do sistema:
1. O cliente cria uma conta
2. O cliente faz login
3. O cliente personaliza o produto
4. O sistema gera a pré-visualização
5. O sistema calcula o preço
6. O cliente finaliza o pedido
7. O administrador gerencia o pedido
8. O cliente acompanha o status

---

## Como Executar o Projeto

### Usando Docker

bash
docker-compose up --build

Depois acesse no navegador:

http://localhost:8080

## Objetivo do Projeto

O objetivo do sistema é ajudar empresas de personalização a organizarem seus pedidos, automatizar o processo de personalização e permitir que clientes realizem pedidos online com visualização prévia do produto.

### Autor

Pedro Guerra
Curso de Ciência da Computação
Projeto Integrador – 2026
