var EVENT = require('./html_event.js');
var fs = require('fs');

var genHtml = function(html_event, rootRESTful, data){
  //console.log('[html_generator.js] EVENT : ' + html_event + ', rootRESTful = ' + rootRESTful + ', data = ' + data);

  var deviceID = rootRESTful.split('/')[2];
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
  
  /* create directory */
  dir = './' + deviceID;
  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
  }
  fileName = dir + '/index.htm'

  fs.writeFile(fileName, '', function(err) {
    if(err) {
      return console.log(err);
    }
    //console.log("The file was saved!");
  });
 
  /* List RESTful API */
  RESTfulList.forEach(function(value){
    console.log(value);
    var RESTful = value.split(',')[0];
    var asm = value.split(',')[1];
    //RESTfulAPI = rootRESTful + RESTfulAPI;
    var html_form = genDeviceHtml( rootRESTful, RESTful, asm );

    fs.appendFile(fileName, html_form, function (err) {

    });

  });
}

function genDeviceHtml( rootRESTful, RESTful, asm ){

  var line1 = '<form action=\"set.cgi\">\r\n';
  var line2 = RESTful +':\r\n'; 
  var line3 = '<input type=\"text\" name=\"';
  var line4 = rootRESTful + RESTful;
  var line5 = '\" value=\"\"'; 
  var line6 = ' readonly>\r\n';
  var line6_1 = '>\r\n';
  var line7 = '<input type=\"submit\" name=\"restful\" value=\"Get\">\r\n';
  var line7_1 = '<input type=\"submit\" name=\"restful\" value=\"Set\">\r\n';
  var line8 = '</form>\r\n';
  var line9 = '\r\n';
  
  if ( asm === 'r' ){ 
    var html_form = line1 + line2 + line3 + line4 + line5 + line6 + line7 + line8 + line9;
  }
  else{
    var html_form = line1 + line2 + line3 + line4 + line5 + line6_1 + line7 + line7_1 + line8 + line9;
  }

  return html_form;

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
          console.log('jsonObj[asm] = ' + jsonObj['asm']);
          RESTfulList.push(restPath+','+jsonObj['asm']);
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
