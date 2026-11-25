/* ===== Agendamento ===== */

let configuracaoAgendamentos;
let versaoConsultaVagas = 0;

const obterElementoPorId = id => document.getElementById(id);

const opcoesServicosAgendamento = obterElementoPorId("opcoes-servicos-agendamento"),
  listaCartoesServicos = obterElementoPorId("lista-servicos"),
  opcoesTurnosAgendamento = obterElementoPorId("opcoes-turnos-agendamento"),
  campoDataAgendamento = obterElementoPorId("data-agendamento"),
  opcoesBarbeiros = obterElementoPorId("opcoes-barbeiros-agendamento");

const botaoEnviarAgendamento = obterElementoPorId("formulario-agendamento").querySelector("button[type=submit]");

function formatarPreco(precoServico) {
  if (typeof precoServico !== "number" || !Number.isFinite(precoServico) || precoServico < 0) {
    throw new Error("Preço de serviço inválido.");
  }
  const temCentavos = !Number.isInteger(precoServico);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: temCentavos ? 2 : 0,
    maximumFractionDigits: 2
  }).format(precoServico);
}

const formatadorHorarioBarbearia = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Sao_Paulo",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23"
});

function obterHorarioLocalBarbearia() {
  const partesDataHora = Object.fromEntries(
    formatadorHorarioBarbearia.formatToParts(new Date()).map(part => [part.type, part.value])
  );
  return {
    data: `${partesDataHora.year}-${partesDataHora.month}-${partesDataHora.day}`,
    minutos: Number(partesDataHora.hour) * 60 + Number(partesDataHora.minute)
  };
}

function atualizarLimitesDataAgendamento() {
  campoDataAgendamento.min = obterHorarioLocalBarbearia().data;
  const dataMaxima = new Date(`${campoDataAgendamento.min}T12:00:00Z`);
  dataMaxima.setUTCDate(dataMaxima.getUTCDate() + 60);
  campoDataAgendamento.max = dataMaxima.toISOString().slice(0, 10);
}

atualizarLimitesDataAgendamento();

async function chamarRpcSupabase(nomeRpc, parametrosRpc = {}) {
  const resposta = await fetch(`${CONFIGURACAO_SUPABASE.endereco}/rest/v1/rpc/${nomeRpc}`, {
    method: "POST",
    headers: {
      apikey: CONFIGURACAO_SUPABASE.chavePublica,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(parametrosRpc)
  });
  const resultadoRpc = await resposta.json();
  if (!resposta.ok) {
    console.error(`Erro no Supabase (${nomeRpc}):`, resultadoRpc);
    throw new Error(resultadoRpc.code === "22023"
      ? resultadoRpc.message
      : "Não foi possível acessar os agendamentos. Tente novamente mais tarde.");
  }
  return resultadoRpc;
}

const horarioParaMinutos = horario => {
  const [horas, minutos] = horario.split(":").map(Number);
  return horas * 60 + minutos;
};

function renderizarOpcoesBarbeiros() {
  opcoesBarbeiros.replaceChildren();
  configuracaoAgendamentos.barbeiros.forEach(({ nome: nomeBarbeiro }) => {
    const opcaoBarbeiro = document.createElement("label");
    opcaoBarbeiro.className = "opcao-selecao";

    const campoBarbeiro = document.createElement("input");
    campoBarbeiro.type = "radio";
    campoBarbeiro.name = "barbeiro";
    campoBarbeiro.value = nomeBarbeiro;

    const rotuloBarbeiro = document.createElement("span");
    rotuloBarbeiro.textContent = nomeBarbeiro;
    opcaoBarbeiro.append(campoBarbeiro, rotuloBarbeiro);
    opcoesBarbeiros.append(opcaoBarbeiro);
  });
}

function renderizarOpcoesServicos(servicos) {
  const fragmentoOpcoesServico = document.createDocumentFragment();
  const fragmentoCartoesServico = document.createDocumentFragment();

  servicos.forEach(({ nome: nomeServico, descricao: descricaoServico, preco: precoServico }) => {
    const precoFormatado = formatarPreco(precoServico);

    const opcaoServico = document.createElement("label");
    opcaoServico.className = "opcao-selecao";

    const campoServico = document.createElement("input");
    campoServico.type = "radio";
    campoServico.name = "servico";
    campoServico.value = nomeServico;

    const rotuloServico = document.createElement("span");
    rotuloServico.append(document.createTextNode(nomeServico));

    const precoOpcao = document.createElement("b");
    precoOpcao.textContent = precoFormatado;
    rotuloServico.append(precoOpcao);
    opcaoServico.append(campoServico, rotuloServico);
    fragmentoOpcoesServico.append(opcaoServico);

    const cartaoServico = document.createElement("li");
    const detalhesServico = document.createElement("div");

    const tituloServico = document.createElement("strong");
    tituloServico.textContent = nomeServico;

    const textoDescricaoServico = document.createElement("small");
    textoDescricaoServico.textContent = descricaoServico;
    detalhesServico.append(tituloServico, textoDescricaoServico);

    const precoCartao = document.createElement("span");
    precoCartao.className = "preco-servico";
    precoCartao.textContent = precoFormatado;

    const botaoAgendar = document.createElement("button");
    botaoAgendar.type = "button";
    botaoAgendar.className = "botao-agendar-servico";
    botaoAgendar.dataset.servico = nomeServico;
    botaoAgendar.textContent = "Agendar";

    cartaoServico.append(detalhesServico, precoCartao, botaoAgendar);
    fragmentoCartoesServico.append(cartaoServico);
  });

  opcoesServicosAgendamento.replaceChildren(fragmentoOpcoesServico);
  listaCartoesServicos.replaceChildren(fragmentoCartoesServico);
  obterElementoPorId("status-carregamento-servicos").hidden = true;
}

function renderizarCreditosCriadores(creditos) {
  const ehUrlHttpsValida = url => {
    try {
      return new URL(url).protocol === "https:";
    } catch {
      return false;
    }
  };
  if (
    !creditos ||
    typeof creditos.nome !== "string" ||
    !creditos.nome.trim() ||
    !ehUrlHttpsValida(creditos.url) ||
    !ehUrlHttpsValida(creditos.imagem)
  ) {
    console.error("Configure nome, ancora e imagem válidos para os créditos no Supabase.");
    return;
  }

  const ancora = document.createElement("a");
  ancora.className = "credito-criadores";
  ancora.href = creditos.url;
  ancora.target = "_blank";
  ancora.rel = "noopener noreferrer";

  const imagem = document.createElement("img");
  imagem.src = creditos.imagem;
  imagem.alt = "";
  imagem.width = 20;
  imagem.height = 20;

  const nome = document.createElement("span");
  nome.textContent = creditos.nome;
  ancora.append(imagem, nome);
  obterElementoPorId("creditos-criadores").replaceChildren(ancora);
}

async function carregarConfiguracaoAgendamentos() {
  try {
    configuracaoAgendamentos = await chamarRpcSupabase("config_agendamentos");
    const possuiServicosValidos = Array.isArray(configuracaoAgendamentos.servicos) &&
      configuracaoAgendamentos.servicos.length > 0 &&
      configuracaoAgendamentos.servicos.every(servico =>
        typeof servico?.nome === "string" &&
        servico.nome.trim() &&
        typeof servico.descricao === "string" &&
        servico.descricao.trim() &&
        typeof servico.preco === "number" &&
        Number.isFinite(servico.preco) &&
        servico.preco >= 0
      ) &&
      new Set(configuracaoAgendamentos.servicos.map(({ nome }) => nome)).size === configuracaoAgendamentos.servicos.length;
    if (!possuiServicosValidos) {
      throw new Error("Configure nomes únicos, descrição e preço válidos para cada serviço no Supabase.");
    }

    const possuiContatosValidosBarbeiros = Array.isArray(configuracaoAgendamentos.barbeiros) &&
      configuracaoAgendamentos.barbeiros.length > 0 &&
      configuracaoAgendamentos.barbeiros.every(({ nome, tel }) =>
        typeof nome === "string" &&
        nome.trim() &&
        typeof tel === "string" &&
        /^\d{10,15}$/.test(tel)
    );
    if (!possuiContatosValidosBarbeiros) {
      throw new Error("Configure nome e telefone válidos para cada barbeiro no Supabase.");
    }

    renderizarOpcoesServicos(configuracaoAgendamentos.servicos);
    renderizarOpcoesBarbeiros();
    botaoEnviarAgendamento.disabled = false;
    botaoEnviarAgendamento.textContent = "Enviar pedido de agendamento";
  } catch (erro) {
    console.error("Erro ao carregar configuração:", erro);
    obterElementoPorId("status-carregamento-servicos").textContent = "Não foi possível carregar os serviços. Tente novamente mais tarde.";
    obterElementoPorId("erro-agendamento").textContent = "Agendamento indisponível. Recarregue a página para tentar novamente ou entre em contato com a barbearia.";
    botaoEnviarAgendamento.disabled = true;
    botaoEnviarAgendamento.textContent = "Agendamento indisponível";
  }
}

carregarConfiguracaoAgendamentos();

async function carregarCreditosCriadores() {
  try {
    const creditos = await chamarRpcSupabase("config_creditos");
    renderizarCreditosCriadores(creditos);
  } catch (erro) {
    console.error("Erro ao carregar os créditos do rodapé:", erro);
  }
}

carregarCreditosCriadores();

// Renderiza os turnos do barbeiro escolhido, mostrando quantas vagas restam.
async function carregarTurnosDisponiveis() {
  const versaoRequisicao = ++versaoConsultaVagas;
  opcoesTurnosAgendamento.replaceChildren();
  atualizarLimitesDataAgendamento();

  const dataSelecionada = campoDataAgendamento.value;
  const barbeiroSelecionado = document.querySelector("input[name=barbeiro]:checked")?.value;

  if (!dataSelecionada || !barbeiroSelecionado) {
    obterElementoPorId("mensagem-turnos-agendamento").textContent = "Escolha o barbeiro e o dia para ver os turnos.";
    return;
  }

  if (dataSelecionada < campoDataAgendamento.min || dataSelecionada > campoDataAgendamento.max) {
    obterElementoPorId("mensagem-turnos-agendamento").textContent = "Escolha uma data entre hoje e os próximos 60 dias.";
    return;
  }

  const diaSemana = new Date(`${dataSelecionada}T12:00:00Z`).getUTCDay();
  const indiceDomingo = 0;
  const indiceSegunda = 1;

  obterElementoPorId("mensagem-data-agendamento").textContent = "";

  if (diaSemana === indiceDomingo || diaSemana === indiceSegunda) {
    obterElementoPorId("mensagem-turnos-agendamento").textContent = "Fechado neste dia. Escolha de terça a sábado.";
    return;
  }

  obterElementoPorId("mensagem-turnos-agendamento").textContent = "Consultando vagas...";
  let disponibilidadeVagas;
  try {
    const respostaDisponibilidade = await chamarRpcSupabase("vagas_agendamentos", { p_data: dataSelecionada });
    if (versaoRequisicao !== versaoConsultaVagas) return;
    disponibilidadeVagas = respostaDisponibilidade.vagas;
    if (!configuracaoAgendamentos.turnos.every(turno =>
      Number.isInteger(disponibilidadeVagas?.[barbeiroSelecionado]?.[turno.id]?.restantes)
    )) {
      throw new Error("Resposta de vagas inválida");
    }
  } catch (erro) {
    if (versaoRequisicao !== versaoConsultaVagas) return;
    console.error("Erro ao consultar vagas:", erro);
    obterElementoPorId("mensagem-turnos-agendamento").textContent = "Não foi possível consultar as vagas. Selecione novamente o dia ou o barbeiro para tentar de novo.";
    return;
  }
  const horarioLocalAtual = obterHorarioLocalBarbearia();
  const ehHoje = dataSelecionada === horarioLocalAtual.data;
  let possuiVagasDisponiveis = false;

  for (const turno of configuracaoAgendamentos.turnos) {
    // Sábado: sem turno da noite (fecha às 18h)
    if (diaSemana === 6 && turno.id === "noite") continue;
    // Turno de hoje que já terminou
    if (ehHoje && horarioParaMinutos(turno.fim) <= horarioLocalAtual.minutos) continue;

    const vagasRestantes = disponibilidadeVagas[barbeiroSelecionado][turno.id].restantes;
    const estaLotado = vagasRestantes <= 0;
    const textoDisponibilidade = estaLotado
      ? "Lotado"
      : `${vagasRestantes} ${vagasRestantes === 1 ? "vaga" : "vagas"}`;

    if (!estaLotado) possuiVagasDisponiveis = true;

    opcoesTurnosAgendamento.insertAdjacentHTML(
      "beforeend",
      `<label class="opcao-selecao${estaLotado ? " lotado" : ""}"><input type="radio" name="turno" value="${turno.id}" ${estaLotado ? "disabled" : ""}><span><span class="detalhes-turno">${turno.nome}<small>${turno.inicio} às ${turno.fim}</small></span><b>${textoDisponibilidade}</b></span></label>`
    );
  }

  obterElementoPorId("mensagem-turnos-agendamento").textContent = possuiVagasDisponiveis
    ? ""
    : "Sem vagas para este barbeiro neste dia. Escolha outro barbeiro ou outro dia.";
}

campoDataAgendamento.addEventListener("change", carregarTurnosDisponiveis);
opcoesBarbeiros.addEventListener("change", carregarTurnosDisponiveis);

listaCartoesServicos.addEventListener("click", evento => {
  const botaoAgendar = evento.target.closest("button.botao-agendar-servico");
  if (!botaoAgendar) return;

  const campoServicoSelecionado = [...opcoesServicosAgendamento.querySelectorAll('input[name="servico"]')]
    .find(campoServico => campoServico.value === botaoAgendar.dataset.servico);
  if (campoServicoSelecionado) campoServicoSelecionado.checked = true;

  obterElementoPorId("agendamento").scrollIntoView({ behavior: "smooth" });
});

obterElementoPorId("formulario-agendamento").addEventListener("submit", async evento => {
  evento.preventDefault();

  const servicoSelecionado = document.querySelector("input[name=servico]:checked"),
    barbeiroSelecionado = document.querySelector("input[name=barbeiro]:checked"),
    turnoSelecionado = document.querySelector("input[name=turno]:checked"),
    nomeCliente = obterElementoPorId("nome-cliente").value.trim(),
    telefoneCliente = obterElementoPorId("telefone-cliente").value.trim();

  const mensagemErro = obterElementoPorId("erro-agendamento");
  const confirmacaoAgendamento = obterElementoPorId("agendamento-confirmado");

  mensagemErro.textContent = "";
  confirmacaoAgendamento.hidden = true;

  if (botaoEnviarAgendamento.disabled) return;
  if (!servicoSelecionado) return mensagemErro.textContent = "Escolha um serviço.";
  if (!barbeiroSelecionado) return mensagemErro.textContent = "Escolha o barbeiro.";
  const configuracaoBarbeiroSelecionado = configuracaoAgendamentos.barbeiros.find(({ nome }) => nome === barbeiroSelecionado.value);
  if (!configuracaoBarbeiroSelecionado) return mensagemErro.textContent = "Selecione um barbeiro válido.";
  if (!campoDataAgendamento.value) return mensagemErro.textContent = "Escolha o dia do atendimento.";
  if (!turnoSelecionado) return mensagemErro.textContent = "Escolha um turno.";
  if (nomeCliente.length < 2) return mensagemErro.textContent = "Informe seu nome.";
  if (telefoneCliente.replace(/\D/g, "").length < 10) return mensagemErro.textContent = "Informe um telefone com DDD.";

  const [ano, mes, dia] = campoDataAgendamento.value.split("-");
  const dataAgendamentoISO = `${ano}-${mes}-${dia}`;
  const dataAgendamentoFormatada = `${dia}/${mes}/${ano}`;

  const turnoAgendamentoSelecionado = configuracaoAgendamentos.turnos.find(turno => turno.id === turnoSelecionado.value);
  const descricaoTurno = `${turnoAgendamentoSelecionado.nome} (${turnoAgendamentoSelecionado.inicio} às ${turnoAgendamentoSelecionado.fim})`;

  botaoEnviarAgendamento.disabled = true;
  botaoEnviarAgendamento.textContent = "Reservando...";
  try {
    const resultadoAgendamento = await chamarRpcSupabase("criar_agendamento", {
      p_nome: nomeCliente,
      p_telefone: telefoneCliente,
      p_servico: servicoSelecionado.value,
      p_data: dataAgendamentoISO,
      p_barbeiro: barbeiroSelecionado.value,
      p_turno: turnoSelecionado.value
    });

    if (resultadoAgendamento.success !== true) {
      mensagemErro.textContent = resultadoAgendamento.error || "Não foi possível reservar este turno.";
      carregarTurnosDisponiveis();
      return;
    }

    const mensagemWhatsApp = `Olá, Os Malas! Reservei ${servicoSelecionado.value} com ${barbeiroSelecionado.value}, dia ${dataAgendamentoFormatada}, turno ${descricaoTurno}. Nome: ${nomeCliente}. Telefone: ${telefoneCliente}.`;

    const enderecoWhatsApp = `https://wa.me/${configuracaoBarbeiroSelecionado.tel}?text=${encodeURIComponent(mensagemWhatsApp)}`;

    confirmacaoAgendamento.hidden = false;
    confirmacaoAgendamento.innerHTML = `
            <strong>✅ Agendamento confirmado!</strong>
            <p class="mensagem-formulario"><strong>Serviço:</strong> ${servicoSelecionado.value}<br>
            <strong>Barbeiro:</strong> ${barbeiroSelecionado.value}<br>
            <strong>Dia:</strong> ${dataAgendamentoFormatada}<br>
            <strong>Turno:</strong> ${descricaoTurno}<br>
            <strong>Nome:</strong> <span data-nome-cliente></span><br>
            <strong>Valor:</strong> ${formatarPreco(resultadoAgendamento.preco)}</p>
            <p class="mensagem-formulario">Sua vaga já está reservada no sistema. Chegue dentro do turno escolhido. Abra o WhatsApp para confirmar diretamente com a barbearia.</p>
            <a class="botao-primario" href="${enderecoWhatsApp}" target="_blank" rel="noopener">Abrir WhatsApp</a>
        `;
    confirmacaoAgendamento.querySelector("[data-nome-cliente]").textContent = nomeCliente;

    versaoConsultaVagas++;
    obterElementoPorId("formulario-agendamento").reset();
    opcoesTurnosAgendamento.replaceChildren();
    obterElementoPorId("mensagem-turnos-agendamento").textContent = "Escolha o barbeiro e o dia para ver os turnos.";
    obterElementoPorId("mensagem-data-agendamento").textContent = "";

    // Abre o WhatsApp após confirmar no banco
    window.open(enderecoWhatsApp, "_blank", "noopener");

  } catch (error) {
    console.error("Erro ao salvar agendamento:", error);
    mensagemErro.textContent = `Não foi possível confirmar a reserva. ${error.message} Se a conexão caiu durante o envio, confirme com a barbearia antes de repetir o pedido.`;
  } finally {
    botaoEnviarAgendamento.disabled = false;
    botaoEnviarAgendamento.textContent = "Enviar pedido de agendamento";
  }
});


/* ===== Vídeo de abertura: trava a rolagem, congela no último frame e desce sozinho ===== */

(() => {
  const raizDocumento = document.documentElement,
    secaoAbertura = document.querySelector(".secao-abertura"),
    videoAbertura = document.getElementById("video-abertura"),
    barraProgressoVideo = document.getElementById("progresso-video-abertura"),
    botaoPularVideo = document.getElementById("botao-pular-abertura"),
    botaoIniciarVideo = document.getElementById("botao-iniciar-abertura");

  let videoFinalizado = false;
  let temporizadorBotaoIniciar;

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  scrollTo(0, 0);
  raizDocumento.classList.add("rolagem-bloqueada");

  const rolagemBloqueada = () => raizDocumento.classList.contains("rolagem-bloqueada");

  ["wheel", "touchmove"].forEach(eventName =>
    addEventListener(
      eventName,
      evento => {
        if (rolagemBloqueada()) evento.preventDefault();
      },
      { passive: false }
    )
  );

  addEventListener("keydown", evento => {
    if (
      rolagemBloqueada() &&
      [" ", "ArrowDown", "ArrowUp", "PageDown", "PageUp", "End", "Home"].includes(evento.key)
    ) evento.preventDefault();
  });

  function finalizarVideoAbertura() {
    if (videoFinalizado) return;

    videoFinalizado = true;
    clearTimeout(temporizadorBotaoIniciar);

    secaoAbertura.classList.add("concluido");
    barraProgressoVideo.style.transform = "scaleX(1)";

    try {
      videoAbertura.pause();
    } catch (e) { }

    // Libera a rolagem imediatamente; a animação do copy é controlada separadamente
    raizDocumento.classList.remove("rolagem-bloqueada");

    const prefereMovimentoReduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;

    document.getElementById("cortes").scrollIntoView({
      behavior: prefereMovimentoReduzido ? "auto" : "smooth"
    });
  }

  videoAbertura.addEventListener("timeupdate", () => {
    if (videoAbertura.duration && !videoFinalizado) {
      barraProgressoVideo.style.transform = "scaleX(" + (videoAbertura.currentTime / videoAbertura.duration) + ")";
    }
  });

  videoAbertura.addEventListener("ended", finalizarVideoAbertura);

  videoAbertura.addEventListener("playing", () => {
    clearTimeout(temporizadorBotaoIniciar);
    botaoIniciarVideo.hidden = true;
  });

  videoAbertura.addEventListener("error", () => {
    clearTimeout(temporizadorBotaoIniciar);
    videoFinalizado = true;
    raizDocumento.classList.remove("rolagem-bloqueada");
    secaoAbertura.classList.add("concluido");
  });

  botaoPularVideo.addEventListener("click", () => {
    if (videoAbertura.duration) videoAbertura.currentTime = Math.max(0, videoAbertura.duration - .05);
    finalizarVideoAbertura();
  });

  botaoIniciarVideo.addEventListener("click", () => {
    videoAbertura.play().catch(() => {
      if (!videoFinalizado) botaoIniciarVideo.hidden = false;
    });
  });

  temporizadorBotaoIniciar = setTimeout(() => {
    if (!videoFinalizado) botaoIniciarVideo.hidden = false;
  }, 1200);

  videoAbertura.play().catch(() => {
    if (!videoFinalizado) botaoIniciarVideo.hidden = false;
  });
})();


/* ===== Cortes: arrastar para os lados controla o tempo do vídeo ===== */

(() => {
  const NOMES_CORTES = [
    "Afro Low Taper Fade",
    "Afro Curto Low Taper Fade",
    "Mid Skin Fade",
    "Tranças Nagô Desenhadas",
    "Tranças Nagô Retas",
    "Buzz Cut Platinado",
    "Low Taper Fade com Luzes",
    "Taper Fade com Nudred"
  ];

  const controleVideoCorte = obterElementoPorId("controle-video-cortes"),
    videoCorte = obterElementoPorId("video-cortes"),
    barraProgresso = obterElementoPorId("progresso-cortes"),
    dicaInteracao = obterElementoPorId("dica-controle-cortes"),
    nomeCorteAtual = obterElementoPorId("nome-corte-atual"),
    miniaturasCortes = obterElementoPorId("miniaturas-cortes");

  let indiceCorteAtual = 0,
    progressoAlvo = 0,
    progressoAtual = 0,
    velocidadeArrasto = 0,
    estaArrastando = false,
    posicaoAnteriorPonteiroX = 0,
    horarioAnteriorInteracao = 0,
    jaInteragiu = false;

  const limitarProgresso = valor => Math.min(1, Math.max(0, valor));

  NOMES_CORTES.forEach((nomeCorte, indiceCorte) =>
    miniaturasCortes.insertAdjacentHTML(
      "beforeend",
      `<button type="button" aria-label="${nomeCorte}"><img src="img/cortes/corte-${indiceCorte + 1}.jpg" alt="" loading="lazy"></button>`
    )
  );

  function carregarCorte(indiceCorte) {
    indiceCorteAtual = (indiceCorte + NOMES_CORTES.length) % NOMES_CORTES.length;
    progressoAlvo = progressoAtual = velocidadeArrasto = 0;

    videoCorte.poster = `img/cortes/corte-${indiceCorteAtual + 1}-poster.jpg`;
    videoCorte.src = `video/cortes/corte-${indiceCorteAtual + 1}.mp4`;

    nomeCorteAtual.textContent = NOMES_CORTES[indiceCorteAtual];

    [...miniaturasCortes.children].forEach((botaoMiniatura, indiceMiniatura) =>
      botaoMiniatura.setAttribute("aria-current", indiceMiniatura === indiceCorteAtual)
    );

    const miniaturaAtiva = miniaturasCortes.children[indiceCorteAtual];

    miniaturasCortes.scrollTo({
      left: miniaturaAtiva.offsetLeft - (miniaturasCortes.clientWidth - miniaturaAtiva.offsetWidth) / 2,
      behavior: "smooth"
    });
  }

  function atualizarQuadroVideo() {
    if (!estaArrastando && Math.abs(velocidadeArrasto) > .0002) {
      progressoAlvo = limitarProgresso(progressoAlvo + velocidadeArrasto);
      velocidadeArrasto *= .96;
      if (progressoAlvo <= 0 || progressoAlvo >= 1) velocidadeArrasto = 0;
    }

    // A interpolação dita a suavidade, mas agora roda na velocidade do monitor (60hz, 120hz...)
    progressoAtual += (progressoAlvo - progressoAtual) * .15;

    if (Math.abs(progressoAlvo - progressoAtual) < .0001) progressoAtual = progressoAlvo;

    const tempoVideo = progressoAtual * (videoCorte.duration || 0);

    // Atualiza o frame o mais rápido que o navegador permitir
    if (videoCorte.readyState >= 2 && !videoCorte.seeking && Math.abs(videoCorte.currentTime - tempoVideo) > .01) {
      videoCorte.currentTime = tempoVideo;
    }

    barraProgresso.style.transform = `scaleX(${progressoAtual})`;
    controleVideoCorte.setAttribute("aria-valuenow", Math.round(progressoAtual * 100));

    requestAnimationFrame(atualizarQuadroVideo);
  }

  controleVideoCorte.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" && e.button) return;

    estaArrastando = true;
    velocidadeArrasto = 0;
    posicaoAnteriorPonteiroX = e.clientX;
    horarioAnteriorInteracao = performance.now();

    controleVideoCorte.setPointerCapture(e.pointerId);
    controleVideoCorte.classList.add("ativo");

    if (!jaInteragiu) {
      jaInteragiu = true;
      dicaInteracao.classList.add("oculto");

      videoCorte.play().then(() => videoCorte.pause()).catch(() => { });
    }
  });

  controleVideoCorte.addEventListener("pointermove", eventoPonteiro => {
    if (!estaArrastando) return;

    // ALTERAÇÃO 3: Aumentei o divisor de .85 para 1.4.
    // Isso deixa o arrasto menos sensível, exigindo um movimento maior para girar o vídeo.
    const variacaoProgresso = (eventoPonteiro.clientX - posicaoAnteriorPonteiroX) / (controleVideoCorte.clientWidth * 1.4),
      currentTime = performance.now();

    posicaoAnteriorPonteiroX = eventoPonteiro.clientX;
    progressoAlvo = limitarProgresso(progressoAlvo + variacaoProgresso);

    // Ajuste da velocidade para a inércia
    velocidadeArrasto = .8 * velocidadeArrasto + .2 * (variacaoProgresso / Math.max(1, currentTime - horarioAnteriorInteracao) * 16);
    horarioAnteriorInteracao = currentTime;
  });

  const encerrarArrastoPonteiro = () => {
    if (!estaArrastando) return;

    estaArrastando = false;
    controleVideoCorte.classList.remove("ativo");

    if (performance.now() - horarioAnteriorInteracao > 80) velocidadeArrasto = 0;
  };

  ["pointerup", "pointercancel", "lostpointercapture"].forEach(eventName =>
    controleVideoCorte.addEventListener(eventName, encerrarArrastoPonteiro)
  );

  controleVideoCorte.addEventListener("wheel", eventoRolagem => {
    if (Math.abs(eventoRolagem.deltaX) <= Math.abs(eventoRolagem.deltaY)) return;

    eventoRolagem.preventDefault();

    jaInteragiu = true;
    dicaInteracao.classList.add("oculto");

    // Suavizado também no scroll do mouse
    progressoAlvo = limitarProgresso(progressoAlvo - eventoRolagem.deltaX / (controleVideoCorte.clientWidth * 1.8));
  }, { passive: false });

  controleVideoCorte.addEventListener("keydown", eventoTeclado => {
    const passoProgresso = {
      ArrowRight: .05,
      ArrowLeft: -.05
    }[eventoTeclado.key];

    if (passoProgresso !== undefined) {
      eventoTeclado.preventDefault();

      jaInteragiu = true;
      dicaInteracao.classList.add("oculto");

      progressoAlvo = limitarProgresso(progressoAlvo + passoProgresso);
    }
  });

  obterElementoPorId("corte-anterior").addEventListener("click", () => carregarCorte(indiceCorteAtual - 1));
  obterElementoPorId("proximo-corte").addEventListener("click", () => carregarCorte(indiceCorteAtual + 1));

  [...miniaturasCortes.children].forEach((botaoMiniatura, indiceCorte) =>
    botaoMiniatura.addEventListener("click", () => carregarCorte(indiceCorte))
  );

  function orientarControleCorte() {
    if (jaInteragiu || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const horarioInicioAnimacao = performance.now();

    (function animarOrientacao(marcaTempo) {
      const progresso = (marcaTempo - horarioInicioAnimacao) / 1600;

      if (jaInteragiu || estaArrastando) return;
      if (progresso >= 1) {
        progressoAlvo = 0;
        return;
      }

      progressoAlvo = .22 * Math.sin(Math.PI * progresso);
      requestAnimationFrame(animarOrientacao);
    })(horarioInicioAnimacao);
  }

  carregarCorte(0);
  atualizarQuadroVideo();

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entradas, observador) => {
      if (entradas[0].isIntersecting) {
        videoCorte.preload = "auto";
        videoCorte.load();
        observador.disconnect();
      }
    }, { rootMargin: "700px" }).observe(controleVideoCorte);

    new IntersectionObserver((entradas, observador) => {
      if (entradas[0].isIntersecting) {
        observador.disconnect();

        videoCorte.readyState >= 2
          ? orientarControleCorte()
          : videoCorte.addEventListener("loadeddata", orientarControleCorte, { once: true });
      }
    }, { threshold: .6 }).observe(controleVideoCorte);

  } else {
    videoCorte.preload = "auto";
    videoCorte.load();
  }
})();

/* ===== Menu fixo: ancora da seção atual ===== */
(() => {
  const linksNavegacao = [...document.querySelectorAll(".navegacao-secoes a")];
  const definirLinkNavegacaoAtual = idSecao => {
    linksNavegacao.forEach(ancora => {
      ancora.setAttribute("aria-current", String(ancora.getAttribute("href") === `#${idSecao}`));
    });
  };
  const chegouAoFinalDaPagina = () =>
    window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1;
  const atualizarLinkContato = () => {
    if (chegouAoFinalDaPagina()) definirLinkNavegacaoAtual("contato");
  };
  const observadorSecoes = "IntersectionObserver" in window
    ? new IntersectionObserver(entradas => {
      if (chegouAoFinalDaPagina()) {
        definirLinkNavegacaoAtual("contato");
        return;
      }

      entradas.forEach(entrada => {
        if (entrada.isIntersecting) definirLinkNavegacaoAtual(entrada.target.id);
      });
    }, { rootMargin: "-45% 0px -50% 0px" })
    : null;

  linksNavegacao.forEach(ancora => {
    ancora.addEventListener("click", () => {
      definirLinkNavegacaoAtual(ancora.getAttribute("href").slice(1));
    });

    const secaoAlvo = document.querySelector(ancora.getAttribute("href"));
    if (secaoAlvo && observadorSecoes) {
      observadorSecoes.observe(secaoAlvo);
    }
  });

  window.addEventListener("scroll", atualizarLinkContato, { passive: true });
  window.addEventListener("resize", atualizarLinkContato);
  atualizarLinkContato();
})();

/* ===== Jacaré entra andando na seção Serviços =====
   Chrome, Edge e Firefox: video/croc.webm (WebM com transparência de verdade, sem nenhum truque de script).
   Safari e iPhone não leem transparência em WebM; lá usamos video/croc.mp4, que guarda a cor (metade de cima)
   e a transparência (metade de baixo), e juntamos as duas num canvas. */
(() => {
  const areaAnimacaoJacare = document.getElementById("animacao-jacare"), telaQuadrosJacare = document.getElementById("tela-quadros-jacare"), videoAlternativoJacare = document.getElementById("video-mp4-jacare"), videoTransparenteJacare = document.getElementById("video-webm-jacare");
  if (!areaAnimacaoJacare || !telaQuadrosJacare || !videoAlternativoJacare) return;
  const dimensoesQuadroVideo = { largura: 782, altura: 600, inicioXVisivel: 245, fimXVisivel: 713 };            // tamanho do recorte e onde o jacaré para (em px do vídeo)
  const agenteUsuario = navigator.userAgent;
  const requerVideoOpaco = /iP(hone|ad|od)/.test(agenteUsuario) || (/^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(agenteUsuario));
  const suportaWebmTransparente = !!videoTransparenteJacare && !requerVideoOpaco && !!videoTransparenteJacare.canPlayType && videoTransparenteJacare.canPlayType('video/webm; codecs="vp9"') !== "";
  const videoAtivo = suportaWebmTransparente ? videoTransparenteJacare : videoAlternativoJacare;
  if (!suportaWebmTransparente && videoTransparenteJacare) videoTransparenteJacare.remove();
  telaQuadrosJacare.width = dimensoesQuadroVideo.largura; telaQuadrosJacare.height = dimensoesQuadroVideo.altura;
  const contextoQuadro = telaQuadrosJacare.getContext("2d");
  const telaAuxiliar = document.createElement("canvas"); telaAuxiliar.width = dimensoesQuadroVideo.largura; telaAuxiliar.height = dimensoesQuadroVideo.altura * 2;
  const contextoAuxiliar = telaAuxiliar.getContext("2d", { willReadFrequently: true });
  const dadosImagemQuadro = contextoQuadro.createImageData(dimensoesQuadroVideo.largura, dimensoesQuadroVideo.altura);
  const prefereMovimentoReduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let animacaoIniciada = false;
  if (suportaWebmTransparente) telaQuadrosJacare.style.display = "none";

  /* posiciona o jacaré: começa colado na borda esquerda da tela (ele "entra" por ali) e para na coluna do título */
  function posicionarAnimacao() {
    const alturaContainer = areaAnimacaoJacare.clientHeight;
    const fatorEscala = alturaContainer / dimensoesQuadroVideo.altura;
    const limitesContainer = areaAnimacaoJacare.getBoundingClientRect();
    const larguraJacareVisivel =
      (dimensoesQuadroVideo.fimXVisivel - dimensoesQuadroVideo.inicioXVisivel) * fatorEscala;
    const deslocamentoInicioVisivel = dimensoesQuadroVideo.inicioXVisivel * fatorEscala;
    const posicaoEsquerdaDesejada =
      limitesContainer.left + (areaAnimacaoJacare.clientWidth - larguraJacareVisivel) / 2;
    const posicaoEsquerdaAnimacao = Math.min(0, posicaoEsquerdaDesejada - deslocamentoInicioVisivel);

    for (const elementoMidia of [telaQuadrosJacare, suportaWebmTransparente ? videoTransparenteJacare : null]) {
      if (!elementoMidia) continue;

      elementoMidia.style.width = dimensoesQuadroVideo.largura * fatorEscala + "px";
      elementoMidia.style.height = alturaContainer + "px";
      elementoMidia.style.left = posicaoEsquerdaAnimacao - limitesContainer.left + "px";
    }

    areaAnimacaoJacare.style.setProperty(
      "--posicao-x-jacare",
      posicaoEsquerdaAnimacao - limitesContainer.left + deslocamentoInicioVisivel + larguraJacareVisivel / 2 + "px"
    );
    areaAnimacaoJacare.style.setProperty("--largura-sombra-jacare", larguraJacareVisivel * 1.05 + "px");
  }
  posicionarAnimacao(); addEventListener("resize", posicionarAnimacao); addEventListener("load", posicionarAnimacao);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(posicionarAnimacao);

  function mostrarPoseFinal() { areaAnimacaoJacare.classList.add("jacare-posicionado") }
  function renderizarFallbackEstatico() {                                    // sem animação: mostra só o jacaré já parado
    const imagemFallback = new Image();
    imagemFallback.onload = () => {
      if (videoTransparenteJacare) videoTransparenteJacare.style.display = "none";
      telaQuadrosJacare.style.display = "";
      contextoQuadro.clearRect(0, 0, dimensoesQuadroVideo.largura, dimensoesQuadroVideo.altura);
      contextoQuadro.drawImage(imagemFallback, 0, 0, dimensoesQuadroVideo.largura, dimensoesQuadroVideo.altura);
      mostrarPoseFinal();
    };
    imagemFallback.src = "img/croc-final.webp";
  }
  function desenharQuadroVideo() {
    contextoAuxiliar.drawImage(videoAtivo, 0, 0, dimensoesQuadroVideo.largura, dimensoesQuadroVideo.altura * 2);
    const dadosPixelsOrigem =
      contextoAuxiliar.getImageData(0, 0, dimensoesQuadroVideo.largura, dimensoesQuadroVideo.altura * 2).data;
    const dadosPixelsSaida = dadosImagemQuadro.data;
    const quantidadePixels = dimensoesQuadroVideo.largura * dimensoesQuadroVideo.altura * 4;

    for (let indicePixel = 0; indicePixel < quantidadePixels; indicePixel += 4) {
      dadosPixelsSaida[indicePixel] = dadosPixelsOrigem[indicePixel];
      dadosPixelsSaida[indicePixel + 1] = dadosPixelsOrigem[indicePixel + 1];
      dadosPixelsSaida[indicePixel + 2] = dadosPixelsOrigem[indicePixel + 2];
      dadosPixelsSaida[indicePixel + 3] = dadosPixelsOrigem[quantidadePixels + indicePixel];
    }
    contextoQuadro.putImageData(dadosImagemQuadro, 0, 0);
  }
  const agendarProximoQuadro = funcaoRetorno =>
    "requestVideoFrameCallback" in videoAtivo
      ? videoAtivo.requestVideoFrameCallback(funcaoRetorno)
      : requestAnimationFrame(funcaoRetorno);
  function renderizarQuadroAnimacao() {
    try {
      if (videoAtivo.readyState >= 2) desenharQuadroVideo();
      if (videoAtivo.ended) { desenharQuadroVideo(); mostrarPoseFinal(); return }
    } catch {
      renderizarFallbackEstatico();
      return;
    }
    agendarProximoQuadro(renderizarQuadroAnimacao);
  }
  function iniciarAnimacao() {
    if (animacaoIniciada) return; animacaoIniciada = true;
    if (prefereMovimentoReduzido) { renderizarFallbackEstatico(); return }
    videoAtivo.preload = "auto";
    videoAtivo.addEventListener("ended", () => { if (!suportaWebmTransparente) { try { desenharQuadroVideo() } catch (e) { renderizarFallbackEstatico(); return } } mostrarPoseFinal() }, { once: true });
    videoAtivo.addEventListener("error", renderizarFallbackEstatico, { once: true });
    const promessaReproducao = videoAtivo.play();
    if (suportaWebmTransparente) {
      if (promessaReproducao && promessaReproducao.catch) promessaReproducao.catch(renderizarFallbackEstatico);
      return;
    }
    if (promessaReproducao && promessaReproducao.then) {
      promessaReproducao.then(() => agendarProximoQuadro(renderizarQuadroAnimacao), renderizarFallbackEstatico);
    } else {
      agendarProximoQuadro(renderizarQuadroAnimacao);
    }
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entradas, observador) => {
      if (!entradas[0].isIntersecting) return;

      videoAtivo.preload = "auto";
      videoAtivo.load();
      observador.disconnect();
    }, { rootMargin: "800px" }).observe(areaAnimacaoJacare);
    new IntersectionObserver((entradas, observador) => {
      if (!entradas[0].isIntersecting) return;

      observador.disconnect();
      iniciarAnimacao();
    }, { threshold: .6 }).observe(areaAnimacaoJacare);
  } else iniciarAnimacao();
})();

/* ===== Revelar blocos ao rolar ===== */
(() => {
  const elementosRevelacao = document.querySelectorAll(".revelar-ao-rolar,section h2,section .descricao-secao");
  elementosRevelacao.forEach(elemento => elemento.classList.add("revelar-ao-rolar"));
  if (!("IntersectionObserver" in window)) {
    elementosRevelacao.forEach(elemento => elemento.classList.add("visivel"));
    return;
  }

  const observadorRevelacao = new IntersectionObserver(entradas => entradas.forEach(entrada => {
    if (!entrada.isIntersecting) return;

    entrada.target.classList.add("visivel");
    observadorRevelacao.unobserve(entrada.target);
  }), { threshold: .12, rootMargin: "0px 0px -6% 0px" });
  elementosRevelacao.forEach(elemento => observadorRevelacao.observe(elemento));
})();


/* ===== Barbeiro selecionado entra em cena (vídeo) ===== */
(function () {
  const palcoVideoBarbeiro = document.getElementById("palco-video-barbeiro");
  if (!palcoVideoBarbeiro) return;
  const normalizarNomeBarbeiro = nomeBarbeiro =>
    (nomeBarbeiro || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const videosBarbeiros = [...palcoVideoBarbeiro.querySelectorAll(".video-barbeiro")];
  let videoBarbeiroAtivo = null;

  function mostrarVideoBarbeiro(nomeBarbeiro) {
    const proximoVideoBarbeiro = videosBarbeiros.find(video =>
      normalizarNomeBarbeiro(video.dataset.barbeiro) === normalizarNomeBarbeiro(nomeBarbeiro)
    ) || null;
    if (proximoVideoBarbeiro === videoBarbeiroAtivo) return;

    // quem estava em cena sai suavemente e pausa depois da transição
    if (videoBarbeiroAtivo) {
      const videoBarbeiroAnterior = videoBarbeiroAtivo;
      videoBarbeiroAnterior.classList.remove("ativo");
      setTimeout(() => { if (!videoBarbeiroAnterior.classList.contains("ativo")) videoBarbeiroAnterior.pause(); }, 1000);
    }

    videoBarbeiroAtivo = proximoVideoBarbeiro;
    if (proximoVideoBarbeiro) {
      proximoVideoBarbeiro.currentTime = 0;
      const promessaReproducao = proximoVideoBarbeiro.play();
      if (promessaReproducao && promessaReproducao.catch) promessaReproducao.catch(() => { });
      // força o navegador a registrar o estado inicial antes de animar a entrada
      requestAnimationFrame(() => requestAnimationFrame(() => proximoVideoBarbeiro.classList.add("ativo")));
    }
  }

  document.getElementById("opcoes-barbeiros-agendamento").addEventListener("change", evento => {
    if (evento.target.name === "barbeiro") mostrarVideoBarbeiro(evento.target.value);
  });

  // depois de enviar o formulário (reset), o barbeiro sai de cena
  document.getElementById("formulario-agendamento").addEventListener("reset", () => setTimeout(() => mostrarVideoBarbeiro(null), 0));
})();
