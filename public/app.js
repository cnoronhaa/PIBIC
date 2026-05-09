// CONFIGURAÇÕES
const CLIENT_ID = '1056484806122-rhmdjfl6njumsj6sjb6fo5rh4ba1jvgt.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/classroom.courses.readonly ' + 
               'https://www.googleapis.com/auth/classroom.announcements.readonly ' + 
               'https://www.googleapis.com/auth/classroom.coursework.me.readonly ' +
               'https://www.googleapis.com/auth/classroom.rosters.readonly ' +
               'https://www.googleapis.com/auth/userinfo.profile ' + 
               'https://www.googleapis.com/auth/userinfo.email ' +
               'https://www.googleapis.com/auth/drive.readonly'; 
const TAMANHO_MAXIMO_MB = 50; // Limite de 50 Megabytes

let historicoTranscricoes = []; // Guarda as transcrições da sessão atual
let usuarioLogadoEmail = ""; // NOVO: Guarda o e-mail do usuário para o localStorage
let tokenClient;
let gapiInited = false;
let cursoAtualGlobal = null;

window.onload = () => {
    gapi.load('client', async () => {
        await gapi.client.init({});
        await gapi.client.load('classroom', 'v1');
        await gapi.client.load('oauth2', 'v2'); 
        gapiInited = true;

        const tokenSalvo = sessionStorage.getItem('google_token');
        if (tokenSalvo) {
            gapi.client.setToken({ access_token: tokenSalvo });
            document.getElementById('tela-login').style.display = 'none';
            document.getElementById('tela-painel').style.display = 'flex';
            carregarTurmas();
            carregarPerfil();
        }
    });

    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
                sessionStorage.setItem('google_token', tokenResponse.access_token);
                document.getElementById('tela-login').style.display = 'none';
                document.getElementById('tela-painel').style.display = 'flex';
                carregarTurmas();
                carregarPerfil(); 
            }
        },
    });

    document.getElementById('btn-login-google').onclick = () => {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    };

    configurarAcessibilidade();
};

/* NAVEGAÇÃO */
function toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed'); }

function navegarPara(idSecao, event) {
    if(event) event.preventDefault(); 
    document.querySelectorAll('.content-section').forEach(sec => sec.style.display = 'none');
    document.getElementById(idSecao).style.display = 'block';
    
    // Parar vídeos caso o aluno mude de tela enquanto assiste
    if(idSecao !== 'secao-material') {
        const iframe = document.getElementById('video-iframe');
        if(iframe) iframe.src = ''; 
    }
    
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    if(event && event.currentTarget) event.currentTarget.classList.add('active');
}

/* LOGOUT */
function fazerLogout() {
    const token = gapi.client.getToken();
    sessionStorage.removeItem('google_token');
    
    // NOVO: Limpa as variáveis e a tela (mas deixa salvo no localStorage)
    historicoTranscricoes = [];
    usuarioLogadoEmail = "";
    const containerHistorico = document.getElementById('historico-container');
    if (containerHistorico) containerHistorico.style.display = 'none';

    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => { window.location.reload(); });
    } else {
        window.location.reload();
    }
}

/* PERFIL */
async function carregarPerfil() {
    try {
        const response = await gapi.client.oauth2.userinfo.get();
        const perfil = response.result;
        document.getElementById('perfil-nome').innerText = perfil.name || 'Usuário';
        document.getElementById('perfil-email').innerText = perfil.email || 'E-mail não disponível';
        
        // NOVO: Salva o e-mail globalmente e carrega o histórico dele
        if (perfil.email) {
            usuarioLogadoEmail = perfil.email;
            const salvo = localStorage.getItem(`historico_${usuarioLogadoEmail}`);
            historicoTranscricoes = salvo ? JSON.parse(salvo) : [];
            atualizarUIHistorico(); // Mostra na tela o que já estava salvo
        }

        if (perfil.picture) {
            const imgEl = document.getElementById('perfil-foto');
            imgEl.src = perfil.picture;
            imgEl.style.display = 'inline-block';
            document.getElementById('perfil-icone-fallback').style.display = 'none';
        }
    } catch (err) { console.error('Erro ao carregar perfil:', err); }
}

/* API CLASSROOM - TURMAS E MURAL */
async function carregarTurmas() {
    const container = document.getElementById('container-turmas');
    container.innerHTML = '<p>Carregando turmas...</p>';
    try {
        const response = await gapi.client.classroom.courses.list({ courseStates: ['ACTIVE'] });
        const courses = response.result.courses;
        container.innerHTML = '';

        if (!courses || courses.length === 0) {
            container.innerHTML = '<p>Nenhuma turma encontrada.</p>';
            return;
        }

        courses.forEach(curso => {
            const card = document.createElement('article');
            card.className = 'card-turma';
            card.onclick = () => abrirMural(curso); 
            const imgId = `img-prof-${curso.id}`;

            card.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 12px;">
                    <div style="width: 45px; height: 45px; border-radius: 50%; background: var(--bg-sidebar); color: var(--text-sidebar); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; border: 1px solid var(--border-color);">
                        <img id="${imgId}" src="" alt="Foto do Professor" style="width: 100%; height: 100%; object-fit: cover; display: none;">
                        <span id="icon-${imgId}" class="material-symbols-outlined">person</span>
                    </div>
                    <h3 style="margin: 0; font-size: 1.2rem;">${curso.name}</h3>
                </div>
                <p>${curso.section || 'Geral'}</p>
                <p>Código: ${curso.id}</p>
            `;
            container.appendChild(card);

            gapi.client.classroom.courses.teachers.list({ courseId: curso.id }).then(res => {
                const professores = res.result.teachers;
                if (professores && professores.length > 0) {
                    const fotoUrl = professores[0].profile.photoUrl;
                    if (fotoUrl && !fotoUrl.includes('default-user')) {
                        const imgEl = document.getElementById(imgId);
                        imgEl.src = fotoUrl.startsWith('//') ? 'https:' + fotoUrl : fotoUrl;
                        imgEl.style.display = 'block';
                        document.getElementById(`icon-${imgId}`).style.display = 'none';
                    }
                }
            }).catch(() => {});
        });
    } catch (err) {
        if (err.status === 401 || (err.result && err.result.error && err.result.error.code === 401)) {
            sessionStorage.removeItem('google_token');
            window.location.reload();
        }
    }
}

async function abrirMural(curso) {
    cursoAtualGlobal = curso; 
    document.getElementById('mural-nome-turma').innerText = curso.name;
    document.getElementById('mural-disciplina').innerText = curso.section || 'Geral';
    navegarPara('secao-mural');
    alternarAbaTurma('mural');

    const containerMural = document.getElementById('container-posts');
    const containerAtividades = document.getElementById('aba-atividades');
    
    containerMural.innerHTML = '<p>Carregando postagens...</p>';
    containerAtividades.innerHTML = '<p>Carregando atividades...</p>';

    try {
        const [comunicados, materiais] = await Promise.all([
            gapi.client.classroom.courses.announcements.list({ courseId: curso.id }),
            gapi.client.classroom.courses.courseWork.list({ courseId: curso.id })
        ]);

        let posts = [];
        if (comunicados.result.announcements) posts.push(...comunicados.result.announcements.map(p => ({...p, tipoBase: 'Comunicado'})));
        if (materiais.result.courseWork) posts.push(...materiais.result.courseWork.map(p => ({...p, tipoBase: 'Material'})));

        posts.sort((a, b) => new Date(b.updateTime) - new Date(a.updateTime));
        containerMural.innerHTML = '';

        if(posts.length === 0) {
            containerMural.innerHTML = '<p>Mural vazio.</p>';
        } else {
            posts.forEach(post => {
                const div = document.createElement('div');
                div.className = 'card-post';
                const data = new Date(post.updateTime).toLocaleDateString('pt-BR');

                const anexos = post.materials || post.assignment?.materials;
                const temAnexo = anexos && anexos.length > 0;
                const tipoReal = post.tipoBase === 'Material' ? 'Atividade' : (temAnexo ? 'Material' : 'Comunicado');
                const classeTag = post.tipoBase === 'Material' ? 'tag-comunicado' : (tipoReal === 'Comunicado' ? 'tag-comunicado' : 'tag-material');

                let anexoHtml = '';
                if (temAnexo) {
                    anexos.forEach(anexo => {
                        if (anexo.driveFile) {
                            const file = anexo.driveFile.driveFile;
                            const titulo = (file.title || "").toLowerCase();
                            const ehMidia = titulo.endsWith('.mp3') || titulo.endsWith('.mp4') || titulo.endsWith('.m4a') || titulo.endsWith('.wav') || titulo.endsWith('.ogg');
                            
                            if (ehMidia) {
                                anexoHtml += `<button class="btn-anexo" style="margin-right: 10px; background: var(--accent); color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;" onclick="baixarETranscreverDoDrive('${file.id}', '${file.title.replace(/'/g, "\\'")}')">🎙️ Transcrever Aula (${file.title})</button>`;
                            } else {
                                anexoHtml += `<a href="${file.alternateLink}" target="_blank" class="btn-anexo" style="margin-right: 10px; display: inline-block;">📄 Abrir Arquivo</a>`;
                            }
                        } else if (anexo.youtubeVideo) {
                            const ytId = anexo.youtubeVideo.id;
                            const ytTitle = anexo.youtubeVideo.title || "Vídeo";
                            anexoHtml += `<button class="btn-anexo" style="margin-right: 10px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer;" onclick="abrirPlayerYoutube('${ytId}', '${ytTitle.replace(/'/g, "\\'")}')"><span class="material-symbols-outlined">play_circle</span> Assistir Vídeo</button>`;
                        } else if (anexo.link) {
                            anexoHtml += `<a href="${anexo.link.url}" target="_blank" class="btn-anexo" style="margin-right: 10px; display: inline-block;">🔗 Abrir Link</a>`;
                        }
                    });
                } else if (post.alternateLink && post.tipoBase === 'Material') {
                    anexoHtml = `<a href="${post.alternateLink}" target="_blank" class="btn-anexo">🔗 Abrir Atividade</a>`;
                }

                div.innerHTML = `
                    <span class="tag ${classeTag}" ${post.tipoBase === 'Material' ? 'style="background: var(--accent);"' : ''}>${tipoReal}</span>
                    <span class="post-data">${data}</span>
                    <h2>${post.title || 'Aviso do Professor'}</h2>
                    <p style="white-space: pre-wrap;">${post.text || post.description || ''}</p>
                    <div style="margin-top: 15px;">${anexoHtml}</div>
                `;
                containerMural.appendChild(div);
            });
        }

        const courseWorkList = materiais.result.courseWork || [];
        containerAtividades.innerHTML = '<div class="atividades-list" id="lista-atividades-dinamica"></div>';
        const listaAtividades = document.getElementById('lista-atividades-dinamica');

        if (courseWorkList.length === 0) {
            listaAtividades.innerHTML = '<p>Nenhuma atividade exigindo envio nesta turma.</p>';
        } else {
            courseWorkList.forEach(ativ => {
                let dueDateStr = 'Sem data de entrega estipulada';
                if (ativ.dueDate) {
                    const dataObj = new Date(ativ.dueDate.year, ativ.dueDate.month - 1, ativ.dueDate.day);
                    dueDateStr = 'Vence em: ' + dataObj.toLocaleDateString('pt-BR');
                }
                const divAtiv = document.createElement('div');
                divAtiv.className = 'card-atividade';
                divAtiv.onclick = () => window.open(ativ.alternateLink, '_blank'); 
                divAtiv.innerHTML = `
                    <div class="atividade-info">
                        <div class="icone-atividade" style="background: var(--accent); color: white; padding: 10px; border-radius: 50%;">
                            <span class="material-symbols-outlined">upload_file</span>
                        </div>
                        <div>
                            <h4 style="margin: 0;">${ativ.title}</h4>
                            <p style="margin: 5px 0 0 0; color: #666; font-size: 0.9rem;">${dueDateStr}</p>
                        </div>
                    </div>
                    <span class="status-badge pendente">Espaço Aberto</span>
                `;
                listaAtividades.appendChild(divAtiv);
            });
        }
    } catch (err) { console.error("Erro ao carregar mural:", err); }
}

function alternarAbaTurma(aba) {
    document.getElementById('btn-aba-mural').classList.remove('active');
    document.getElementById('btn-aba-atividades').classList.remove('active');
    document.getElementById('aba-mural').style.display = 'none';
    document.getElementById('aba-atividades').style.display = 'none';
    if (aba === 'mural') {
        document.getElementById('btn-aba-mural').classList.add('active');
        document.getElementById('aba-mural').style.display = 'block';
    } else if (aba === 'atividades') {
        document.getElementById('btn-aba-atividades').classList.add('active');
        document.getElementById('aba-atividades').style.display = 'block';
    }
}

async function abrirInfoTurma() {
    if(!cursoAtualGlobal) return;
    const modal = document.getElementById('modal-info-turma');
    const conteudo = document.getElementById('info-turma-conteudo');
    conteudo.innerHTML = '<p>Buscando detalhes do professor...</p>';
    modal.style.display = 'block';
    try {
        const response = await gapi.client.classroom.courses.teachers.list({ courseId: cursoAtualGlobal.id });
        const professores = response.result.teachers || [];
        const nomesProfessores = professores.map(p => p.profile.name.fullName).join(', ') || 'Não identificado';
        conteudo.innerHTML = `
            <div style="margin-bottom: 10px;"><strong>Turma:</strong> ${cursoAtualGlobal.name}</div>
            <div style="margin-bottom: 10px;"><strong>Disciplina/Seção:</strong> ${cursoAtualGlobal.section || 'Geral'}</div>
            <div style="margin-bottom: 10px;"><strong>Professor(es):</strong> ${nomesProfessores}</div>
        `;
    } catch (err) { conteudo.innerHTML = `<p>Sem permissão para ver dados dos professores.</p>`; }
}
function fecharInfoTurma() { document.getElementById('modal-info-turma').style.display = 'none'; }


/* =========================================
   TRANSCRIÇÃO MANUAL (BARRA LATERAL)
   ========================================= */
function abrirFerramentaTranscricao(titulo) {
    document.getElementById('btn-voltar-material').style.display = 'none';
    document.getElementById('material-titulo').innerText = titulo || 'Transcrição Manual';
    
    document.getElementById('video-container').style.display = 'none';
    document.getElementById('video-iframe').src = '';
    
    const videoPreview = document.getElementById('video-local-preview');
    if(videoPreview) {
        videoPreview.style.display = 'none';
        videoPreview.src = '';
    }
    
    document.getElementById('caixa-transcricao').style.display = 'block';
    document.getElementById('upload-wrapper').style.display = 'block';
    
    document.getElementById('badge-idioma').innerText = "";
    document.getElementById('btn-traduzir').style.display = 'none'; 
    document.getElementById('transcricao-texto').innerHTML = "Selecione um arquivo acima e clique em 'Transcrever Arquivo' para iniciar a leitura com IA.";
    document.getElementById('arquivo-upload').value = ""; 
    
    const btnEnviar = document.getElementById('btn-enviar-arquivo');
    btnEnviar.disabled = false;
    btnEnviar.onclick = () => processarUploadArquivo();
    
    navegarPara('secao-material');
}

async function processarUploadArquivo() {
    const inputArquivo = document.getElementById('arquivo-upload');
    const caixaTexto = document.getElementById('transcricao-texto');
    const btnEnviar = document.getElementById('btn-enviar-arquivo');
    const arquivo = inputArquivo.files[0];

    if (!arquivo) return alert("Por favor, selecione um arquivo.");

    const tamanhoEmMB = arquivo.size / (1024 * 1024);
    if (tamanhoEmMB > TAMANHO_MAXIMO_MB) {
        alert(`Erro: O arquivo tem ${tamanhoEmMB.toFixed(1)}MB. O limite máximo do sistema é ${TAMANHO_MAXIMO_MB}MB.`);
        inputArquivo.value = ""; 
        return;
    }

    const videoPreview = document.getElementById('video-local-preview');
    if (arquivo.type.startsWith('video/')) {
        const urlDoVideo = URL.createObjectURL(arquivo);
        videoPreview.src = urlDoVideo;
        videoPreview.style.display = 'block';
    } else {
        videoPreview.style.display = 'none';
        videoPreview.src = '';
    }

    const formData = new FormData();
    formData.append('audio', arquivo);

    caixaTexto.innerHTML = `<p><strong>Enviando e processando:</strong> ${arquivo.name} ⏳</p>`;
    btnEnviar.disabled = true;

    try {
        const resposta = await fetch('/api/transcrever', { method: 'POST', body: formData });
        const dados = await resposta.json();
        
        if (resposta.ok && !dados.erro) {
            exibirTranscricao(dados.texto, dados.idioma);
            salvarNoHistorico(arquivo.name, dados.texto, dados.idioma);
        } else {
            caixaTexto.innerHTML = `<p style="color: red;">Erro: ${dados.erro}</p>`;
        }
    } catch (erro) {
        caixaTexto.innerHTML = "<p style='color: red;'>Erro de conexão.</p>";
    } finally {
        btnEnviar.disabled = false;
    }
}

/* =========================================
   TRANSCRIÇÃO AUTOMÁTICA (DO CLASSROOM)
   ========================================= */
async function baixarETranscreverDoDrive(fileId, fileName) {
    document.getElementById('btn-voltar-material').style.display = 'inline-block';
    document.getElementById('material-titulo').innerText = 'Transcrevendo: ' + fileName;
    
    document.getElementById('video-container').style.display = 'none';
    document.getElementById('video-iframe').src = '';
    document.getElementById('upload-wrapper').style.display = 'none';
    document.getElementById('caixa-transcricao').style.display = 'block';
    
    const videoPreview = document.getElementById('video-local-preview');
    videoPreview.style.display = 'none';
    videoPreview.src = '';

    document.getElementById('badge-idioma').innerText = "";
    document.getElementById('btn-traduzir').style.display = 'none';
    
    const caixaTexto = document.getElementById('transcricao-texto');
    caixaTexto.innerHTML = `<p><strong>Passo 1/2:</strong> Buscando arquivo do professor no Google Drive... ⏳</p>`;
    
    navegarPara('secao-material');

    try {
        const token = sessionStorage.getItem('google_token');
        const driveResposta = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!driveResposta.ok) throw new Error("Acesso negado. Você pode precisar fazer login novamente para dar permissão de leitura.");
        
        const blob = await driveResposta.blob(); 
        
        if (blob.type.startsWith('video/') || fileName.toLowerCase().endsWith('.mp4') || fileName.toLowerCase().endsWith('.mov')) {
             const urlDoVideo = URL.createObjectURL(blob);
             videoPreview.src = urlDoVideo;
             videoPreview.style.display = 'block';
        }
        
        caixaTexto.innerHTML = `<p><strong>Passo 2/2:</strong> Arquivo capturado! Enviando para a Inteligência Artificial processar... 🧠⏳</p>`;
        
        const formData = new FormData();
        formData.append('audio', blob, fileName);

        const servidorResposta = await fetch('/api/transcrever', {
            method: 'POST',
            body: formData
        });
        
        const dados = await servidorResposta.json();
        
        if (servidorResposta.ok && !dados.erro) {
            exibirTranscricao(dados.texto, dados.idioma);
            salvarNoHistorico(fileName, dados.texto, dados.idioma);
        } else {
            caixaTexto.innerHTML = `<p style="color: red;">Erro na IA: ${dados.erro}</p>`;
        }

    } catch (erro) {
        console.error(erro);
        caixaTexto.innerHTML = `<p style='color: red;'>Erro: ${erro.message}</p>`;
        if(erro.message.includes("Acesso negado")) {
             setTimeout(fazerLogout, 3000);
        }
    }
}

/* =========================================
   PLAYER DO YOUTUBE (Sem transcrição)
   ========================================= */
function abrirPlayerYoutube(videoId, videoTitle) {
    document.getElementById('btn-voltar-material').style.display = 'inline-block';
    document.getElementById('material-titulo').innerText = videoTitle || 'Vídeo do YouTube';
    
    document.getElementById('upload-wrapper').style.display = 'none';
    document.getElementById('caixa-transcricao').style.display = 'none';
    
    document.getElementById('video-container').style.display = 'block';
    document.getElementById('video-iframe').src = `https://www.youtube.com/embed/${videoId}`;
    document.getElementById('btn-ver-yt').href = `https://www.youtube.com/watch?v=${videoId}`;
    
    navegarPara('secao-material');
}


/* =========================================
   EXIBIÇÃO E TRADUÇÃO
   ========================================= */
function exibirTranscricao(texto, idioma) {
    const caixaTexto = document.getElementById('transcricao-texto');
    const btnTraduzir = document.getElementById('btn-traduzir');
    const badgeIdioma = document.getElementById('badge-idioma');

    caixaTexto.innerHTML = `<p style="white-space: pre-wrap; line-height: 1.6;">${texto}</p>`;

    if (idioma && !idioma.toLowerCase().includes('pt')) {
        badgeIdioma.innerText = "(Idioma Original)";
        btnTraduzir.style.display = 'flex'; 
        btnTraduzir.onclick = () => traduzirNoNavegador(texto);
    } else {
        badgeIdioma.innerText = "(Português)";
        btnTraduzir.style.display = 'none';
    }
}

async function traduzirNoNavegador(textoOriginal) {
    const btnTraduzir = document.getElementById('btn-traduzir');
    const caixaTexto = document.getElementById('transcricao-texto');
    btnTraduzir.innerHTML = "⏳ Traduzindo...";
    btnTraduzir.disabled = true;

    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=pt&dt=t&q=${encodeURIComponent(textoOriginal)}`;
        const resposta = await fetch(url);
        const dados = await resposta.json();
        
        let textoTraduzido = "";
        dados[0].forEach(frase => { if (frase[0]) textoTraduzido += frase[0]; });

        caixaTexto.innerHTML = `
            <div style="margin-bottom: 15px;">
                <strong style="color: #4CAF50; font-size: 1.1rem;">🇧🇷 Tradução:</strong><br>
                <span style="white-space: pre-wrap; line-height: 1.6;">${textoTraduzido}</span>
            </div>
            <hr style="border: 1px solid var(--border-color); margin: 20px 0;">
            <div>
                <strong style="opacity: 0.7;">🗣️ Áudio Original:</strong><br>
                <span style="white-space: pre-wrap; line-height: 1.6; opacity: 0.8;">${textoOriginal}</span>
            </div>
        `;
        btnTraduzir.style.display = 'none'; 
    } catch (erro) {
        btnTraduzir.innerHTML = "❌ Erro. Tente de novo.";
        btnTraduzir.disabled = false;
    }
}

/* =========================================
   SISTEMA DE HISTÓRICO (Economia de Tokens)
   ========================================= */
function salvarNoHistorico(nome, texto, idioma) {
    const jaExiste = historicoTranscricoes.find(item => item.nome === nome);
    if (!jaExiste) {
        historicoTranscricoes.push({ nome, texto, idioma });
        
        // NOVO: Salva usando o email como chave para não misturar usuários
        if (usuarioLogadoEmail) {
            localStorage.setItem(
                `historico_${usuarioLogadoEmail}`, 
                JSON.stringify(historicoTranscricoes)
            );
        }
        
        atualizarUIHistorico();
    }
}

function atualizarUIHistorico() {
    const container = document.getElementById('historico-container');
    const lista = document.getElementById('lista-historico');
    
    if (historicoTranscricoes.length === 0) {
        if(container) container.style.display = 'none';
        return;
    }

    if(container) container.style.display = 'block';
    if(lista) lista.innerHTML = '';

    historicoTranscricoes.forEach((item) => {
        const btn = document.createElement('button');
        btn.className = 'btn-anexo'; 
        btn.style.cssText = 'text-align: left; background: var(--bg-main); color: var(--text-main); border: 1px solid var(--border-color); width: 100%; display: flex; justify-content: space-between; align-items: center; cursor: pointer; padding: 12px;';
        
        btn.innerHTML = `
            <span>📄 <strong>${item.nome}</strong></span>
            <span class="material-symbols-outlined" style="font-size: 1.2rem; color: var(--accent);">restore</span>
        `;
        
        btn.onclick = () => {
            document.getElementById('video-local-preview').style.display = 'none'; 
            document.getElementById('caixa-transcricao').style.display = 'block';
            exibirTranscricao(item.texto, item.idioma);
            document.getElementById('material-titulo').innerText = 'Recuperado: ' + item.nome;
            window.scrollTo({ top: document.getElementById('caixa-transcricao').offsetTop, behavior: 'smooth' });
        };
        
        if(lista) lista.appendChild(btn);
    });
}


/* ACESSIBILIDADE */
function abrirModalAcessibilidade() { document.getElementById('modal-acessibilidade').style.display = 'block'; }
function fecharModalAcessibilidade() { document.getElementById('modal-acessibilidade').style.display = 'none'; }

function configurarAcessibilidade() {
    document.getElementById('chk-escuro').onchange = (e) => {
        document.body.className = e.target.checked ? 'theme-dark' : 'theme-light';
        document.getElementById('chk-contraste').checked = false;
    };
    document.getElementById('chk-contraste').onchange = (e) => {
        document.body.className = e.target.checked ? 'theme-high-contrast' : 'theme-light';
        document.getElementById('chk-escuro').checked = false;
    };
}

let zoom = 100;
function alterarFonte(tipo) {
    zoom = (tipo === 'aumentar') ? zoom + 10 : zoom - 10;
    document.documentElement.style.fontSize = zoom + "%";
}
