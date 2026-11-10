/* ===== Agendamento ===== */

const WA = "5511999999999";

const SV = [
    ["Corte", 50],
    ["Barba", 40],
    ["Corte + barba", 80],
    ["Acabamento", 20],
    ["Tatto", 250],
    ["Piercing", 120]
];

const $ = id => document.getElementById(id);

const svc = $("svc"),
    sl = $("sl"),
    d = $("d");

SV.forEach(([n, p], i) => {
    svc.insertAdjacentHTML(
        "beforeend",
        `<label class="opt"><input type="radio" name="s" value="${n}"><span>${n}<b>R$ ${p}</b></span></label>`
    );
});

const pad = n => String(n).padStart(2, "0");

const today = new Date();

d.min = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

const max = new Date();
max.setDate(max.getDate() + 60);

d.max = `${max.getFullYear()}-${pad(max.getMonth() + 1)}-${pad(max.getDate())}`;

// Busca horários ocupados para uma data via API
async function buscarOcupados(data) {
    try {
        const resp = await fetch(`/api/agendamentos?data=${encodeURIComponent(data)}`);
        const json = await resp.json();
        return json.ocupados || [];
    } catch (err) {
        console.warn("Não foi possível buscar horários ocupados:", err);
        return [];
    }
}

// Renderiza slots bloqueando os já ocupados
async function slots() {
    sl.innerHTML = "";

    const v = d.value;

    if (!v) {
        $("sm").textContent = "Escolha um dia para ver os horários.";
        return;
    }

    const [y, m, dd] = v.split("-").map(Number),
        dt = new Date(y, m - 1, dd),
        w = dt.getDay();
    // variaveis dos dias fechados da semana
    const firstDayClose = 0;
    const secondDayClose = 1;

    $("dm").textContent = "";

    if (w === firstDayClose || w === secondDayClose) {
        $("sm").textContent = "Fechado neste dia. Escolha de terça a sábado.";
        return;
    }

    const end = w === 6 ? 17 : 20;
    const ocupados = await buscarOcupados(v);
    let any = false;

    for (let h = 9; h < end; h++) {
        for (const mi of [0, 30]) {
            const t = `${pad(h)}:${pad(mi)}`;
            const jaOcupado = ocupados.includes(t);

            if (
                dt.toDateString() === today.toDateString() &&
                (h * 60 + mi) <= today.getHours() * 60 + today.getMinutes()
            ) continue;

            if (jaOcupado) {
                // Horário ocupado — mostra escuro e sem selectable
                sl.insertAdjacentHTML(
                    "beforeend",
                    `<label class="opt ocupado"><input type="radio" name="h" value="${t}" disabled><span>${t}</span></label>`
                );
                continue;
            }

            any = true;
            sl.insertAdjacentHTML(
                "beforeend",
                `<label class="opt"><input type="radio" name="h" value="${t}"><span>${t}</span></label>`
            );
        }
    }

    $("sm").textContent = any ? "" : "Sem horários livres hoje. Escolha outro dia.";
}

d.addEventListener("change", async () => {
    await slots();
});

document.querySelectorAll(".mini").forEach(b =>
    b.addEventListener("click", () => {
        document.querySelector(
            `input[name=s][value="${b.dataset.s}"]`
        ).checked = true;

        $("agendar").scrollIntoView({ behavior: "smooth" });
    })
);

$("f").addEventListener("submit", async e => {
    e.preventDefault();

    const s = document.querySelector("input[name=s]:checked"),
        h = document.querySelector("input[name=h]:checked"),
        n = $("n").value.trim(),
        t = $("t").value.trim();

    const err = $("e");
    const ok = $("ok");

    err.textContent = "";
    ok.hidden = true;

    if (!s) return err.textContent = "Escolha um serviço.";
    if (!d.value) return err.textContent = "Escolha o dia do atendimento.";
    if (!h) return err.textContent = "Escolha um horário.";
    if (n.length < 2) return err.textContent = "Informe seu nome.";
    if (t.replace(/\D/g, "").length < 10) return err.textContent = "Informe um telefone com DDD.";

    const [y, m, dd] = d.value.split("-");
    const dataISO = `${y}-${m}-${dd}`;
    const dataBR = `${dd}/${m}/${y}`;

    const preco = SV.find(([nm]) => nm === s.value)[1];

    // ===== SALVA NO BANCO (SQLite) IMEDIATAMENTE =====
    try {
        const resp = await fetch("/api/agendamentos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                nome: n,
                telefone: t,
                servico: s.value,
                preco: preco,
                data: dataISO,
                horario: h.value
            })
        });

        const result = await resp.json();

        if (!resp.ok) {
            err.textContent = result.error || "Não foi possível reservar este horário.";
            return;
        }

        // ✅ Agendamento confirmado no banco!
        const txt = `Olá, Akitas! Quero agendar: ${s.value}, dia ${dataBR} às ${h.value}. Nome: ${n}. Telefone: ${t}.`;

        const url = `https://wa.me/${WA}?text=${encodeURIComponent(txt)}`;

        ok.hidden = false;
        ok.innerHTML = `
            <strong>✅ Agendamento confirmado!</strong>
            <p class="msg"><strong>Serviço:</strong> ${s.value}<br>
            <strong>Dia:</strong> ${dataBR} às ${h.value}<br>
            <strong>Nome:</strong> ${n}<br>
            <strong>Valor:</strong> R$ ${preco}</p>
            <p class="msg">Seu horário já está reservado no sistema. Abra o WhatsApp para confirmar diretamente com a barbearia.</p>
            <a class="btn" href="${url}" target="_blank" rel="noopener">Abrir WhatsApp</a>
        `;

        $("f").reset();
        $("sl").innerHTML = "";
        $("sm").textContent = "Escolha um dia para ver os horários.";
        $("dm").textContent = "";

        // Abre o WhatsApp após confirmar no banco
        window.open(url, "_blank", "noopener");

    } catch (err) {
        console.error("Erro ao salvar agendamento:", err);
        err.textContent = "Erro de conexão com o servidor. Tente novamente.";
    }
});


/* ===== Vídeo de abertura: trava a rolagem, congela no último frame e desce sozinho ===== */

(() => {
    const root = document.documentElement,
        hero = document.querySelector(".hero"),
        v = document.getElementById("v"),
        prog = document.getElementById("prog"),
        skip = document.getElementById("skip"),
        start = document.getElementById("start");

    let finished = false;

    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    scrollTo(0, 0);
    root.classList.add("locked");

    const locked = () => root.classList.contains("locked");

    ["wheel", "touchmove"].forEach(n =>
        addEventListener(
            n,
            e => {
                if (locked()) e.preventDefault();
            },
            { passive: false }
        )
    );

    addEventListener("keydown", e => {
        if (
            locked() &&
            [" ", "ArrowDown", "ArrowUp", "PageDown", "PageUp", "End", "Home"].includes(e.key)
        ) e.preventDefault();
    });

    function finish() {
        if (finished) return;

        finished = true;

        hero.classList.add("done");
        prog.style.transform = "scaleX(1)";

        try {
            v.pause();
        } catch (e) {}

        // Libera a rolagem imediatamente; a animação do copy é controlada separadamente
        root.classList.remove("locked");

        const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

        document.getElementById("cortes").scrollIntoView({
            behavior: reduce ? "auto" : "smooth"
        });
    }

    v.addEventListener("timeupdate", () => {
        if (v.duration && !finished) {
            prog.style.transform = "scaleX(" + (v.currentTime / v.duration) + ")";
        }
    });

    v.addEventListener("ended", finish);

    v.addEventListener("playing", () => {
        start.hidden = true;
    });

    v.addEventListener("error", () => {
        finished = true;
        root.classList.remove("locked");
        hero.classList.add("done");
    });

    skip.addEventListener("click", () => {
        if (v.duration) v.currentTime = Math.max(0, v.duration - .05);
        finish();
    });

    start.addEventListener("click", () => {
        v.play();
    });

    v.play().catch(() => {
        start.hidden = false;
    });
})();


/* ===== Cortes: arrastar para os lados controla o tempo do vídeo ===== */

(() => {
    const CUTS = [
        "Afro com fade",
        "Degradê preciso",
        "Crop com fade",
        "Tranças com desenho",
        "Cornrows com fade",
        "Platinado",
        "Grisalho ondulado",
        "Topete com risca"
    ];

    const $ = id => document.getElementById(id),
        st = $("scrub"),
        v = $("cv"),
        bar = $("bar"),
        hint = $("hint"),
        cn = $("cn"),
        th = $("th");

    let cur = 0,
        target = 0,
        pos = 0,
        vel = 0,
        drag = false,
        lastX = 0,
        lastT = 0,
        touched = false;

    const clamp = x => Math.min(1, Math.max(0, x));

    CUTS.forEach((n, i) =>
        th.insertAdjacentHTML(
            "beforeend",
            `<button type="button" aria-label="${n}"><img src="img/cortes/corte-${i + 1}.jpg" alt="" loading="lazy"></button>`
        )
    );

    function load(i) {
        cur = (i + CUTS.length) % CUTS.length;
        target = pos = vel = 0;

        v.poster = `img/cortes/corte-${cur + 1}-poster.jpg`;
        v.src = `video/cortes/corte-${cur + 1}.mp4`;

        cn.textContent = CUTS[cur];

        [...th.children].forEach((b, k) =>
            b.setAttribute("aria-current", k === cur)
        );

        const b = th.children[cur];

        th.scrollTo({
            left: b.offsetLeft - (th.clientWidth - b.offsetWidth) / 2,
            behavior: "smooth"
        });
    }

        function tick() {
        if (!drag && Math.abs(vel) > .0002) {
            target = clamp(target + vel);
            vel *= .96; 
            if (target <= 0 || target >= 1) vel = 0;
        }

        // A interpolação dita a suavidade, mas agora roda na velocidade do monitor (60hz, 120hz...)
        pos += (target - pos) * .15; 

        if (Math.abs(target - pos) < .0001) pos = target;

        const t = pos * (v.duration || 0);

        // Atualiza o frame o mais rápido que o navegador permitir
        if (v.readyState >= 2 && !v.seeking && Math.abs(v.currentTime - t) > .01) {
            v.currentTime = t;
        }

        bar.style.transform = `scaleX(${pos})`;
        st.setAttribute("aria-valuenow", Math.round(pos * 100));

        requestAnimationFrame(tick);
    }

    st.addEventListener("pointerdown", e => {
        if (e.pointerType === "mouse" && e.button) return;

        drag = true;
        vel = 0;
        lastX = e.clientX;
        lastT = performance.now();

        st.setPointerCapture(e.pointerId);
        st.classList.add("on");

        if (!touched) {
            touched = true;
            hint.classList.add("off");

            v.play().then(() => v.pause()).catch(() => {});
        }
    });

    st.addEventListener("pointermove", e => {
        if (!drag) return;

        // ALTERAÇÃO 3: Aumentei o divisor de .85 para 1.4. 
        // Isso deixa o arrasto menos sensível, exigindo um movimento maior para girar o vídeo.
        const f = (e.clientX - lastX) / (st.clientWidth * 1.4),
            n = performance.now();

        lastX = e.clientX;
        target = clamp(target + f);

        // Ajuste da velocidade para a inércia
        vel = .8 * vel + .2 * (f / Math.max(1, n - lastT) * 16);
        lastT = n;
    });

    const end = () => {
        if (!drag) return;

        drag = false;
        st.classList.remove("on");

        if (performance.now() - lastT > 80) vel = 0;
    };

    ["pointerup", "pointercancel", "lostpointercapture"].forEach(n =>
        st.addEventListener(n, end)
    );

    st.addEventListener("wheel", e => {
        if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;

        e.preventDefault();

        touched = true;
        hint.classList.add("off");

        // Suavizado também no scroll do mouse
        target = clamp(target - e.deltaX / (st.clientWidth * 1.8));
    }, { passive: false });

    st.addEventListener("keydown", e => {
        const k = {
            ArrowRight: .05,
            ArrowLeft: -.05
        }[e.key];

        if (k !== undefined) {
            e.preventDefault();

            touched = true;
            hint.classList.add("off");

            target = clamp(target + k);
        }
    });

    $("prev").addEventListener("click", () => load(cur - 1));
    $("next").addEventListener("click", () => load(cur + 1));

    [...th.children].forEach((b, i) =>
        b.addEventListener("click", () => load(i))
    );

    function nudge() {
        if (touched || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const s = performance.now();

        (function f(n) {
            const k = (n - s) / 1600;

            if (touched || drag) return;
            if (k >= 1) {
                target = 0;
                return;
            }

            target = .22 * Math.sin(Math.PI * k);
            requestAnimationFrame(f);
        })(s);
    }

    load(0);
    tick();

    if ("IntersectionObserver" in window) {
        new IntersectionObserver((en, o) => {
            if (en[0].isIntersecting) {
                v.preload = "auto";
                v.load();
                o.disconnect();
            }
        }, { rootMargin: "700px" }).observe(st);

        new IntersectionObserver((en, o) => {
            if (en[0].isIntersecting) {
                o.disconnect();

                v.readyState >= 2
                    ? nudge()
                    : v.addEventListener("loadeddata", nudge, { once: true });
            }
        }, { threshold: .6 }).observe(st);

    } else {
        v.preload = "auto";
        v.load();
    }
})();

/* ===== Menu fixo: fundo ao rolar e link da seção atual ===== */
(()=>{
const hd=document.querySelector("header");
const solid=()=>hd.classList.toggle("solid",scrollY>60);addEventListener("scroll",solid,{passive:true});solid();
const links=[...document.querySelectorAll(".links a")];
if("IntersectionObserver"in window){
 const so=new IntersectionObserver(en=>en.forEach(x=>{if(x.isIntersecting)links.forEach(a=>a.setAttribute("aria-current",a.getAttribute("href")==="#"+x.target.id))}),{rootMargin:"-45% 0px -50% 0px"});
 links.forEach(a=>{const s=document.querySelector(a.getAttribute("href"));if(s)so.observe(s)});
}
})();

/* ===== Jacaré entra andando na seção Serviços =====
   Chrome, Edge e Firefox: video/croc.webm (WebM com transparência de verdade, sem nenhum truque de script).
   Safari e iPhone não leem transparência em WebM; lá usamos video/croc.mp4, que guarda a cor (metade de cima)
   e a transparência (metade de baixo), e juntamos as duas num canvas. */
(()=>{
const stage=document.getElementById("croc"),cv=document.getElementById("crocc"),mp4=document.getElementById("crocv"),wm=document.getElementById("crocw");
if(!stage||!cv||!mp4)return;
const M={w:782,h:600,fx0:245,fx1:713};            // tamanho do recorte e onde o jacaré para (em px do vídeo)
const ua=navigator.userAgent;
const noAlpha=/iP(hone|ad|od)/.test(ua)||(/^((?!chrome|chromium|android|crios|fxios|edg).)*safari/i.test(ua));
const useWebm=!!wm&&!noAlpha&&!!wm.canPlayType&&wm.canPlayType('video/webm; codecs="vp9"')!=="";
const vid=useWebm?wm:mp4;
if(!useWebm&&wm)wm.remove();
cv.width=M.w;cv.height=M.h;
const ctx=cv.getContext("2d");
const off=document.createElement("canvas");off.width=M.w;off.height=M.h*2;
const octx=off.getContext("2d",{willReadFrequently:true});
const out=ctx.createImageData(M.w,M.h);
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
let started=false;
if(useWebm)cv.style.display="none";

/* posiciona o jacaré: começa colado na borda esquerda da tela (ele "entra" por ali) e para na coluna do título */
function layout(){
 const sh=stage.clientHeight,s=sh/M.h,r=stage.getBoundingClientRect();
 const crocW=(M.fx1-M.fx0)*s,fx0=M.fx0*s;
 const want=r.left+(stage.clientWidth-crocW)/2;     // onde queremos o jacaré parado (x na tela)
 const left=Math.min(0,want-fx0);                   // o vídeo nunca começa depois da borda da tela
 for(const el of [cv,useWebm?wm:null]){if(!el)continue;el.style.width=M.w*s+"px";el.style.height=sh+"px";el.style.left=(left-r.left)+"px"}
 stage.style.setProperty("--gx",(left-r.left+fx0+crocW/2)+"px");
 stage.style.setProperty("--gw",crocW*1.05+"px");
}
layout();addEventListener("resize",layout);addEventListener("load",layout);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(layout);

function arrive(){stage.classList.add("arrived")}
function still(){                                    // sem animação: mostra só o jacaré já parado
 const im=new Image();
 im.onload=()=>{if(wm)wm.style.display="none";cv.style.display="";ctx.clearRect(0,0,M.w,M.h);ctx.drawImage(im,0,0,M.w,M.h);arrive()};
 im.src="img/croc-final.webp";
}
function draw(){
 octx.drawImage(vid,0,0,M.w,M.h*2);
 const d=octx.getImageData(0,0,M.w,M.h*2).data,o=out.data,n=M.w*M.h*4;
 for(let i=0;i<n;i+=4){o[i]=d[i];o[i+1]=d[i+1];o[i+2]=d[i+2];o[i+3]=d[n+i]}
 ctx.putImageData(out,0,0);
}
const next=cb=>"requestVideoFrameCallback"in vid?vid.requestVideoFrameCallback(cb):requestAnimationFrame(cb);
function tick(){
 try{
  if(vid.readyState>=2)draw();
  if(vid.ended){draw();arrive();return}
 }catch(e){still();return}                           // navegador bloqueou a leitura dos pixels: mostra a pose final
 next(tick);
}
function go(){
 if(started)return;started=true;
 if(reduce){still();return}
 vid.preload="auto";
 vid.addEventListener("ended",()=>{if(!useWebm){try{draw()}catch(e){still();return}}arrive()},{once:true});
 vid.addEventListener("error",still,{once:true});
 const p=vid.play();
 if(useWebm){if(p&&p.catch)p.catch(still);return}   // se o navegador bloquear o autoplay, mostra a pose final
 if(p&&p.then)p.then(()=>next(tick),still);else next(tick);
}
if("IntersectionObserver"in window){
 new IntersectionObserver((en,o)=>{if(en[0].isIntersecting){vid.preload="auto";vid.load();o.disconnect()}},{rootMargin:"800px"}).observe(stage);
 new IntersectionObserver((en,o)=>{if(en[0].isIntersecting){o.disconnect();go()}},{threshold:.6}).observe(stage);
}else go();
})();

/* ===== Revelar blocos ao rolar ===== */
(()=>{
const els=document.querySelectorAll(".reveal,section h2,section .lead");
els.forEach(e=>e.classList.add("reveal"));
if(!("IntersectionObserver"in window)){els.forEach(e=>e.classList.add("in"));return}
const io=new IntersectionObserver(en=>en.forEach(x=>{if(x.isIntersecting){x.target.classList.add("in");io.unobserve(x.target)}}),{threshold:.12,rootMargin:"0px 0px -6% 0px"});
els.forEach(e=>io.observe(e));
})();
