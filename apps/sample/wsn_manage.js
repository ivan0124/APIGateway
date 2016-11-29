// App Plug-in Module Sample
var STATUS = require('../../inc/statusCode.js').STATUS_CODE;


const EventEmitter = require('events');
var eventEmitterObj = new EventEmitter();


// Test Data
var GET_RESULT ={"Net":{"e": [{"n":"Health","v":86}],"bn":"Net"}};
var PUT_RESULT = {"n":"GPIO","bv":0};

var test1 = 0;

var cb = undefined;

var res1 = undefined;
var res2 = undefined;

/* ====================================================================
    Note
    You need implement below 4 items integrate with EIS RESTful API Interfaces.
    1. <Definition> : Declared your App module
    2. <RESTful>    : get / put / post / delete
    3. <Event>      : for evnet trigger Functions
    4. <Export>     : Export your function map to general interface
    ==================================================================== 
*/


// <1> ============== <Definition> ==============

// Entry path of your app => uri: restapi/WSNManage/ => If URI is matching your group name will pass to this Module
const groupName = 'WSNManage';

// path: router path : => rui: restapi/WSNManage/* => path match restapi/WSNManage/ will pass to this module
// action: Support which HTTP Action ( GET, PUT, POST, DELETE )
// ex: [{"path":"senhub/data","action":"GET,PUT"}];  => Match URI Route: restapi/WSNManage/senhub/data   Action: 'GET'
var routers = [{"path":"*","action":"GET,PUT"}];

// Define Event Type for auto update by websocket  
var WSNEVENTS = [{"event":"eConnectivity_Capability"},
                 {"event":"eConnectivity_UpdateData"},
                 {"event":"eSenHub_Connected"},
                 {"event":"eSenHub_Disconnect"},
                 {"event":"eSenHub_Capability"},
                 {"event":"eSenHub_UpdateData"}];

var wsclients = [];
//    ============== <Definition> ==============





// <2>  ============== <RESTful> ==============

// Description: process RESTful 'GET' Request
var wsnget = function( uri, inParam, outData ) {
    var code = STATUS.INTERNAL_SERVER_ERROR;
    outData.ret = JSON.stringify(GET_RESULT);
    code = STATUS.OK;
    return code;
}

// Description: process RESTful 'PUT' Request 
var wsnput = function( path, data, res, callback ) {
    cb = callback;
    if( test1 == 0)
        res1=res;
    else   
        res2=res;

    test1++; 

    if(test1==2)
        test1 = 0;
}
//     ============== <RESTful> ==============




// <3>  ============== <Event> ==============
var addListener = function( userFn )
{
    if( userFn != undefined )
        eventEmitterObj.addListener(groupName,userFn);
}



//     ============== <Event> ==============



// <4>   ============== <Export> ==============
module.exports = {
  group: groupName,
  routers: routers,
  get: wsnget,
  put: wsnput,
  events: WSNEVENTS,
  addListener: addListener,
  wsclients: wsclients,
};
//      ============== <Export> ==============










// Below section code is Demo ONLY

var UpdateCapability = function()
{
    // trigger event for webocket and socket.io
    eventEmitterObj.emit(groupName, groupName, 'eConnectivity_UpdateData', GET_RESULT);

    // asyn callback for put response
    if( res1 != undefined) {
        cb(res1,STATUS.OK,'{"n":"123"}');
        res1 = undefined;
    }
    else if( res2 != undefined) {
        cb(res2,STATUS.OK,'{"n":"567"}')
        res2 = undefined;
    }
}


var autoUpdate = function()
{
    setInterval(UpdateCapability, 10000);
}

autoUpdate();

