// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const LARGURA_MAPA = 1500;
const ALTURA_MAPA = 1500;
const rooms = {};

function gerarComida() {
    let foods = [];
    for (let i = 0; i < 100; i++) {
        foods.push({
            x: Math.random() * LARGURA_MAPA,
            y: Math.random() * ALTURA_MAPA,
            value: 1
        });
    }
    return foods;
}

function criarJogador(nick) {
    return {
        nick: nick,
        skin: '#5DB971',
        x: 200 + Math.random() * (LARGURA_MAPA - 400),
        y: 200 + Math.random() * (ALTURA_MAPA - 400),
        angle: 0,
        targetAngle: 0,
        speed: 3,
        history: [],
        body: [],
        score: 1,
        isBoosting: false,
        wins: 0,
        inventory: null,
        isFrozen: false,
        isHypnotized: false,
        hypnotizerId: null
    };
}

io.on('connection', (socket) => {
    console.log('Jogador conectado:', socket.id);

    socket.on('createRoom', (nick) => {
        let roomCode = Math.floor(100 + Math.random() * 900).toString();
        socket.join(roomCode);

        rooms[roomCode] = {
            code: roomCode,
            adminId: socket.id,
            status: 'LOBBY',
            players: {},
            foods: gerarComida(),
            items: [],
            domains: [],
            projectiles: []
        };

        rooms[roomCode].players[socket.id] = criarJogador(nick);
        socket.emit('joinedLobby', roomCode);
        io.to(roomCode).emit('updateLobby', obterDadosLobby(roomCode));
    });

    socket.on('joinRoom', (roomCode, nick) => {
        if (rooms[roomCode] && Object.keys(rooms[roomCode].players).length < 2 && rooms[roomCode].status === 'LOBBY') {
            socket.join(roomCode);
            rooms[roomCode].players[socket.id] = criarJogador(nick);

            if (Object.keys(rooms[roomCode].players).length === 2) {
                rooms[roomCode].players[socket.id].skin = '#D46A84';
            }

            socket.emit('joinedLobby', roomCode);
            io.to(roomCode).emit('updateLobby', obterDadosLobby(roomCode));
        } else {
            socket.emit('erro', 'Sala cheia, código inválido ou a partida já começou!');
        }
    });

    socket.on('changeSkin', (roomCode, novaSkin) => {
        if (rooms[roomCode] && rooms[roomCode].players[socket.id] && rooms[roomCode].status === 'LOBBY') {
            rooms[roomCode].players[socket.id].skin = novaSkin;
        }
    });

    socket.on('startGame', (roomCode) => {
        let room = rooms[roomCode];
        if (room && room.adminId === socket.id && Object.keys(room.players).length === 2) {
            room.foods = gerarComida();
            room.items = [];

            for (let id in room.players) {
                let p = room.players[id];
                p.x = 200 + Math.random() * (LARGURA_MAPA - 400);
                p.y = 200 + Math.random() * (ALTURA_MAPA - 400);
                p.history = [];
                p.body = [];
                p.score = 1;
                p.isBoosting = false;
                p.inventory = null;
            }
            room.domains = [];
            room.projectiles = [];

            room.status = 'COUNTDOWN';
            io.to(roomCode).emit('startCountdown');

            setTimeout(() => {
                room.status = 'PLAYING';
            }, 5000);
        }
    });

    socket.on('rematch', (roomCode) => {
        if (rooms[roomCode]) {
            rooms[roomCode].status = 'LOBBY';
            rooms[roomCode].items = [];
            rooms[roomCode].domains = [];
            rooms[roomCode].projectiles = [];

            for (let id in rooms[roomCode].players) {
                rooms[roomCode].players[id].wins = 0;
                rooms[roomCode].players[id].inventory = null;
            }
            rooms[roomCode].foods = gerarComida();
            io.to(roomCode).emit('updateLobby', obterDadosLobby(roomCode));
        }
    });

    socket.on('mouseMove', (roomCode, targetAngle) => {
        if (rooms[roomCode] && rooms[roomCode].players[socket.id] && rooms[roomCode].status === 'PLAYING') {
            rooms[roomCode].players[socket.id].targetAngle = targetAngle;
        }
    });

    socket.on('dash', (roomCode, estadoDoBotao) => {
        if (rooms[roomCode] && rooms[roomCode].players[socket.id] && rooms[roomCode].status === 'PLAYING') {
            let player = rooms[roomCode].players[socket.id];
            player.isBoosting = (estadoDoBotao === true && player.score > 3);
        }
    });

    socket.on('useItem', (roomCode) => {
        let room = rooms[roomCode];
        if (room && room.players[socket.id] && room.status === 'PLAYING') {
            let player = room.players[socket.id];

            if (player.inventory) {
                if (player.inventory === 'onca') {
                    let enemyId = Object.keys(room.players).find(id => id !== socket.id);
                    if (enemyId) io.to(enemyId).emit('ataqueAlisaPelo');
                } 
                else if (player.inventory === 'lula') {
                    let enemyId = Object.keys(room.players).find(id => id !== socket.id);
                    if (enemyId && room.players[enemyId]) {
                        let inimigo = room.players[enemyId];
                        let tamanhoRoubado = inimigo.score * 0.5;
                        inimigo.score = Math.max(1, inimigo.score - tamanhoRoubado);
                        player.score += (tamanhoRoubado / 2);
                        io.to(enemyId).emit('jumpscareLula');
                    }
                } 
                else if (player.inventory === 'amor') {
                    let enemyId = Object.keys(room.players).find(id => id !== socket.id);
                    if (enemyId && room.players[enemyId]) {
                        let inimigo = room.players[enemyId];
                        inimigo.isHypnotized = true;
                        inimigo.hypnotizerId = socket.id;
                        io.to(enemyId).emit('efeitoAmor');

                        setTimeout(() => {
                            if (rooms[roomCode] && rooms[roomCode].players[enemyId]) {
                                rooms[roomCode].players[enemyId].isHypnotized = false;
                                rooms[roomCode].players[enemyId].hypnotizerId = null;
                            }
                        }, 3000);
                    }
                } 
                else if (player.inventory === 'dominio') {
                    if (!room.domains) room.domains = [];
                    let novoDominio = {
                        id: Date.now(),
                        x: player.x,
                        y: player.y,
                        radius: 200,
                        ownerId: socket.id
                    };
                    room.domains.push(novoDominio);

                    setTimeout(() => {
                        if (room && room.domains) {
                            room.domains = room.domains.filter(d => d.id !== novoDominio.id);
                        }
                    }, 10000);
                } 
                else if (player.inventory === 'arma') {
                    if (!room.projectiles) room.projectiles = [];
                    let anguloCabeca = player.angle;
                    let inicioX = player.x + Math.cos(anguloCabeca) * 22;
                    let inicioY = player.y + Math.sin(anguloCabeca) * 22;

                    room.projectiles.push({
                        id: Date.now() + Math.random(),
                        x: inicioX,
                        y: inicioY,
                        angle: anguloCabeca,
                        speed: 15,
                        ownerId: socket.id,
                        maxDist: 850,
                        traveled: 0
                    });
                }
                else if (player.inventory === 'flashbang') {
                    const RAIO_EXPLOSAO = 1200;
                    for (let id in room.players) {
                        if (id !== socket.id) {
                            let inimigo = room.players[id];
                            let dist = Math.hypot(inimigo.x - player.x, inimigo.y - player.y);
                            if (dist <= RAIO_EXPLOSAO) {
                                io.to(id).emit('efeitoFlashbang');
                            }
                        }
                    }
                }

                player.inventory = null;
            }
        }
    });

    socket.on('disconnect', () => {
        for (let code in rooms) {
            if (rooms[code] && rooms[code].players[socket.id]) {
                delete rooms[code].players[socket.id];
                let remainingPlayers = Object.keys(rooms[code].players);

                if (remainingPlayers.length === 0) {
                    delete rooms[code];
                } else {
                    if (rooms[code].adminId === socket.id) {
                        rooms[code].adminId = remainingPlayers[0];
                    }
                    io.to(code).emit('updateLobby', obterDadosLobby(code));
                }
            }
        }
    });
});

function obterDadosLobby(roomCode) {
    let room = rooms[roomCode];
    let playersArr = Object.values(room.players);
    return {
        code: roomCode,
        adminId: room.adminId,
        player1: playersArr[0] ? playersArr[0].nick : "Aguardando...",
        player2: playersArr[1] ? playersArr[1].nick : "Aguardando...",
        totalPlayers: playersArr.length
    };
}

function registrarMorte(room, roomCode, socketIdMorto) {
    room.status = 'COUNTDOWN';
    let idsJogadores = Object.keys(room.players);
    let idVencedor = idsJogadores.find(id => id !== socketIdMorto);

    if (idVencedor && room.players[idVencedor]) {
        let vencedor = room.players[idVencedor];
        vencedor.wins += 1;

        if (vencedor.wins >= 2) {
            io.to(roomCode).emit('matchOver', vencedor.nick);
        } else {
            io.to(roomCode).emit('pointScored', vencedor.nick);

            setTimeout(() => {
                room.foods = gerarComida();
                room.items = [];

                for (let id in room.players) {
                    let p = room.players[id];
                    p.x = 200 + Math.random() * (LARGURA_MAPA - 400);
                    p.y = 200 + Math.random() * (ALTURA_MAPA - 400);
                    p.history = [];
                    p.body = [];
                    p.score = 1;
                    p.isBoosting = false;
                    p.inventory = null;
                }
                room.domains = [];
                room.projectiles = [];

                room.status = 'PLAYING';
            }, 3000);
        }
    }
}

// LOOP PRINCIPAL DO JOGO (60 FPS)
setInterval(() => {
    for (let roomCode in rooms) {
        let room = rooms[roomCode];

        if (room.status === 'PLAYING') {
            for (let id in room.players) {
                let player = room.players[id];

                if (player.isHypnotized && player.hypnotizerId && room.players[player.hypnotizerId]) {
                    let mestre = room.players[player.hypnotizerId];
                    let alvoX = mestre.x;
                    let alvoY = mestre.y;

                    if (mestre.body && mestre.body.length > 0) {
                        let rabo = mestre.body[mestre.body.length - 1];
                        alvoX = rabo.x;
                        alvoY = rabo.y;
                    }

                    player.targetAngle = Math.atan2(alvoY - player.y, alvoX - player.x);
                }

                let diferenca = player.targetAngle - player.angle;
                while (diferenca > Math.PI) diferenca -= Math.PI * 2;
                while (diferenca < -Math.PI) diferenca += Math.PI * 2;

                if (Math.abs(diferenca) > 0.1) {
                    player.angle += Math.sign(diferenca) * 0.1;
                } else {
                    player.angle = player.targetAngle;
                }

                // Cálculo corrigido da velocidade sem erro de escopo
                let velocidadeAtual = player.isBoosting ? 4.5 : 2;
                if (player.speedBoost) velocidadeAtual = player.speedBoost;

                if (!player.isFrozen) {
                    player.x += Math.cos(player.angle) * velocidadeAtual;
                    player.y += Math.sin(player.angle) * velocidadeAtual;
                }

                // Colisão com Borda
                if (player.x < 0 || player.x > LARGURA_MAPA || player.y < 0 || player.y > ALTURA_MAPA) {
                    registrarMorte(room, roomCode, id);
                    break;
                }

                // Spawning e Colisão de Itens
                if (!room.items) room.items = [];
                const tiposDeItens = ['onca', 'lula', 'amor', 'dominio', 'arma', 'flashbang'];

                if (room.items.length < 2 && Math.random() < 0.005) {
                    let tipoSorteado = tiposDeItens[Math.floor(Math.random() * tiposDeItens.length)];
                    room.items.push({
                        x: 50 + Math.random() * (LARGURA_MAPA - 100),
                        y: 50 + Math.random() * (ALTURA_MAPA - 100),
                        type: tipoSorteado
                    });
                }

                for (let i = room.items.length - 1; i >= 0; i--) {
                    let item = room.items[i];
                    let dist = Math.hypot(player.x - item.x, player.y - item.y);
                    if (dist < 30 && !player.inventory) {
                        player.inventory = item.type;
                        room.items.splice(i, 1);
                    }
                }

                // Comer Comidas
                for (let i = room.foods.length - 1; i >= 0; i--) {
                    let food = room.foods[i];
                    let distancia = Math.hypot(player.x - food.x, player.y - food.y);

                    if (distancia < 20) {
                        player.score += food.value || 1;
                        room.foods.splice(i, 1);
                        room.foods.push({
                            x: Math.random() * LARGURA_MAPA,
                            y: Math.random() * ALTURA_MAPA,
                            value: 1
                        });
                    }
                }

                // Histórico do Rastro
                player.history.unshift({ x: player.x, y: player.y });
                let tamanhoMaximo = player.score * 5;

                if (player.isBoosting && player.score > 3) {
                    player.score -= 0.15;

                    if (Math.random() < 0.4) {
                        let rastroAntigo = player.history[player.history.length - 1];
                        if (rastroAntigo) {
                            room.foods.push({ x: rastroAntigo.x, y: rastroAntigo.y, value: 0.25 });
                        }
                    }

                    if (player.score <= 3) {
                        player.isBoosting = false;
                    }
                }

                while (player.history.length > tamanhoMaximo) {
                    player.history.pop();
                }

                player.body = [];
                for (let i = 5; i < player.history.length; i += 5) {
                    player.body.push(player.history[i]);
                }

                // Colisão com Corpo Inimigo
                for (let outroId in room.players) {
                    if (outroId !== id) {
                        let inimigo = room.players[outroId];
                        if (inimigo && inimigo.body) {
                            for (let p of inimigo.body) {
                                let distanciaCorpo = Math.hypot(player.x - p.x, player.y - p.y);
                                if (distanciaCorpo < 20) {
                                    registrarMorte(room, roomCode, id);
                                    break;
                                }
                            }
                        }
                    }
                }
            }

            // Expansão de Domínio
            if (room.domains && room.domains.length > 0) {
                for (let dominio of room.domains) {
                    for (let id in room.players) {
                        if (id !== dominio.ownerId) {
                            let p = room.players[id];
                            let dist = Math.hypot(p.x - dominio.x, p.y - dominio.y);
                            if (dist < dominio.radius) {
                                p.score = Math.max(1, p.score - (p.score * 0.0025));
                            }
                        }
                    }
                }
            }

            // Projéteis da Arma
            if (room.projectiles && room.projectiles.length > 0) {
                for (let i = room.projectiles.length - 1; i >= 0; i--) {
                    let proj = room.projectiles[i];

                    proj.x += Math.cos(proj.angle) * proj.speed;
                    proj.y += Math.sin(proj.angle) * proj.speed;
                    proj.traveled += proj.speed;

                    let acertou = false;

                    for (let id in room.players) {
                        if (id !== proj.ownerId) {
                            let p = room.players[id];

                            if (Math.hypot(p.x - proj.x, p.y - proj.y) < 22) {
                                p.score = Math.max(1, p.score - 4);
                                acertou = true;
                                break;
                            }

                            if (p.body) {
                                for (let parte of p.body) {
                                    if (Math.hypot(parte.x - proj.x, parte.y - proj.y) < 18) {
                                        p.score = Math.max(1, p.score - 2.5);
                                        acertou = true;
                                        break;
                                    }
                                }
                            }
                        }
                        if (acertou) break;
                    }

                    if (acertou || proj.traveled >= proj.maxDist || proj.x < 0 || proj.x > LARGURA_MAPA || proj.y < 0 || proj.y > ALTURA_MAPA) {
                        room.projectiles.splice(i, 1);
                    }
                }
            }
        }

        io.to(roomCode).emit('gameState', room);
    }
}, 1000 / 60);

// Substitua a linha onde o servidor ouve a porta por esta:
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
