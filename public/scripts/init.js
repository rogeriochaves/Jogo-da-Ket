(function(){
	var rules = ''
	  , rules2 = ''
	  , naipes = ['p','e','c','o']
	  , numbers = ['a',2,3,4,5,6,7,8,9,10,'j','q','k'];

	for(n in naipes){
		for(i in numbers){
			var naipe = naipes[n]
			  , num = numbers[i];
			rules += '.'+naipe+num+'{background-position: -'+(i * 73)+'px -'+(n * 98)+'px}';
			rules2 += '.'+naipe+num+'.small{background-position: -'+(i * 43.6)+'px -'+(n * 58.4)+'px}';
		}
	}
	$('head').append('<style type="text/css">'+rules+rules2+'</style>');
})();