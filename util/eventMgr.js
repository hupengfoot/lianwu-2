var eventMgr = {};
var util = require('util');
var events = require('events');
var path = require('path');
var eventDefine = require(path.join(global.rootPath, 'define/event'));

var myEvent = new events.EventEmitter();

var _ = {};
_.getName = function(iType){
    var iLen = eventDefine.define.length;
    for(var i=0; i!=iLen; ++i){
        if(eventDefine.define[i].iType == iType){
            return eventDefine.define[i].szName;
        }
    }
};

eventMgr.emit = function(iType, param){
    var szName = _.getName(iType);
    if(szName){
        var iCount = events.EventEmitter.listenerCount(myEvent, szName);
        console.log("emit a event %s listeners count %d", szName, iCount);
        myEvent.emit(szName, param);
    }else{
        console.error("can not get type name %d val %s", iType, param);
    }
};

eventMgr.register = function(iType, func){
    var szName = _.getName(iType);
    if(szName){
        myEvent.addListener(szName, func);
    }
};

module.exports = eventMgr;
