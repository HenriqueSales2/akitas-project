# Akitas Project 🐶

Arquivos:
  index.html        estrutura da pagina
  style.css         visual
  script.js         agendamento (WhatsApp) e video de abertura
  video/osmalas.mp4 video de abertura (pode trocar mantendo o nome)
  img/poster.jpg    imagem exibida enquanto o video carrega
  video/cortes/     os 8 videos da secao "Nossos cortes" (corte-1.mp4 ... corte-8.mp4)
  img/cortes/       miniatura (corte-N.jpg) e poster (corte-N-poster.jpg) de cada corte

Para editar (em script.js): numero do WhatsApp na constante WA (formato 5511999999999).
Mantenha esse numero consistente com o contato exibido no rodape do index.html.
No index.html: precos, endereco, horario e Instagram.

## Agendamento: GitHub Pages + Supabase

O site e estatico: nao precisa de Node.js, npm, SQLite nem arquivo JSON para salvar reservas.
O navegador chama a Data API do Supabase diretamente com `fetch`.

### Configuracao passo a passo

1. No Supabase, crie o projeto com **Enable Data API** e **Enable automatic RLS** ativos.
   Deixe **Automatically expose new tables** desativado.
2. Abra **SQL Editor > New query**, cole o conteudo completo de
   [supabase/schema.sql](supabase/schema.sql) e clique em **Run**.
   O script cria a tabela e as funcoes, ativa RLS e concede acesso somente as funcoes publicas.
   Pode ser executado novamente para atualizar as funcoes sem apagar os agendamentos.
3. Confira a URL e a chave **publishable** em [supabase-config.js](supabase-config.js).
   Esses dois valores sao publicos. Nunca coloque senha, chave `sb_secret_...` ou
   `service_role` no site, nos commits ou em mensagens compartilhadas.
4. No repositorio GitHub, abra **Settings > Pages**, selecione **Deploy from a branch**
   e escolha a branch de publicacao e a pasta **/(root)**.
   Nao e necessario conectar o GitHub dentro do painel Supabase.
5. Abra o site e confira se os servicos e barbeiros carregam. Escolha um dia de terca
   a sabado, consulte as vagas e faca uma reserva de teste.
6. No **Table Editor** do Supabase, confira o registro e depois exclua a reserva de teste.
   Convide os colegas para a organizacao com contas individuais; nao compartilhe senhas.

Para testar localmente, use o Live Server do VS Code ou outro servidor de arquivos estaticos.
Nao e necessario instalar dependencias JavaScript. As URLs locais dos scripts sao relativas,
compativeis com GitHub Pages em um subdiretorio.

### Regras e acesso aos dados

- `config_agendamentos()` fornece servicos/precos, barbeiros, turnos e limite.
- `vagas_agendamentos(p_data)` retorna apenas contagens, sem nomes ou telefones.
- `criar_agendamento(...)` valida os dados e determina o preco no banco, nao no navegador.
  Uma trava por data/barbeiro/turno protege o limite de 10 vagas contra reservas simultaneas.
- O banco valida dias de funcionamento, prazo de ate 60 dias e turnos encerrados usando
  o fuso `America/Sao_Paulo`; a tela usa esse mesmo fuso, independentemente do fuso do visitante.
  Sabado nao tem turno noturno.
- Visitantes nao podem consultar a tabela diretamente, editar ou excluir reservas.
  A administracao e feita pelo painel Supabase; nao ha CRUD administrativo publico no site.
- RLS e permissoes protegem dados pessoais, mas nao impedem abuso de reservas anonimas.
  Antes de uso comercial, adicione protecao contra bots/rate limiting com validacao confiavel.
- Se a consulta de vagas falhar, o site mostra erro e nao inventa vagas disponiveis.
  O WhatsApp so e disponibilizado como confirmacao depois de a reserva ser salva.

O antigo `agendamentos.json` foi descartado; os registros antigos nao serao migrados.
O nome continua no `.gitignore` para evitar a publicacao acidental de backups com dados de clientes.
O `.gitignore` nao remove dados ja presentes no historico do Git; o antigo `.db` pode
continuar acessivel em commits anteriores.

### Testes do banco

[supabase/tests.sql](supabase/tests.sql) valida as reservas, o limite, as regras e as permissoes
em um PostgreSQL **local descartavel**, depois de aplicar `schema.sql`.
Esse banco de teste precisa dos papeis `anon` e `authenticated`.
Os dados de teste sao revertidos com `rollback`. Nao execute os testes no projeto de producao.

Secao "Nossos cortes": o dedo (ou mouse) arrastando para os lados controla o tempo do video. Os nomes dos cortes ficam na lista CUTS no fim do script.js, na mesma ordem dos arquivos corte-1 a corte-8. Para trocar um video, substitua o mp4, o corte-N.jpg e o corte-N-poster.jpg de mesmo numero (o mp4 deve ser gerado com keyframes frequentes: ffmpeg -i entrada.mp4 -an -c:v libx264 -crf 26 -g 2 -bf 0 -pix_fmt yuv420p -movflags +faststart saida.mp4).

Jacare na secao "Servicos":
  video/croc.webm      jacare com transparencia (Chrome, Edge, Firefox)
  video/croc.mp4       versao para Safari/iPhone (o script.js junta cor e transparencia num canvas)
  img/croc-final.webp  pose final parada (usada se o navegador bloquear o video)
  O tamanho dele muda em .croc no style.css.

Barbeiros, turnos e limite de vagas (na funcao config_agendamentos em supabase/schema.sql):
  BARBEIROS         lista de barbeiros (Alexandre, Luiz, Matheus)
  TURNOS            manha 08:30-12:00, tarde 13:00-18:00, noite 18:00-20:00
  LIMITE_POR_TURNO  maximo de clientes por barbeiro em cada turno (10)
Para mudar as regras, edite o SQL e execute-o novamente no Supabase.
Ao mudar precos, atualize tambem os valores exibidos na secao Servicos do index.html.
