require('getmac').getMac(function(err,macAddress){
    if (err)  throw err;
    console.log('-----------------------------');
    console.log('getMac: ' + macAddress);   
    var mac = macAddress.toString().replace(/:/g,'');
    gHostConnectivity = '0007' + mac;
    //console.log( 'gHostConnectivity = ' + gHostConnectivity );
});
var STATUS = require('../../inc/statusCode.js').STATUS_CODE;
var Uuid = require('node-uuid');
var Mqtt = require('mqtt');
var HashMap = require('hashmap').HashMap;
const EventEmitter = require('events');
var eventEmitterObj = new EventEmitter();
var genHtmlEventObj = new EventEmitter();
var EVENT = require('./html_event.js');
var VgwMap = new HashMap();
var SensorHubMap = new HashMap();
var ConnectivityMap = new HashMap();
var MqttPublishMap = new HashMap();
var RESTFulArrayValueMap = new HashMap();
var gHostConnectivity;
//
const TIMEOUT = 30000; // 30 seconds
const HEART_BEAT_TIMEOUT = 60000; // 60 seconds
const HEART_BEAT_CHECK_INTERVAL = 5000; //5 seconds
const groupName = 'WSNManage';
var routers = [{"path":"*","action":"GET,PUT"}];

// Define Event Type for auto update by websocket  
var WSNEVENTS = [{"event":"eConnectivity_Capability"},
                 {"event":"eConnectivity_UpdateData"},
                 {"event":"eSenHub_Connected"},
                 {"event":"eSenHub_Disconnect"},
                 {"event":"eSenHub_Capability"},
                 {"event":"eSenHub_UpdateData"}];
				 
var GET_RESULT ={"Net":{"e": [{"n":"Health","v":86}],"bn":"Net"}};

var wsclients = [];


var Client  = Mqtt.connect('mqtt://172.22.213.145');
Client.queueQoSZero = false;

const MSG_TYPE = { 
                   ERROR: -1, 
		   UNKNOWN: 0,
                   VGW_CONNECT: 1, 
		   VGW_OS_INFO: 2, 
		   VGW_INFO_SPEC: 3, 
	           VGW_WILLMESSAGE: 4,
                   VGW_DISCONNECT: 5, 
		   VGW_INFO: 6,
                   SENSORHUB_CONNECT: 7, 
		   SENSORHUB_DISCONNECT: 8, 
		   SENSORHUB_INFO_SPEC: 9, 
		   SENSORHUB_INFO: 10,
                   SENSORHUB_SET_RESPONSE: 11,   
                   CONNECTIVITY_SET_RESPONSE: 12,
                   VGW_HEART_BEAT:13,
                   VGW_GET_CAPABILITY_REQUEST:14,   
                   VGW_RECONNECT:15,
                   VGW_QUERY_HEART_BEAT_VALUE_REQUEST:16,   
                   VGW_QUERY_HEART_BEAT_VALUE_RESPONSE:17,
                   VGW_CHANGE_HEART_BEAT_VALUE_REQUEST:18,
                   VGW_CHANGE_HEART_BEAT_VALUE_RESPONSE:19   
		 };
				 
const OS_TYPE = { 
                  NONE_IP_BASE: 'NONE_IP_BASE', 
		  IP_BASE: 'IP_BASE'
		};

const URI_TYPE = { 
                  CONNECTIVITY: 1, 
		  SENSORHUB: 2
		};

const DATATYPE = {
                  UNKNOWN: 0, 
                  CONNECTIVITY_INFOSPEC: 1, 
		  CONNECTIVITY_INFO: 2,
		  CONNECTIVITY_CAPABILITY: 3,
                  SENSORHUB_ALL_LIST: 4,
                  SENSORHUB_CONNECT_INFO: 5,
                  SENSORHUB_INFOSPEC_INFO: 6,
                  SENSORHUB_INFO: 7,
                  SENSOR_DATA: 9
		};
				
const DEVICE_OBJ = { 
                     vgw_id: 'null', 
                     conn_id: 'null',
                     conn_type: 'null',
                     connect: 'null', 
                     os_info: 'null', 
                     dev_info_spec: 'null',  
                     dev_info: 'null',
                     dev_capability: 'null',
                     dev_full_info: 'null',
                     dev_last_hb_time: 0,
                   };
const RESTFUL_VAL_TYPE = {
                           ERROR: -1,
                           SUCCESS:0, 
                           ARRAY: 1,
                           ARRAY_ELEMENT: 2,
                           READ_ONLY: 3
                         }; 

function addHostConnectivity(){

  console.log( '[addHostConnectivity] gHostConnectivity = ' + gHostConnectivity );
  /* copy DEVICE_OBJ object as vgw objcect */
  var connObj = JSON.parse(JSON.stringify(DEVICE_OBJ));

  /*create infoSpec object*/
  var infoSpecObj = {};
  infoSpecObj.Info = {};
  infoSpecObj.Info.e = [];
  infoSpecObj.Info.e.push({n:'SenHubList', sv:'',asm:'r'});
  infoSpecObj.Info.e.push({n:'Neighbor', sv:'',asm:'r'});
  infoSpecObj.Info.e.push({n:'Name', sv:'Ethernet',asm:'r'});
  infoSpecObj.Info.bn = 'Info';
  infoSpecObj.bn = gHostConnectivity;
  infoSpecObj.ver = 1;

  /*create deviceinfo object*/
  var keyStr = '';
  var devinfoObj = JSON.parse(JSON.stringify(infoSpecObj));
  buildFullInfoObj(true, keyStr, devinfoObj);
 

  connObj.conn_id = gHostConnectivity;
  connObj.conn_type = 'Ethernet';
  connObj.dev_info_spec = JSON.stringify(infoSpecObj);
  connObj.dev_info = JSON.stringify(devinfoObj);

  var keyStr = '';
  var fullInfoObj = JSON.parse(JSON.stringify(infoSpecObj));
  buildFullInfoObj(false, keyStr, fullInfoObj);
  connObj.dev_full_info = JSON.stringify(fullInfoObj);

  //
  ConnectivityMap.set(gHostConnectivity, connObj );

}

var lastTime= new Date().getTime();
setInterval(function () {
  var currentTime = new Date().getTime();
  var diffTime = (currentTime - lastTime);
  console.log('[Check HeartBeat] Wakeup to check... diffTime= ' + diffTime + ' ms');
  lastTime = currentTime;
  //
  VgwMap.forEach(function(obj, key) {

    if ( obj.dev_last_hb_time > 0 ){
      var devDiffTime = currentTime - obj.dev_last_hb_time;
      console.log('[Check HeartBeat][' + key + ']: diffTime = ' + devDiffTime + ' ms');
      if ( devDiffTime > HEART_BEAT_TIMEOUT * 3 ){
        console.log('[Check HeartBeat][' + key + ']: HeartBeat timeout');
        removeVGW( key );
        return;
      }
      //
    }
  });

} , HEART_BEAT_CHECK_INTERVAL);

var mqttConnectCallback =  function () {
  console.log('[wisesnail_msgmgr] Mqtt connected !!!!');
  //
  addHostConnectivity();
  //
  Client.subscribe('/cagent/admin/+/notify');
  Client.subscribe('/cagent/admin/+/agentinfoack');
  Client.subscribe('/cagent/admin/+/willmessage');
  Client.subscribe('/cagent/admin/+/agentactionreq');
  Client.subscribe('/cagent/admin/+/deviceinfo'); 
   
}

var mqttMessageCallback = function (topic, message){
  // message is Buffer 
/*
  console.log('--------------------------------------------------------------');
  console.log('topic=' + topic.toString() );
  console.log('msg=' + message.toString());
*/
  try {
      var re = /\0/g;
      msg = message.toString().replace(re, '');
      var jsonObj = JSON.parse(msg);
  } catch (e) {
      console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
      console.error(e);
      return;
  }
  
  var msg_type = getMsgType(topic, jsonObj);
  var device_id = topic.toString().split('/')[3];
  
  
  switch(msg_type){
    case MSG_TYPE.VGW_HEART_BEAT:
      {
        console.log('[' + device_id + ']' + ': receive VGW_HEART_BEAT');
        //dev_last_hb_time
        if ( doesVGWNeedReConnect(device_id) === true ) {
          //Send Re-connect
          console.log('['+ device_id +'] send Re-connect');
          var messageObj = {};
          buildRequestMessageObj( MSG_TYPE.VGW_RECONNECT, messageObj);
          sendRequestToWiseSnail( device_id, messageObj);
        }
        else{
          if ( VgwMap.has(device_id) === true ) {
            console.log('[' + device_id + '] Update last heart beat time');
            var vgw = VgwMap.get(device_id);
            vgw.dev_last_hb_time = new Date().getTime();
            VgwMap.set(device_id, vgw );     
          }   
        }

        break;
      }
    case MSG_TYPE.VGW_CONNECT:
      {
          console.log('[' + device_id + ']' + ': receive VGW_CONNECT');
          removeVGW( device_id );
         
          if ( VgwMap.has(device_id) === false ) {
              //copy DEVICE_OBJ object as vgw objcect
              var vgw = JSON.parse(JSON.stringify(DEVICE_OBJ));
          }
          else{
             var vgw = VgwMap.get(device_id);
          }
              
          vgw.connect = message.toString();            
          vgw.vgw_id = device_id.toString();
          VgwMap.set(device_id, vgw );        
          /*Send get capability request to WiseSnail*/

          var messageObj = {};
          buildRequestMessageObj( MSG_TYPE.VGW_GET_CAPABILITY_REQUEST, messageObj);
          sendRequestToWiseSnail( device_id, messageObj);

          //genHtmlEventObj.emit(groupName, EVENT.eConnectivity_Capability, '1111111');

          break;
      }
    case MSG_TYPE.VGW_DISCONNECT:
      {
          console.log('[' + device_id + ']' + ': receive VGW_DISCONNECT');
          removeVGW( device_id );
          break;        
      }      
    case MSG_TYPE.VGW_OS_INFO:
      {
          console.log('[' + device_id + ']' + ': receive VGW_OS_INFO, IP=' + jsonObj.susiCommData.osInfo.IP);
          if ( VgwMap.has(device_id) === true ) {
                var vgw=VgwMap.get(device_id);
                if (typeof vgw !== 'undefined') {
                  vgw.os_info = message.toString();
                }
          }
          else{
               console.log('receive [MSG_TYPE.VGW_OS_INFO]: VgwMap does not exist !!');
          }
          
          break;
      }
    case MSG_TYPE.VGW_INFO_SPEC:
      {
          console.log('[' + device_id + ']' + ': receive VGW_INFO_SPEC');
          if ( VgwMap.has(device_id) === true ) {
                var vgw = VgwMap.get(device_id);
                if (typeof vgw !== 'undefined') {
                  vgw.dev_info_spec = message.toString();
                  //add ConnectivityMap here
                    var infoObj=jsonObj.susiCommData.infoSpec.IoTGW;
                    //console.log( '[ConnectivityMapUpdate] Start-------------------------------------------------');
                    connectivityMapUpdate(MSG_TYPE.VGW_INFO_SPEC, device_id , vgw.os_info, 0, 'null', infoObj); 
                    //console.log( '[ConnectivityMapUpdate] End---------------------------------------------------');                  
                }
          }
          else{
               console.log('[MSG_TYPE.VGW_INFO_SPEC]: VgwMap does not exist !!');
          }
          //
          sendTotalConnectivityCapabilityEvent();
          break;
      }
    case MSG_TYPE.VGW_INFO:
      {
          console.log('[' + device_id + ']' + ': receive VGW_INFO');
          if ( VgwMap.has(device_id) === true ) {
                var vgw=VgwMap.get(device_id);
                if (typeof vgw !== 'undefined') {
                  vgw.dev_info = message.toString();
                  var infoObj=jsonObj.susiCommData.data.IoTGW;
                  //console.log( '[ConnectivityMapUpdate] Start-------------------------------------------------');
                  connectivityMapUpdate(MSG_TYPE.VGW_INFO, device_id , vgw.os_info, 0, 'null', infoObj); 
                  //console.log( '[ConnectivityMapUpdate] End---------------------------------------------------');   
                }
          }
          else{
               console.log('[MSG_TYPE.VGW_INFO]: VgwMap does not exist !!');
          }  
          break;
      }
    case MSG_TYPE.VGW_WILLMESSAGE:
      {
          console.log('[' + device_id + ']' + ': receive VGW_WILLMESSAGE');
          removeVGW( device_id );
          break;
      }
    case MSG_TYPE.CONNECTIVITY_SET_RESPONSE:
      {
          console.log('[' + device_id + ']' + ': receive CONNECTIVITY_SET_RESPONSE');
          var sessionID = jsonObj.susiCommData.sessionID ;
          var sessionObj = MqttPublishMap.get(sessionID);

          if ( typeof sessionObj !== 'undefined' ){
                updateDevFullInfo( URI_TYPE.CONNECTIVITY, sessionObj, jsonObj);
          }

          if ( jsonObj.susiCommData.sensorInfoList.e[0].StatusCode === STATUS.OK){
            var resMsg = sessionObj.data;     
            sessionObj.callback(sessionObj.res, STATUS.OK, resMsg);
          }
          else{
            var resMsg = '';
            sessionObj.callback(sessionObj.res, STATUS.NOT_ACCEPTABLE, resMsg);
          }

          MqttPublishMap.remove(sessionID);
          break;
      }
    case MSG_TYPE.SENSORHUB_CONNECT:
      {
          console.log('[' + device_id + ']' + ': receive SENSORHUB_CONNECT');
          sensorHubMapUpdate(MSG_TYPE.SENSORHUB_CONNECT, device_id, message.toString());
          break;
      }
    case MSG_TYPE.SENSORHUB_DISCONNECT:
      {
          console.log('[' + device_id + ']' + ': receive SENSORHUB_DISCONNECT');
          if ( SensorHubMap.has(device_id) === true ) {
            var sensorhub = SensorHubMap.get(device_id);
            sensorhub.connect = message.toString();
          }
      }
    case MSG_TYPE.SENSORHUB_INFO_SPEC:
      {
         console.log('[' + device_id + ']' + ': receive SENSORHUB_INFO_SPEC');
         sensorHubMapUpdate(MSG_TYPE.SENSORHUB_INFO_SPEC, device_id, message.toString());
         break;
      }
    case MSG_TYPE.SENSORHUB_INFO:
      {    
        //console.log('[' + device_id + ']' + ': SENSORHUB_INFO');
        sensorHubMapUpdate(MSG_TYPE.SENSORHUB_INFO, device_id, message.toString());
        break;
      }
    case MSG_TYPE.SENSORHUB_SET_RESPONSE:
      {
        console.log('[' + device_id + ']' + ': receive SENSORHUB_SET_RESPONSE');
        var sessionID = jsonObj.susiCommData.sessionID ;
        var sessionObj = MqttPublishMap.get(sessionID);

        if ( typeof sessionObj !== 'undefined' ){
          updateDevFullInfo( URI_TYPE.SENSORHUB, sessionObj, jsonObj);
        }

        if ( jsonObj.susiCommData.sensorInfoList.e[0].StatusCode === STATUS.OK){
          var resMsg = sessionObj.data;
          sessionObj.callback(sessionObj.res, STATUS.OK, resMsg);
        }
        else{
          var resMsg = '';
          sessionObj.callback(sessionObj.res, STATUS.NOT_ACCEPTABLE, resMsg);
        }

        MqttPublishMap.remove(sessionID);
        break;
      }
    case MSG_TYPE.VGW_QUERY_HEART_BEAT_VALUE_RESPONSE:
      {
        console.log('[' + device_id + ']' + ': receive VGW_QUERY_HEART_BEAT_VALUE_RESPONSE');
        console.log('HeartBeat rate = ' + jsonObj.susiCommData.heartbeatrate); 
        break;
      }
    case MSG_TYPE.VGW_CHANGE_HEART_BEAT_VALUE_RESPONSE:
      {
        console.log('[' + device_id + ']' + ': receive VGW_CHANGE_HEART_BEAT_VALUE_RESPONSE');
        console.log('HeartBeat change result = ' + jsonObj.susiCommData.result); 
        break;
      }
    case MSG_TYPE.UNKNOWN:
      console.log('[' + device_id + ']MSG_TYPE.UNKNOWN');
      break;
    default:
      console.log('[' + device_id + '] unknown message');
      break;
  }
  //console.log('--------------------------------------------------------------');  
}

function doesVGWNeedReConnect( deviceID ){

 if ( VgwMap.has(deviceID) === false ) {
   console.log('[doesVGWNeedReConnect] Cannot find ' + deviceID );
   return true;
 }

 var vgw = VgwMap.get(deviceID);
 if ( typeof vgw === 'undefined' ){
   console.log('[doesVGWNeedReConnect] ' + deviceID + ' data undefined' );
   return true;
 }

 if ( vgw.vgw_id === 'null'  || vgw.connect === 'null' || vgw.os_info === 'null' ){
/*
   console.log('---------------------' );
   console.log('vgw.vgw_id = ' + vgw.vgw_id );
   console.log('vgw.connect = ' + vgw.connect );
   console.log('vgw.os_info = ' + vgw.os_info );
   console.log('---------------------' );
*/
   console.log('[doesVGWNeedReConnect] ' + deviceID + ' data corrupted' );
   return true;
 }

 var connectivityCount = 0;
 ConnectivityMap.forEach(function(obj, key) {
   if ( vgw.vgw_id === obj.vgw_id ){
     console.log('[doesVGWNeedReConnect] ConnectivityMap key = ' + key);
     connectivityCount ++;
   }
 });

 if ( connectivityCount === 0 ){
   console.log('[doesVGWNeedReConnect] connectivity info not found');
   return true;
 }

 console.log('[doesVGWNeedReConnect] ' + deviceID + ' data OK' );
 return false;
}

function buildRequestMessageObj( requestType, messageObj){

  if ( requestType === MSG_TYPE.VGW_CHANGE_HEART_BEAT_VALUE_REQUEST){
    messageObj.susiCommData = {};
    messageObj.susiCommData.commCmd = 129;
    messageObj.susiCommData.handlerName = 'general';
    messageObj.susiCommData.heartbeatrate = HEART_BEAT_TIMEOUT/1000;
    messageObj.susiCommData.sessionID = new Date().getTime();
  }

  if ( requestType === MSG_TYPE.VGW_QUERY_HEART_BEAT_VALUE_REQUEST){
    messageObj.susiCommData = {};
    messageObj.susiCommData.commCmd = 127;
    messageObj.susiCommData.handlerName = 'general';
    messageObj.susiCommData.sessionID = new Date().getTime();
  }

  if ( requestType === MSG_TYPE.VGW_RECONNECT ){
    messageObj.susiCommData = {};
    messageObj.susiCommData.commCmd = 125;
    messageObj.susiCommData.handlerName = 'general';
    
    messageObj.susiCommData.response = {};
    messageObj.susiCommData.response.statuscode = 4;
    messageObj.susiCommData.response.msg = 'Reconnect';

  }

  if ( requestType === MSG_TYPE.VGW_GET_CAPABILITY_REQUEST ){
    messageObj.susiCommData = {};
    messageObj.susiCommData.requestID = 1001;
    messageObj.susiCommData.catalogID = 4;
    messageObj.susiCommData.commCmd = 2051;
    messageObj.susiCommData.handlerName = 'general';
  }
}

function sendRequestToWiseSnail( deviceID, messageObj ){
  
  var topic = '/cagent/admin/' + deviceID + '/agentcallbackreq';
  var message = JSON.stringify(messageObj);
  Client.publish(topic, message);
}

function updateDevFullInfo( uriType, sessionObj, responsJsonObj ){
/*
  console.log('-----------');
  console.log('Response RESTful path == ' + responsJsonObj.susiCommData.sensorInfoList.e[0].n);
  console.log('SET RESPONSE: sessionObj.path = ' + sessionObj.uri + ', sessionObj.data = ' + sessionObj.data);
  console.log('-----------');
*/
  var dataObj = JSON.parse(sessionObj.data);
  var restObj = {};
  //create RESTful array value object
  restObj.path = responsJsonObj.susiCommData.sensorInfoList.e[0].n.replace(/^\//g,'');
  if (uriType === URI_TYPE.CONNECTIVITY){
    var device_id = sessionObj.uri.split('/')[3];
    var objMap = ConnectivityMap;
  }

  if (uriType === URI_TYPE.SENSORHUB){
    var device_id = sessionObj.uri.split('/')[1];
    var objMap = SensorHubMap;
    restObj.path = 'SenHub/' + restObj.path;
  }

  Object.keys(dataObj).forEach(function(key) {
    restObj.valKey = key;
    restObj.val = dataObj[key];
    //console.log('key = ' + key + ', val= ' + dataObj[key]);
  });

  var mapID = device_id + '/' + restObj.path;
  //console.log('SET RESPONSE: mapID = ' + mapID);
  RESTFulArrayValueMap.set( mapID, restObj);

  /*set object to RESTful array value Map*/
  //console.log('restObj.path = ' + restObj.path + ', restObj.valKey= ' + restObj.valKey + ', restObj.val= ' + restObj.val);

  if ( objMap.has(device_id) === true ) {
    var deviceObj = objMap.get(device_id);
    var keyStr = '';
    var fullInfoObj = JSON.parse(deviceObj.dev_full_info);
    //console.log('deviceObj.dev_full_info =' + deviceObj.dev_full_info);

    setRESTFulArrayValueMapToJsonObj( device_id, keyStr, fullInfoObj);
    deviceObj.dev_full_info = JSON.stringify(fullInfoObj);
    //console.log('SET RESPONSE: deviceObj.dev_full_info = ' + deviceObj.dev_full_info);

  }

}

function getObjKeyValue( jsonObj, outObj){

  for (key in jsonObj) {
      if (jsonObj.hasOwnProperty(key)) {
          if ( outObj.is_n_sv_format === true ){
            if ( jsonObj[key] === outObj.key ){
              //console.log( 'key =======>' + key + ', keyVal=======>' + jsonObj[key]);
              //console.log( 'key =======>' + 'sv' + ', keyVal=======>' + jsonObj['sv']);     
              if ( typeof jsonObj['sv'] === 'object'){ 
                outObj.result = JSON.stringify(jsonObj['sv']);
              }
              else{
                outObj.result = jsonObj['sv'];
              }
              return;
            }
          }
          else {
            if ( key === outObj.key ){
              //console.log( 'key =======>' + key + ', keyVal=======>' + jsonObj[key]);
              if ( typeof jsonObj[key] === 'object'){ 
                outObj.result = JSON.stringify(jsonObj[key]);
              }
              else{
                outObj.result = jsonObj[key];
              }
              return;
            }
          }
      }
   }
 //
  for (key in jsonObj) {
      if (jsonObj.hasOwnProperty(key)) {
          //console.log(key + " ===> " + jsonObj[key] + " ,type = " + typeof jsonObj[key]);
          if (typeof jsonObj[key] === 'object' ){
              getObjKeyValue( jsonObj[key], outObj);
          }
      }
   }

   return;  
}

function getDeviceCapability( devInfoSpecObj, devInfoObj ){
                  
  for ( var i=0 ; i < devInfoSpecObj['Info']['e'].length ; i++){
    if ( typeof devInfoSpecObj['Info']['e'][i].v !== 'undefined' && devInfoObj['Info']['e'][i].v !== 'undefined' ){
      devInfoSpecObj['Info']['e'][i].v =  devInfoObj['Info']['e'][i].v;
      //console.log('v..devInfoSpecObj.e['+ i +'].n = ' +  JSON.stringify(devInfoSpecObj['Info']['e'][i]['n']));
    }
                     
    if ( typeof devInfoSpecObj['Info']['e'][i].sv !== 'undefined' && devInfoObj['Info']['e'][i].sv !== 'undefined' ){
      devInfoSpecObj['Info']['e'][i].sv =  devInfoObj['Info']['e'][i].sv;
      //console.log('sv..devInfoSpecObj.e['+ i +'].n = ' +  JSON.stringify(devInfoSpecObj['Info']['e'][i]['n']));
    } 
                     
    if ( typeof devInfoSpecObj['Info']['e'][i].bv !== 'undefined' && devInfoObj['Info']['e'][i].bv !== 'undefined' ){
      devInfoSpecObj['Info']['e'][i].bv =  devInfoObj['Info']['e'][i].bv;
      //console.log('bv..devInfoSpecObj.e['+ i +'].n = ' +  JSON.stringify(devInfoSpecObj['Info']['e'][i]['n']));
    }                        
                      
    //console.log('devInfoSpecObj.e['+ i +'] = ' +  JSON.stringify(devInfoSpecObj['Info']['e'][i]));
  }  
  
}

function connectivityMapUpdate( messageType, vgw_id, osInfo, layer, connType, infoObj){
  
  //console.log( 'Start-------------------------------------------------');
  layer++;
  for (key in infoObj) {
      if (infoObj.hasOwnProperty(key)) {
          //console.log('layer=' + layer + 'key =====================' + key);
          if ( key === 'bn' ){
              if ( layer === 2 ){
                connType = infoObj[key];
                //console.log('layer=' + layer + 'connType =====================' + connType);
              }
              if ( layer === 3 ){
                 //console.log( 'messageType =' + messageType + ', [layer] :' + layer + ', connType='+ connType +', infoObj[' + key +']=======>' + infoObj[key] );
                 var device_id=infoObj[key];
                 if ( ConnectivityMap.has(device_id) === false ) {
                   //copy DEVICE_OBJ object as vgw objcect
                   var connectivity = JSON.parse(JSON.stringify(DEVICE_OBJ));
                 }
                 else{
                   var connectivity = ConnectivityMap.get(device_id);
                 }
                
                 if ( messageType === MSG_TYPE.VGW_INFO_SPEC ){ 
                   connectivity.vgw_id = vgw_id;
                   connectivity.os_info = osInfo;
                   connectivity.conn_id = device_id; 
                   connectivity.conn_type = connType;
                   connectivity.dev_info_spec = JSON.stringify(infoObj);

                   var keyStr = '';
                   var fullInfoObj = JSON.parse(connectivity.dev_info_spec);
                   buildFullInfoObj(false, keyStr, fullInfoObj);
                   connectivity.dev_full_info = JSON.stringify(fullInfoObj);

                   /* send generate html event */
                   var rootRESTful = 'IoTGW/' + connType + '/' + device_id; 
                   genHtmlEventObj.emit(groupName, EVENT.eConnectivity_GenHtml, rootRESTful,connectivity.dev_full_info);
/*
                   console.log('-----------');
                   console.log('connectivity.dev_full_info ==== ' + connectivity.dev_full_info);
                   console.log('-----------');
*/
                 }
                   
                 if ( messageType === MSG_TYPE.VGW_INFO ){
  
                   var tmpInfoSpecObj = JSON.parse(connectivity.dev_info_spec);
                   getDeviceCapability(tmpInfoSpecObj, infoObj);
                   
                   connectivity.dev_info = JSON.stringify(infoObj);
                   connectivity.dev_capability = JSON.stringify(tmpInfoSpecObj);
                  
                    
                   //
                   var keyStr = '';
                   var partialInfoObj = JSON.parse(connectivity.dev_info);
                   var fullInfoObj = JSON.parse(connectivity.dev_full_info);
                   convertJsonObjToRESTFulArrayValueMap(device_id, keyStr, partialInfoObj);
                   
                   var keyStr = '';
                   setRESTFulArrayValueMapToJsonObj( device_id, keyStr, fullInfoObj);
                   connectivity.dev_full_info = JSON.stringify(fullInfoObj);

                   /*create message obj for event*/

                   if ( getOSType( connectivity.os_info ) === OS_TYPE.NONE_IP_BASE ){
                     var eventMsgObj={};
                     eventMsgObj.IoTGW = {};
                     eventMsgObj.IoTGW[connType]={};
                     eventMsgObj.IoTGW[connType][device_id]={};
                     eventMsgObj.IoTGW[connType][device_id]= JSON.parse(connectivity.dev_info);
                     eventMsgObj.IoTGW[connType].bn = connType;
                     eventMsgObj.IoTGW.ver = 1;
                     eventEmitterObj.emit(groupName, groupName, WSNEVENTS[1].event, eventMsgObj); 
                   }
                   /*
                   console.log('-----------');
                   console.log('UPDATE: connectivity.dev_full_info ==== ' + connectivity.dev_full_info);
                   console.log('-----------');
                   */

                 }
                 
                 //console.log('[' + device_id + ']' + ': update ConnectivityMap key pairs');
                 ConnectivityMap.set(device_id, connectivity );                
                 return;
              }
               
          }
      }
   }
 //
  for (key in infoObj) {
      if (infoObj.hasOwnProperty(key)) {
          //console.log(key + " ===> " + jsonObj[key] + " ,type = " + typeof jsonObj[key]);
          if (typeof infoObj[key] === 'object' ){
              connectivityMapUpdate(messageType, vgw_id, osInfo, layer, connType, infoObj[key]);
          }
      }
   }  
  
   layer--;
   return;    
}


function sensorHubMapUpdate(messageType, device_id, message){
          
  //console.log('message ===== ' + message);
  ConnectivityMap.forEach(function(obj, key) {
    //console.log('obj.dev_info = ' + obj.dev_info);
    var infoObj = JSON.parse ( obj.dev_info );
    var outObj = {
                  key:'SenHubList',
                  is_n_sv_format: true, 
                  result:''
                 };
    getObjKeyValue(infoObj, outObj);
    var sensorHubList = outObj.result.split(',');
    for (var i=0 ; i < sensorHubList.length ; i++){
      if(sensorHubList[i] === device_id){
        //console.log('sensorHub(' + device_id + '): conn_id=' + obj.conn_id + ', vgw_id=' + obj.vgw_id  );
        if ( SensorHubMap.has(device_id) === false ) {
          var sensorhub = JSON.parse(JSON.stringify(DEVICE_OBJ));
        }
        else{
          var sensorhub = SensorHubMap.get(device_id);
        }
        sensorhub.vgw_id = obj.vgw_id;
        sensorhub.os_info = obj.os_info;
        sensorhub.conn_id = obj.conn_id;
        sensorhub.conn_type = obj.conn_type;
        if ( MSG_TYPE.SENSORHUB_CONNECT === messageType){
          sensorhub.connect = message;
          var eventMsgObj = JSON.parse(message);
          var wsnEvent = WSNEVENTS[3].event; //eSenHub_Disconnect
          if ( eventMsgObj.susiCommData.status === 1 || eventMsgObj.susiCommData.status === '1' ){
            wsnEvent = WSNEVENTS[2].event; //eSenHub_Connected
          }
   
          eventEmitterObj.emit(groupName, groupName, wsnEvent, eventMsgObj);
        }

        if ( MSG_TYPE.SENSORHUB_INFO_SPEC === messageType){
          sensorhub.dev_info_spec = message;
	  var keyStr = '';
	  var fullInfoObj = JSON.parse(message);
          var eventMsgObj = JSON.parse(JSON.stringify(fullInfoObj.susiCommData.infoSpec));

          buildFullInfoObj(false, keyStr, fullInfoObj);
	  sensorhub.dev_full_info = JSON.stringify(fullInfoObj.susiCommData.infoSpec);
          console.log('-----------');
          //console.log('sensorhub.dev_full_info ==== ' + sensorhub.dev_full_info);
          eventMsgObj.agentID = device_id;
          eventEmitterObj.emit(groupName, groupName, WSNEVENTS[4].event, eventMsgObj);
          console.log('-----------');
        }        
        if ( MSG_TYPE.SENSORHUB_INFO === messageType){
          sensorhub.dev_info = message;

  
	  var keyStr = '';
          var partialInfoObj = JSON.parse(message);
          var fullInfoObj = JSON.parse(sensorhub.dev_full_info);
          convertJsonObjToRESTFulArrayValueMap(device_id, keyStr, partialInfoObj.susiCommData.data);

	  var keyStr = '';
	  setRESTFulArrayValueMapToJsonObj( device_id, keyStr, fullInfoObj); 
	  sensorhub.dev_full_info = JSON.stringify(fullInfoObj);
          console.log('-----------');
          //console.log('UPDATE: sensorhub.dev_full_info ==== ' + sensorhub.dev_full_info);
          //console.log('WSNEVENTS  ==== ' + WSNEVENTS[5].event);
          var eventMsgObj = partialInfoObj.susiCommData.data;
          eventMsgObj.agentID = device_id;
          eventEmitterObj.emit(groupName, groupName, WSNEVENTS[5].event, eventMsgObj);
          console.log('-----------');
            
          /*
	  RESTFulArrayValueMap.forEach(function(obj, key) {
            console.log('UPDATE: key = '+ key + ', restPath = ' + obj.path + ', restPath val = ' + obj.val);
          });
          */
        }            
        
        SensorHubMap.set(device_id, sensorhub );

        if ( MSG_TYPE.SENSORHUB_CONNECT === messageType){
          /**/
          if ( getOSType( sensorhub.os_info ) === OS_TYPE.IP_BASE ){
            
            sendIPBaseConnectivityInfoEvent();

          }

        }        
        return;
      }
    }
  });
               
}

function sendTotalConnectivityCapabilityEvent(){
  //send total connectivity capability EVENT
  var totalCapability = getIoTGWConnectivityCapability( DATATYPE.CONNECTIVITY_INFOSPEC );
  var eventMsgObj = JSON.parse(totalCapability);
  eventEmitterObj.emit(groupName, groupName, WSNEVENTS[0].event, eventMsgObj);
}

function sendIPBaseConnectivityInfoEvent(){

  var connectivityObj = ConnectivityMap.get(gHostConnectivity);
  var connType = connectivityObj.conn_type;
  var deviceID = connectivityObj.conn_id;
  var connectivityInfo = buildIPBaseConnectivityInfo();

  var eventMsgObj={};
  eventMsgObj.IoTGW = {};
  eventMsgObj.IoTGW[connType]={};
  eventMsgObj.IoTGW[connType][deviceID]={};
  eventMsgObj.IoTGW[connType][deviceID]= JSON.parse(connectivityInfo);
  eventMsgObj.IoTGW[connType].bn = connType;
  eventMsgObj.IoTGW.ver = 1;
  eventEmitterObj.emit(groupName, groupName, WSNEVENTS[1].event, eventMsgObj);

}


function getMsgType(topic, jsonObj){
  
    var topic_arr = topic.toString().split('/');
    //console.log('=======> topic_arr[4] =' + topic_arr[4]);
  
    if ( topic_arr[4] === 'notify'){
      return MSG_TYPE.VGW_HEART_BEAT;
    }

    if ( topic_arr[4] === 'agentinfoack'){
        //console.log('jsonObj.susiCommData.type =' + jsonObj.susiCommData.type + ',jsonObj.susiCommData.commCmd ='  + jsonObj.susiCommData.commCmd);
        if ( jsonObj.susiCommData.type === 'IoTGW' && 
             jsonObj.susiCommData.commCmd === 1 ){
             if ( jsonObj.susiCommData.status === 1){
                 return MSG_TYPE.VGW_CONNECT;
             }
             if ( jsonObj.susiCommData.status === 0){
                 return MSG_TYPE.VGW_DISCONNECT;
             }
        }
      
        if ( jsonObj.susiCommData.type === 'SenHub' && 
             jsonObj.susiCommData.commCmd === 1 ){
             if ( jsonObj.susiCommData.status === '1' || jsonObj.susiCommData.status === 1){
                 return MSG_TYPE.SENSORHUB_CONNECT;
             }
             if ( jsonObj.susiCommData.status === '0' || jsonObj.susiCommData.status === 0){
                 return MSG_TYPE.SENSORHUB_DISCONNECT;
             }
        }      
    }
  
    if ( topic_arr[4] === 'agentactionreq'){
        if ( jsonObj.susiCommData.commCmd === 116 ){
            return MSG_TYPE.VGW_OS_INFO;
        }
      
        if ( jsonObj.susiCommData.commCmd === 2052 ){
            if ( typeof jsonObj.susiCommData.infoSpec.IoTGW !== 'undefined' ){
                return MSG_TYPE.VGW_INFO_SPEC;
            }  
          
            if ( typeof jsonObj.susiCommData.infoSpec.SenHub !== 'undefined' ){
                return MSG_TYPE.SENSORHUB_INFO_SPEC;
            }  
        }
       
        if ( jsonObj.susiCommData.commCmd === 526 ){
            if ( jsonObj.susiCommData.handlerName === 'SenHub' ){
                return MSG_TYPE.SENSORHUB_SET_RESPONSE;
            }

            if ( jsonObj.susiCommData.handlerName === 'IoTGW' ){
                return MSG_TYPE.CONNECTIVITY_SET_RESPONSE;
            }
        }
  
        if ( jsonObj.susiCommData.commCmd === 128 ){
          return MSG_TYPE.VGW_QUERY_HEART_BEAT_VALUE_RESPONSE;
        }

        if ( jsonObj.susiCommData.commCmd === 130 ){
          return MSG_TYPE.VGW_CHANGE_HEART_BEAT_VALUE_RESPONSE;
        }
 
    }
  
    if ( topic_arr[4] === 'deviceinfo'){   
        if ( jsonObj.susiCommData.commCmd === 2055 ){
            if ( typeof jsonObj.susiCommData.data.IoTGW !== 'undefined' ){
                return MSG_TYPE.VGW_INFO;
            }  
          
            if ( typeof jsonObj.susiCommData.data.SenHub !== 'undefined' ){
                return MSG_TYPE.SENSORHUB_INFO;
            }          
          
        }       
    }  
  
    if ( topic_arr[4] === 'willmessage'){
        return MSG_TYPE.VGW_WILLMESSAGE;
    }
    
    
    return MSG_TYPE.UNKNOWN;
}

function getStatusFromMsg( connectMsg ){
  
  //console.log('connectMsg = ' + connectMsg);
  try {
      var msgObj = JSON.parse(connectMsg.toString());
      var status = msgObj.susiCommData.status;
      if ( status === 1 || status === '1' ){
        return 'on';
      }    
  } catch (e) {
      return 'off';
  }   
  
  return 'off';
}


function getOSType( osInfo ){

  //console.log('[getOSType]osInfo = ' + osInfo);
  if ( typeof osInfo === 'undefined' || osInfo === 'null' ){
    return 'null';
  }
 
  try {
      var os_info_obj = JSON.parse( osInfo );
  } catch (e) {
      console.error(e);
      return 'null';
  }  
  
  if ( is_ip_valid( os_info_obj.susiCommData.osInfo.IP) === true ){
    //console.log('osInfo : ' + OS_TYPE.IP_BASE);
    return OS_TYPE.IP_BASE;
  }
  else{
    //console.log('osInfo : ' + OS_TYPE.NONE_IP_BASE);
    return OS_TYPE.NONE_IP_BASE;
  }  
  
  return 'null';
  
}

function removeVGW( vgw_id ){

    console.log('['+ vgw_id + '] removeVGW');
    //console.log('--------------------------------------------------------------');
  
    //if ( getOSType(vgw_id) == OS_TYPE.NONE_IP_BASE){
    var osType;
      //console.log('Show all VgwMap. count= ' + VgwMap.count());
      VgwMap.forEach(function(obj, key) {
        //console.log('key = ' + key); 
        if ( vgw_id === key ){
          //console.log('VgwMap.remove() key = ' + key);
          osType = getOSType(obj.os_info);
          VgwMap.remove(key);
        }
      });
/*     
      console.log('Show all VgwMap. count= ' + VgwMap.count());
      console.log('--------------------------------------------------------------');    
      console.log('Show all ConnectivityMap. count= ' + ConnectivityMap.count());
*/
      ConnectivityMap.forEach(function(obj, key) {
        //console.log('key = ' + key); 
        if ( vgw_id === obj.vgw_id ){
/*
           console.log('ConnectivityMap.remove() key = ' + key);

           console.log('----');
           console.log('vgw_id = ' + obj.vgw_id);
           console.log('conn_id = ' + obj.conn_id);
           console.log('conn_type = ' + obj.conn_type);
           console.log('os info = \n' + obj.os_info);
           console.log('conn dev_info_spec = \n' + obj.dev_info_spec);
           console.log('conn dev_info = \n' + obj.dev_info);
           console.log('conn dev_capability = \n' + obj.dev_capability);
           //console.log('conn_type = ' + obj.conn_type);
           console.log('----');
*/
           ConnectivityMap.remove(key);

           /* send generate html event */
           var rootRESTful = 'IoTGW/' + obj.conn_type + '/' + key; 
           genHtmlEventObj.emit(groupName, EVENT.eConnectivity_DelHtml, rootRESTful, '');
        }
      });
/*     
      console.log('Show all ConnectivityMap. count= ' + ConnectivityMap.count());
      console.log('--------------------------------------------------------------');
      console.log('Show all SensorHubMap. count= ' + SensorHubMap.count());
*/
      SensorHubMap.forEach(function(obj, key) {
        //console.log('key = ' + key); 
        if ( vgw_id === obj.vgw_id ){
/*
           console.log('SensorHubMap.remove() key = ' + key);
           
           console.log('----');
           console.log('vgw_id = ' + obj.vgw_id);
           console.log('conn_id = ' + obj.conn_id);
           console.log('conn_type = ' + obj.conn_type);
           console.log('os info = \n' + obj.os_info);
           console.log('sensorhub connect = \n' + obj.connect);
           console.log('sensorhub dev_info_spec = \n' + obj.dev_info_spec);
           console.log('sensorhub dev_info = \n' + obj.dev_info);
           //console.log('conn_type = ' + obj.conn_type);
           console.log('----');
           */
           SensorHubMap.remove(key);
        }
      });     
      //console.log('Show all SensorHubMap. count= ' + SensorHubMap.count());
    //}
    //console.log('--------------------------------------------------------------');  

    if ( osType === OS_TYPE.NONE_IP_BASE){
      //send total connectivity capability EVENT
      sendTotalConnectivityCapabilityEvent();
    }

    if ( osType === OS_TYPE.IP_BASE){
      sendIPBaseConnectivityInfoEvent();
    }

}

function is_ip_valid( ip ){
  
  //console.log( '[is_ip_valid] ip = ' + ip);
  var ip_arr=ip.split('.');
  //console.log( 'ip_arr.length = ' + ip_arr.length);
  if (ip_arr.length !== 4 ){
      return false;
  }
  
  if ( (ip_arr[0] >= 0 && ip_arr[0] < 256) &&
       (ip_arr[1] >= 0 && ip_arr[1] < 256) &&
       (ip_arr[2] >= 0 && ip_arr[2] < 256) &&
       (ip_arr[3] >= 0 && ip_arr[3] < 256)){
      return true;      
  }
  
  return false;
}

function listRESTFulObj( apiPath, keyStr, jsonObj, outputObj ){
/*
  if ( apiPath === '/' ){
    //console.log( 'apiPath =======>' + apiPath + ', KeyVal=======>' + JSON.stringify(jsonObj));
    outputObj.ret = JSON.stringify(jsonObj);
    return;
  }
*/
  for (key in jsonObj) {
    if (jsonObj.hasOwnProperty(key)) {
      //var jsonKeyStr = keyStr + '/' + key ;
      //if ( apiPath === jsonKeyStr || apiPath === jsonKeyStr + '/' ){
      if ( jsonObj[key] !== 'object'){
         console.log( 'keyStr =======>' + keyStr + ', jsonKeyVal=======>' + JSON.stringify(jsonObj[key]));
        //outputObj.ret = JSON.stringify(jsonObj[key]);
      }
    }
  }
  //
  for (key in jsonObj) {
    if (jsonObj.hasOwnProperty(key)) {
      if (typeof jsonObj[key] === 'object' ){
        listRESTFulObj( apiPath, keyStr + '/' + key, jsonObj[key], outputObj);
      }
    }
  }

  return;

}


function setRESTFulArrayValueMapToJsonObj( deviceID, keyStr, jsonObj){
  
  var regexArrayPath = new RegExp('e\/[0-9]+\/n\/?$');
	
  for (key in jsonObj) {
    if (jsonObj.hasOwnProperty(key)) {
      var jsonKeyStr = keyStr + '/' + key ; 
      if ( typeof jsonObj[key] !==  'object' ){
	if ( regexArrayPath.test(jsonKeyStr) ){
	  var restPath = jsonKeyStr.replace(/e\/[0-9]+\/n\/?$/g,jsonObj[key]);
 	
	  restPath = restPath.replace(/^\//g,'');
          var mapID = deviceID + '/' + restPath;
	  var restObj = RESTFulArrayValueMap.get(mapID);
	  if ( typeof restObj !== 'undefined'){
	    //console.log( '[setRESTFulArrayValueMapToJsonObj]jsonKeyStr =======>' + jsonKeyStr + ', jsonKeyVal=======>' + JSON.stringify(jsonObj[key]));	  
            jsonObj[restObj.valKey] = restObj.val;
            RESTFulArrayValueMap.remove(mapID);
            //console.log( 'RESTFulArrayValueMap.count() = ' + RESTFulArrayValueMap.count());
	  }
	}
        
      }
    }
  }
  //
  for (key in jsonObj) {
    if (jsonObj.hasOwnProperty(key)) {
      if (typeof jsonObj[key] === 'object' ){
        setRESTFulArrayValueMapToJsonObj( deviceID, keyStr + '/' + key, jsonObj[key]);
      }
    }
  }  
	
  return;  

}


function buildFullInfoObj( removeASMkey, keyStr, jsonObj){
  
  var regexArrayPath = new RegExp('e\/[0-9]+\/[A-Z a-z 0-9]+\/?$');
  var regexArrayOKPath = new RegExp('e\/[0-9]+\/(n|v|sv|bv|asm)\/?$');
  var regexArrayASMPath = new RegExp('e\/[0-9]+\/asm\/?$');
	
  for (key in jsonObj) {
    if (jsonObj.hasOwnProperty(key)) {
      var jsonKeyStr = keyStr + '/' + key ;
      //console.log( '[buildFullInfoObj]jsonKeyStr =======>' + jsonKeyStr + ', jsonKeyVal=======>' + JSON.stringify(jsonObj[key]));
      if ( regexArrayPath.test(jsonKeyStr) ){
	if (regexArrayOKPath.test(jsonKeyStr) === false ){
          //console.log('delete ' + jsonKeyStr);
          delete jsonObj[key];
	}

	if (regexArrayASMPath.test(jsonKeyStr) === true ){
          if ( removeASMkey === true ){
            delete jsonObj[key];
          }
	}

      }
    }
  }
  //
  for (key in jsonObj) {
    if (jsonObj.hasOwnProperty(key)) {
      if (typeof jsonObj[key] === 'object' ){
	//outputObj[key] = {};
        buildFullInfoObj( removeASMkey, keyStr + '/' + key, jsonObj[key]);
      }
    }
  }  
	
  return;  

}


function convertJsonObjToRESTFulArrayValueMap( deviceID, keyStr, jsonObj ){
  
  var regexArrayPath = new RegExp('e\/[0-9]+\/n\/?$');
	
  for (key in jsonObj) {
    if (jsonObj.hasOwnProperty(key)) {
      var jsonKeyStr = keyStr + '/' + key ; 
      if ( typeof jsonObj[key] !==  'object' ){
	if ( regexArrayPath.test(jsonKeyStr) ){
          //console.log( '[convertJsonObjToRESTFulArrayValueMap]jsonKeyStr =======>' + jsonKeyStr + ', jsonKeyVal=======>' + JSON.stringify(jsonObj[key]));
	  var restPath = jsonKeyStr.replace(/e\/[0-9]+\/n\/?$/g,jsonObj[key]);
          var restPathValue;
          var restPathValueKey;
          if ( typeof jsonObj['v'] !== 'undefined' ){
            restPathValue = jsonObj['v'];
 	    restPathValueKey = 'v';
	  }
          if ( typeof jsonObj['sv'] !== 'undefined' ){
            restPathValue = jsonObj['sv']; 
            restPathValueKey = 'sv';
	  }	
          if ( typeof jsonObj['bv'] !== 'undefined' ){
            restPathValue = jsonObj['bv'];
	    restPathValueKey = 'bv';	  
	  }		
	  
	  var restObj = {};
          restObj.path = restPath.replace(/^\//g,'');
	  restObj.val = restPathValue;
          restObj.valKey = restPathValueKey;
	  //outputObj.push(restObj);
          //console.log('mapID = ' + deviceID + '/' + restObj.path );
	  RESTFulArrayValueMap.set(deviceID + '/' + restObj.path, restObj);
          //console.log('restObj.path = ' + restObj.path + ', restObj.val = ' + restObj.val + ', restObj.valKey = ' + restObj.valKey);
	}
        
      }
    }
  }
  //
  for (key in jsonObj) {
    if (jsonObj.hasOwnProperty(key)) {
      if (typeof jsonObj[key] === 'object' ){
        convertJsonObjToRESTFulArrayValueMap( deviceID, keyStr + '/' + key, jsonObj[key]);
      }
    }
  }  
	
  return;  

}


function getRESTFulValue( apiPath, keyStr, jsonObj, outputObj ){
  
  if ( apiPath === '/' ){
    //console.log( 'apiPath =======>' + apiPath + ', KeyVal=======>' + JSON.stringify(jsonObj));
    outputObj.ret = JSON.stringify(jsonObj);
    return;
  } 
 
  for (key in jsonObj) {
    if (jsonObj.hasOwnProperty(key)) {
      var jsonKeyStr = keyStr + '/' + key ; 
      if ( apiPath === jsonKeyStr || apiPath === jsonKeyStr + '/' ){
        //console.log( 'jsonKeyStr =======>' + jsonKeyStr + ', jsonKeyVal=======>' + JSON.stringify(jsonObj[key]));
        outputObj.ret = JSON.stringify(jsonObj[key]);
      }
    }
  }
  //
  for (key in jsonObj) {
    if (jsonObj.hasOwnProperty(key)) {
      if (typeof jsonObj[key] === 'object' ){
        getRESTFulValue( apiPath, keyStr + '/' + key, jsonObj[key], outputObj);
      }
    }
  }  
	
  return;  

}

function getIoTGWConnectivityCapability( dataType ){
  
  //console.log('getTotalConnectivityCapability');
  IoTGWCapability = {};
  IoTGWCapability.IoTGW = {};

  /*Add NONE_IP_BASE  connectivity*/
  ConnectivityMap.forEach(function(obj, key) {
   
    if ( getOSType( obj.os_info ) !== OS_TYPE.NONE_IP_BASE ){
      return;
    } 
    
    //console.log('----');
    //console.log('key = ' + key); 
    //console.log('conn dev_capability = \n' + obj.dev_capability);
    var connectivityName = obj.conn_id;
    var connectivityType = obj.conn_type;
    
    if ( typeof IoTGWCapability.IoTGW[connectivityType] === 'undefined' ){
      IoTGWCapability.IoTGW[connectivityType] = {};
    }      
    if ( typeof IoTGWCapability.IoTGW[connectivityType][connectivityName] === 'undefined' ){
      IoTGWCapability.IoTGW[connectivityType][connectivityName] = {};
    } 
        
    switch (dataType){
      case DATATYPE.CONNECTIVITY_INFOSPEC:
      {
        IoTGWCapability.IoTGW[connectivityType][connectivityName] = JSON.parse(obj.dev_info_spec);
        break;
      }
      case DATATYPE.CONNECTIVITY_INFO:
      {
        var keyStr = '';
        var infoObj = JSON.parse(obj.dev_full_info);
        buildFullInfoObj(true, keyStr, infoObj);
        IoTGWCapability.IoTGW[connectivityType][connectivityName] = infoObj;
        break;
      }
      case DATATYPE.CONNECTIVITY_CAPABILITY:
      {
        var keyStr = '';
        var infoObj = JSON.parse(obj.dev_full_info);
        buildFullInfoObj(false, keyStr, infoObj);
        IoTGWCapability.IoTGW[connectivityType][connectivityName] = infoObj;
        break;
      }
      default:
      {
        break;
      }
    }
    //console.log('----');

  });       

  
  /*Add IP_BASE  connectivity*/
  var obj = ConnectivityMap.get(gHostConnectivity);

  if ( typeof obj !== 'undefined' ){ 
    var connectivityName = obj.conn_id;
    var connectivityType = obj.conn_type;

    if ( typeof IoTGWCapability.IoTGW[connectivityType] === 'undefined' ){
      IoTGWCapability.IoTGW[connectivityType] = {};
    }      
    if ( typeof IoTGWCapability.IoTGW[connectivityType][connectivityName] === 'undefined' ){
      IoTGWCapability.IoTGW[connectivityType][connectivityName] = {};
    } 

    switch (dataType){
      case DATATYPE.CONNECTIVITY_INFOSPEC:
      {
        IoTGWCapability.IoTGW[connectivityType][connectivityName] = JSON.parse(obj.dev_info_spec);
        break;
      }
      case DATATYPE.CONNECTIVITY_INFO:
      {
        var connectivityInfo = buildIPBaseConnectivityInfo();
/*
        console.log('*****************************************');
        console.log('[getIoTGWConnectivityCapability] connectivityInfo =' + connectivityInfo);
        console.log('*****************************************');
*/
        IoTGWCapability.IoTGW[connectivityType][connectivityName] = JSON.parse(connectivityInfo);
        break;
      }
      default:
      {
        break;
      }
    }
  }
  return JSON.stringify(IoTGWCapability);
}

function buildIPBaseConnectivityInfo(){

  var obj = ConnectivityMap.get(gHostConnectivity);
  var keyStr = '';
  var devinfoObj = JSON.parse(obj.dev_info);

  var sensorHubAllList = '';
  SensorHubMap.forEach(function(obj, key) {
    if ( getOSType(obj.os_info ) === OS_TYPE.IP_BASE ){
      if ( sensorHubAllList.length !== 0){
        sensorHubAllList += ',';
      }
      sensorHubAllList += key;
    }
  });

  devinfoObj['Info']['e'][0]['sv'] = sensorHubAllList;
  devinfoObj['Info']['e'][1]['sv'] = sensorHubAllList;
/*
  console.log('*****************************************');
  console.log('[buildIPBaseConnectivityInfo] devinfoObj =' + JSON.stringify(devinfoObj));
  console.log('*****************************************');
*/
  return JSON.stringify(devinfoObj);
}

function getUriType( uri ){

  var uriList = uri.split('/');
  var category = uriList[0];

  if ( category === 'Connectivity' ){
    return URI_TYPE.CONNECTIVITY ;
  }

  if ( category === 'SenHub' ){
    return URI_TYPE.SENSORHUB ;
  }

  return 'null';
}

 
function getRESTfulArrayValue( isAsm, path, jsonData, outObj ){
  
  var newPath = path.replace(/\/([A-Z a-z 0-9]*)\/?$/g,'/e/');
  var pathPattern = path.replace(/\/([A-Z a-z 0-9]*)\/?$/g,'/');
  var keyName = path.replace(pathPattern, '');
  keyName = keyName.replace(/\//g, '');
  var i=0;
  var InfoPath;
  var tmpValueObj;

  //console.log('============== newPath = ' + newPath);
  //console.log('============== pathPattern = ' + pathPattern);
  //console.log('============== keyName = ' + keyName);

    do{
        tmpValue = {};
        keyStr = '' ;
        InfoPath = newPath + i;
        //console.log('InfoPath  = ' + InfoPath);
        getRESTFulValue(InfoPath, keyStr, jsonData, tmpValue);
        //console.log('tmpValue.ret = ' + tmpValue.ret);

        if ( typeof tmpValue.ret !== 'undefined' ){
          tmpValueObj = JSON.parse(tmpValue.ret);
          if ( tmpValueObj.n === keyName ){
            if ( typeof tmpValueObj.v !== 'undefined'){
              var result = { v:tmpValueObj.v };
              outObj.ret = JSON.stringify(result);
            }
            if ( typeof tmpValueObj.sv !== 'undefined'){
              var result = { sv:tmpValueObj.sv };
              outObj.ret = JSON.stringify(result);
            }
            if ( typeof tmpValueObj.bv !== 'undefined'){
              var result = { bv:tmpValueObj.bv };
              outObj.ret = JSON.stringify(result);
            }
            if ( isAsm === true ){
              //console.log('tmpValue.asm = ' + tmpValueObj.asm );
              //get access rigth
              outObj.ret = tmpValueObj.asm;
            }
             
            return 0;
          }
        }
        i++;
    } while ( typeof tmpValue.ret !== 'undefined' );

    return -1;
}

function getConnectivityRESTful( uri, outObj ){

  var path = uri.replace(/^Connectivity/g,'');
  var tmpValue;
  var capability;
  var jsonData;
  var keyStr;

  /* ex: RESTful API path: Connectivity/ */
  if ( path === '' || path === '/' ){
    capability = getIoTGWConnectivityCapability( DATATYPE.CONNECTIVITY_INFOSPEC );
    jsonData = JSON.parse(capability);
    keyStr = '';
    getRESTFulValue('/', keyStr, jsonData, outObj);
    return RESTFUL_VAL_TYPE.SUCCESS;
  }

  tmpValue = {};
  capability = getIoTGWConnectivityCapability( DATATYPE.CONNECTIVITY_INFO );
  jsonData = JSON.parse(capability);
  keyStr = '';
  getRESTFulValue(path, keyStr, jsonData, tmpValue);
  //console.log('=============== tmpValue.ret = ' + tmpValue.ret);
  
  if ( typeof tmpValue.ret !== 'undefined' ){
    outObj.ret = tmpValue.ret;
    return RESTFUL_VAL_TYPE.SUCCESS;
  }
  else{
    if ( getRESTfulArrayValue(false, path, jsonData, outObj) === 0){
      var capability = getIoTGWConnectivityCapability( DATATYPE.CONNECTIVITY_CAPABILITY );
      var jsonData = JSON.parse(capability);
      var asmObj = {};
      asmObj.ret = {};
      getRESTfulArrayValue(true, path, jsonData, asmObj);
      console.log('=============== asmObj.ret = ' + asmObj.ret);
      if ( asmObj.ret === 'w' || asmObj.ret === 'rw' || asmObj.ret === 'wr' ){
        return RESTFUL_VAL_TYPE.ARRAY_ELEMENT ;
      }

      return RESTFUL_VAL_TYPE.READ_ONLY;
    }
  }

  return RESTFUL_VAL_TYPE.ERROR;

}

function getSensorHubRESTful(uri, outObj){

  var path = uri.replace(/\/$/g,'');
  var pathArray = path.split('/');
  var deviceID = pathArray[1];

  //console.log('[getSensorHubRESTful] path = ' + path + ', pathArray length = ' + pathArray.length);
  var regexAllSenHubList = new RegExp('\/AllSenHubList\/?$');
  var regexDevInfo = new RegExp('\/DevInfo\/?$');

  /* SenHub/AllSenHubList */
  if ( pathArray.length === 2 && regexAllSenHubList.test(path) ){

    //console.log('DATATYPE.SENSORHUB_ALL_LIST ===============');
    var sensorHubAllListObj = {};
    sensorHubAllListObj.n = 'AllSenHubList';
    sensorHubAllListObj.sv = '';

    var sensorHubAllList = '';
    SensorHubMap.forEach(function(obj, key) {
      if ( sensorHubAllList.length !== 0){
        sensorHubAllList += ',';
      }
      sensorHubAllList += key;
    });
    sensorHubAllListObj.sv = sensorHubAllList;
    outObj.ret = JSON.stringify(sensorHubAllListObj);
    return RESTFUL_VAL_TYPE.SUCCESS;
  }

  /* SenHub/<deviceID> */
  if ( pathArray.length === 2 ){
    //console.log('DATATYPE.SENSORHUB_INFOSPEC_INFO ===============');
    if ( SensorHubMap.has(deviceID) === true ){
      var sensorHub = SensorHubMap.get(deviceID);
      if (typeof sensorHub !== 'undefined') {
        var devInfoObj = JSON.parse(sensorHub.dev_info_spec);
        outObj.ret = JSON.stringify(devInfoObj.susiCommData.infoSpec);
        return RESTFUL_VAL_TYPE.SUCCESS;
      }
    }
  }

  /* SenHub/<deviceID>/DevInfo */
  if ( pathArray.length === 3 && regexDevInfo.test(path) ){
    
    //console.log('DATATYPE.SENSORHUB_CONNECT_INFO ===============');
    if ( SensorHubMap.has(deviceID) === true ){
      var sensorHub = SensorHubMap.get(deviceID);
      if (typeof sensorHub !== 'undefined') {
        var devInfoObj = JSON.parse(sensorHub.connect);
        outObj.ret = JSON.stringify(devInfoObj.susiCommData);
        return RESTFUL_VAL_TYPE.SUCCESS;
      }
    }

  }

  /**/
  if ( pathArray[2] === 'SenHub' ){

    //console.log('DATATYPE.SENSORHUB_INFO ===============');
    var pathPattern = pathArray[0] + '/' + pathArray[1] + '/' + pathArray[2];
    var newPath = path.replace(pathPattern,'');
    if ( newPath === '' ){
      newPath = '/';
    }
    //console.log('[getSensorHubRESTful] newPath = ' + newPath );
    
    if ( SensorHubMap.has(deviceID) === true ){
      var sensorHub = SensorHubMap.get(deviceID);
      if (typeof sensorHub !== 'undefined') {
        var devInfoObj = JSON.parse(sensorHub.dev_full_info);
        buildFullInfoObj(true, keyStr, devInfoObj);
        //var devInfoObj = JSON.parse(sensorHub.dev_full_info);
        var tmpValue = {};
        var jsonData = devInfoObj.SenHub;
        var keyStr = '';
        getRESTFulValue(newPath, keyStr, jsonData, tmpValue);
        //console.log('=============== tmpValue.ret = ' + tmpValue.ret);

        if ( typeof tmpValue.ret !== 'undefined' ){
          outObj.ret = tmpValue.ret;
          return RESTFUL_VAL_TYPE.SUCCESS;
        }
        else{
          if ( getRESTfulArrayValue(false, newPath, jsonData, outObj) === 0){
            var devInfoObj = JSON.parse(sensorHub.dev_full_info);
            buildFullInfoObj(false, keyStr, devInfoObj);
            var tmpValue = {};
            var jsonData = devInfoObj.SenHub;
            var keyStr = '';
            var asmObj={};
            asmObj.ret = {};
            getRESTfulArrayValue(true, newPath, jsonData, asmObj);
            console.log('=============== asmObj.ret = ' + asmObj.ret);
            if ( asmObj.ret === 'w' || asmObj.ret === 'rw' || asmObj.ret === 'wr' ){
              return RESTFUL_VAL_TYPE.ARRAY_ELEMENT ;
            }
            
            return RESTFUL_VAL_TYPE.READ_ONLY;
          }
        }

      }
    }
  }


  return RESTFUL_VAL_TYPE.ERROR;

}


var wsnget = function( uri, inParam, outData ) {
   
  console.log('uri = ' + uri);
  var uriType = getUriType ( uri );

  switch( uriType ){
    case URI_TYPE.CONNECTIVITY:
    {

      if ( getConnectivityRESTful(uri, outData) === RESTFUL_VAL_TYPE.ERROR ){
        console.log('get ' + uri + ' fail !!!');
      }

      break;
    }
    case URI_TYPE.SENSORHUB:
    {
      console.log('URI_TYPE.SENSORHUB ===============');
      if ( getSensorHubRESTful(uri, outData) === RESTFUL_VAL_TYPE.ERROR ){
        console.log('get ' + uri + ' fail !!!');
      }
      break;
    }
    default:
    {
      break;
    }
  }
      
  console.log('-----------------------------------------');
  console.log(outData.ret);
  console.log('-----------------------------------------'); 
 
  var code = STATUS.NOT_FOUND;
  
  if ( typeof outData.ret !== 'undefined' ){
    outData.ret = outData.ret.toString();
    code = STATUS.OK;
  }

  return code;
}

var wsnput = function( path, data, res, callback ) {
  
  console.log('wsnput uri ==== ' + path);
  console.log('wsnput data ==== ' + JSON.stringify(data));
  //
  var code = STATUS.OK;
  var uri = path;
  var outData = {};
  outData.ret ={};
  var uriType = getUriType ( uri );

  switch( uriType ){
    case URI_TYPE.CONNECTIVITY:
    {
      //console.log('[wsnput] URI_TYPE.CONNECTIVITY ===============');
      var ret = getConnectivityRESTful(uri, outData);

      if ( ret === RESTFUL_VAL_TYPE.READ_ONLY ){
        callback(res, STATUS.METHOD_NOT_ALLOWED, '{"sv":"Read Only"}');
        code = STATUS.METHOD_NOT_ALLOWED;
        //console.log('[wsnput] return STATUS.METHOD_NOT_ALLOWED ===============');
        return code;
      }

      if ( ret !== RESTFUL_VAL_TYPE.ARRAY_ELEMENT ){
        console.log('[wsnput] connectivity: ' + uri + ' is not array element !!!');
        callback(res, STATUS.BAD_REQUEST, '{"sv":"Bad Request"}');
        code = STATUS.BAD_REQUEST;
        //console.log('[wsnput] return STATUS.BAD_REQUEST ===============');
        return code;
      }

      break;
    }
    case URI_TYPE.SENSORHUB:
    {
      //console.log('[wsnput] URI_TYPE.SENSORHUB ===============');
      var ret = getSensorHubRESTful(uri, outData);
 
      if ( ret === RESTFUL_VAL_TYPE.READ_ONLY ){
        callback(res, STATUS.METHOD_NOT_ALLOWED, '{"sv":"Read Only"}');
        code = STATUS.METHOD_NOT_ALLOWED;
        //console.log('[wsnput] return STATUS.METHOD_NOT_ALLOWED ===============');
        return code;
      }

      if ( ret !== RESTFUL_VAL_TYPE.ARRAY_ELEMENT ){
        console.log('[wsnput] sensor hub: ' + uri + ' is not array element !!!');
        callback(res, STATUS.BAD_REQUEST, '{"sv":"Bad Request"}');
        code = STATUS.BAD_REQUEST;
        //console.log('[wsnput] return STATUS.BAD_REQUEST ===============');
        return code;
      }
      //console.log('[wsnput] outData.ret ===============', outData.ret);
      break;
    }
    default:
    {
      break;
    }
  }
  //
  var sessionID = Uuid.v4().replace(/-/g,'');
  var uriType = getUriType ( path );

  var sessionObj = {};
  sessionObj.uriType = uriType;
  sessionObj.callback = callback;
  sessionObj.uri = path;
  sessionObj.res = res;
  sessionObj.data = JSON.stringify(data);
  MqttPublishMap.set(sessionID, sessionObj);


  var setMsgObj = {};
  setMsgObj.susiCommData = {};
  setMsgObj.susiCommData.sensorIDList = {};
  setMsgObj.susiCommData.sensorIDList.e = [];
  setMsgObj.susiCommData.sessionID = sessionID;
  setMsgObj.susiCommData.commCmd = 525;
  setMsgObj.susiCommData.requestID = 0;
  setMsgObj.susiCommData.sendTS = new Date().getTime();

  switch( uriType ){
    case URI_TYPE.CONNECTIVITY:
    {
      console.log('wsnput URI_TYPE.CONNECTIVITY');
      var deviceID = path.split('/')[3];
      console.log('deviceID = ' + deviceID);
      var connectivity = ConnectivityMap.get(deviceID);
      if ( typeof connectivity === 'undefined'){
       // console.log('connectivity.vgw_id = ' + connectivity.vgw_id);
        console.log('not found connectivity');
        break;
      }
      var deviceID = connectivity.vgw_id;
      var topic = '/cagent/admin/'+ deviceID + '/agentcallbackreq';
      //var pathPattern = 'Connectivity/';
      var RESTfulPath = path.replace(/^Connectivity/g,'');
      var setData = JSON.parse(JSON.stringify(data));
      console.log('RESTful path = ' + RESTfulPath);

      setData.n = RESTfulPath;
      setMsgObj.susiCommData.sensorIDList.e.push(setData);
      setMsgObj.susiCommData.agentID = deviceID;
      setMsgObj.susiCommData.handlerName = 'IoTGW';

      break;
    }
    case URI_TYPE.SENSORHUB:
    {
      console.log('wsnput URI_TYPE.SENSORHUB');
      var deviceID = path.split('/')[1];
      var topic = '/cagent/admin/'+ deviceID + '/agentcallbackreq';
      var pathPattern = 'SenHub/' + deviceID + '/';
      var RESTfulPath = path.replace(pathPattern,'');
      var setData = JSON.parse(JSON.stringify(data));
      /*RESTful path ex: SenHub/Info/Name */
      console.log('RESTful path = ' + RESTfulPath);

      setData.n = RESTfulPath; 
      setMsgObj.susiCommData.sensorIDList.e.push(setData);
      setMsgObj.susiCommData.agentID = deviceID;
      setMsgObj.susiCommData.handlerName = 'SenHub';

      break;
    }
    default:
    {
      break;
    }
  }

  /**/
  var message = JSON.stringify(setMsgObj);
  console.log('--------------------------------------------------------------');
  console.log('publish SET message to ' + deviceID);
  console.log('message = ' + message);
  console.log('--------------------------------------------------------------');

  Client.publish(topic, message);

  /*set timeout*/
  //var timeout = 30000;
  setTimeout(function () {
    console.log('[Timeout] session ID ===' + sessionID );
    if ( MqttPublishMap.has(sessionID) === true){
      var sessionObj = MqttPublishMap.get(sessionID);
      if ( typeof sessionObj !== 'undefined' ){
        sessionObj.callback(sessionObj.res, STATUS.NOT_ACCEPTABLE, '');
        MqttPublishMap.remove(sessionID);
        console.log('[Timeout] MqttPublishMap.count() =' + MqttPublishMap.count())
      }
    }
  } , TIMEOUT, sessionID);

  code = STATUS.OK;
  return code;
}


var addListener = function( userFn )
{
    if( userFn !== undefined )
        eventEmitterObj.addListener(groupName,userFn);
}

var addGenHtmlListener = function( userFn )
{
    if( userFn !== undefined )
        genHtmlEventObj.addListener(groupName,userFn);
}


module.exports = {
  group: groupName,
  routers: routers,
  get: wsnget,
  put: wsnput,
  events: WSNEVENTS,
  addListener: addListener,
  addGenHtmlListener: addGenHtmlListener,
  wsclients: wsclients,  
};

Client.on('connect', mqttConnectCallback );
Client.on('message', mqttMessageCallback);

