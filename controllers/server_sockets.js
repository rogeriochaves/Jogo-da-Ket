// inicia variáveis
var players = {}
  , sockets = {}
  , salas = {};

// retorna uma array com uid e nome dos jogadores na sala
var na_sala = function(sala){
	var players = [];
	for(p in sala.players){
		var player = sala.players[p];
		players.push({uid: player.uid, nome: player.nome});
	}
	return players;
}

// retorna uma lista de salas online, que ainda não estão em jogo
var get_salas_online = function(){
	var salas_online = [];
	for(s in salas){
		var sala = salas[s];
		if(!sala.jogando) salas_online.push({nome: sala.nome, sid: sala.sid, players: sala.players.length});
	}
	return salas_online;
};

// tira o socket de sua sala
var sair_sala = function(socket){
	var sala = socket.player.sala;
	
	socket.broadcast.to(sala.sid).emit('saiu da sala', socket.player.uid); // avisa a todos que o jogador com tal uid saiu da sala
	socket.leave(sala.sid); // tira o socket da sala
	sala.players.splice(socket.player.pid, 1); // tira o player da sala
	// reajusta os pids
	for(p in sala.players){
		var player = sala.players[p];
		player.pid = p;
	}
	// deleta a sala caso não haja mais player nela
	if(sala.players.length == 0){
		delete salas[sala.sid];
	}
	// deleta a sala e o pid do player
	delete socket.player.sala;
	delete socket.player.pid;
};

// ordena a array randômicamente
var shuffle = function(arr) {
    var result = [];
    for (var i = 0, max = arr.length; i < max; i++) {
        j = Math.floor(Math.random() * arr.length);
        result.push(arr[j]);
        arr.splice(j, 1);
    }
    return result;
};

// verifica se a carta 'maior' realmente pode ser jogada por cima da 'menor' de acordo com as regras do jogo da Ket
var compara_cartas = function(maior, menor){
	var numbers = ['2','3','4','5','6','7','8','9','1','j','q','k','a'];
	return maior[1] == '2' || maior[1] == '1' || numbers.indexOf(maior[1]) >= numbers.indexOf(menor[1]);
}

var comprar_da_mesa = function(socket){
	var player = socket.player
	  , sala = player.sala;
	player.mao = player.mao.concat(sala.mesa); // adiciona cartas à mão
	sala.mesa = []; // esvazia a mesa
	sala.vez++; // passa para o próximo jogador
	if(sala.vez >= sala.players.length) sala.vez = 0; // caso seja o último, passa para o primeiro novamente
}

io.sockets.on('connection', function (socket) {

	var session = socket.handshake.session;
	if(session.auth){
		var user = session.auth.facebook.user;

		if(players[user.id]){
			socket.player = players[user.id];
			socket.player.socket = socket;
		}else{
			socket.player = {uid: user.id, nome: user.name, socket: socket};
			socket.sala = null;
			players[socket.player.uid] = socket.player;
		}
	
		
		socket.emit('salas online', get_salas_online()); // retorna a lista de salas online pro jogador

		socket.on('message', function(msg){ // ao receber uma mensagem do jogador no chat, transmite ela pros outros jogadores da sala
			var sala = socket.player.sala;
			if(typeof sala != 'undefined'){
				socket.broadcast.to(sala.sid).emit('message', socket.player.nome, msg);
			}
		});

		socket.on('atualizar salas', function(){ // atualiza a lista de salas, o cliente faz essa requisição a cada 2s
			socket.emit('salas online', get_salas_online());
		});

		socket.on('criar sala', function(nome, fn){ // cliente manda criar uma nova sala
			// define um sid aleatório ainda não existem para a sala
			var sid = '1';
			while(typeof salas[sid] != 'undefined'){
				sid = (parseInt(Math.random() * 10000)).toString();
			}
			console.log('Nova sala criada, sid: ' + sid);
			var sala = {sid: sid, nome: nome, players: [], jogando: false}; // inicializa a sala
			salas[sid] = sala; // adiciona à lista de salas
			socket.join(sid); // adiciona socket à sala
			socket.player.pid = sala.players.length; // cria um pid pro player (que é a posição dele na sala)
			sala.players.push(socket.player); // adiciona o player à sala
			socket.player.sala = sala; // adiciona a sala ao player
			fn(sid); // retorna o sid da sala atual
		});
		
		socket.on('entrar sala', function(sid, fn){ // cliente clica pra entrar na sala
			var sala = salas[sid];
			if(typeof sala == 'undefined' || sala.players.length > 9 || sala.jogando){ // verifica se a sala existe, não está cheia, e não está jogando
				fn(false);
			}else{
				socket.join(sid); // adiciona socket à sala
				var player = socket.player;
				socket.player.pid = sala.players.length; // define o pid do player
				sala.players.push(socket.player); // adiciona o player à sala
				socket.player.sala = sala; // adiciona a sala ao player
				socket.broadcast.to(sala.sid).emit('entrou na sala', {uid: player.uid, nome: player.nome}); // avisa a todos que o player entrou
				fn(na_sala(sala)); // retorna quem está dentro da sala
			}
		});

		socket.on('disconnect', function () { // quando o socket desconectar
		    if (!socket.player || !socket.player.sala) return;
		    sair_sala(socket); // o retira da sala em que ele estava
		});

		socket.on('sair sala', function(fn){ // jogador pede pra sair da sala
			sair_sala(socket); // tira ele da sala
			fn(); // callback
		});

		socket.on('iniciar jogo', function(){
			if(!socket.player || !socket.player.sala || socket.player.pid > 0) return;
			var	sala = socket.player.sala
			  , naipes = ['p','e','c','o']
			  , numbers = ['a',2,3,4,5,6,7,8,9,10,'j','q','k']
			  , deck = []
			  , max_decks = (Math.ceil((12 * sala.players.length + 1) / 52)); // calcula o número de baralhos necessários para a quantidade de jogadores
			sala.jogando = true; // impede que entrem mais jogadores
			
			// monta os baralhos
			var c = 0; // contador para o cid, que é o id da carta, garantindo que cada carta seja única e possível de identificar
			for(var k = max_decks; k--;){
				for(n in naipes){
					for(i in numbers){
						deck.push({carta: naipes[n]+numbers[i], cid: c});
						c++;
					}
				}
			}
			deck = shuffle(deck); // embaralha

			// distribui as cartas entre os jogadores
			var players = [];
			for(var i = 0, max = sala.players.length; i < max; i++){
				var player = sala.players[i];
				player.mesa_baixo = deck.splice(0, 4);
				player.mesa_cima = deck.splice(0, 4);
				player.mao = deck.splice(0, 4);
				players.push({
					uid: player.uid,
					pid: player.pid,
					nome: player.nome,
					mesa_cima: player.mesa_cima
				});
			}
			// pega uma carta pra ficar na mesa
			sala.mesa = deck.splice(0, 1);
			if(sala.mesa[0].carta[1] == '1') sala.mesa = []
			sala.vez = 0; // inicia com o primeiro jogador
			// envia para cada jogador qual é a carta na mesa, qual é sua mão e quais são as cartas na mesa de cada um
			for(var i = 0, max = sala.players.length; i < max; i++){
				sala.players[i].socket.emit('iniciar jogo', (sala.mesa[0] ? sala.mesa[0] : null), sala.players[i].mao, players);
			}
		});

		socket.on('jogar', function(cid, onde, fn){ // jogador joga uma carta
			if(!socket.player || !socket.player.sala || socket.player.pid != socket.player.sala.vez || !socket.player.sala.jogando){
				fn(false); // não é a vez do jogador
			}else{
				var player = socket.player
				  , cartas = (onde == 'mao' ? player.mao : onde == 'mesa cima' ? player.mesa_cima : player.mesa_baixo)
				  , carta
				  , pos = -1;
				if(onde == 'mesa baixo'){ // caso seja uma carta virada pra baixo, pega pela posição
					carta = cartas[cid];
					pos = cid;
				}else{ // caso não, pega pelo cid, assim não importa a posição que esteja ordenado
					for(var i = 0, max = cartas.length; i < max; i++){
						if(cartas[i].cid == cid){
							pos = i;
							carta = cartas[i];
							break;
						}
					}
				}
				cartas.splice(pos, 1);

				if(typeof carta == 'undefined'){
					fn(false); // jogador não possui tal carta
				}else{
					var numbers = ['2','3','4','5','6','7','8','9','1','j','q','k','a']
					  , sala = player.sala
					  , carta_mesa = sala.mesa[sala.mesa.length - 1]; // carta no topo da mesa
					if(typeof carta_mesa != 'undefined' && !compara_cartas(carta.carta, carta_mesa.carta)){
						if(onde == 'mesa baixo'){
							sala.mesa.push(carta); // adiciona carta à mesa
							fn(false, carta); // carta menor do que a que está na mesa, mostra qual é a carta
							comprar_da_mesa(socket);
							socket.broadcast.to(sala.sid).emit('comprar cartas', socket.player.pid, carta, cid);
						}else{
							fn(false); // carta menor do que a que está na mesa
						}
					}else{
						socket.broadcast.to(sala.sid).emit('jogar', player.pid, cid, onde, carta.carta, carta.cid); // transmitir jogada feita
						sala.mesa.push(carta); // adiciona carta à mesa
						if(carta.carta[1] == '1'){ // caso seja um 10
							sala.mesa = []; // queima as cartas da mesa
						}
						sala.vez++; // passa para o próximo jogador
						if(sala.vez >= sala.players.length) sala.vez = 0; // caso seja o último, passa para o primeiro novamente
						if(onde == 'mesa baixo'){
							fn(true, carta); // jogada efetuada com sucesso, mostra qual é a carta
						}else{
							fn(true); // jogada efetuada com sucesso
						}
					}
				}
				if(player.mao.length == 0 && player.mesa_cima.length == 0 && player.mesa_baixo.length == 0){ // caso o jogador esteja sem cartas
					player.sala.jogando = false; // finalizar jogo
					socket.broadcast.to(player.sala.sid).emit('finalizar', player.pid);
				}
			}
		});

		socket.on('comprar cartas', function(fn){
			if(!socket.player || !socket.player.sala || socket.player.pid != socket.player.sala.vez || !socket.player.sala.jogando){
				fn(false); // não é a vez do jogador
			}else{
				var sala = socket.player.sala
				  , player = socket.player
				  , carta = sala.mesa[sala.mesa.length - 1].carta
				  , tem = false;
				if(player.mao.length == 0 && player.mesa_cima.length == 0){
					fn(false);
				}else{
					if(player.mao.length > 0){
						player.mao.forEach(function(c){
							if(!tem && compara_cartas(c.carta, carta)){
								tem = true
							}
						});
					}else if(player.mesa_cima.length > 0){
						player.mesa_cima.forEach(function(c){
							if(!tem && compara_cartas(c.carta, carta)){
								tem = true
							}
						});
					}
					if(!tem){
						fn(true);
						comprar_da_mesa(socket);
						socket.broadcast.to(sala.sid).emit('comprar cartas', player.pid);
					}else{
						fn(false);
					}
				} 
			}
			
		});

	}

});