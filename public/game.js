// public/game.js
const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const menuScreen = document.getElementById('menu');
const lobbyScreen = document.getElementById('lobby');
const endScreen = document.getElementById('endScreen');

// --- CARREGAMENTO DE SPRITES DAS SKINS ---
const skins = {
    raven: {
        cabeca: new Image(),
        corpo: [new Image()]
    },
    clover: {
        cabeca: new Image(),
        corpoVermelho: new Image(),
        corpoCoracao: new Image(),
        corpoBarriga: new Image()
    },
    palmeiras: {
        cabeca: new Image(),
        corpoVerde: new Image(),
        corpoBranco: new Image()
    },
    saopaulo: {
        cabeca: new Image(),
        corpoVermelho: new Image(),
        corpoPreto: new Image()
    }
};

// Ravena
skins.raven.cabeca.src = 'img/cabecaRavena.png';
skins.raven.corpo[0].src = 'img/corpoRavena.png';

// Clover
skins.clover.cabeca.src = 'img/clover_cabeca_256.png';
skins.clover.corpoVermelho.src = 'img/clover_corpo_vermelho_256.png';
skins.clover.corpoCoracao.src = 'img/clover_corpo_coracao_256.png';
skins.clover.corpoBarriga.src = 'img/clover_corpo_barriga_256.png';

// Palmeiras
skins.palmeiras.cabeca.src = 'img/palmeiras_cabeca_escudo_256.png';
skins.palmeiras.corpoVerde.src = 'img/palmeiras_corpo_verde_256.png';
skins.palmeiras.corpoBranco.src = 'img/palmeiras_corpo_branco_256.png';

// São Paulo
skins.saopaulo.cabeca.src = 'img/saopaulo_cabeca_escudo_256.png';
skins.saopaulo.corpoVermelho.src = 'img/saopaulo_corpo_vermelho_256.png';
skins.saopaulo.corpoPreto.src = 'img/saopaulo_corpo_preto_256.png';

// --- CARREGAMENTO DE ÍCONES DOS ITENS ---
const itemImgs = {
    onca: new Image(),
    lula: new Image(),
    amor: new Image(),
    dominio: new Image(),
    arma: new Image(),
    flashbang: new Image()
};

itemImgs.onca.src = 'img/onca.png';
itemImgs.lula.src = 'img/lula.png';
itemImgs.amor.src = 'img/amor.png';
itemImgs.dominio.src = 'img/dominio.png';
itemImgs.arma.src = 'img/arma.png';
itemImgs.flashbang.src = 'img/flashbang.png';

let myRoom = '';
let meuNick = '';
let estadoAtual = null;

let textoCentro = '';
let timerCentro = null;
let confetes = []; // Lista de confetes para animação

// Controles de Efeitos de Itens
let efeitoAlisaPelo = false;
let toquesFaltantesE = 10;

let opacidadeLula = 0;

let efeitoHipnose = false;

let opacidadeFlash = 0; // Controle de opacidade da tela branca
let tempoTerminoCegueira = 0; // Marca até quando a tela deve ficar 100% branca



// Recupera o nick salvo no computador do jogador (se existir)
const nickInput = document.getElementById('nick');
if (localStorage.getItem('snakeNick')) {
    nickInput.value = localStorage.getItem('snakeNick');
}

const LARGURA_MAPA = 1500;
const ALTURA_MAPA = 1500;

// ==========================================
// FUNÇÕES DE INTERFACE
// ==========================================

function criarSala() {
    meuNick = document.getElementById('nick').value;
    if (meuNick) {
        localStorage.setItem('snakeNick', meuNick);
        socket.emit('createRoom', meuNick);
    } else {
        alert("Digite um Nick primeiro!");
    }
}

function entrarSala() {
    meuNick = document.getElementById('nick').value;
    let codigo = document.getElementById('roomCodeInput').value;

    if (meuNick && codigo) {
        localStorage.setItem('snakeNick', meuNick);
        socket.emit('joinRoom', codigo, meuNick);
    } else {
        alert("Digite um Nick e um Código de 3 dígitos!");
    }
}

// NOVA FUNÇÃO: Troca de Skin
function mudarSkin(cor, btnElement) {
    socket.emit('changeSkin', myRoom, cor);

    // Atualiza o visual dos botões
    document.querySelectorAll('.skin-btn').forEach(btn => btn.classList.remove('selected'));
    btnElement.classList.add('selected');
}

function iniciarJogo() {
    socket.emit('startGame', myRoom);
}

function pedirRevanche() {
    endScreen.style.display = 'none';
    canvas.style.display = 'none';
    lobbyScreen.style.display = 'flex';
    confetes = [];

    socket.emit('rematch', myRoom);
}

function sairDaSala() {
    window.location.reload();
}

function gerarConfetes() {
    confetes = [];
    for (let i = 0; i < 150; i++) {
        confetes.push({
            x: canvas.width / 2,
            y: canvas.height / 2 + 50,
            vx: (Math.random() - 0.5) * 20,
            vy: (Math.random() - 1) * 25,
            color: Math.random() > 0.5 ? '#5DB971' : '#D46A84',
            size: Math.random() * 8 + 4
        });
    }
}

// ==========================================
// EVENTOS DO SOCKET
// ==========================================

socket.on('erro', (msg) => {
    alert(msg);
});

socket.on('ataqueAlisaPelo', () => {
    efeitoAlisaPelo = true;
    toquesFaltantesE = 10;
});

socket.on('jumpscareLula', () => {
    opacidadeLula = 1.0; // Inicia com 100% de visibilidade
});

socket.on('efeitoAmor', () => {
    efeitoHipnose = true;
    setTimeout(() => {
        efeitoHipnose = false;
    }, 3000); // Apaga o efeito no ecrã após os mesmos 3 segundos
});

socket.on('efeitoFlashbang', () => {
    console.log("Fui atingido pela Flashbang!");
    opacidadeFlash = 1.0;

    // Define que a cegueira total vai durar exatamente 5 segundos a partir de agora
    tempoTerminoCegueira = Date.now() + 5000;
});

socket.on('joinedLobby', (roomCode) => {
    myRoom = roomCode;
    menuScreen.style.display = 'none';
    endScreen.style.display = 'none';
    canvas.style.display = 'none';
    lobbyScreen.style.display = 'flex';
});

socket.on('updateLobby', (data) => {
    document.getElementById('lobbyCode').innerText = data.code;
    document.getElementById('player1Name').innerText = data.player1;
    document.getElementById('player2Name').innerText = data.player2;

    let startBtn = document.getElementById('startBtn');
    if (socket.id === data.adminId && data.totalPlayers === 2) {
        startBtn.style.display = 'block';
    } else {
        startBtn.style.display = 'none';
    }
});

socket.on('startCountdown', () => {
    lobbyScreen.style.display = 'none';
    canvas.style.display = 'block';
    redimensionarCanvas();

    let contagem = 5;
    textoCentro = String(contagem);

    timerCentro = setInterval(() => {
        contagem--;
        if (contagem > 0) {
            textoCentro = String(contagem);
        } else if (contagem === 0) {
            textoCentro = "JÁ!";
        } else {
            textoCentro = '';
            clearInterval(timerCentro);
        }
    }, 1000);
});

socket.on('pointScored', (nickVencedor) => {
    textoCentro = `PONTO: ${nickVencedor.toUpperCase()}`;
    setTimeout(() => {
        textoCentro = '';
    }, 3000);
});

socket.on('matchOver', (vencedorNick) => {
    endScreen.style.display = 'flex';
    document.getElementById('vencedorTexto').innerText = `${vencedorNick} VENCEU!`;
    gerarConfetes();
});

socket.on('gameState', (state) => {
    estadoAtual = state;
});

// ==========================================
// CONTROLES E CÂMERA
// ==========================================

canvas.addEventListener('mousemove', (e) => {
    let centroX = canvas.width / 2;
    let centroY = canvas.height / 2;
    let targetAngle = Math.atan2(e.clientY - centroY, e.clientX - centroX);
    socket.emit('mouseMove', myRoom, targetAngle);
});

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') socket.emit('dash', myRoom, true);

    // --- LIVRAR-SE DO ALISA MEU PELO ---
    if ((e.code === 'KeyE' || e.key === 'e' || e.key === 'E') && efeitoAlisaPelo) {
        toquesFaltantesE--;
        if (toquesFaltantesE <= 0) {
            efeitoAlisaPelo = false; // Desliga o telefone quando chega a zero
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') socket.emit('dash', myRoom, false);
});

// Impede o menu do rato de abrir e envia a ação de usar item
window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    socket.emit('useItem', myRoom);
});

function redimensionarCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', redimensionarCanvas);
redimensionarCanvas();

// ==========================================
// RENDERIZAÇÃO 
// ==========================================

function desenharTela() {
    requestAnimationFrame(desenharTela);

    // --- TRAVA DE SEGURANÇA ABSOLUTA ---
    // Limpa qualquer zoom, rotação ou transparência que tenha travado no quadro anterior
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1.0;

    if (!estadoAtual || !estadoAtual.players[socket.id] || canvas.style.display === 'none') return;

    let meuJogador = estadoAtual.players[socket.id];

    // --- ZOOM DO JOGO (Calcula a câmera ANTES de desenhar o mapa e os tiros) ---
    // Zoom dinâmico: começa em 1.5 e vai afastando conforme a pontuação sobe (mínimo de 0.6)
    let zoom = Math.max(0.6, 1.5 - (meuJogador.score * 0.015));

    let cameraX = meuJogador.x - (canvas.width / 2) / zoom;
    let cameraY = meuJogador.y - (canvas.height / 2) / zoom;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    try {
        ctx.scale(zoom, zoom); // Aplica o zoom no mundo do jogo
    } finally { }

    // Grade
    ctx.strokeStyle = '#1a0033';
    ctx.lineWidth = 2;
    for (let x = 0; x <= LARGURA_MAPA; x += 50) {
        ctx.beginPath(); ctx.moveTo(x - cameraX, -cameraY); ctx.lineTo(x - cameraX, ALTURA_MAPA - cameraY); ctx.stroke();
    }
    for (let y = 0; y <= ALTURA_MAPA; y += 50) {
        ctx.beginPath(); ctx.moveTo(-cameraX, y - cameraY); ctx.lineTo(LARGURA_MAPA - cameraX, y - cameraY); ctx.stroke();
    }

    // Borda
    ctx.strokeStyle = '#8A2BE2';
    ctx.lineWidth = 5;
    ctx.strokeRect(-cameraX, -cameraY, LARGURA_MAPA, ALTURA_MAPA);

    // Comidas
    if (estadoAtual.foods) {
        for (let food of estadoAtual.foods) {
            let raio = (food.value === 0.25) ? 4 : 8;
            let x = food.x - cameraX; let y = food.y - cameraY;
            let grad = ctx.createRadialGradient(x, y, 0, x, y, raio * 1.5);
            grad.addColorStop(0, 'rgba(93, 185, 113, 0.9)');
            grad.addColorStop(0.4, 'rgba(93, 185, 113, 0.4)');
            grad.addColorStop(1, 'rgba(93, 185, 113, 0)');
            ctx.beginPath(); ctx.fillStyle = grad; ctx.arc(x, y, raio * 1.5, 0, Math.PI * 2); ctx.fill();
        }
    }

    // Itens no chão
    if (estadoAtual.items) {
        for (let item of estadoAtual.items) {
            let x = item.x - cameraX;
            let y = item.y - cameraY;

            let img = itemImgs[item.type];
            if (img && img.complete) {
                ctx.drawImage(img, x - 15, y - 15, 30, 30);

                ctx.beginPath();
                ctx.arc(x, y, 18, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    }

    // --- DESENHAR TIROS NO MAPA (Posição corrigida: dentro do Zoom e após cameraX) ---
    if (estadoAtual.projectiles && Array.isArray(estadoAtual.projectiles)) {
        for (let proj of estadoAtual.projectiles) {
            let px = proj.x - cameraX;
            let py = proj.y - cameraY;

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(proj.angle);

            // Brilho de energia do projétil
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#FF4500';

            // Corpo do projétil
            ctx.fillStyle = '#FF8C00';
            ctx.fillRect(-10, -3, 16, 6);

            // Ponta do projétil
            ctx.fillStyle = '#FFFF00';
            ctx.fillRect(-2, -2, 10, 4);

            ctx.restore();
        }
    }

    // --- DESENHAR EXPANSÃO DE DOMÍNIO NO MAPA ---
    if (estadoAtual.domains && Array.isArray(estadoAtual.domains)) {
        for (let dom of estadoAtual.domains) {
            let x = dom.x - cameraX;
            let y = dom.y - cameraY;
            let time = Date.now() * 0.001;

            ctx.save();
            ctx.translate(x, y);

            let pulso = Math.sin(time * 3) * 15;
            let raioBase = dom.radius + pulso;

            ctx.globalCompositeOperation = 'lighter';

            // Camada 1: Roxo
            let grad1 = ctx.createRadialGradient(0, 0, 0, 0, 0, raioBase);
            grad1.addColorStop(0, 'rgba(75, 0, 130, 0.7)');
            grad1.addColorStop(0.6, 'rgba(75, 0, 130, 0.3)');
            grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = grad1;
            ctx.beginPath();
            ctx.arc(0, 0, raioBase, 0, Math.PI * 2);
            ctx.fill();

            // Camada 2: Azul
            ctx.save();
            ctx.rotate(time * 0.5);
            let grad2 = ctx.createRadialGradient(30, 0, 0, 30, 0, raioBase * 0.8);
            grad2.addColorStop(0, 'rgba(0, 191, 255, 0.5)');
            grad2.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = grad2;
            ctx.beginPath();
            ctx.arc(30, 0, raioBase * 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Camada 3: Vermelho
            ctx.save();
            ctx.rotate(-time * 0.7);
            let grad3 = ctx.createRadialGradient(-30, 20, 0, -30, 20, raioBase * 0.85);
            grad3.addColorStop(0, 'rgba(220, 20, 60, 0.5)');
            grad3.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = grad3;
            ctx.beginPath();
            ctx.arc(-30, 20, raioBase * 0.85, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.globalCompositeOperation = 'source-over';

            ctx.beginPath();
            ctx.arc(0, 0, dom.radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(138, 43, 226, 0.6)';
            ctx.lineWidth = 4 + Math.sin(time * 6) * 2;
            ctx.stroke();

            ctx.restore();
        }
    }

    // 5. DESENHA OS JOGADORES
    for (let id in estadoAtual.players) {
        let player = estadoAtual.players[id];
        let corPrincipal = player.skin || '#5DB971';
        let angulo = player.angle || 0;

        if (corPrincipal === 'raven' && skins.raven.cabeca.complete) {
            let skinData = skins.raven;
            for (let i = player.body.length - 1; i >= 0; i--) {
                let p = player.body[i];
                let proporcao = 1 - (i / player.body.length);
                let tamanhoCorpo = (3.5 + (6.5 * proporcao)) * 2.5;

                ctx.save();
                ctx.translate(p.x - cameraX, p.y - cameraY);
                ctx.drawImage(skinData.corpo[0], -tamanhoCorpo / 2, -tamanhoCorpo / 2, tamanhoCorpo, tamanhoCorpo);
                ctx.restore();
            }

            ctx.save();
            ctx.translate(player.x - cameraX, player.y - cameraY);
            ctx.rotate(angulo);

            if (Math.abs(angulo) > Math.PI / 2) {
                ctx.scale(1, -1);
            }

            let tamanhoCabeca = 32;
            ctx.drawImage(skinData.cabeca, -tamanhoCabeca / 2, -tamanhoCabeca / 2, tamanhoCabeca, tamanhoCabeca);
            ctx.restore();
        } else if (corPrincipal === 'clover' && skins.clover.cabeca.complete) {
            let skinData = skins.clover;
            for (let i = player.body.length - 1; i >= 0; i--) {
                let p = player.body[i];
                let proporcao = 1 - (i / player.body.length);
                let tamanhoCorpo = (3.5 + (6.5 * proporcao)) * 2.6;

                let imgCorpo;
                if (i === 2) imgCorpo = skinData.corpoCoracao;
                else if (i === 3) imgCorpo = skinData.corpoBarriga;
                else imgCorpo = skinData.corpoVermelho;

                ctx.save();
                ctx.translate(p.x - cameraX, p.y - cameraY);
                if (i === 2 || i === 3) ctx.rotate(angulo);
                ctx.drawImage(imgCorpo, -tamanhoCorpo / 2, -tamanhoCorpo / 2, tamanhoCorpo, tamanhoCorpo);
                ctx.restore();
            }

            ctx.save();
            ctx.translate(player.x - cameraX, player.y - cameraY);
            ctx.rotate(angulo);
            let tamanhoCabeca = 34;
            ctx.drawImage(skinData.cabeca, -tamanhoCabeca / 2, -tamanhoCabeca / 2, tamanhoCabeca, tamanhoCabeca);
            ctx.restore();
        } else if (
            corPrincipal === 'palmeiras' &&
            skins.palmeiras.cabeca.complete &&
            skins.palmeiras.corpoVerde.complete &&
            skins.palmeiras.corpoBranco.complete
        ) {
            let skinData = skins.palmeiras;
            for (let i = player.body.length - 1; i >= 0; i--) {
                let p = player.body[i];
                let proporcao = 1 - (i / player.body.length);
                let tamanhoCorpo = (3.5 + (6.5 * proporcao)) * 2.5;

                let imgCorpo = (i >= 3 && i % 2 !== 0) ? skinData.corpoBranco : skinData.corpoVerde;

                ctx.save();
                ctx.translate(p.x - cameraX, p.y - cameraY);
                ctx.drawImage(imgCorpo, -tamanhoCorpo / 2, -tamanhoCorpo / 2, tamanhoCorpo, tamanhoCorpo);
                ctx.restore();
            }

            ctx.save();
            ctx.translate(player.x - cameraX, player.y - cameraY);
            ctx.rotate(angulo);
            let tamanhoCabeca = 32;
            ctx.drawImage(skinData.cabeca, -tamanhoCabeca / 2, -tamanhoCabeca / 2, tamanhoCabeca, tamanhoCabeca);
            ctx.restore();
        } else if (
            corPrincipal === 'saopaulo' &&
            skins.saopaulo.cabeca.complete &&
            skins.saopaulo.corpoVermelho.complete &&
            skins.saopaulo.corpoPreto.complete
        ) {
            let skinData = skins.saopaulo;
            for (let i = player.body.length - 1; i >= 0; i--) {
                let p = player.body[i];
                let proporcao = 1 - (i / player.body.length);
                let tamanhoCorpo = (3.5 + (6.5 * proporcao)) * 2.5;

                let imgCorpo = (i % 2 === 0) ? skinData.corpoVermelho : skinData.corpoPreto;

                ctx.save();
                ctx.translate(p.x - cameraX, p.y - cameraY);
                ctx.drawImage(imgCorpo, -tamanhoCorpo / 2, -tamanhoCorpo / 2, tamanhoCorpo, tamanhoCorpo);
                ctx.restore();
            }

            ctx.save();
            ctx.translate(player.x - cameraX, player.y - cameraY);
            ctx.rotate(angulo);
            let tamanhoCabeca = 36;
            ctx.drawImage(skinData.cabeca, -tamanhoCabeca / 2, -tamanhoCabeca / 2, tamanhoCabeca, tamanhoCabeca);
            ctx.restore();
        } else {
            let corReal = ['raven', 'clover', 'palmeiras', 'saopaulo'].includes(corPrincipal)
                ? '#5DB971' : corPrincipal;

            ctx.shadowBlur = 10;
            ctx.shadowColor = corReal;

            for (let i = 0; i < player.body.length; i++) {
                let p = player.body[i];
                let proporcao = 1 - (i / player.body.length);
                let raioCorpo = 3.5 + (6.5 * proporcao);

                ctx.beginPath();
                ctx.fillStyle = corReal;
                ctx.arc(p.x - cameraX, p.y - cameraY, raioCorpo, 0, Math.PI * 2);
                ctx.fill();
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.stroke();
            }

            ctx.beginPath();
            ctx.fillStyle = corReal;
            ctx.arc(player.x - cameraX, player.y - cameraY, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.shadowBlur = 0;
        }

        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(player.nick, player.x - cameraX, player.y - cameraY - 22);
    }

    ctx.restore(); // Desativa o zoom para desenhar a interface de usuário (HUD)

    // --- INVENTÁRIO (Canto inferior direito) ---
    let invX = canvas.width - 80;
    let invY = canvas.height - 80;
    let raioInv = 45;

    ctx.fillStyle = 'rgba(25, 25, 25, 0.85)';
    ctx.beginPath();
    ctx.arc(invX, invY, raioInv, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#8A2BE2';
    ctx.stroke();

    if (meuJogador.inventory) {
        let img = itemImgs[meuJogador.inventory];
        if (img && img.complete) {
            ctx.drawImage(img, invX - 25, invY - 25, 50, 50);
        }

        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("USE (M2)", invX, invY + 35);
    }

    // Placar
    ctx.fillStyle = 'rgba(31, 34, 31, 0.8)';
    ctx.fillRect(canvas.width / 2 - 150, 15, 300, 45);
    ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    let jogadores = Object.values(estadoAtual.players);
    if (jogadores.length >= 2) {
        let meuPlayer = estadoAtual.players[socket.id];
        let inimigoId = Object.keys(estadoAtual.players).find(id => id !== socket.id);
        let inimigo = estadoAtual.players[inimigoId];

        ctx.fillStyle = '#5DB971'; ctx.fillText(`${meuPlayer.nick}: ${meuPlayer.wins || 0}`, canvas.width / 2 - 70, 37);
        ctx.fillStyle = 'white'; ctx.fillText('VS', canvas.width / 2, 37);
        ctx.fillStyle = '#D46A84'; ctx.fillText(`${inimigo.wins || 0} :${inimigo.nick}`, canvas.width / 2 + 70, 37);
    } else {
        ctx.fillStyle = '#E0E0E0'; ctx.fillText('Aguardando...', canvas.width / 2, 37);
    }

    // Animação de Ponto ou Contagem
    if (textoCentro) {
        if (String(textoCentro).includes("PONTO")) {
            ctx.fillStyle = 'rgba(31, 34, 31, 0.9)';
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(canvas.width / 2 - 120, 75, 240, 45, 22);
                ctx.fill();
                ctx.strokeStyle = '#D46A84'; ctx.lineWidth = 2; ctx.stroke();
            } else {
                ctx.fillRect(canvas.width / 2 - 120, 75, 240, 45);
            }

            ctx.fillStyle = '#E0E0E0';
            ctx.font = 'bold 18px sans-serif';
            ctx.fillText(textoCentro, canvas.width / 2, 97);
        } else {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, canvas.height / 2 - 60, canvas.width, 120);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 80px sans-serif';
            ctx.fillText(textoCentro, canvas.width / 2, canvas.height / 2);
        }
    }

    if (endScreen.style.display === 'flex' && confetes.length > 0) {
        for (let c of confetes) {
            c.x += c.vx;
            c.y += c.vy;
            c.vy += 0.5;

            ctx.fillStyle = c.color;
            ctx.fillRect(c.x, c.y, c.size, c.size);
        }
    }

    // EFEITO VISUAL: ALISA MEU PELO
    if (efeitoAlisaPelo) {
        let phoneW = 320;
        let phoneH = 500;
        let px = (canvas.width / 2) - (phoneW / 2);
        let py = (canvas.height / 2) - (phoneH / 2);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#1A1A1A';
        if (ctx.roundRect) {
            ctx.beginPath(); ctx.roundRect(px, py, phoneW, phoneH, 30); ctx.fill();
        } else {
            ctx.fillRect(px, py, phoneW, phoneH);
        }
        ctx.strokeStyle = '#333'; ctx.lineWidth = 6; ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText("ALISA MEU PELO", canvas.width / 2, py + 60);

        ctx.font = '18px sans-serif'; ctx.fillStyle = '#FF4C4C';
        ctx.fillText("SPAMME A TECLA 'E' !!", canvas.width / 2, py + 95);

        let barraW = 260;
        ctx.fillStyle = '#333'; ctx.fillRect(px + 30, py + 120, barraW, 20);
        ctx.fillStyle = '#5DB971';
        let progresso = 1 - (toquesFaltantesE / 10);
        ctx.fillRect(px + 30, py + 120, barraW * progresso, 20);

        let imgOnca = itemImgs.onca;
        if (imgOnca && imgOnca.complete) {
            ctx.drawImage(imgOnca, px + 30, py + 160, 260, 260);
        }

        ctx.fillStyle = '#D46A84';
        ctx.beginPath(); ctx.arc(canvas.width / 2, py + 450, 25, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'white'; ctx.font = 'bold 24px sans-serif';
        ctx.fillText("E", canvas.width / 2, py + 458);
    }

    // EFEITO VISUAL: JUMPSCARE LULA
    if (opacidadeLula > 0) {
        let imgLula = itemImgs.lula;
        if (imgLula && imgLula.complete) {
            ctx.save();
            ctx.globalAlpha = opacidadeLula;

            let tamanhoSusto = Math.min(canvas.width, canvas.height) * 0.9;
            let sx = (canvas.width / 2) - (tamanhoSusto / 2);
            let sy = (canvas.height / 2) - (tamanhoSusto / 2);

            ctx.drawImage(imgLula, sx, sy, tamanhoSusto, tamanhoSusto);
            ctx.restore();
        }

        opacidadeLula -= 0.015;
        if (opacidadeLula < 0) opacidadeLula = 0;
    }

    // EFEITO VISUAL: POÇÃO DO AMOR
    if (efeitoHipnose) {
        ctx.fillStyle = 'rgba(255, 105, 180, 0.25)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#FF69B4';
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("HIPNOTIZADO! A SEGUIR O INIMIGO...", canvas.width / 2, 100);
    }

    // --- EFEITO VISUAL: FLASHBANG ---
    if (opacidadeFlash > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${opacidadeFlash})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Só começa a reduzir a opacidade DEPOIS que passarem os 5 segundos
        if (Date.now() > tempoTerminoCegueira) {
            opacidadeFlash -= 0.01; // Velocidade do fade-out após os 5 segundos (dura ~1.6s para sumir totalmente)
            if (opacidadeFlash < 0) opacidadeFlash = 0;
        }
    }
}
requestAnimationFrame(desenharTela);
