/* jshint node:true*/
"use strict";
var os = require('os');  
var networkInterfaces = os.networkInterfaces();
var hostname = os.hostname();


var network = {};
network.hostname = hostname;

network.getClientIp = function(req) {
    var szClientIP = req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;
    // 新版node IPv4地址格式为 ::ffff:127.0.0.1
    if (szClientIP && szClientIP.length > 7 && (szClientIP.substr(0, 7) === "::ffff:")) {
        szClientIP = szClientIP.substr(7);
    }
    return szClientIP;
};

var szAddr = ''; 
for(var index in networkInterfaces){
    if(index !== 'lo') {
        var address = networkInterfaces[index][0].address;
        //console.log('get local ip %s',address);
        var ipsplit = address.split('.');
        if(ipsplit[0] === '10' || ipsplit[0] === '100' ){
            szAddr = address;
        }
    }
}

network.get_local_ip = function() {
    return szAddr;
};

module.exports = network;

