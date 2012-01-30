socket = io.connect();

// adiciona uma mensagem no chat
var add_msg = function(nome, msg){
	$('.chat ul').append($('<li>').html(msg).prepend($('<span>').addClass('nome').html(nome + ': ')));
	$('.chat').stop().animate({
		scrollTop: $('.chat ul').height()
	}, 500);
}

// envia uma mensagem no chat
var send_message = function(msg){
	add_msg(player_nome, msg);
	socket.emit('message', msg);
}

// muda de quem é a vez
var mudar_vez = function(pid){
	if(pid == player_pid){
		msg('Sua vez!');
		sua_vez = true;
	}else{
		msg('Vez de '+$('.player[pid='+pid+'] .nome').text());
	}
}

// verifica se a carta 'maior' realmente pode ser jogado por cima da 'menor'
var compara_cartas = function(maior, menor){
	var numbers = ['2','3','4','5','6','7','8','9','1','j','q','k','a'];
	return maior[1] == '2' || maior[1] == '1' || numbers.indexOf(maior[1]) >= numbers.indexOf(menor[1]);
}

// passa para o próximo
var avancar_vez = function(pid){
	var vez = pid + 1;
	mudar_vez(vez >= qtd_jogadores ? 0 : vez);
}

// joga uma carta na mesa
var jogar_na_mesa = function(carta, pid, fn){
	var carta_val = carta.attr('carta')
	  , carta_mesa_elem = $('.mesa-principal .carta')
	  , carta_mesa = carta_mesa_elem.attr('carta');
		
	carta.css({
		position:'absolute', zIndex: 3, top: carta.offset().top, left: carta.offset().left, width: '73px' // faz a carta ficar por cima na tela
	}).appendTo('body').animate({
		top: carta_mesa_elem.offset().top, // move ela até a mesa
		left: carta_mesa_elem.offset().left
	}, 500, function(){
		carta_mesa_elem.attr({class: 'carta '+carta_val, carta: carta_val}); // muda a carta na mesa
		carta.remove(); // remove a carta do jogador
		if(carta_val[1] == '1'){ // caso seja um 10
			cartas_mesa = []; // reseta o numero de cartas na mesa
			carta_mesa_elem.attr('carta', 'a2'); // faz a carta na mesa ter propriedade de 2, assim qualquer carta pode ser jogada por cim
			carta_mesa_elem.addClass('vazio').clone().removeClass('vazio').css({ // queima as cartas da mesa, joga pra fora do jogo
				position: 'absolute',
				zIndex: 3,
				top: carta_mesa_elem.offset().top,
				left: carta_mesa_elem.offset().left
			}).appendTo('body').animate({
				left: -100
			}, 500, function(){
				$(this).remove();
				avancar_vez(pid); // passa para o próximo
				if(typeof fn != 'undefined') fn(); // callback
			});
		}else{
			cartas_mesa.push({carta: carta_val, cid: carta.attr('cid')}); // adiciona mais uma carta à mesa
			avancar_vez(pid); // passa para o próximo
			if(typeof fn != 'undefined') fn(); // callback
		}
	});
}

var puxar_carta = function(i, top, left, cmesa_clone, mao, max, small){ // puxa cada carta do bolo na mesa
	setTimeout(function(){
		var carta = cartas_mesa[i]
		  , nova_carta = cmesa_clone.clone(); // cria uma cópia da carta para o efeito
		nova_carta.appendTo('body').attr({class: 'carta '+carta.carta, cid: carta.cid}).animate({ // move para a mão do usuário
			top: top,
			left: left
		}, 500, function(){
			nova_carta.remove(); // deleta a carta do campo
			mao.append( // adiciona a carta à mão
				$('<li cid="'+carta.cid+'" carta="'+carta.carta+'">').append(
					$('<div class="carta '+carta.carta+small+'" cid="'+carta.cid+'" carta="'+carta.carta+'">')
				)
			);
			mao.find('li').css({width: parseInt(100 / mao.find('li').length) + '%'}); // ajusta mão
		});
	}, 200 * (max - 1 - i));
}

var pegar_cartas_da_mesa = function(pid){ // jogador compra as cartas da mesa
	var carta_mesa_elem = $('.mesa-principal .carta') 
	  , max = cartas_mesa.length
	  , mao = pid == player_pid ? $('.jogador .mao ul') : $('.player[pid='+pid+'] .mao ul')
	  , top = mao.offset().top
	  , left = mao.offset().left
	  , small = pid == player_pid ? '' : ' small back'
	  , cmesa_clone = carta_mesa_elem.addClass('vazio').clone().removeClass('vazio').css({  // deixa a carta no campo como vazio e cria um clone
			position: 'absolute',
			top: carta_mesa_elem.offset().top,
			left: carta_mesa_elem.offset().left,
			zIndex: 3
		})
	  
	for(var i = max; i--;){
		puxar_carta(i, top, left, cmesa_clone, mao, max, small); // puxa as cartas, uma por uma
	}
	setTimeout(function(){
		carta_mesa_elem.attr({carta: 'c2'}); // faz a carta no campo ter efeito de um 2, pra qualquer carta ser jogada por cima
		cmesa_clone.remove(); // remove o clone
		cartas_mesa = []; // esvazia a mesa
	}, 200 * max);
}

// mostra uma mensagem do jogo
var msg = function(m){
	$('.mesa-principal .mensagem').html(m);
}

// ver se o jogador está sem cartas
var checar_finalizou = function(){
	var qtd_cartas = $('.jogador .mao li').length + $('.jogador .mesa li').length - $('.jogador .mesa li.vazio').length;
	if(qtd_cartas == 0){
		finalizar(player_pid);
	}
}

// finalizar jogo
var finalizar = function(pid){
	var msg = '<h1>Você Ganhou!</h1>';
	if(pid != player_pid){
		msg = '<h2>Você perdeu, '+$('.player[pid='+pid+'] .nome').text()+' é o vencedor</h2>';
	}
	$('.mesa-principal').prepend('<div class="fim">'+msg+'<a href="/">Sair</a></div>');
}

// ao receber uma mensagem de outro jogador, adiciona ela ao chat
socket.on('message', function(nome, msg){
	add_msg(nome, msg);
});

// caso o jogador não tenha uma sala, atualiza a lista de salas
setInterval(function(){
	if(sid == null) socket.emit('atualizar salas');
}, 2000);

// atualiza a lista de salas online
socket.on('salas online', function(salas){
	$('ul.salas').html('');
	for(s in salas){
		var sala = salas[s];
		$('ul.salas').append($('<li>').attr({sid: sala.sid}).html(sala.nome + ' - ' + sala.players + ' jogadores'));
	}
});

// adiciona um jogador na sala
socket.on('entrou na sala', function(player){
	$('.dentro-sala .jogadores').append($('<li>').attr({uid: player.uid}).html(player.nome));
});

// tira um jogador da sala
socket.on('saiu da sala', function(uid){
	$('.dentro-sala .jogadores li[uid="'+uid+'"]').remove();
});

// jogador clica em criar sala
$('#bttCriarSala').click(function(){
	var nome = $("#txtNomeSala").val();
	socket.emit('criar sala', nome, function(id){
		sid = id;
		$('.fora-sala').hide(); // esconde a lista de salas
		$('.dentro-sala, #chat').show(); // mostra a sala e o chat
		$('.dentro-sala .jogadores').html('').append($('<li>').attr({uid: player_uid}).html(player_nome)); // se adiciona dentro da sala
		$('#lnkIniciarJogo').show(); // mostra botão de iniciar jogo
	});
	return false;
});

$('ul.salas li').live('click', function(){ // ao clicar em uma sala
	var id = $(this).attr('sid');
	socket.emit('entrar sala', id, function(players){ // jogador pede pra entrar na sala
		if(players != false){ // caso seja possível
			sid = id;
			$('.fora-sala').hide(); // esconde a lista de salas
			$('.dentro-sala, #chat').show(); // mostra o chat e dentro da sala
			// exibe os jogadores dentro da sala
			$('.dentro-sala .jogadores').html('');
			for(p in players){
				var player = players[p];
				$('.dentro-sala .jogadores').append($('<li>').attr({uid: player.uid}).html(player.nome));
			}
		}
	});
});

$('#lnkSairSala').click(function(){ // jogador clica pra sair da sala
	socket.emit('sair sala', function(){
		sid = null;
		$('.fora-sala').show(); // mostra a lista de salas
		$('.dentro-sala, #chat').hide(); // esconde a sala e o chat
		$('#lnkIniciarJogo').hide(); // esconde o botão de iniciar jogo
	});
	return false;
});

$('#lnkIniciarJogo').click(function(){ // jogador clica em iniciar jogo
	socket.emit('iniciar jogo');
	$('.dentro-sala').hide(); // esconde a sala
	return false;
});

socket.on('iniciar jogo', function(mesa, mao, players){ // jogo foi iniciado
	$('.dentro-sala').hide(); // esconde a sala
	$('.jogo').show(); // exibe o jogo
	if(mesa == null){ // caso a primeira carta seja um 10
		$('.mesa-principal .carta').attr({class: 'carta a2 vazio', cid: -1, carta: 'a2'}); // coloca uma carta 'vazia' na mesa
	}else{
		cartas_mesa.push({carta: mesa.carta, cid: mesa.cid}); // adiciona a carta à mesa
		$('.mesa-principal .carta').attr({class: 'carta '+mesa.carta, cid: mesa.cid, carta: mesa.carta}); // coloca a carta da mesa
	}
	
	var jogador = $('.jogador');
	for(var i = 4; i--;) // coloca as quatro cartas pra baixo do jogador
		jogador.find('.mesa .baixo').append($('<li>').attr({class: 'carta back'}));
	
	for(var i = 0, max = mao.length; i < max; i++) // coloca as cartas da mão do jogador 
		jogador.find('.mao ul').append(
			$('<li cid="'+mao[i].cid+'" carta="'+mao[i].carta+'">').append(
				$('<div class="carta '+mao[i].carta+'" cid="'+mao[i].cid+'" carta="'+mao[i].carta+'">')
			)
		);
	
	var max = players.length;
	qtd_jogadores = max;
	$('.players').css({width: 242 * max}).html(''); // define a largura da class players pra fazer o overflow para quando há muitos jogadores
	for(var i = 0; i < max; i++){
		var player = players[i]
		  , cartas = player.mesa_cima
		  , player_elem;

		if(player.uid != player_uid){ // caso não seja o jogador principal
			player_elem = 
				$('<div class="player">').attr({uid: player.uid, pid: player.pid}).append( // cria uma div para o jogador e define sua informações
					$('<div class="info">').append(
						$('<div class="foto">').append(
							$('<img src="https://graph.facebook.com/'+player.uid+'/picture?type=square" border="0" width="50" height="50" />')
						)
					).append(
						$('<div class="nome">').html(player.nome)
					)
				).append('<div class="cartas"><div class="mao"><label>Mão</label><ul><li><div class="carta small back"></div></li><li><div class="carta small back"></div></li><li><div class="carta small back"></div></li><li><div class="carta small back"></div></li></ul></div><div class="mesa"><label>Mesa</label><ul class="cima"></ul><ul class="baixo"><li class="carta back small"></li><li class="carta back small"></li><li class="carta back small"></li><li class="carta back small"></li></ul></div></div>') // adiciona as cartas viradas pra baixo do jogador, da mão e da mesa

			$('.players').append(player_elem); // adiciona à div de players
		}else{
			player_pid = player.pid; // define o pid do jogador
			player_elem = jogador;
		}
	    
	    // adiciona as cartas que ficam na mesa para cada jogador
		for(var p = 0, maxp = cartas.length; p < maxp; p++)
			player_elem.find('.mesa .cima').append($('<li>').attr({class: 'carta '+cartas[p].carta+(player.uid != player_uid ? ' small' : ''), cid: cartas[p].cid, carta: cartas[p].carta}));
		
	}
	mudar_vez(0); // inicia com o primeiro jogador
});

$('.jogador .mao li').live('click', function(){ // ao clicar pra jogar uma carta de sua mão
	var carta_mesa_elem = $('.mesa-principal .carta')
	  , carta_mesa = carta_mesa_elem.attr('carta')
	  , este = $(this)
	  , carta = este.attr('carta')
	  , cid = este.attr('cid');

	if(!sua_vez){
		msg('Não é sua vez');
	}else{
		if(!compara_cartas(carta, carta_mesa)){ // verifica se esta carta pode ser jogada
			msg('Jogue uma carta igual ou maior ou compre da mesa');
		}else{
			var player_cartas = $('.jogador .mao li');
			player_cartas.css({width: parseInt(100 / (player_cartas.length - 1)) + '%'}); // regula a porcentagem das cartas na mão, pra caso o jogador tenha muitas cartas na mão elas fiquem umas por cima das outras

			sua_vez = false;
			socket.emit('jogar', cid, 'mao', function(pass){ // enviar informações da jogada
				if(pass){ // caso jogada seja válida
					jogar_na_mesa(este, player_pid);
					checar_finalizou(); // ver se acabou as cartas
				}else{
					sua_vez = true;
					msg('Jogada inválida');
				}
			});
		}
	}
});

$('.jogador .mesa li').live('click', function(){ // ao clicar pra jogar uma carta da mesa
	var carta_mesa_elem = $('.mesa-principal .carta')
	  , carta_mesa = carta_mesa_elem.attr('carta')
	  , este = $(this)
	  , baixo = este.parent().hasClass('baixo')
	  , carta
	  , cid;
	if(baixo){ // não se sabe qual é a carta
		cid = este.index();
	}else{
		cid = este.attr('cid');
		carta = este.attr('carta');
	}

	if(!sua_vez){
		msg('Não é sua vez');
		return false;
	}
	if($('.jogador .mao li').length > 0){
		msg('Primeiro jogue as cartas da sua mão');
		return false;
	}else if(baixo && ($('.jogador .mesa .cima li').length - $('.jogador .mesa .cima li.vazio').length) > 0){
		msg('Primeiro jogue as cartas viradas pra cima');
		return false;
	}
	if(!baixo && !compara_cartas(carta, carta_mesa)){ // verifica se esta carta pode ser jogada
		msg('Jogue uma carta igual ou maior ou compre da mesa');
		return false;
	}
	sua_vez = false;
	socket.emit('jogar', cid, 'mesa '+(baixo ? 'baixo' : 'cima'), function(pass, carta){ // enviar informações da jogada
		if(baixo){
			este.attr({cid: carta.cid, carta: carta.carta});
		}
		var carta_elem = este.clone().appendTo('body').css({position: 'absolute', top: este.offset().top, left: este.offset().left});
		este.addClass('vazio').removeAttr('carta');
		if(baixo){
			carta_elem.removeClass('back').addClass(carta.carta);
		}else{
			$('.jogador .mesa .baixo li:eq('+este.index()+')').css({position: 'relative', zIndex: 1});
		}

		if(pass){ // caso jogada seja válida
			jogar_na_mesa(carta_elem, player_pid);
			checar_finalizou(); // ver se acabou as cartas
		}else if(baixo){
			jogar_na_mesa(carta_elem, player_pid, function(){
				pegar_cartas_da_mesa(player_pid);
			});
		}else{
			msg('Jogada inválida');
		}
	});
});

$('.mesa-principal .carta').live('click', function(){ // ao clicar pra pegar cartas da mesa
	if(!sua_vez){
		msg('Não é sua vez');
		return false;
	}
	if($(this).hasClass('vazio')){ // se não tiver carta na mesa
		msg('Jogue uma carta');
		return false;
	}
	if($('.jogador .mao li').length == 0 && $('.jogador .mesa .cima li').length == 0){ // se o jogador não tiver cartas na mão nem na mesa, mas tiver virado pra baixo
		msg('Jogue uma de suas cartas viradas pra baixo');
		return false;
	}
	var carta = $(this).attr('carta')
	  , tem = false;
	if($('.jogador .mao li').length > 0){ // verifica se o jogador tem cartas na mão que possam ser jogadas
		$('.jogador .mao li').each(function(){
			if(!tem && compara_cartas($(this).attr('carta'), carta)){
				tem = true
			}
		});
	}else if($('.jogador .mesa .cima li').length > 0){ // verifica se o jogador tem cartas na mesa que possam ser jogadas
		$('.jogador .mesa .cima li').each(function(){
			if(!tem && !$(this).hasClass('vazio') && compara_cartas($(this).attr('carta'), carta)){
				tem = true
			}
		});
	}
	if(tem){ // se tiver
		msg('Você tem carta pra jogar, jogue-a');
	}else{
		sua_vez = false;
		socket.emit('comprar cartas', function(pass){ // compra cartas
			if(pass){
				pegar_cartas_da_mesa(player_pid); // faz animação
			}else{
				sua_vez = true;	
				msg('Jogada inválida');
			}
		});
	}
});

socket.on('jogar', function(pid, cid, onde, carta_val, carta_cid){ // quando um outro jogador faz uma jogada
	var player = $('.player[pid='+pid+']')
	  , carta_mesa_elem = $('.mesa-principal .carta')
	  , carta_mesa = carta_mesa_elem.attr('carta')
	  , carta;
	if(onde == 'mao'){ // caso seja uma carta da mão
		var player_cartas = player.find('.mao li')
		  , rand_carta = parseInt(Math.random() * player_cartas.length);
		carta = player.find('.mao li:eq('+rand_carta+')');
		carta.find('.carta').addClass(carta_val).removeClass('back').removeClass('small'); // desvira e aumenta a carta
		player_cartas.css({width: parseInt(100 / (player_cartas.length - 1)) + '%'}); // regula a porcentagem das cartas na mão
	}else if(onde == 'mesa baixo'){ // caso seja uma carta da mesa pra baixo
		carta = player.find('.mesa .baixo li:eq('+cid+')').addClass('vazio').clone().removeClass('vazio').removeClass('back').removeClass('small').addClass(carta_val);
	}else{ // caso seja uma carta da mesa pra cima
		carta = player.find('.mesa .cima li[cid='+cid+']').addClass('vazio').clone().removeClass('vazio').removeClass('small');
	}
	carta.attr({carta: carta_val, cid: carta_cid});
	jogar_na_mesa(carta, pid);
});

socket.on('comprar cartas', function(pid, carta, pos){ // quando um outro jogador compra cartas
	if(typeof carta != 'undefined'){ // quando ele compra pois jogou uma virada para baixo que não poderia ser jogada
		var player = $('.player[pid='+pid+']')
	  	  , carta_elem = $('.player .mesa .baixo li:eq('+pos+')');
	  	carta_elem.attr({carta: carta.carta, cid: carta.cid});
		jogar_na_mesa(carta_elem, pid, function(){ // joga a carta virada pra baixo
			pegar_cartas_da_mesa(pid); // retorna ela e as outras cartas da mesa para a mão
		});
	}else{
		pegar_cartas_da_mesa(pid); // pega as cartas da mesa
		avancar_vez(pid); // passa para o próximo jogador
	}
});

socket.on('finalizar', function(pid){
	finalizar(pid);
});


