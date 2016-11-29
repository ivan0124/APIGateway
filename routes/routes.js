var STATUS = require('../inc/statusCode.js').STATUS_CODE;
var webSocketCtl = require('./websocket.js');

// Global Variables

var ReturnHead = {'Connection':'close',
				  'Content-Type':'application/json',
				  'Access-Control-Allow-Origin':'*'};

var procAsynRequest = function( res, status, result ) {

	if( res == undefined ) return;

	if( status >= STATUS.BAD_REQUEST ) { // Error
		res.writeHead(status,ReturnHead);
		res.end();
	} else {
		res.writeHead(status,ReturnHead);
		res.end(result);
	}
}

var procReply = function(req, res, next, app ) {
	
	var outret = {};
	var code = STATUS.METHOD_NOT_ALLOWED;
	var uri = '';
	//console.log('method: '+ req.method);
	//console.log('path: '+ req.path);
	
	var n = app.group.length + 2;
	uri = req.path.substring(n);  

	switch( req.method )
	{
		case 'GET':
			if( app.get != undefined )
				code = app.get(uri,null, outret);
			break;
		case 'PUT':
			if( app.put != undefined ) 
				return app.put(uri, req.body, res, procAsynRequest);
			break;
		case 'POST':
			if( app.post != undefined )
				code = app.post(uri,req.body);
		case 'DELETE':
			if( app.delete != undefined )
				code = app.delete();
		default:
			code = STATUS.METHOD_NOT_ALLOWED;
	}	


	if( code >= STATUS.BAD_REQUEST ) { // Error
		res.writeHead(code,ReturnHead);
		res.end();
	} else {
		res.writeHead(code,ReturnHead);
		res.end(outret.ret);
	}

}


var loadAppService = function( router , ioSocket, wss ) {

	var services = {"service":{ "e":[]}};

	var sList = [];
	var hLd = null;


	//for(var j =0; j < 2; j++ ) 
	{			
		var app = {"n":null}; 
		hLd = require('../apps/wsn_manage/index.js');
		//hLd = require('../apps/sample/index.js');

		if( hLd == undefined || hLd == null ) {
			console.log('handle is null');
			return;
		}	

		hLd.APIs.usrObj = procReply;


		// Add Router's' Process function point to Module Event Listen
		if( hLd.APIs.addListener != undefined )
			hLd.APIs.addListener(webSocketCtl.procEvents);
		
		// Add appInf to websocket hash map
		webSocketCtl.setWebSocketGoup(hLd.APIs.group, hLd.APIs);
		// Set WebSocket callback fn to proc websocket event 
		hLd.APIs.websktCb = webSocketCtl.proceWebSocket;

        // To combine app in services list
		app.n = hLd.APIs.group;
		sList.push(app);
		//console.log(JSON.stringify(webSocketCtl.appInterface[0]));

		// Load path to Router	
		var paths = hLd.APIs.routers;
		for (var index in paths ){
			var path = '/' + hLd.APIs.group + '/' + paths[index].path;
			var tmp = paths[index].action;
			var actions = tmp.split(",");

			for(var i in actions) {
				switch( actions[i])
				{				
					case 'GET':
						router.get(path,hLd.APIs.procFn);
						break;
					case 'PUT':
						router.put(path,hLd.APIs.procFn);
						break;
					case 'POST':
						router.post(path,hLd.APIs.procFn);
						break;
					case 'DELETE':
						router.delete(path,hLd.APIs.procFn);
						break;
					default:
						console.log('Unknow Action: "'+ actions[i] + '" in Module: '+ hLd.APIs.group );
				}
			} // End of For actions 
			console.log('path:' + path); 
		} // End of For paths

	}

    services.service.e = sList;
	webSocketCtl.setWebSocket(wss);
	webSocketCtl.setIoSocket( ioSocket, JSON.stringify(services) );
}



// Router Function
var appRouter = function(router,socketio,wss) {
	
	
	router.all('*',function(req, res, next){
		// Debug for ALL Command
		console.log('all method captured param'+JSON.stringify(req.params) +'body=' + JSON.stringify(req.body));
		next();
	});
	loadAppService(router,socketio,wss);
	
}

module.exports = appRouter;
