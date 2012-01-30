app.all('/home', function(request, response){
	if (request.session.auth){
		var token = request.session.auth.facebook.accessToken;
		facebook.getSessionByAccessToken(token)(function(session) {

			var user = request.session.auth.facebook.user;

			response.render('home.ejs',{
				layout: 'layout',
				user: user
			});

		});
	}else{
		response.redirect('/');
	}
});

app.all('/teste', function(request, response){
	
	if(typeof request.session.auth == 'undefined'){
		request.session.auth = {
			facebook: {
				user: {
					id: parseInt(Math.random() * 10000),
					name: ['Herp', 'Derp', 'Herpino', 'Derpino', 'Herpson', 'Derpson', 'Herpina', 'Derpina'][parseInt(Math.random() * 8)]
				}
			}
		}
	}
	var user = request.session.auth.facebook.user;

	response.render('home.ejs',{
		layout: 'layout',
		user: user
	});

});