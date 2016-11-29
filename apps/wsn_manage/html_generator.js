var EVENT = require('./html_event.js');

var genHtml = function(html_event, rootRESTful, data){
  console.log('[html_generator.js] EVENT : ' + html_event + ', rootRESTful = ' + rootRESTful + ', data = ' + data);

  var dataObj = JSON.parse(data);
/*
  dataObj.Net = {};
  dataObj.Net.e = [];
  dataObj.Net.e.push({n:'Net1', sv:'',asm:'r'});
  dataObj.Net.e.push({n:'Net2', sv:'',asm:'r'});
  dataObj.Net.e.push({n:'Name', sv:'Net',asm:'r'});
  dataObj.Net.bn = 'Net';

  console.log('data = ' + JSON.stringify(dataObj));
*/
  var RESTfulList = [];
  convertJsonObjToRESTful('',dataObj, RESTfulList);
  
  //List RESTful API
  RESTfulList.forEach(function(value){
    console.log(value);
  });
}

function convertJsonObjToRESTful( keyStr, jsonObj, RESTfulList){

  var regexArrayPath = new RegExp('e\/[0-9]+\/n\/?$');

  for (key in jsonObj) {
    if (jsonObj.hasOwnProperty(key)) {
      var jsonKeyStr = keyStr + '/' + key ;
      if ( typeof jsonObj[key] !== 'object'){
	if ( regexArrayPath.test(jsonKeyStr) ){
	  var restPath = jsonKeyStr.replace(/e\/[0-9]+\/n\/?$/g,jsonObj[key]);
          console.log('restPath = ' + restPath);
          RESTfulList.push(restPath);
        }
         //console.log( 'keyStr =======>' + jsonKeyStr + ', jsonKeyVal=======>' + JSON.stringify(jsonObj[key]));
      }
    }
  }
  //
  for (key in jsonObj) {
    if (jsonObj.hasOwnProperty(key)) {
      if (typeof jsonObj[key] === 'object' ){
        convertJsonObjToRESTful( keyStr + '/' + key, jsonObj[key], RESTfulList);
      }
    }
  }

  return;

}

module.exports = {
    genHtml: genHtml,
};
