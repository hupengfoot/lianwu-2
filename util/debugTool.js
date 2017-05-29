var stackTrace = require('stack-trace');
var debugTool = {};

debugTool.getCaller = function(){
    var trace = stackTrace.get();
    return trace[2].getFileName() + ":"+ trace[2].getLineNumber();
};

module.exports = debugTool;
