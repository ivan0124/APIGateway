
var hAppCtl = require('./wsn_manage.js');


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
    events: hAppCtl.events,
    get: hAppCtl.get,
    put: hAppCtl.put,
    post: hAppCtl.post,
    delete: hAppCtl.delete,
    procFn: procFn,
    usrObj: undefined,
    addListener: hAppCtl.addListener,    
    websktFn: websktFn,
    websktCb: undefined,
    wsclients:  hAppCtl.wsclients,    
};






module.exports.APIs = APIs;






