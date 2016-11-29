
var hAppCtl = require('./wisesnail_msgmgr.js');
var generator = require('./html_generator.js');

var procEventGenHtml = function(eventType, rootRESTful, data){

  //console.log('[index.js] event: '+ eventType + ' data: '+ data );
  generator.genHtml(eventType, rootRESTful, data);

}
hAppCtl.addGenHtmlListener( procEventGenHtml );
/*
hAppCtl.notification.on(EVENT.eConnectivity_Capability, function(data) {
    // process data when someEvent occurs
  console.log('[index.js] EVENT : ' + EVENT.eConnectivity_Capability + ', data = ' + data);
  generator.genHtml(EVENT.eConnectivity_Capability, data);
});
*/

var procFn = function (req,res,next) {
    //console.log('grop:'+APIs.group);
    if( APIs.usrObj != undefined )
        APIs.usrObj(req,res,next,APIs);
}

var websktFn = function (ws) {

    if( APIs.websktCb != undefined )
        APIs.websktCb( ws, APIs );
}

var APIs = {
  group: hAppCtl.group,
  routers: hAppCtl.routers,
  events:hAppCtl.events,
  get: hAppCtl.get,
  put: hAppCtl.put,
  post: undefined,
  delete: undefined,
  procFn: procFn,
  usrObj: undefined,
  addListener: hAppCtl.addListener,
  websktFn: websktFn,
  websktCb: undefined,
  wsclients:  hAppCtl.wsclients,      
};



module.exports.APIs = APIs;






