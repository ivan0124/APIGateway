var EVENT = require('./html_event.js');
var fs = require('fs');

var genHtml = function(html_event, rootRESTful, data){

  console.log('[html_generator.js] EVENT : ' + html_event + ', rootRESTful = ' + rootRESTful + ', data = ' + data);
  
  var devType = rootRESTful.split('/')[0];
  var deviceID = rootRESTful.split('/')[2];
  var connectivityType = rootRESTful.split('/')[1];
  var connectivityID='';
 
  if ( html_event === 'eConnectivity_DelHtml' || html_event === 'eSensorHub_DelHtml'){
    console.log('[html_generator.js] EVENT : ' + html_event );

    try
    {
      //remove device_table html
      var dir = '../wsn_setting/device_table';
      var fileName = dir + '/' + deviceID + '.htm';
      fs.unlinkSync(fileName);
      //remove device_html
      var dir = '../wsn_setting/device_html/' + deviceID;
      var fileName = dir + '/index.htm';
      fs.unlinkSync(fileName);
      fs.rmdirSync(dir);
    }
    catch (e)
    {
        console.log(fileName + ": " + e);
        return;
    }

    return;
  }


  if ( html_event === 'eSensorHub_GenHtml'){
    //console.log( 'deviceID =' + deviceID + ', connectivityType = ' + connectivityType);
    var connectivityID = rootRESTful.split('/')[3];
    rootRESTful = devType + '/' + deviceID;
    console.log( 'connectivityID =' + connectivityID);
    //console.log( 'rootRESTful =' + rootRESTful);
  }

  if ( html_event === 'eConnectivity_GenHtml'){
    rootRESTful = 'Connectivity/' + rootRESTful;
  }


  if ( html_event === 'eConnectivity_GenHtml' || html_event === 'eSensorHub_GenHtml'){
    var dataObj = JSON.parse(data);
 
    //generate device_table data
    var dir = '../wsn_setting/device_table';
    var fileName = dir + '/' + deviceID + '.htm';
    var html_trtd = genDeviceTableElement( html_event, deviceID, connectivityType, connectivityID );
    
    fs.writeFile(fileName, html_trtd, function(err) {
      if(err) {
        return console.log(err);
      }
      //console.log("The file was saved!");
    });
    var RESTfulList = [];
    convertJsonObjToRESTful('',dataObj, RESTfulList);
  
    // create directory
    var dir = '../wsn_setting/device_html/' + deviceID;
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir);
    }
    var fileName = dir + '/index.htm'

    fs.writeFile(fileName, '', function(err) {
      if(err) {
        return console.log(err);
      }
      //console.log("The file was saved!");
    });
 
    // List RESTful API
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

}

function genDeviceTableElement( html_event, deviceID, connectivityType, connectivityID ){

  var line1 = '<tr> <td><a href=\"./device_html/index.cgi?device_id=';
  var line2 = deviceID;
  var line3 = '\">'
  var line4 = deviceID;
  var line5 = '</a></td> <td>';
  if ( html_event === 'eConnectivity_GenHtml' ){
    var line6 = 'Connectivity';
  }
  else{
    var line6 = 'Sensor Hub';
  }
  var line7 = '</td><td><a href=\"./device_html/index.cgi?device_id=';
  if ( html_event === 'eConnectivity_GenHtml' ){
    var line8 = deviceID;
  }
  else{
    var line8 = connectivityID;
  }
  var line9 = '\">';
  if ( html_event === 'eConnectivity_GenHtml' ){
    var line10 = deviceID;
  }
  else{
    var line10 = connectivityID;
  }
  var line11 = '</a></td><td>';
  var line12 = connectivityType;
  var line13 = '</td> </tr>'; 
  var html_trtd = line1 + line2 + line3 + line4 + line5 + line6 + line7 + line8 + line9 +line10 + line11 + line12 + line13;

  return html_trtd;
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
