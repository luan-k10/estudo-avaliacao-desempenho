(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const shuffle = arr => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const L = "ABCDE";
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };
  const num = (v, d = 2) => Number.isFinite(v) ? v.toLocaleString("pt-BR", { maximumFractionDigits: d }) : "—";
  const val = id => parseFloat(String($("#" + id).value).replace(",", "."));

  QUESTOES.forEach((q, i) => { q.id = i; });
  $("#ano").textContent = new Date().getFullYear();

  // ---------------- tema claro/escuro (igual ao portfólio) ----------------
  $("#theme-toggle").addEventListener("click", () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    store.set("theme", next);
  });

  // ---------------- tabelas empilháveis: rótulos para o celular ----------------
  $$("table.stack").forEach(t => {
    const heads = $$("thead th", t).map(th => th.textContent.trim());
    $$("tbody tr", t).forEach(tr => $$("td", tr).forEach((td, i) => td.setAttribute("data-l", heads[i] || "")));
  });

  // ---------------- progresso ----------------
  const KEY = "adsc-progresso-v1";
  let prog = {};
  try { prog = JSON.parse(store.get(KEY)) || {}; } catch { prog = {}; }
  const save = () => store.set(KEY, JSON.stringify(prog));
  const registrar = (q, ok) => { prog[q.id] = ok ? 1 : 0; save(); };

  function renderStats() {
    const ids = Object.keys(prog).filter(k => QUESTOES[k]);
    const certas = ids.filter(k => prog[k] === 1).length;
    $("#st-total").textContent = ids.length;
    $("#st-acerto").textContent = ids.length ? Math.round(certas * 100 / ids.length) + "%" : "0%";
    $("#st-erradas").textContent = ids.length - certas;
    $("#progresso-temas").innerHTML = Object.entries(TEMAS).map(([k, nome]) => {
      const qs = QUESTOES.filter(q => q.t === k);
      const ok = qs.filter(q => prog[q.id] === 1).length;
      const pct = qs.length ? Math.round(ok * 100 / qs.length) : 0;
      return `<div class="prog-row"><span>${esc(nome)}</span><div class="bar"><div style="width:${pct}%"></div></div><span class="muted">${ok}/${qs.length}</span></div>`;
    }).join("");
  }
  $("#btn-reset").addEventListener("click", () => {
    if (confirm("Zerar todo o progresso do quiz?")) { prog = {}; save(); renderStats(); renderQuizOptions(); }
  });

  // ---------------- navegação ----------------
  function go(view) {
    if (!$("#view-" + view)) view = "inicio";
    $$("#nav button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + view));
    if (view === "inicio") renderStats();
    if (view === "quiz") { $("#quiz-setup").classList.remove("hidden"); $("#quiz-area").classList.add("hidden"); renderQuizOptions(); }
    if (view !== "simulado") clearInterval(simTimer);
    const active = $(`#nav button[data-view="${view}"]`);
    if (active) active.scrollIntoView({ block: "nearest", inline: "center" });
    if (history.replaceState) history.replaceState(null, "", view === "inicio" ? location.pathname : "#" + view);
    window.scrollTo(0, 0);
  }
  $$("#nav button").forEach(b => b.addEventListener("click", () => go(b.dataset.view)));
  $$("[data-go]").forEach(b => b.addEventListener("click", e => {
    e.preventDefault();
    go(b.dataset.go);
    if (b.dataset.lab) openLab(b.dataset.lab);
  }));
  $$(".practice[data-tema]").forEach(b => b.addEventListener("click", () => {
    go("quiz");
    startQuiz(TEMAS[b.dataset.tema], shuffle(QUESTOES.filter(q => q.t === b.dataset.tema)));
  }));

  // Índice de semanas: abre o <details> e rola até ele
  $$(".week-index a").forEach(a => a.addEventListener("click", e => {
    e.preventDefault();
    const d = $("#" + a.dataset.week);
    d.open = true;
    d.scrollIntoView({ behavior: "smooth", block: "start" });
  }));

  // ---------------- quiz ----------------
  // Em data.js a correta é sempre o índice 0; as alternativas são sempre embaralhadas.
  function prep(q) {
    const ord = shuffle(q.o.map((_, i) => i));
    return { q, ord, correta: ord.indexOf(0) };
  }

  function renderQuizOptions() {
    const erradas = QUESTOES.filter(q => prog[q.id] === 0);
    const nunca = QUESTOES.filter(q => prog[q.id] === undefined);
    const opts = [
      { nome: "Todas misturadas", sub: `${QUESTOES.length} questões`, fn: () => startQuiz("Todas", shuffle(QUESTOES)) },
      { nome: "Todas na ordem das semanas", sub: `${QUESTOES.length} questões, da Semana 1 à 6`, fn: () => startQuiz("Ordem das semanas", [...QUESTOES]) },
      { nome: "Ainda não respondidas", sub: `${nunca.length} questões`, fn: () => nunca.length ? startQuiz("Não respondidas", shuffle(nunca)) : alert("Você já respondeu todas!") },
      { nome: "Revisar erradas", sub: `${erradas.length} questões`, fn: () => erradas.length ? startQuiz("Revisão de erradas", shuffle(erradas)) : alert("Nenhuma questão errada para revisar") },
      ...Object.entries(TEMAS).map(([k, nome]) => ({ nome, sub: `${QUESTOES.filter(q => q.t === k).length} questões`, fn: () => startQuiz(nome, shuffle(QUESTOES.filter(q => q.t === k))) })),
    ];
    const box = $("#quiz-options");
    box.innerHTML = "";
    opts.forEach(o => {
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = `<b>${esc(o.nome)}</b><small>${esc(o.sub)}</small>`;
      b.addEventListener("click", o.fn);
      box.appendChild(b);
    });
  }

  function startQuiz(titulo, lista) {
    const itens = lista.map(prep);
    let i = 0, acertos = 0;
    const resp = new Array(itens.length).fill(null);
    $("#quiz-setup").classList.add("hidden");
    const area = $("#quiz-area");
    area.classList.remove("hidden");

    function render() {
      const it = itens[i], q = it.q;
      area.innerHTML = `<div class="card">
        <div class="qhead"><span><b>${esc(titulo)}</b>${titulo === TEMAS[q.t] ? "" : " · " + esc(TEMAS[q.t])}</span><span id="q-score">Questão ${i + 1}/${itens.length} · ✓ ${acertos}</span></div>
        <div class="progressline"><div style="width:${(i + 1) * 100 / itens.length}%"></div></div>
        <div class="qtext">${esc(q.q)}</div>
        <div id="opts">${it.ord.map((oi, k) => `<button type="button" class="opt" data-k="${k}"><span class="l">${L[k]})</span><span>${esc(q.o[oi])}</span></button>`).join("")}</div>
        <div id="explic"></div>
        <div class="qnav"><button type="button" class="btn" id="q-prev" ${i === 0 ? "disabled" : ""}>← Anterior</button>
        <button type="button" class="btn" id="q-sair">Sair</button>
        <button type="button" class="btn btn-primary" id="q-next">${i === itens.length - 1 ? "Finalizar" : "Próxima →"}</button></div></div>`;
      if (resp[i] !== null) mostrar(resp[i]);
      $$("#opts .opt", area).forEach(b => b.addEventListener("click", () => {
        if (resp[i] !== null) return;
        const k = +b.dataset.k;
        resp[i] = k;
        const ok = k === it.correta;
        if (ok) acertos++;
        registrar(q, ok);
        mostrar(k);
        $("#q-score").textContent = `Questão ${i + 1}/${itens.length} · ✓ ${acertos}`;
      }));
      $("#q-prev").onclick = () => { i--; render(); };
      $("#q-next").onclick = () => { if (i < itens.length - 1) { i++; render(); window.scrollTo(0, 0); } else fim(); };
      $("#q-sair").onclick = () => go("quiz");
    }
    function mostrar(k) {
      const it = itens[i];
      $$("#opts .opt", area).forEach((b, j) => {
        b.disabled = true;
        if (j === it.correta) b.classList.add("correct");
        else if (j === k) b.classList.add("wrong");
      });
      const ok = k === it.correta;
      $("#explic").innerHTML = `<div class="explic ${ok ? "" : "bad"}"><b>${ok ? "✓ Correto!" : `✗ Resposta certa: ${L[it.correta]}`}</b><br>${esc(it.q.e)}</div>`;
    }
    function fim() {
      const n = resp.filter(r => r !== null).length;
      const pct = n ? Math.round(acertos * 100 / n) : 0;
      area.innerHTML = `<div class="card center"><h2>Fim: ${esc(titulo)}</h2>
        <div class="score-big" style="color:${pct >= 70 ? "var(--ok)" : pct >= 50 ? "var(--warn)" : "var(--bad)"}">${pct}%</div>
        <p>${acertos} acertos de ${n} respondidas (${itens.length} no total).</p>
        <p class="muted">${pct >= 70 ? "Mandou bem! Tente o simulado." : "Releia os resumos das semanas em que errou e use “Revisar erradas”."}</p>
        <button type="button" class="btn btn-primary" id="q-again">Escolher outro conjunto</button></div>`;
      $("#q-again").onclick = () => go("quiz");
      window.scrollTo(0, 0);
    }
    render();
    window.scrollTo(0, 0);
  }

  // ---------------- simulado ----------------
  let simTimer = null;
  $("#sim-tema").innerHTML += Object.entries(TEMAS).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join("");
  $("#sim-start").addEventListener("click", () => {
    const tema = $("#sim-tema").value;
    const base = tema ? QUESTOES.filter(q => q.t === tema) : QUESTOES;
    const n = Math.min(+$("#sim-n").value, base.length);
    const itens = shuffle(base).slice(0, n).map(prep);
    const resp = new Array(itens.length).fill(null);
    let i = 0;
    const t0 = Date.now();
    $("#sim-setup").classList.add("hidden");
    const area = $("#sim-area");
    area.classList.remove("hidden");
    const tempo = () => { const s = Math.floor((Date.now() - t0) / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
    clearInterval(simTimer);
    simTimer = setInterval(() => { const el = $("#sim-time"); if (el) el.textContent = tempo(); }, 1000);

    function render() {
      const it = itens[i];
      const respondidas = resp.filter(r => r !== null).length;
      area.innerHTML = `<div class="card">
        <div class="qhead"><span>Simulado · Questão ${i + 1}/${itens.length} · respondidas ${respondidas}</span><span id="sim-time">${tempo()}</span></div>
        <div class="progressline"><div style="width:${respondidas * 100 / itens.length}%"></div></div>
        <div class="qtext">${esc(it.q.q)}</div>
        <div id="s-opts">${it.ord.map((oi, k) => `<button type="button" class="opt ${resp[i] === k ? "sel" : ""}" data-k="${k}"><span class="l">${L[k]})</span><span>${esc(it.q.o[oi])}</span></button>`).join("")}</div>
        <div class="qnav"><button type="button" class="btn" id="s-prev" ${i === 0 ? "disabled" : ""}>← Anterior</button>
        <button type="button" class="btn" id="s-next" ${i === itens.length - 1 ? "disabled" : ""}>Próxima →</button>
        <button type="button" class="btn btn-primary" id="s-end">Entregar prova</button></div></div>`;
      $$("#s-opts .opt", area).forEach(b => b.addEventListener("click", () => {
        resp[i] = +b.dataset.k;
        if (i < itens.length - 1) i++;
        render();
      }));
      $("#s-prev").onclick = () => { i--; render(); };
      $("#s-next").onclick = () => { i++; render(); };
      $("#s-end").onclick = () => {
        const falt = resp.filter(r => r === null).length;
        if (falt && !confirm(`Faltam ${falt} questões. Entregar mesmo assim?`)) return;
        fim();
      };
    }
    function fim() {
      clearInterval(simTimer);
      let acertos = 0;
      itens.forEach((it, k) => {
        if (resp[k] === null) return;
        const ok = resp[k] === it.correta;
        if (ok) acertos++;
        registrar(it.q, ok);
      });
      const nota = acertos * 10 / itens.length;
      const porTema = {};
      itens.forEach((it, k) => { const t = it.q.t; porTema[t] = porTema[t] || [0, 0]; porTema[t][1]++; if (resp[k] === it.correta) porTema[t][0]++; });
      area.innerHTML = `<div class="card center"><h2>Resultado do simulado</h2>
        <div class="score-big" style="color:${nota >= 7 ? "var(--ok)" : nota >= 5 ? "var(--warn)" : "var(--bad)"}">${num(nota, 1)}</div>
        <p>${acertos}/${itens.length} acertos · tempo ${tempo()}</p>
        <div style="max-width:600px;margin:0 auto 1rem;text-align:left">${Object.entries(porTema).map(([t, [a, n]]) => `<div class="prog-row"><span>${esc(TEMAS[t])}</span><div class="bar"><div style="width:${a * 100 / n}%"></div></div><span class="muted">${a}/${n}</span></div>`).join("")}</div>
        <button type="button" class="btn btn-primary" id="s-new">Novo simulado</button></div>
        <div class="card"><h3 style="margin-top:0">Correção</h3>${itens.map((it, k) => {
          const r = resp[k], ok = r === it.correta;
          return `<div class="review-item"><b class="${ok ? "ok" : "bad"}">${ok ? "✓" : "✗"} ${k + 1}.</b> ${esc(it.q.q)}<br>
            ${r === null ? `<span class="bad">Não respondida.</span><br>` : ok ? "" : `<span class="bad">Sua: ${esc(it.q.o[it.ord[r]])}</span><br>`}
            <span class="ok">Certa: ${esc(it.q.o[0])}</span><br><span class="muted">${esc(it.q.e)}</span></div>`;
        }).join("")}</div>`;
      $("#s-new").onclick = () => { area.classList.add("hidden"); $("#sim-setup").classList.remove("hidden"); window.scrollTo(0, 0); };
      window.scrollTo(0, 0);
    }
    render();
    window.scrollTo(0, 0);
  });

  // ---------------- flashcards ----------------
  let cards = [...FLASHCARDS], fi = 0;
  const fc = $("#flashcard");
  function setSide(flip) {
    fc.classList.toggle("flip", flip);
    $("#flash-side").textContent = flip ? "Resposta" : "Pergunta";
  }
  function renderCard() {
    setSide(false);
    $("#flash-front").textContent = cards[fi][0];
    $("#flash-back").innerHTML = cards[fi][1];
    $("#flash-count").textContent = `${fi + 1} / ${cards.length}`;
  }
  fc.addEventListener("click", () => setSide(!fc.classList.contains("flip")));
  fc.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); setSide(!fc.classList.contains("flip")); } });
  $("#flash-prev").onclick = () => { fi = (fi - 1 + cards.length) % cards.length; renderCard(); };
  $("#flash-next").onclick = () => { fi = (fi + 1) % cards.length; renderCard(); };
  $("#flash-shuffle").onclick = () => { cards = shuffle(cards); fi = 0; renderCard(); };
  document.addEventListener("keydown", e => {
    if (!$("#view-flash").classList.contains("active") || /TEXTAREA|INPUT|SELECT/.test(document.activeElement.tagName)) return;
    if (e.key === " ") { e.preventDefault(); setSide(!fc.classList.contains("flip")); }
    if (e.key === "ArrowRight") $("#flash-next").click();
    if (e.key === "ArrowLeft") $("#flash-prev").click();
  });
  renderCard();

  // ---------------- discursivas ----------------
  const grupo = d => d.f.split(" – ")[0];
  const grupos = [...new Set(DISCURSIVAS.map(grupo))];
  let discFiltro = "";
  $("#disc-filter").innerHTML = [`<button type="button" data-g="" class="active">Todas (${DISCURSIVAS.length})</button>`,
    ...grupos.map(g => `<button type="button" data-g="${esc(g)}">${esc(g)} (${DISCURSIVAS.filter(d => grupo(d) === g).length})</button>`)].join("");
  $("#disc-list").innerHTML = DISCURSIVAS.map((d, i) => `<div class="card disc" data-g="${esc(grupo(d))}">
    <div class="qhead"><span class="src">${esc(d.f)}</span><span>${esc(TEMAS[d.t] || "")}</span></div>
    <div class="qtext">${esc(d.q)}</div>
    <textarea placeholder="Escreva sua resposta aqui antes de ver o modelo..." data-i="${i}" aria-label="Sua resposta"></textarea>
    <button type="button" class="btn" data-show="${i}">Ver resposta-modelo</button>
    <div class="modelo hidden" id="disc-${i}">${d.r}
      <p><b>Confira se sua resposta tem os pontos-chave:</b></p>
      <div class="chk">${d.k.map(k => `<label><input type="checkbox"> <span>${esc(k)}</span></label>`).join("")}</div></div></div>`).join("");
  function aplicarFiltro() {
    $$("#disc-filter button").forEach(b => b.classList.toggle("active", b.dataset.g === discFiltro));
    $$("#disc-list .disc").forEach(c => c.classList.toggle("hidden", !!discFiltro && c.dataset.g !== discFiltro));
    $("#disc-case").classList.toggle("hidden", !!discFiltro && discFiltro !== "Atividade Semana 6");
  }
  $$("#disc-filter button").forEach(b => b.addEventListener("click", () => { discFiltro = b.dataset.g; aplicarFiltro(); }));
  $$("#disc-list [data-show]").forEach(b => b.addEventListener("click", () => {
    const m = $("#disc-" + b.dataset.show);
    m.classList.toggle("hidden");
    b.textContent = m.classList.contains("hidden") ? "Ver resposta-modelo" : "Esconder resposta-modelo";
  }));
  $$("#disc-list textarea").forEach(t => {
    const k = "adsc-disc-" + t.dataset.i;
    t.value = store.get(k) || "";
    t.addEventListener("input", () => store.set(k, t.value));
  });

  // ---------------- calculadoras ----------------
  function openLab(id) {
    $$("#lab-tabs button").forEach(b => b.classList.toggle("active", b.dataset.lab === id));
    $$(".lab").forEach(l => l.classList.toggle("hidden", l.id !== "lab-" + id));
    const b = $(`#lab-tabs button[data-lab="${id}"]`);
    if (b) b.scrollIntoView({ block: "nearest", inline: "center" });
  }
  $$("#lab-tabs button").forEach(b => b.addEventListener("click", () => openLab(b.dataset.lab)));
  const bind = (ids, fn) => { ids.forEach(id => $("#" + id).addEventListener("input", fn)); fn(); };
  const nivel = (u) => u >= 1 ? ["bad", "saturado", "SATURADO (≥ 100%)"] : u >= 0.85 ? ["bad", "crítico", "crítico — pouca folga"] : u >= 0.7 ? ["warn", "atenção", "atenção"] : ["ok", "folga", "folga"];

  // U e X
  bind(["b-b", "b-t", "b-c"], () => {
    const B = val("b-b"), T = val("b-t"), C = val("b-c");
    const U = B / T, X = C / (T * 3600);
    $("#b-res").innerHTML = T > 0
      ? `U = ${num(B)} ÷ ${num(T)} = <b class="big">${num(U * 100, 1)}%</b><br>X = ${num(C, 0)} ÷ (${num(T)} h × 3.600 s) = <b class="big">${num(X, 3)} req/s</b>${U > 1 ? '<br><span class="badge bad">B não pode ser maior que T</span>' : ""}`
      : "Informe um tempo total maior que zero.";
  });

  // M/M/1
  bind(["f-s", "f-u"], () => {
    const S = val("f-s"), U = val("f-u") / 100;
    $("#f-uv").textContent = Math.round(U * 100) + "%";
    const R = S / (1 - U);
    const [c, , t] = nivel(U);
    $("#f-res").innerHTML = `R = ${num(S)} ÷ (1 − ${num(U, 2)}) = <b class="big">${num(R, 2)} ms</b> &nbsp;<span class="badge ${c}">${t}</span><br><span class="small muted">Espera na fila ≈ ${num(R - S, 2)} ms · R é ${num(R / S, 1)}× o tempo de serviço.</span>`;
    const us = [0.2, 0.5, 0.8, 0.9, 0.95, 0.98];
    $("#f-tab").innerHTML = `<thead><tr><th>U</th><th class="n">R (ms)</th><th class="n">R / S</th></tr></thead><tbody>${us.map(u => `<tr${Math.abs(u - U) < 0.005 ? ' class="hl"' : ""}><td>${num(u * 100, 0)}%</td><td class="n">${num(S / (1 - u), 2)}</td><td class="n">${num(1 / (1 - u), 1)}×</td></tr>`).join("")}</tbody>`;
  });

  // U = X·S por componente
  const comps = [["Web / API", 1.2], ["Aplicação", 1.6], ["Banco de dados", 1.8], ["Armazenamento", 0.8]];
  $("#l-tab").innerHTML = `<thead><tr><th>Componente</th><th class="n">S (ms)</th><th class="n">U</th><th>Situação</th></tr></thead><tbody>${comps.map(([n, s], i) => `<tr><td>${n}</td><td class="n"><input type="number" id="l-s${i}" value="${s}" min="0" step="any" aria-label="S de ${n}"></td><td class="n" id="l-u${i}"></td><td id="l-b${i}"></td></tr>`).join("")}</tbody>`;
  bind(["l-x", ...comps.map((_, i) => "l-s" + i)], () => {
    const X = val("l-x");
    let pior = null;
    comps.forEach(([n], i) => {
      const U = X * val("l-s" + i) / 1000;
      const [c, t] = nivel(U);
      $("#l-u" + i).textContent = num(U * 100, 1) + "%";
      $("#l-b" + i).innerHTML = `<span class="badge ${c}">${t}</span>`;
      if (!pior || U > pior[1]) pior = [n, U];
    });
    const maxX = 1000 / Math.max(...comps.map((_, i) => val("l-s" + i)));
    $("#l-res").innerHTML = `Gargalo provável: <b>${pior[0]}</b> (${num(pior[1] * 100, 1)}%).<br><span class="small muted">Vazão máxima teórica (U = 100% no gargalo): X = 1 ÷ S = ${num(maxX, 0)} req/s.</span>`;
  });

  // Little
  bind(["li-x", "li-r", "li-n", "li-q"], () => {
    const X = val("li-x"), R = val("li-r"), N = val("li-n"), q = $("#li-q").value;
    let out;
    if (q === "n") out = `N = ${num(X)} × ${num(R)} = <b class="big">${num(X * R, 2)}</b> requisições no sistema`;
    else if (q === "x") out = R > 0 ? `X = N ÷ R = ${num(N)} ÷ ${num(R)} = <b class="big">${num(N / R, 2)} req/s</b>` : "Informe N e R (> 0).";
    else out = X > 0 ? `R = N ÷ X = ${num(N)} ÷ ${num(X)} = <b class="big">${num(N / X, 3)} s</b>` : "Informe N e X (> 0).";
    $("#li-res").innerHTML = out;
  });

  // Disponibilidade
  const fmtH = h => h >= 1 ? `${num(h, 1)} h` : `${num(h * 60, 1)} min`;
  bind(["d-a", "d-c"], () => {
    const A = val("d-a") / 100, custo = val("d-c");
    const h = (1 - A) * 8760;
    $("#d-res").innerHTML = A >= 0 && A <= 1
      ? `Parado por ano: <b class="big">${fmtH(h)}</b><br>Por mês: ${fmtH(h / 12)} · por semana: ${fmtH(h / 52.14)}<br>Prejuízo potencial/ano: <b>R$ ${num(h * custo, 0)}</b>`
      : "Use um valor entre 0 e 100.";
  });
  bind(["d-mtbf", "d-mttr"], () => {
    const a = val("d-mtbf"), r = val("d-mttr");
    const A = a / (a + r);
    $("#d-res2").innerHTML = a + r > 0 ? `A = ${num(a)} ÷ (${num(a)} + ${num(r)}) = <b class="big">${num(A * 100, 3)}%</b> → parado ≈ ${fmtH((1 - A) * 8760)}/ano` : "Informe MTBF e MTTR.";
  });

  // Matriz ponderada
  const CRIT = ["Desempenho", "Disponibilidade", "Escalabilidade", "Custo", "Manutenção"];
  const CRIT_AB = ["Desemp.", "Disponib.", "Escalab.", "Custo", "Manut."];
  const PRESETS = {
    xyz: { pesos: [30, 20, 20, 20, 10], alts: [["X — Econômica", [2, 2, 1, 5, 2]], ["Y — Equilibrada", [4, 4, 3, 3, 4]], ["Z — Premium", [5, 5, 5, 2, 4]]] },
    varejo: { pesos: [30, 20, 20, 20, 10], alts: [["B — Moderna local", [3, 3, 3, 4, 3]], ["C — Nuvem gerenciada", [5, 5, 5, 2, 4]]] },
  };
  function montarMatriz(p) {
    const P = PRESETS[p];
    $$("#m-preset button").forEach(b => b.classList.toggle("active", b.dataset.p === p));
    const curto = a => a[0].split(" — ")[0];
    $("#m-tab").innerHTML = `<thead><tr><th>Critério</th><th class="n">Peso %</th>${P.alts.map(a => `<th class="n" title="${esc(a[0])}">${esc(curto(a))}</th>`).join("")}</tr></thead>
      <tbody>${CRIT.map((c, i) => `<tr><td title="${c}"><span class="full">${c}</span><span class="abbr">${CRIT_AB[i]}</span></td><td class="n"><input type="number" class="m-w" data-i="${i}" value="${P.pesos[i]}" min="0" max="100" aria-label="Peso de ${c}"></td>${P.alts.map((a, j) => `<td class="n"><input type="number" class="m-n" data-i="${i}" data-j="${j}" value="${a[1][i]}" min="1" max="5" aria-label="Nota ${c} ${esc(a[0])}"></td>`).join("")}</tr>`).join("")}
      <tr class="hl"><td>Total</td><td class="n" id="m-wsum"></td>${P.alts.map((_, j) => `<td class="n" id="m-t${j}"></td>`).join("")}</tr></tbody>`;
    const calc = () => {
      const w = $$(".m-w").map(e => parseFloat(e.value) || 0);
      const soma = w.reduce((a, b) => a + b, 0);
      $("#m-wsum").textContent = num(soma, 1) + "%";
      const tot = P.alts.map((a, j) => $$(`.m-n[data-j="${j}"]`).reduce((s, e) => s + (parseFloat(e.value) || 0) * w[+e.dataset.i] / 100, 0));
      tot.forEach((t, j) => { $("#m-t" + j).textContent = num(t, 2); });
      const best = tot.indexOf(Math.max(...tot));
      const fora = $$(".m-n").some(e => +e.value < 1 || +e.value > 5);
      $("#m-res").innerHTML = `<p class="m-legend" style="margin-top:0">${P.alts.map(a => esc(a[0])).join(" · ")}</p>Maior pontuação: <b class="big">${esc(P.alts[best][0])}</b> (${num(tot[best], 2)})`
        + (Math.abs(soma - 100) > 0.01 ? `<br><span class="badge warn">Os pesos somam ${num(soma, 1)}% — devem somar 100%</span>` : "")
        + (fora ? `<br><span class="badge warn">Use notas de 1 a 5</span>` : "")
        + `<br><span class="small muted">Experimente aumentar o peso de Custo e reduzir o de Desempenho para ver se o vencedor muda (análise de sensibilidade).</span>`;
    };
    $$("#m-tab input").forEach(e => e.addEventListener("input", calc));
    calc();
  }
  $$("#m-preset button").forEach(b => b.addEventListener("click", () => montarMatriz(b.dataset.p)));
  montarMatriz("xyz");

  // CPU e AMAT
  bind(["c-i", "c-fa", "c-ia", "c-fb", "c-ib"], () => {
    const I = val("c-i"), fa = val("c-fa"), ia = val("c-ia"), fb = val("c-fb"), ib = val("c-ib");
    const ta = I / (ia * fa), tb = I / (ib * fb);
    const vence = ta < tb ? "A" : tb < ta ? "B" : null;
    $("#c-res").innerHTML = `A: ${num(I)} ÷ (${num(ia)} × ${num(fa)}) = <b>${num(ta, 2)} s</b> · ${num(ia * fa, 2)} bi instr/s<br>
      B: ${num(I)} ÷ (${num(ib)} × ${num(fb)}) = <b>${num(tb, 2)} s</b> · ${num(ib * fb, 2)} bi instr/s<br>
      ${vence ? `<b class="big">Processador ${vence} termina primeiro</b>` : "Empate"}${vence && ((vence === "A" && fa < fb) || (vence === "B" && fb < fa)) ? '<br><span class="small muted">Repare: o vencedor tem MENOS GHz — o IPC fez a diferença.</span>' : ""}`;
  });
  bind(["a-h", "a-m", "a-p"], () => {
    const h = val("a-h"), m = val("a-m") / 100, p = val("a-p");
    $("#a-res").innerHTML = `AMAT = ${num(h)} + ${num(m, 4)} × ${num(p)} = <b class="big">${num(h + m * p, 3)} ns</b>`;
  });

  // Rede
  const cls = (v, a, b) => v < a ? ["ok", "excelente"] : v <= b ? ["warn", "aceitável"] : ["bad", "degradação severa"];
  bind(["r-lat", "r-rtt", "r-jit", "r-loss"], () => {
    const linhas = [
      ["Latência", val("r-lat"), "ms", 150, 300],
      ["RTT", val("r-rtt"), "ms", 100, 250],
      ["Jitter", val("r-jit"), "ms", 20, 30],
      ["Perda", val("r-loss"), "%", 1, 3],
    ];
    const res = linhas.map(([n, v, u, a, b]) => { const [c, t] = cls(v, a, b); return { n, c, html: `${n}: ${num(v)} ${u} <span class="badge ${c}">${t}</span>` }; });
    const ruins = res.filter(r => r.c === "bad").map(r => r.n);
    $("#r-res").innerHTML = res.map(r => r.html).join("<br>") + (ruins.length
      ? `<br><b>Atenção:</b> ${ruins.join(", ")} fora do aceitável.${ruins.includes("Jitter") ? " Jitter alto = variação do atraso → áudio/vídeo irregulares (buffer de jitter vazio)." : ""}`
      : "<br><b>Dentro das referências para tempo real.</b>");
  });
  bind(["r-nom", "r-real"], () => {
    const n = val("r-nom"), r = val("r-real");
    $("#r-res2").innerHTML = n > 0 ? `Eficiência = ${num(r)} ÷ ${num(n)} = <b class="big">${num(r * 100 / n, 1)}%</b> da banda nominal` : "Informe a banda nominal.";
  });

  // ---------------- início ----------------
  renderStats();
  const h = location.hash.slice(1);
  if (h && $("#view-" + h)) go(h);
})();

// Menu: se não couber numa linha no desktop, passa para 2 linhas; esmaece as bordas quando há itens escondidos.
(() => {
  const bar = document.querySelector(".topbar"), menu = bar && bar.querySelector(".menu");
  if (!menu) return;
  const wide = matchMedia("(min-width: 1000px)");
  const fades = () => {
    const rest = menu.scrollWidth - menu.clientWidth - menu.scrollLeft;
    menu.classList.toggle("fade-l", menu.scrollLeft > 2);
    menu.classList.toggle("fade-r", rest > 2);
  };
  const fit = () => {
    bar.classList.remove("stack");
    if (wide.matches && menu.scrollWidth > menu.clientWidth + 1) bar.classList.add("stack");
    fades();
  };
  menu.addEventListener("scroll", fades, { passive: true });
  addEventListener("resize", fit);
  if (document.fonts) document.fonts.ready.then(fit);
  fit();
})();