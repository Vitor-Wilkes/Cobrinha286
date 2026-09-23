// server.js
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public')); 
const LARGURA_MAPA = 1500;
const ALTURA_MAPA = 1500;
const rooms = {};

// Função auxiliar para gerar 100 comidas pelo mapa
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

// Função auxiliar para criar as propriedades iniciais de um jogador
function criarJogador(nick) {
    return {
        nick: nick,
        skin: '#5DB971', // Skin Padrão Inicial
        x: 200 + Math.random() * (LARGURA_MAPA - 400),
        y: 200 + Math.random() * (ALTURA_MAPA - 400),
        angle: 0,
        targetAngle: 0,
        speed: 3,
        history: [],
        body: [],
        score: 1,
        isBoosting: false,
        wins: 0 
    };
}

io.on('connection', (socket) => {
    console.log('Um jogador conectou:', socket.id);

    // 1. CRIAR UMA NOVA SALA
    socket.on('createRoom', (nick) => {
        let roomCode = Math.floor(100 + Math.random() * 900).toString();
        socket.join(roomCode);

        rooms[roomCode] = {
            code: roomCode,
            adminId: socket.id, 
            status: 'LOBBY',    
            players: {},
            foods: gerarComida()
        };

        rooms[roomCode].players[socket.id] = criarJogador(nick);

        socket.emit('joinedLobby', roomCode);
        io.to(roomCode).emit('updateLobby', obterDadosLobby(roomCode));
    });

    // 2. ENTRAR EM UMA SALA EXISTENTE
    socket.on('joinRoom', (roomCode, nick) => {
        if (rooms[roomCode] && Object.keys(rooms[roomCode].players).length < 2 && rooms[roomCode].status === 'LOBBY') {
            socket.join(roomCode);
            rooms[roomCode].players[socket.id] = criarJogador(nick);
            
            // Se for o segundo jogador a entrar, dá a ele a skin rosa por padrão para não confundir
            if (Object.keys(rooms[roomCode].players).length === 2) {
                rooms[roomCode].players[socket.id].skin = '#D46A84';
            }

            socket.emit('joinedLobby', roomCode);
            io.to(roomCode).emit('updateLobby', obterDadosLobby(roomCode));
        } else {
            socket.emit('erro', 'Sala cheia, código inválido ou a partida já começou!');
        }
    });

    // NOVA FUNÇÃO: TROCA DE SKIN NO LOBBY
    socket.on('changeSkin', (roomCode, novaSkin) => {
        if (rooms[roomCode] && rooms[roomCode].players[socket.id] && rooms[roomCode].status === 'LOBBY') {
            rooms[roomCode].players[socket.id].skin = novaSkin;
        }
    });

    // 3. INICIAR O JOGO
    socket.on('startGame', (roomCode) => {
        let room = rooms[roomCode];
        if (room && room.adminId === socket.id && Object.keys(room.players).length === 2) {
            room.status = 'COUNTDOWN'; 
            io.to(roomCode).emit('startCountdown');

            setTimeout(() => {
                room.status = 'PLAYING';
            }, 5000);
        }
    });

    // 4. REVANCHE
    socket.on('rematch', (roomCode) => {
        if (rooms[roomCode]) {
            rooms[roomCode].status = 'LOBBY';
            for (let id in rooms[roomCode].players) {
                rooms[roomCode].players[id].wins = 0;
            }
            rooms[roomCode].foods = gerarComida();
            io.to(roomCode).emit('updateLobby', obterDadosLobby(roomCode));
        }
    });

    // MOVIMENTAÇÃO DO MOUSE
    socket.on('mouseMove', (roomCode, targetAngle) => {
        if (rooms[roomCode] && rooms[roomCode].players[socket.id] && rooms[roomCode].status === 'PLAYING') {
            rooms[roomCode].players[socket.id].targetAngle = targetAngle;
        }
    });

    // ATIVAÇÃO DO DASH
    socket.on('dash', (roomCode, estadoDoBotao) => {
        if (rooms[roomCode] && rooms[roomCode].players[socket.id] && rooms[roomCode].status === 'PLAYING') {
            let player = rooms[roomCode].players[socket.id];
            if (estadoDoBotao === true && player.score > 3) {
                player.isBoosting = true;
            } else {
                player.isBoosting = false;
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('Jogador desconectou:', socket.id);

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

// Extrai os dados visuais para a tela de Lobby
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

// LÓGICA DE MORTES, PONTUAÇÃO E ROUNDS
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

                for (let id in room.players) {
                    let p = room.players[id];
                    p.x = 200 + Math.random() * (LARGURA_MAPA - 400);
                    p.y = 200 + Math.random() * (ALTURA_MAPA - 400);
                    p.history = [];
                    p.body = [];
                    p.score = 1;
                    p.isBoosting = false;
                }

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

                let diferenca = player.targetAngle - player.angle;
                while (diferenca > Math.PI) diferenca -= Math.PI * 2;
                while (diferenca < -Math.PI) diferenca += Math.PI * 2;

                if (Math.abs(diferenca) > 0.1) {
                    player.angle += Math.sign(diferenca) * 0.1;
                } else {
                    player.angle = player.targetAngle;
                }

                let velocidadeAtual = player.isBoosting ? 4.5 : 2;
                player.x += Math.cos(player.angle) * velocidadeAtual;
                player.y += Math.sin(player.angle) * velocidadeAtual;

                // Colisão com a Borda
                if (player.x < 0 || player.x > LARGURA_MAPA || player.y < 0 || player.y > ALTURA_MAPA) {
                    registrarMorte(room, roomCode, id);
                    break; 
                }

                // Comer as Bolinhas
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

                // Salva o rastro e gerencia o Dash
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

                // Colisão com o Corpo do Inimigo
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
        }

        io.to(roomCode).emit('gameState', room);
    }
}, 1000 / 60);

http.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});