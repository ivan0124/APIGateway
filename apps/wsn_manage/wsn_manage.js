var STATUS = require('../../inc/statusCode.js').STATUS_CODE;


var RESULT ={"Net":{"e": [{"n":"Health","v":86}],"bn":"Net"}};

var wsnget = function( uri, inParam, outData ) {
    var code = STATUS.INTERNAL_SERVER_ERROR;
    outData.ret = RESULT;
    code = STATUS.OK;
    return code;
}

var wsnput = function( path, callback ) {
    var code = STATUS.INTERNAL_SERVER_ERROR;
    outData.ret = RESULT;
    code = STATUS.ACCEPTED;    
    return code;
}

module.exports = {
  get: wsnget,
  put: wsnput
};