
var socket_io = require('socket.io');
var HashMap = require('hashmap').HashMap;
var io = undefined;
var STATUS = require('../inc/statusCode.js').STATUS_CODE;
var GourpMap = new HashMap();



var resEvent = 'response';
var msgEvent = 'message';

var msgFormat = {"n":null, "event":null, "data":null};

var resFormat = {"status":null, "sessionId":null, "data":null};

var responseMsg = function( status, sessionId, data )
{
  var reply = resFormat;
  reply.status = status;
  reply.sessionId = sessionId;
  reply.data = data;
  return JSON.stringify(reply);
}

var pushMsg = function( type, event, data )
{
  var reply = msgFormat;
  reply.n = type;
  reply.event = event;
  reply.data = data;
  return JSON.stringify(reply);
}

var getAppInterfacebyName = function( name )
{
  if( GourpMap.has(name) == true )
  {
    return GourpMap.get(name);
  }
  return null;
}

var procEventDataToWebSocket = function(group,eventType, data){
	//console.log('123 group: '+ group + ' event: '+ eventType + ' data: '+ JSON.stringify(data) );

    var msg = pushMsg(group,eventType,data);

    // socket.io
    if( io != undefined )
      io.to(group).emit(msgEvent,msg);		

    // websocket
    var app = getAppInterfacebyName(group);
    if( app != null ){
        app.wsclients.forEach(function(ws){
          ws.send(msg);
      });
    }
    else {
      //console.log('can not find app');
    }
    
}


var setWebSocketGoup = function( group,  // WSNManage 
                                 appInf )  // websocket array
{
  // group / WSNManage
  // URI: ServerIP:Port/GroupName   192.168.1.100:3000/WSNManage
  GourpMap.set(group,appInf);
}




var setIoSocket = function(ioSocket,apps){
  io = ioSocket;
    
  ioSocket.sockets.on('connection', function(socket) {
      //console.log('apps: '+ apps);

      // request
      socket.on('request', function(data){
        //console.log('data '+JSON.stringify(data));
        var action = data.n;
        var id = data.sessionId;
        var info = data.data;
        switch(action)
        {
          case 'service':
            {
              socket.emit( resEvent,responseMsg(STATUS.OK, id, apps));
            }
            break;
          case 'subscribe':
            {
              var groupName = info;
              var app = getAppInterfacebyName(groupName);
              if( app !== null ) {
                var data = '{\"e\":'+JSON.stringify(app.events) + '}';     
                socket.emit(resEvent, responseMsg(STATUS.OK,id,data) );
                socket.join(groupName);
              } else
                socket.emit(resEvent, responseMsg(STATUS.BAD_REQUEST,id,null));                   
            }
            break;
          case 'unsubscribe':
            {
              var groupName = info;
              var app = getAppInterfacebyName(groupName);
              if( app !== null ) {    
                socket.emit(resEvent, responseMsg(STATUS.OK,id,null));
                socket.leave(groupName);
              } else
                socket.emit(resEvent, responseMsg(STATUS.BAD_REQUEST,id,null));                   
            }
            break;
          default: 
            {
              socket.emit(resEvent, responseMsg(STATUS.METHOD_NOT_ALLOWED,id,null));  
            }
            break;
        }

      });


    }); // End of connection
}


var proceWebSocket = function( ws, app )
{
    ws.on('close',function(){
        console.log('on close WSNManage');
        var index = app.wsclients.indexOf(ws);
        if (index > -1) {
            console.log('Remove from wsclients= '+index);
            app.wsclients.splice(index, 1);
        }
    });  
}

var setWebSocket = function(wss){


  wss.on('connection', function connection(ws) {
    //console.log('ws  url= '+ ws.upgradeReq.url);
    // you might use location.query.access_token to authenticate or share sessions
    // or ws.upgradeReq.headers.cookie (see http://stackoverflow.com/a/16395220/151312)

    // check by uri path is in group add clients ingro '/'
    var groupName = ws.upgradeReq.url.substr(1);
    var appHandle = getAppInterfacebyName( groupName );
    //console.log('ws handle name '+groupName + 'handle= '+appHandle);
    if( appHandle == null )
    {
      // close socket 
      console.log('ws group is null => close');
      ws.close();
    }
    else
    {
      console.log('add in websocket '+ groupName + ' service');
      appHandle.websktFn(ws);
      appHandle.wsclients.push(ws);      
    }

    /*
    ws.on('message', function incoming(message) {
      console.log('received: %s', message);
    });*/

    //ws.send('something');
  });  
}


module.exports = {
  setIoSocket: setIoSocket,
  procEvents: procEventDataToWebSocket,
  setWebSocketGoup: setWebSocketGoup ,
  setWebSocket: setWebSocket,
  proceWebSocket: proceWebSocket,
}