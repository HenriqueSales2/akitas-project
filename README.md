# Akitas Project 🐶

Arquivos:
  index.html        estrutura da pagina
  style.css         visual
  script.js         agendamento (WhatsApp) e video de abertura
  video/akitas.mp4  video de abertura (pode trocar mantendo o nome)
  img/poster.jpg    imagem exibida enquanto o video carrega
  video/cortes/     os 8 videos da secao "Nossos cortes" (corte-1.mp4 ... corte-8.mp4)
  img/cortes/       miniatura (corte-N.jpg) e poster (corte-N-poster.jpg) de cada corte

Para editar (em script.js): numero do WhatsApp na constante WA (formato 5511999999999) e a lista de servicos/precos em SV.
No index.html: precos, endereco, horario e Instagram.

Para testar: abra o index.html no navegador. Para publicar, envie a pasta inteira para sua hospedagem.

Secao "Nossos cortes": o dedo (ou mouse) arrastando para os lados controla o tempo do video. Os nomes dos cortes ficam na lista CUTS no fim do script.js, na mesma ordem dos arquivos corte-1 a corte-8. Para trocar um video, substitua o mp4, o corte-N.jpg e o corte-N-poster.jpg de mesmo numero (o mp4 deve ser gerado com keyframes frequentes: ffmpeg -i entrada.mp4 -an -c:v libx264 -crf 26 -g 2 -bf 0 -pix_fmt yuv420p -movflags +faststart saida.mp4).

Jacare na secao "Servicos":
  video/croc.webm      jacare com transparencia (Chrome, Edge, Firefox)
  video/croc.mp4       versao para Safari/iPhone (o script.js junta cor e transparencia num canvas)
  img/croc-final.webp  pose final parada (usada se o navegador bloquear o video)
  O tamanho dele muda em .croc no style.css.
