# Os Malas Studio – Site de agendamento online

Site criado pela equipe **Akitas** para o **Os Malas Studio**, um studio que faz corte de cabelo, barba, tatuagem e piercing. O site apresenta o trabalho do studio e permite que o cliente **agende o atendimento sozinho**, escolhendo serviço, barbeiro, dia e turno, sem depender de conversa manual para saber se há vaga.

- Endereço do studio: Avenida Sapopemba, 6839 – São Paulo, SP
- WhatsApp: (11) 97739-5774 · Instagram: @osmalasstudio
- Funcionamento: terça a sexta, 8h30 às 20h · sábado, 8h30 às 18h · domingo e segunda fechado

---

## O que o projeto resolve

| Problema | Como o site resolve |
|---|---|
| Agenda feita à mão, por conversa, sem visão das vagas livres | O cliente consulta as vagas em tempo real e reserva pelo próprio site |
| Risco de dois clientes no mesmo horário | O banco de dados controla as vagas e bloqueia o turno quando ele lota |
| Cliente quer um barbeiro específico | O agendamento é feito por barbeiro, e cada um tem sua própria agenda |
| Falta de uma vitrine do trabalho | Vídeo de abertura, galeria de cortes, serviços e preços no mesmo site |
| Custo e manutenção de servidor | O site é estático (GitHub Pages) e o banco fica no Supabase |

---

## Funcionalidades

- **Vídeo de abertura** com botão para pular e barra de progresso.
- **Galeria "Nossos cortes"**: 8 vídeos que o cliente controla **arrastando o dedo (ou o mouse) para os lados**. Arrastar para a direita avança o vídeo, para a esquerda volta. Há miniaturas e setas para trocar de corte.
- **Serviços e preços**, carregados do banco de dados, com um botão "Agendar" em cada card que já escolhe o serviço no formulário. Na seção há um jacaré animado (vídeo com transparência).
- **Agendamento em 5 passos**: serviço → barbeiro → dia → turno → nome e telefone.
- **Bloqueio de vagas**: cada barbeiro atende até **10 clientes por turno**. Quando o turno lota, ele aparece como indisponível para aquele dia e aquele barbeiro.
- **Botão do WhatsApp**: depois que a reserva é salva, o site abre o WhatsApp do barbeiro escolhido com uma mensagem pronta.
- **Rodapé** com horário, endereço, contato e crédito dos desenvolvedores.

---

## Como o agendamento funciona

1. **Serviço:** os cards e as opções do formulário usam a mesma lista, vinda da função `config_agendamentos()` do banco. Hoje: Corte (R$ 50), Barba (R$ 40), Corte + Barba (R$ 80) e Acabamento (R$ 20).
2. **Barbeiro:** o cliente escolhe com quem quer ser atendido (Alexandre, Luiz ou Matheus).
3. **Dia:** só é possível escolher de **hoje até 60 dias à frente**, de **terça a sábado**. Domingo e segunda mostram "Fechado neste dia".
4. **Turno:** ao escolher barbeiro e dia, o site consulta as vagas e mostra os turnos disponíveis.

   | Turno | Horário |
   |---|---|
   | Manhã | 08:30 – 12:00 |
   | Tarde | 13:00 – 18:00 |
   | Noite | 18:00 – 20:00 (não existe aos sábados) |

5. **Dados do cliente:** nome e telefone com DDD.
6. **Confirmação:** o site chama a função `criar_agendamento()` no banco, que revalida tudo. Se der certo, a vaga fica reservada e aparece o botão para falar no WhatsApp.

Mensagem padrão enviada ao WhatsApp:

```
Olá, Os Malas! Reservei <serviço> com <barbeiro>, dia <data>, turno <turno>. Nome: <nome>. Telefone: <telefone>.
```

### Regras que o banco garante

As regras ficam no banco e não apenas no navegador, então não dá para burlá-las alterando a página:

- O **preço** é definido pelo banco, não pelo navegador.
- Datas passadas, domingos, segundas e sábado à noite são recusados.
- Turnos que já terminaram no dia de hoje são recusados.
- O limite de 10 vagas por barbeiro, dia e turno é protegido por uma trava (`pg_advisory_xact_lock`), então duas pessoas reservando ao mesmo tempo não passam do limite.
- Nome e telefone são validados (telefone com 10 a 15 dígitos).
- Se a consulta de vagas falhar, o site mostra um erro e **não inventa vagas livres**.

---

## Tecnologias

- **Front-end:** HTML, CSS e JavaScript puro (sem framework e sem etapa de build)
- **Banco de dados e API:** [Supabase](https://supabase.com) (PostgreSQL) acessado pela Data API com `fetch`
- **Segurança:** Row Level Security (RLS) e funções `security definer`
- **Hospedagem:** GitHub Pages, com deploy automático por GitHub Actions

---

## Estrutura do projeto

```
akitas-project/
├── index.html                  Estrutura da página
├── style.css                   Visual do site
├── script.js                   Agendamento, WhatsApp, vídeos e animações
├── supabase-config.js          URL e chave pública do Supabase
├── supabase/
│   ├── schema.sql              Tabela, funções e permissões do banco
│   └── tests.sql               Testes das regras do banco
├── img/                        Logo, poster e miniaturas dos cortes
├── video/
│   ├── osmalas.mp4             Vídeo de abertura
│   ├── cortes/                 Os 8 vídeos da galeria (corte-1 ... corte-8)
│   ├── barbeiros/              Vídeos de cada barbeiro (.mp4 e .webm)
│   └── croc.webm / croc.mp4    Animação do jacaré
├── .github/workflows/
│   └── deploy-pages.yml        Publicação automática no GitHub Pages
└── server.js                   Versão antiga (Node.js + SQLite), não é mais usada
```

---

## Como rodar o projeto

### Rodar localmente

Não é preciso instalar Node.js, npm ou dependências. O site é estático.

1. Clone o repositório:
   ```bash
   git clone <url-do-repositorio>
   cd akitas-project
   ```
2. Abra a pasta no VS Code e use a extensão **Live Server** (botão "Go Live"), ou qualquer servidor de arquivos estáticos, por exemplo:
   ```bash
   python3 -m http.server 8000
   ```
   e acesse `http://localhost:8000`.

> Os serviços, as vagas e o agendamento dependem do Supabase configurado (próxima seção). Sem ele, a página abre, mas mostra erro ao carregar os serviços.

### Configurar o Supabase

1. Crie um projeto no Supabase com **Enable Data API** e **Enable automatic RLS** ativados. Deixe **Automatically expose new tables** desativado.
2. Abra **SQL Editor > New query**, cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**. O script cria a tabela `agendamentos`, ativa o RLS e libera apenas as funções públicas. Pode ser executado de novo para atualizar as funções, sem apagar os agendamentos.
3. Em [`supabase-config.js`](supabase-config.js), confira a URL do projeto e a chave **publishable**. Esses dois valores são públicos.
4. Abra o site, escolha uma data de terça a sábado, veja as vagas e faça uma reserva de teste. Depois confira o registro em **Table Editor** e apague a reserva de teste.

> **Nunca** coloque senha, chave `sb_secret_...` ou `service_role` no site, nos commits ou em mensagens.

### Publicar no GitHub Pages

1. No repositório, abra **Settings > Pages** e escolha **GitHub Actions** como origem.
2. A cada `push` na branch `main`, o workflow `deploy-pages.yml` publica o site. Também dá para rodar manualmente em **Actions > Publicar no GitHub Pages > Run workflow**.

---

## Como personalizar

Serviços, barbeiros, turnos e limite de vagas ficam na função `config_agendamentos()` em `supabase/schema.sql`. Depois de qualquer alteração, **execute o `schema.sql` novamente** no Supabase.

| O que mudar | Onde |
|---|---|
| Adicionar ou alterar um serviço (nome, descrição, preço) | `servicos` em `config_agendamentos()`. O card e a opção do formulário são criados automaticamente. Os nomes devem ser únicos. |
| Barbeiros e telefones (formato internacional, só dígitos) | `barbeiros` em `config_agendamentos()` |
| Turnos e horários | `turnos` em `config_agendamentos()` |
| Limite de clientes por turno | `limite` em `config_agendamentos()` |
| Crédito dos desenvolvedores no rodapé | `config_creditos()` |
| Endereço, horário e contato | `index.html` (rodapé) |

> O Studio também faz tatuagem e piercing. Para oferecê-los no agendamento, basta incluí-los em `servicos` com nome, descrição e preço.

### Vídeos e imagens

- **Vídeo de abertura:** substitua `video/osmalas.mp4` e `img/poster.jpg` mantendo os nomes.
- **Galeria de cortes:** para trocar um corte, substitua os três arquivos de mesmo número: `video/cortes/corte-N.mp4`, `img/cortes/corte-N.jpg` (miniatura) e `img/cortes/corte-N-poster.jpg`. Os nomes exibidos ficam na lista `NOMES_CORTES` no `script.js`.
- **Preparar o vídeo de um corte:** para o arrastar funcionar bem, o vídeo precisa de keyframes frequentes:
  ```bash
  ffmpeg -i entrada.mp4 -an -c:v libx264 -crf 26 -g 2 -bf 0 -pix_fmt yuv420p -movflags +faststart saida.mp4
  ```
- **Jacaré:** `video/croc.webm` (Chrome, Edge e Firefox, com transparência), `video/croc.mp4` (Safari e iPhone; o `script.js` combina cor e transparência em um canvas) e `img/croc-final.webp` (pose final, usada se o navegador bloquear o vídeo). O tamanho é ajustado em `.croc` no `style.css`.

---

## Segurança e acesso aos dados

- A tabela `agendamentos` tem RLS ativado. Visitantes **não conseguem** consultar, editar ou excluir reservas diretamente.
- O site só acessa o banco pelas funções públicas:
  - `config_agendamentos()` – serviços, barbeiros, turnos e limite
  - `config_creditos()` – crédito do rodapé
  - `vagas_agendamentos(data)` – devolve apenas **contagens** de vagas, sem nomes nem telefones
  - `criar_agendamento(...)` – valida e salva a reserva
- A administração das reservas é feita pelo painel do Supabase. Não existe painel administrativo público no site.
- O antigo `agendamentos.json` e o banco `.db` da versão anterior não são usados e não foram migrados.

---

## Testes do banco

O arquivo [`supabase/tests.sql`](supabase/tests.sql) valida reservas, limite de vagas, regras de data e turno, preços e permissões. Ele verifica, por exemplo, que:

- data passada, segunda-feira, sábado à noite, barbeiro, serviço e telefone inválidos são recusados;
- a 11ª reserva no mesmo turno é recusada;
- a consulta de vagas não expõe dados pessoais;
- consulta, edição e exclusão diretas da tabela são bloqueadas.

Execute-o **somente em um PostgreSQL local e descartável** (com os papéis `anon` e `authenticated`), depois de aplicar o `schema.sql`. Os dados de teste são revertidos com `rollback`. **Não execute no projeto de produção.**

---

## Limitações e próximos passos

- RLS e permissões protegem os dados pessoais, mas não impedem abuso de reservas anônimas. Antes de uso comercial, adicionar proteção contra bots e limite de requisições.
- Não há painel administrativo no site para gerenciar ou cancelar reservas.
- O cliente não cancela nem remarca sozinho.
- Ideias futuras: lembretes de horário ao cliente, painel administrativo e confirmação automática.

---

## Créditos

Desenvolvido pela equipe **Akitas** para o Os Malas Studio · © 2026
