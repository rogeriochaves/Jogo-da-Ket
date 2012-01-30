(function(){
	$(document).keydown(function (e) {
	
		var keyCode = e.keyCode || e.which;
		
		if(keyCode == 13){
			if($('.mensagem input').is(':focus')){
				if($('.mensagem input').val() != ''){
					send_message($('.mensagem input').val());
					$('.mensagem input').val('');
				}
			}else{
				$('.mensagem input').focus();
			}
		}
		
	});
})();