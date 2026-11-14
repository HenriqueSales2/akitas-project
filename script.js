/* ===== Agendamento ===== */

let appointmentConfig;
let slotRequestVersion = 0;

const getById = id => document.getElementById(id);

const bookingServiceOptions = getById("booking-service-options"),
  serviceCards = getById("service-cards"),
  bookingTimeOptions = getById("booking-time-options"),
  appointmentDateInput = getById("booking-date"),
  barberOptions = getById("booking-barber-options");

const submitButton = getById("booking-form").querySelector("button[type=submit]");

function formatPrice(servicePrice) {
  if (typeof servicePrice !== "number" || !Number.isFinite(servicePrice) || servicePrice < 0) {
    throw new Error("Preço de serviço inválido.");
  }
  const hasCents = !Number.isInteger(servicePrice);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2
  }).format(servicePrice);
}

const barbershopClockFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Sao_Paulo",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23"
});

function getBarbershopLocalTime() {
  const dateTimeParts = Object.fromEntries(
    barbershopClockFormatter.formatToParts(new Date()).map(part => [part.type, part.value])
  );
  return {
    date: `${dateTimeParts.year}-${dateTimeParts.month}-${dateTimeParts.day}`,
    minutes: Number(dateTimeParts.hour) * 60 + Number(dateTimeParts.minute)
  };
}

function updateAppointmentDateLimits() {
  appointmentDateInput.min = getBarbershopLocalTime().date;
  const maximumDate = new Date(`${appointmentDateInput.min}T12:00:00Z`);
  maximumDate.setUTCDate(maximumDate.getUTCDate() + 60);
  appointmentDateInput.max = maximumDate.toISOString().slice(0, 10);
}

updateAppointmentDateLimits();

async function callSupabaseRpc(rpcName, rpcParameters = {}) {
  const response = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/rpc/${rpcName}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_CONFIG.publishableKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(rpcParameters)
  });
  const rpcResult = await response.json();
  if (!response.ok) {
    console.error(`Erro no Supabase (${rpcName}):`, rpcResult);
    throw new Error(rpcResult.code === "22023"
      ? rpcResult.message
      : "Não foi possível acessar os agendamentos. Tente novamente mais tarde.");
  }
  return rpcResult;
}

const timeToMinutes = time => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

function renderBarberOptions() {
  barberOptions.replaceChildren();
  appointmentConfig.barbeiros.forEach(({ nome: barberName }) => {
    const barberOption = document.createElement("label");
    barberOption.className = "choice-option";

    const barberInput = document.createElement("input");
    barberInput.type = "radio";
    barberInput.name = "barber";
    barberInput.value = barberName;

    const barberLabel = document.createElement("span");
    barberLabel.textContent = barberName;
    barberOption.append(barberInput, barberLabel);
    barberOptions.append(barberOption);
  });
}

function renderServiceOptions(services) {
  const serviceOptionsFragment = document.createDocumentFragment();
  const serviceCardsFragment = document.createDocumentFragment();

  services.forEach(({ nome: serviceName, descricao: serviceDescription, preco: servicePrice }) => {
    const formattedPrice = formatPrice(servicePrice);

    const serviceOption = document.createElement("label");
    serviceOption.className = "choice-option";

    const serviceInput = document.createElement("input");
    serviceInput.type = "radio";
    serviceInput.name = "service";
    serviceInput.value = serviceName;

    const serviceLabel = document.createElement("span");
    serviceLabel.append(document.createTextNode(serviceName));

    const optionPrice = document.createElement("b");
    optionPrice.textContent = formattedPrice;
    serviceLabel.append(optionPrice);
    serviceOption.append(serviceInput, serviceLabel);
    serviceOptionsFragment.append(serviceOption);

    const serviceCard = document.createElement("li");
    const serviceDetails = document.createElement("div");

    const serviceTitle = document.createElement("strong");
    serviceTitle.textContent = serviceName;

    const serviceDescriptionText = document.createElement("small");
    serviceDescriptionText.textContent = serviceDescription;
    serviceDetails.append(serviceTitle, serviceDescriptionText);

    const cardPrice = document.createElement("span");
    cardPrice.className = "service-price";
    cardPrice.textContent = formattedPrice;

    const bookingButton = document.createElement("button");
    bookingButton.type = "button";
    bookingButton.className = "service-book-button";
    bookingButton.dataset.service = serviceName;
    bookingButton.textContent = "Agendar";

    serviceCard.append(serviceDetails, cardPrice, bookingButton);
    serviceCardsFragment.append(serviceCard);
  });

  bookingServiceOptions.replaceChildren(serviceOptionsFragment);
  serviceCards.replaceChildren(serviceCardsFragment);
  getById("service-loading-status").hidden = true;
}

function renderCreatorCredits(credits) {
  const isValidHttpsUrl = url => {
    try {
      return new URL(url).protocol === "https:";
    } catch {
      return false;
    }
  };
  if (
    !credits ||
    typeof credits.nome !== "string" ||
    !credits.nome.trim() ||
    !isValidHttpsUrl(credits.url) ||
    !isValidHttpsUrl(credits.imagem)
  ) {
    console.error("Configure nome, link e imagem válidos para os créditos no Supabase.");
    return;
  }

  const link = document.createElement("a");
  link.className = "creator-credit";
  link.href = credits.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  const imagem = document.createElement("img");
  imagem.src = credits.imagem;
  imagem.alt = "";
  imagem.width = 20;
  imagem.height = 20;

  const nome = document.createElement("span");
  nome.textContent = credits.nome;
  link.append(imagem, nome);
  getById("creator-credit-container").replaceChildren(link);
}

async function loadAppointmentConfig() {
  try {
    appointmentConfig = await callSupabaseRpc("config_agendamentos");
    const hasValidServices = Array.isArray(appointmentConfig.servicos) &&
      appointmentConfig.servicos.length > 0 &&
      appointmentConfig.servicos.every(service =>
        typeof service?.nome === "string" &&
        service.nome.trim() &&
        typeof service.descricao === "string" &&
        service.descricao.trim() &&
        typeof service.preco === "number" &&
        Number.isFinite(service.preco) &&
        service.preco >= 0
      ) &&
      new Set(appointmentConfig.servicos.map(({ nome }) => nome)).size === appointmentConfig.servicos.length;
    if (!hasValidServices) {
      throw new Error("Configure nomes únicos, descrição e preço válidos para cada serviço no Supabase.");
    }

    const hasValidBarberContacts = Array.isArray(appointmentConfig.barbeiros) &&
      appointmentConfig.barbeiros.length > 0 &&
      appointmentConfig.barbeiros.every(({ nome, tel }) =>
        typeof nome === "string" &&
        nome.trim() &&
        typeof tel === "string" &&
        /^\d{10,15}$/.test(tel)
    );
    if (!hasValidBarberContacts) {
      throw new Error("Configure nome e telefone válidos para cada barbeiro no Supabase.");
    }

    renderServiceOptions(appointmentConfig.servicos);
    renderBarberOptions();
    submitButton.disabled = false;
    submitButton.textContent = "Enviar pedido de agendamento";
  } catch (err) {
    console.error("Erro ao carregar configuração:", err);
    getById("service-loading-status").textContent = "Não foi possível carregar os serviços. Tente novamente mais tarde.";
    getById("booking-error").textContent = "Agendamento indisponível. Recarregue a página para tentar novamente ou entre em contato com a barbearia.";
    submitButton.disabled = true;
    submitButton.textContent = "Agendamento indisponível";
  }
}

loadAppointmentConfig();

async function loadCreatorCredits() {
  try {
    const credits = await callSupabaseRpc("config_creditos");
    renderCreatorCredits(credits);
  } catch (err) {
    console.error("Erro ao carregar os créditos do rodapé:", err);
  }
}

loadCreatorCredits();

// Renderiza os turnos do barbeiro escolhido, mostrando quantas vagas restam.
async function loadAvailableTimeSlots() {
  const requestVersion = ++slotRequestVersion;
  bookingTimeOptions.replaceChildren();
  updateAppointmentDateLimits();

  const selectedDate = appointmentDateInput.value;
  const selectedBarber = document.querySelector("input[name=barber]:checked")?.value;

  if (!selectedDate || !selectedBarber) {
    getById("booking-time-message").textContent = "Escolha o barbeiro e o dia para ver os turnos.";
    return;
  }

  if (selectedDate < appointmentDateInput.min || selectedDate > appointmentDateInput.max) {
    getById("booking-time-message").textContent = "Escolha uma data entre hoje e os próximos 60 dias.";
    return;
  }

  const weekday = new Date(`${selectedDate}T12:00:00Z`).getUTCDay();
  const sundayIndex = 0;
  const mondayIndex = 1;

  getById("booking-date-message").textContent = "";

  if (weekday === sundayIndex || weekday === mondayIndex) {
    getById("booking-time-message").textContent = "Fechado neste dia. Escolha de terça a sábado.";
    return;
  }

  getById("booking-time-message").textContent = "Consultando vagas...";
  let slotAvailability;
  try {
    const availabilityResponse = await callSupabaseRpc("vagas_agendamentos", { p_data: selectedDate });
    if (requestVersion !== slotRequestVersion) return;
    slotAvailability = availabilityResponse.vagas;
    if (!appointmentConfig.turnos.every(timeSlot =>
      Number.isInteger(slotAvailability?.[selectedBarber]?.[timeSlot.id]?.restantes)
    )) {
      throw new Error("Resposta de vagas inválida");
    }
  } catch (err) {
    if (requestVersion !== slotRequestVersion) return;
    console.error("Erro ao consultar vagas:", err);
    getById("booking-time-message").textContent = "Não foi possível consultar as vagas. Selecione novamente o dia ou o barbeiro para tentar de novo.";
    return;
  }
  const currentLocalTime = getBarbershopLocalTime();
  const isToday = selectedDate === currentLocalTime.date;
  let hasAvailableSlots = false;

  for (const timeSlot of appointmentConfig.turnos) {
    // Sábado: sem turno da noite (fecha às 18h)
    if (weekday === 6 && timeSlot.id === "noite") continue;
    // Turno de hoje que já terminou
    if (isToday && timeToMinutes(timeSlot.fim) <= currentLocalTime.minutes) continue;

    const remainingSlots = slotAvailability[selectedBarber][timeSlot.id].restantes;
    const isFull = remainingSlots <= 0;
    const availabilityLabel = isFull
      ? "Lotado"
      : `${remainingSlots} ${remainingSlots === 1 ? "vaga" : "vagas"}`;

    if (!isFull) hasAvailableSlots = true;

    bookingTimeOptions.insertAdjacentHTML(
      "beforeend",
      `<label class="choice-option${isFull ? " is-full" : ""}"><input type="radio" name="shift" value="${timeSlot.id}" ${isFull ? "disabled" : ""}><span><span class="time-slot-details">${timeSlot.nome}<small>${timeSlot.inicio} às ${timeSlot.fim}</small></span><b>${availabilityLabel}</b></span></label>`
    );
  }

  getById("booking-time-message").textContent = hasAvailableSlots
    ? ""
    : "Sem vagas para este barbeiro neste dia. Escolha outro barbeiro ou outro dia.";
}

appointmentDateInput.addEventListener("change", loadAvailableTimeSlots);
barberOptions.addEventListener("change", loadAvailableTimeSlots);

serviceCards.addEventListener("click", event => {
  const bookingButton = event.target.closest("button.service-book-button");
  if (!bookingButton) return;

  const selectedServiceInput = [...bookingServiceOptions.querySelectorAll('input[name="service"]')]
    .find(serviceInput => serviceInput.value === bookingButton.dataset.service);
  if (selectedServiceInput) selectedServiceInput.checked = true;

  getById("booking").scrollIntoView({ behavior: "smooth" });
});

getById("booking-form").addEventListener("submit", async event => {
  event.preventDefault();

  const selectedService = document.querySelector("input[name=service]:checked"),
    selectedBarber = document.querySelector("input[name=barber]:checked"),
    selectedShift = document.querySelector("input[name=shift]:checked"),
    customerName = getById("customer-name").value.trim(),
    customerPhone = getById("customer-phone").value.trim();

  const errorMessage = getById("booking-error");
  const confirmation = getById("booking-confirmation");

  errorMessage.textContent = "";
  confirmation.hidden = true;

  if (submitButton.disabled) return;
  if (!selectedService) return errorMessage.textContent = "Escolha um serviço.";
  if (!selectedBarber) return errorMessage.textContent = "Escolha o barbeiro.";
  const selectedBarberConfig = appointmentConfig.barbeiros.find(({ nome }) => nome === selectedBarber.value);
  if (!selectedBarberConfig) return errorMessage.textContent = "Selecione um barbeiro válido.";
  if (!appointmentDateInput.value) return errorMessage.textContent = "Escolha o dia do atendimento.";
  if (!selectedShift) return errorMessage.textContent = "Escolha um turno.";
  if (customerName.length < 2) return errorMessage.textContent = "Informe seu nome.";
  if (customerPhone.replace(/\D/g, "").length < 10) return errorMessage.textContent = "Informe um telefone com DDD.";

  const [year, month, day] = appointmentDateInput.value.split("-");
  const appointmentDateISO = `${year}-${month}-${day}`;
  const appointmentDateFormatted = `${day}/${month}/${year}`;

  const selectedTimeSlot = appointmentConfig.turnos.find(timeSlot => timeSlot.id === selectedShift.value);
  const shiftDescription = `${selectedTimeSlot.nome} (${selectedTimeSlot.inicio} às ${selectedTimeSlot.fim})`;

  submitButton.disabled = true;
  submitButton.textContent = "Reservando...";
  try {
    const bookingResult = await callSupabaseRpc("criar_agendamento", {
      p_nome: customerName,
      p_telefone: customerPhone,
      p_servico: selectedService.value,
      p_data: appointmentDateISO,
      p_barbeiro: selectedBarber.value,
      p_turno: selectedShift.value
    });

    if (bookingResult.success !== true) {
      errorMessage.textContent = bookingResult.error || "Não foi possível reservar este turno.";
      loadAvailableTimeSlots();
      return;
    }

    const whatsappMessage = `Olá, Os Malas! Reservei ${selectedService.value} com ${selectedBarber.value}, dia ${appointmentDateFormatted}, turno ${shiftDescription}. Nome: ${customerName}. Telefone: ${customerPhone}.`;

    const whatsappUrl = `https://wa.me/${selectedBarberConfig.tel}?text=${encodeURIComponent(whatsappMessage)}`;

    confirmation.hidden = false;
    confirmation.innerHTML = `
            <strong>✅ Agendamento confirmado!</strong>
            <p class="form-message"><strong>Serviço:</strong> ${selectedService.value}<br>
            <strong>Barbeiro:</strong> ${selectedBarber.value}<br>
            <strong>Dia:</strong> ${appointmentDateFormatted}<br>
            <strong>Turno:</strong> ${shiftDescription}<br>
            <strong>Nome:</strong> <span data-customer-name></span><br>
            <strong>Valor:</strong> ${formatPrice(bookingResult.preco)}</p>
            <p class="form-message">Sua vaga já está reservada no sistema. Chegue dentro do turno escolhido. Abra o WhatsApp para confirmar diretamente com a barbearia.</p>
            <a class="primary-button" href="${whatsappUrl}" target="_blank" rel="noopener">Abrir WhatsApp</a>
        `;
    confirmation.querySelector("[data-customer-name]").textContent = customerName;

    slotRequestVersion++;
    getById("booking-form").reset();
    bookingTimeOptions.replaceChildren();
    getById("booking-time-message").textContent = "Escolha o barbeiro e o dia para ver os turnos.";
    getById("booking-date-message").textContent = "";

    // Abre o WhatsApp após confirmar no banco
    window.open(whatsappUrl, "_blank", "noopener");

  } catch (error) {
    console.error("Erro ao salvar agendamento:", error);
    errorMessage.textContent = `Não foi possível confirmar a reserva. ${error.message} Se a conexão caiu durante o envio, confirme com a barbearia antes de repetir o pedido.`;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Enviar pedido de agendamento";
  }
});


/* ===== Vídeo de abertura: trava a rolagem, congela no último frame e desce sozinho ===== */

(() => {
  const documentRoot = document.documentElement,
    introSection = document.querySelector(".intro-section"),
    introVideo = document.getElementById("intro-video"),
    videoProgressBar = document.getElementById("intro-video-progress"),
    skipVideoButton = document.getElementById("intro-skip-button"),
    startVideoButton = document.getElementById("intro-start-button");

  let hasFinished = false;
  let startButtonTimer;

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  scrollTo(0, 0);
  documentRoot.classList.add("is-scroll-locked");

  const isScrollLocked = () => documentRoot.classList.contains("is-scroll-locked");

  ["wheel", "touchmove"].forEach(eventName =>
    addEventListener(
      eventName,
      event => {
        if (isScrollLocked()) event.preventDefault();
      },
      { passive: false }
    )
  );

  addEventListener("keydown", event => {
    if (
      isScrollLocked() &&
      [" ", "ArrowDown", "ArrowUp", "PageDown", "PageUp", "End", "Home"].includes(event.key)
    ) event.preventDefault();
  });

  function finishIntroVideo() {
    if (hasFinished) return;

    hasFinished = true;
    clearTimeout(startButtonTimer);

    introSection.classList.add("is-complete");
    videoProgressBar.style.transform = "scaleX(1)";

    try {
      introVideo.pause();
    } catch (e) { }

    // Libera a rolagem imediatamente; a animação do copy é controlada separadamente
    documentRoot.classList.remove("is-scroll-locked");

    const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

    document.getElementById("cuts").scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth"
    });
  }

  introVideo.addEventListener("timeupdate", () => {
    if (introVideo.duration && !hasFinished) {
      videoProgressBar.style.transform = "scaleX(" + (introVideo.currentTime / introVideo.duration) + ")";
    }
  });

  introVideo.addEventListener("ended", finishIntroVideo);

  introVideo.addEventListener("playing", () => {
    clearTimeout(startButtonTimer);
    startVideoButton.hidden = true;
  });

  introVideo.addEventListener("error", () => {
    clearTimeout(startButtonTimer);
    hasFinished = true;
    documentRoot.classList.remove("is-scroll-locked");
    introSection.classList.add("is-complete");
  });

  skipVideoButton.addEventListener("click", () => {
    if (introVideo.duration) introVideo.currentTime = Math.max(0, introVideo.duration - .05);
    finishIntroVideo();
  });

  startVideoButton.addEventListener("click", () => {
    introVideo.play().catch(() => {
      if (!hasFinished) startVideoButton.hidden = false;
    });
  });

  startButtonTimer = setTimeout(() => {
    if (!hasFinished) startVideoButton.hidden = false;
  }, 1200);

  introVideo.play().catch(() => {
    if (!hasFinished) startVideoButton.hidden = false;
  });
})();


/* ===== Cortes: arrastar para os lados controla o tempo do vídeo ===== */

(() => {
  const CUT_NAMES = [
    "Afro com fade",
    "Degradê preciso",
    "Crop com fade",
    "Tranças com desenho",
    "Cornrows com fade",
    "Platinado",
    "Grisalho ondulado",
    "Topete com risca"
  ];

  const videoScrubber = getById("cuts-video-scrubber"),
    cutVideo = getById("cuts-video"),
    progressBar = getById("cuts-video-progress"),
    interactionHint = getById("cuts-video-hint"),
    currentCutLabel = getById("current-cut-name"),
    cutThumbnails = getById("cuts-thumbnails");

  let currentCutIndex = 0,
    targetProgress = 0,
    currentProgress = 0,
    dragVelocity = 0,
    isDragging = false,
    previousPointerX = 0,
    previousInteractionTime = 0,
    hasInteracted = false;

  const clampProgress = x => Math.min(1, Math.max(0, x));

  CUT_NAMES.forEach((cutName, cutIndex) =>
    cutThumbnails.insertAdjacentHTML(
      "beforeend",
      `<button type="button" aria-label="${cutName}"><img src="img/cortes/corte-${cutIndex + 1}.jpg" alt="" loading="lazy"></button>`
    )
  );

  function loadCut(cutIndex) {
    currentCutIndex = (cutIndex + CUT_NAMES.length) % CUT_NAMES.length;
    targetProgress = currentProgress = dragVelocity = 0;

    cutVideo.poster = `img/cortes/corte-${currentCutIndex + 1}-poster.jpg`;
    cutVideo.src = `video/cortes/corte-${currentCutIndex + 1}.mp4`;

    currentCutLabel.textContent = CUT_NAMES[currentCutIndex];

    [...cutThumbnails.children].forEach((thumbnailButton, thumbnailIndex) =>
      thumbnailButton.setAttribute("aria-current", thumbnailIndex === currentCutIndex)
    );

    const activeThumbnail = cutThumbnails.children[currentCutIndex];

    cutThumbnails.scrollTo({
      left: activeThumbnail.offsetLeft - (cutThumbnails.clientWidth - activeThumbnail.offsetWidth) / 2,
      behavior: "smooth"
    });
  }

  function updateVideoFrame() {
    if (!isDragging && Math.abs(dragVelocity) > .0002) {
      targetProgress = clampProgress(targetProgress + dragVelocity);
      dragVelocity *= .96;
      if (targetProgress <= 0 || targetProgress >= 1) dragVelocity = 0;
    }

    // A interpolação dita a suavidade, mas agora roda na velocidade do monitor (60hz, 120hz...)
    currentProgress += (targetProgress - currentProgress) * .15;

    if (Math.abs(targetProgress - currentProgress) < .0001) currentProgress = targetProgress;

    const videoTime = currentProgress * (cutVideo.duration || 0);

    // Atualiza o frame o mais rápido que o navegador permitir
    if (cutVideo.readyState >= 2 && !cutVideo.seeking && Math.abs(cutVideo.currentTime - videoTime) > .01) {
      cutVideo.currentTime = videoTime;
    }

    progressBar.style.transform = `scaleX(${currentProgress})`;
    videoScrubber.setAttribute("aria-valuenow", Math.round(currentProgress * 100));

    requestAnimationFrame(updateVideoFrame);
  }

  videoScrubber.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" && e.button) return;

    isDragging = true;
    dragVelocity = 0;
    previousPointerX = e.clientX;
    previousInteractionTime = performance.now();

    videoScrubber.setPointerCapture(e.pointerId);
    videoScrubber.classList.add("is-active");

    if (!hasInteracted) {
      hasInteracted = true;
      interactionHint.classList.add("off");

      cutVideo.play().then(() => cutVideo.pause()).catch(() => { });
    }
  });

  videoScrubber.addEventListener("pointermove", pointerEvent => {
    if (!isDragging) return;

    // ALTERAÇÃO 3: Aumentei o divisor de .85 para 1.4.
    // Isso deixa o arrasto menos sensível, exigindo um movimento maior para girar o vídeo.
    const progressDelta = (pointerEvent.clientX - previousPointerX) / (videoScrubber.clientWidth * 1.4),
      currentTime = performance.now();

    previousPointerX = pointerEvent.clientX;
    targetProgress = clampProgress(targetProgress + progressDelta);

    // Ajuste da velocidade para a inércia
    dragVelocity = .8 * dragVelocity + .2 * (progressDelta / Math.max(1, currentTime - previousInteractionTime) * 16);
    previousInteractionTime = currentTime;
  });

  const endPointerDrag = () => {
    if (!isDragging) return;

    isDragging = false;
    videoScrubber.classList.remove("is-active");

    if (performance.now() - previousInteractionTime > 80) dragVelocity = 0;
  };

  ["pointerup", "pointercancel", "lostpointercapture"].forEach(eventName =>
    videoScrubber.addEventListener(eventName, endPointerDrag)
  );

  videoScrubber.addEventListener("wheel", wheelEvent => {
    if (Math.abs(wheelEvent.deltaX) <= Math.abs(wheelEvent.deltaY)) return;

    wheelEvent.preventDefault();

    hasInteracted = true;
    interactionHint.classList.add("off");

    // Suavizado também no scroll do mouse
    targetProgress = clampProgress(targetProgress - wheelEvent.deltaX / (videoScrubber.clientWidth * 1.8));
  }, { passive: false });

  videoScrubber.addEventListener("keydown", keyboardEvent => {
    const progressStep = {
      ArrowRight: .05,
      ArrowLeft: -.05
    }[keyboardEvent.key];

    if (progressStep !== undefined) {
      keyboardEvent.preventDefault();

      hasInteracted = true;
      interactionHint.classList.add("off");

      targetProgress = clampProgress(targetProgress + progressStep);
    }
  });

  getById("previous-cut").addEventListener("click", () => loadCut(currentCutIndex - 1));
  getById("next-cut").addEventListener("click", () => loadCut(currentCutIndex + 1));

  [...cutThumbnails.children].forEach((thumbnailButton, cutIndex) =>
    thumbnailButton.addEventListener("click", () => loadCut(cutIndex))
  );

  function nudgeScrubber() {
    if (hasInteracted || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const animationStartTime = performance.now();

    (function animateNudge(timestamp) {
      const progress = (timestamp - animationStartTime) / 1600;

      if (hasInteracted || isDragging) return;
      if (progress >= 1) {
        targetProgress = 0;
        return;
      }

      targetProgress = .22 * Math.sin(Math.PI * progress);
      requestAnimationFrame(animateNudge);
    })(animationStartTime);
  }

  loadCut(0);
  updateVideoFrame();

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries, observer) => {
      if (entries[0].isIntersecting) {
        cutVideo.preload = "auto";
        cutVideo.load();
        observer.disconnect();
      }
    }, { rootMargin: "700px" }).observe(videoScrubber);

    new IntersectionObserver((entries, observer) => {
      if (entries[0].isIntersecting) {
        observer.disconnect();

        cutVideo.readyState >= 2
          ? nudgeScrubber()
          : cutVideo.addEventListener("loadeddata", nudgeScrubber, { once: true });
      }
    }, { threshold: .6 }).observe(videoScrubber);

  } else {
    cutVideo.preload = "auto";
    cutVideo.load();
  }
})();

/* ===== Menu fixo: link da seção atual ===== */
(() => {
  const navigationLinks = [...document.querySelectorAll(".section-navigation a")];
  if ("IntersectionObserver" in window) {
    const sectionObserver = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      navigationLinks.forEach(link => {
        const isCurrentSection = link.getAttribute("href") === `#${entry.target.id}`;
        link.setAttribute("aria-current", isCurrentSection);
      });
    }), { rootMargin: "-45% 0px -50% 0px" });

    navigationLinks.forEach(link => {
      const targetSection = document.querySelector(link.getAttribute("href"));
      if (targetSection) sectionObserver.observe(targetSection);
    });
  }
})();

/* ===== Jacaré entra andando na seção Serviços =====
   Chrome, Edge e Firefox: video/croc.webm (WebM com transparência de verdade, sem nenhum truque de script).
   Safari e iPhone não leem transparência em WebM; lá usamos video/croc.mp4, que guarda a cor (metade de cima)
   e a transparência (metade de baixo), e juntamos as duas num canvas. */
(() => {
  const animationContainer = document.getElementById("alligator-animation"), frameCanvas = document.getElementById("alligator-frame-canvas"), fallbackVideo = document.getElementById("alligator-mp4-video"), transparentVideo = document.getElementById("alligator-webm-video");
  if (!animationContainer || !frameCanvas || !fallbackVideo) return;
  const videoFrameDimensions = { width: 782, height: 600, visibleStartX: 245, visibleEndX: 713 };            // tamanho do recorte e onde o jacaré para (em px do vídeo)
  const userAgent = navigator.userAgent;
  const requiresOpaqueVideo = /iP(hone|ad|od)/.test(userAgent) || (/^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(userAgent));
  const supportsTransparentWebm = !!transparentVideo && !requiresOpaqueVideo && !!transparentVideo.canPlayType && transparentVideo.canPlayType('video/webm; codecs="vp9"') !== "";
  const activeVideo = supportsTransparentWebm ? transparentVideo : fallbackVideo;
  if (!supportsTransparentWebm && transparentVideo) transparentVideo.remove();
  frameCanvas.width = videoFrameDimensions.width; frameCanvas.height = videoFrameDimensions.height;
  const frameContext = frameCanvas.getContext("2d");
  const offscreenCanvas = document.createElement("canvas"); offscreenCanvas.width = videoFrameDimensions.width; offscreenCanvas.height = videoFrameDimensions.height * 2;
  const offscreenContext = offscreenCanvas.getContext("2d", { willReadFrequently: true });
  const frameImageData = frameContext.createImageData(videoFrameDimensions.width, videoFrameDimensions.height);
  const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let hasStarted = false;
  if (supportsTransparentWebm) frameCanvas.style.display = "none";

  /* posiciona o jacaré: começa colado na borda esquerda da tela (ele "entra" por ali) e para na coluna do título */
  function positionAnimation() {
    const containerHeight = animationContainer.clientHeight;
    const scaleFactor = containerHeight / videoFrameDimensions.height;
    const containerBounds = animationContainer.getBoundingClientRect();
    const visibleCrocodileWidth =
      (videoFrameDimensions.visibleEndX - videoFrameDimensions.visibleStartX) * scaleFactor;
    const visibleStartOffset = videoFrameDimensions.visibleStartX * scaleFactor;
    const desiredLeftPosition =
      containerBounds.left + (animationContainer.clientWidth - visibleCrocodileWidth) / 2;
    const animationLeft = Math.min(0, desiredLeftPosition - visibleStartOffset);

    for (const mediaElement of [frameCanvas, supportsTransparentWebm ? transparentVideo : null]) {
      if (!mediaElement) continue;

      mediaElement.style.width = videoFrameDimensions.width * scaleFactor + "px";
      mediaElement.style.height = containerHeight + "px";
      mediaElement.style.left = animationLeft - containerBounds.left + "px";
    }

    animationContainer.style.setProperty(
      "--alligator-position-x",
      animationLeft - containerBounds.left + visibleStartOffset + visibleCrocodileWidth / 2 + "px"
    );
    animationContainer.style.setProperty("--alligator-shadow-width", visibleCrocodileWidth * 1.05 + "px");
  }
  positionAnimation(); addEventListener("resize", positionAnimation); addEventListener("load", positionAnimation);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(positionAnimation);

  function showFinalPose() { animationContainer.classList.add("arrived") }
  function renderStaticFallback() {                                    // sem animação: mostra só o jacaré já parado
    const fallbackImage = new Image();
    fallbackImage.onload = () => {
      if (transparentVideo) transparentVideo.style.display = "none";
      frameCanvas.style.display = "";
      frameContext.clearRect(0, 0, videoFrameDimensions.width, videoFrameDimensions.height);
      frameContext.drawImage(fallbackImage, 0, 0, videoFrameDimensions.width, videoFrameDimensions.height);
      showFinalPose();
    };
    fallbackImage.src = "img/croc-final.webp";
  }
  function drawVideoFrame() {
    offscreenContext.drawImage(activeVideo, 0, 0, videoFrameDimensions.width, videoFrameDimensions.height * 2);
    const sourcePixelData =
      offscreenContext.getImageData(0, 0, videoFrameDimensions.width, videoFrameDimensions.height * 2).data;
    const outputPixelData = frameImageData.data;
    const pixelCount = videoFrameDimensions.width * videoFrameDimensions.height * 4;

    for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 4) {
      outputPixelData[pixelIndex] = sourcePixelData[pixelIndex];
      outputPixelData[pixelIndex + 1] = sourcePixelData[pixelIndex + 1];
      outputPixelData[pixelIndex + 2] = sourcePixelData[pixelIndex + 2];
      outputPixelData[pixelIndex + 3] = sourcePixelData[pixelCount + pixelIndex];
    }
    frameContext.putImageData(frameImageData, 0, 0);
  }
  const scheduleNextFrame = callback =>
    "requestVideoFrameCallback" in activeVideo
      ? activeVideo.requestVideoFrameCallback(callback)
      : requestAnimationFrame(callback);
  function renderAnimationFrame() {
    try {
      if (activeVideo.readyState >= 2) drawVideoFrame();
      if (activeVideo.ended) { drawVideoFrame(); showFinalPose(); return }
    } catch {
      renderStaticFallback();
      return;
    }
    scheduleNextFrame(renderAnimationFrame);
  }
  function startAnimation() {
    if (hasStarted) return; hasStarted = true;
    if (prefersReducedMotion) { renderStaticFallback(); return }
    activeVideo.preload = "auto";
    activeVideo.addEventListener("ended", () => { if (!supportsTransparentWebm) { try { drawVideoFrame() } catch (e) { renderStaticFallback(); return } } showFinalPose() }, { once: true });
    activeVideo.addEventListener("error", renderStaticFallback, { once: true });
    const playPromise = activeVideo.play();
    if (supportsTransparentWebm) {
      if (playPromise && playPromise.catch) playPromise.catch(renderStaticFallback);
      return;
    }
    if (playPromise && playPromise.then) {
      playPromise.then(() => scheduleNextFrame(renderAnimationFrame), renderStaticFallback);
    } else {
      scheduleNextFrame(renderAnimationFrame);
    }
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries, observer) => {
      if (!entries[0].isIntersecting) return;

      activeVideo.preload = "auto";
      activeVideo.load();
      observer.disconnect();
    }, { rootMargin: "800px" }).observe(animationContainer);
    new IntersectionObserver((entries, observer) => {
      if (!entries[0].isIntersecting) return;

      observer.disconnect();
      startAnimation();
    }, { threshold: .6 }).observe(animationContainer);
  } else startAnimation();
})();

/* ===== Revelar blocos ao rolar ===== */
(() => {
  const revealElements = document.querySelectorAll(".reveal-on-scroll,section h2,section .section-description");
  revealElements.forEach(element => element.classList.add("reveal-on-scroll"));
  if (!("IntersectionObserver" in window)) {
    revealElements.forEach(element => element.classList.add("is-visible"));
    return;
  }

  const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;

    entry.target.classList.add("is-visible");
    revealObserver.unobserve(entry.target);
  }), { threshold: .12, rootMargin: "0px 0px -6% 0px" });
  revealElements.forEach(element => revealObserver.observe(element));
})();


/* ===== Barbeiro selecionado entra em cena (vídeo) ===== */
(function () {
  const barberVideoStage = document.getElementById("barber-video-stage");
  if (!barberVideoStage) return;
  const normalizeBarberName = barberName =>
    (barberName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const barberVideos = [...barberVideoStage.querySelectorAll(".barber-video")];
  let activeBarberVideo = null;

  function showBarberVideo(barberName) {
    const nextBarberVideo = barberVideos.find(video =>
      normalizeBarberName(video.dataset.barber) === normalizeBarberName(barberName)
    ) || null;
    if (nextBarberVideo === activeBarberVideo) return;

    // quem estava em cena sai suavemente e pausa depois da transição
    if (activeBarberVideo) {
      const previousBarberVideo = activeBarberVideo;
      previousBarberVideo.classList.remove("is-active");
      setTimeout(() => { if (!previousBarberVideo.classList.contains("is-active")) previousBarberVideo.pause(); }, 1000);
    }

    activeBarberVideo = nextBarberVideo;
    if (nextBarberVideo) {
      nextBarberVideo.currentTime = 0;
      const playPromise = nextBarberVideo.play();
      if (playPromise && playPromise.catch) playPromise.catch(() => { });
      // força o navegador a registrar o estado inicial antes de animar a entrada
      requestAnimationFrame(() => requestAnimationFrame(() => nextBarberVideo.classList.add("is-active")));
    }
  }

  document.getElementById("booking-barber-options").addEventListener("change", event => {
    if (event.target.name === "barber") showBarberVideo(event.target.value);
  });

  // depois de enviar o formulário (reset), o barbeiro sai de cena
  document.getElementById("booking-form").addEventListener("reset", () => setTimeout(() => showBarberVideo(null), 0));
})();
