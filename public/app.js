// CONFIGURAÇÕES
const CLIENT_ID = '1056484806122-rhmdjfl6njumsj6sjb6fo5rh4ba1jvgt.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/classroom.courses.readonly ' + 
               'https://www.googleapis.com/auth/classroom.announcements.readonly ' + 
               'https://www.googleapis.com/auth/classroom.coursework.me.readonly ' +
               'https://www.googleapis.com/auth/classroom.rosters.readonly ' +
               'https://www.googleapis.com/auth/userinfo.profile ' + 
               'https://www.googleapis.com/auth/userinfo.email';

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
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
}

function navegarPara(idSecao, event) {
    if(event) event.preventDefault(); 

    document.querySelectorAll('.content-section').forEach(sec => sec.style.display = 'none');
    document.getElementById(idSecao).style.display = 'block';
    
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    if(event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
}

/* LOGOUT */
function fazerLogout() {
    const token = gapi.client.getToken();
    sessionStorage.removeItem('google_token');

    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token, () => {
            window.location.reload();
        });
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
        
        if (perfil.picture) {
            const imgEl = document.getElementById('perfil-foto');
            imgEl.src = perfil.picture;
            imgEl.style.display = 'inline-block';
            document.getElementById('perfil-icone-fallback').style.display = 'none';
        }
    } catch (err) {
        console.error('Erro ao carregar perfil:', err);
        document.getElementById('perfil-nome').innerText = 'Erro ao carregar perfil';
    }
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

            gapi.client.classroom.courses.teachers.list({ courseId: curso.id })
                .then(res => {
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
                })
                .catch(err => console.log("Sem permissão ou erro ao buscar foto da turma", curso.id));
        });
    } catch (err) {
        console.error("Erro ao carregar turmas na API:", err);
        if (err.status === 401 || (err.result && err.result.error && err.result.error.code === 401)) {
            sessionStorage.removeItem('google_token');
            window.location.reload();
        } else {
            container.innerHTML = '<p>Erro ao carregar turmas. Tente fazer login novamente.</p>';
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
                        // Agora todos os botões de anexo direcionam para a ferramenta local (se for vídeo/áudio)
                        if (anexo.youtubeVideo) {
                            anexoHtml += `<button class="btn-anexo" style="margin-right: 10px;" onclick="abrirFerramentaTranscricao('${post.title || 'Material da Aula'}')">🎙️ Transcrever Arquivo Local</button>`;
                        } else if (anexo.driveFile) {
                            const file = anexo.driveFile.driveFile;
                            anexoHtml += `<a href="${file.alternateLink}" target="_blank" class="btn-anexo" style="margin-right: 10px; display: inline-block;">📄 Abrir ${file.title || 'Arquivo'}</a>`;
                        } else if (anexo.link) {
                            anexoHtml += `<a href="${anexo.link.url}" target="_blank" class="btn-anexo" style="margin-right: 10px; display: inline-block;">🔗 Abrir Link</a>`;
                        } else if (anexo.form) {
                            anexoHtml += `<a href="${anexo.form.formUrl}" target="_blank" class="btn-anexo" style="margin-right: 10px; display: inline-block;">📝 Abrir Formulário</a>`;
                        }
                    });
                } else if (post.alternateLink && post.tipoBase === 'Material') {
                    anexoHtml = `<a href="${post.alternateLink}" target="_blank" class="btn-anexo">🔗 Abrir Atividade no Classroom</a>`;
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
                    <span class="status-badge pendente">Espaço para Envio Aberto</span>
                `;
                listaAtividades.appendChild(divAtiv);
            });
        }
    } catch (err) {
        console.error("Erro ao carregar mural:", err);
    }
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
            <div style="margin-bottom: 10px;"><strong>Sala:</strong> ${cursoAtualGlobal.room || 'Não informada'}</div>
            <div style="margin-bottom: 10px; border-top: 1px solid #ccc; padding-top: 10px; margin-top: 15px;">
                <strong>Descrição da Turma:</strong><br>
                ${cursoAtualGlobal.descriptionHeading || cursoAtualGlobal.description || 'Nenhuma descrição adicionada.'}
            </div>
        `;
    } catch (err) {
        conteudo.innerHTML = `<p>Você precisa dar a permissão ao Google para ver os dados dos professores.</p>`;
    }
}

function fecharInfoTurma() { document.getElementById('modal-info-turma').style.display = 'none'; }


/* =========================================
   SISTEMA DE UPLOAD E TRANSCRIÇÃO DE ARQUIVOS
   ========================================= */

// Função que abre a tela de upload
function abrirFerramentaTranscricao(titulo) {
    document.getElementById('material-titulo').innerText = titulo || 'Ferramenta de Transcrição';
    
    const btnTraduzir = document.getElementById('btn-traduzir');
    const caixaTexto = document.getElementById('transcricao-texto');
    const badgeIdioma = document.getElementById('badge-idioma');
    const inputArquivo = document.getElementById('arquivo-upload');
    const btnEnviar = document.getElementById('btn-enviar-arquivo');
    
    badgeIdioma.innerText = "";
    btnTraduzir.style.display = 'none'; 
    caixaTexto.innerHTML = "Selecione um arquivo acima e clique em 'Transcrever Arquivo' para iniciar a leitura com IA.";
    inputArquivo.value = ""; 
    
    btnEnviar.disabled = false;
    btnEnviar.onclick = () => processarUploadArquivo();
    
    navegarPara('secao-material');
}

// Faz o upload real do arquivo para o servidor via form-data
async function processarUploadArquivo() {
    const inputArquivo = document.getElementById('arquivo-upload');
    const caixaTexto = document.getElementById('transcricao-texto');
    const btnEnviar = document.getElementById('btn-enviar-arquivo');
    const arquivo = inputArquivo.files[0];

    if (!arquivo) {
        alert("Por favor, selecione um arquivo de áudio ou vídeo no seu computador primeiro.");
        return;
    }

    const formData = new FormData();
    formData.append('audio', arquivo);

    // Aviso acessível para leitores de tela devido ao aria-live no HTML
    caixaTexto.innerHTML = `<p><strong>Enviando e processando:</strong> ${arquivo.name}.<br>Isso pode levar alguns instantes. Por favor, aguarde... ⏳</p>`;
    btnEnviar.disabled = true;
    btnEnviar.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">hourglass_empty</span> Processando...`;

    try {
        const resposta = await fetch('/api/transcrever', {
            method: 'POST',
            body: formData
        });
        const dados = await resposta.json();
        
        if (resposta.ok && !dados.erro) {
            exibirTranscricao(dados.texto, dados.idioma);
        } else {
            caixaTexto.innerHTML = `<p style="color: red;">Erro: ${dados.erro}</p>`;
        }
    } catch (erro) {
        console.error("Erro na requisição:", erro);
        caixaTexto.innerHTML = "<p style='color: red;'>Erro de conexão com o servidor. O arquivo pode ser muito grande ou a rede falhou.</p>";
    } finally {
        btnEnviar.disabled = false;
        btnEnviar.innerHTML = `<span class="material-symbols-outlined" aria-hidden="true">upload</span> Transcrever Arquivo`;
    }
}

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
                <strong style="color: #4CAF50; font-size: 1.1rem;">🇧🇷 Tradução (Automática):</strong><br>
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
        console.error(erro);
        btnTraduzir.innerHTML = "❌ Erro. Tente de novo.";
        btnTraduzir.disabled = false;
    }
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
