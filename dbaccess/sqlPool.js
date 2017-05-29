const mysql = require('mysql'); 
const path = require('path');
const underscore = require('underscore');
const arConfigList = require(path.join(global.rootPath, "config/mysql.json"));
const sqls = require('./sql_define').sqls;
const debugTool = require(path.join(global.rootPath, 'util/debugTool'));
const dbIndex = require(path.join(global.rootPath, 'define/dbIndex'));
const msg = require(path.join(global.rootPath, "define/msg"));

let dbArray = [];

arConfigList.forEach(function(config){
    console.log('LOAD DB %s CONFIG %s:%d-%s',
               config.szDbName,config.writeDB.szDbIP,
               config.writeDB.szDbPort,config.writeDB.szDbDefaultDb);
    let readPool = mysql.createPool({
        host:config.readDB.szDbIP,
        port:config.readDB.szDbPort,
        user:config.readDB.szDbUser,
        password:config.readDB.szDbPwd,
        database:config.readDB.szDbDefaultDb,
        supportBigNumbers :true,
        connectionLimit:'10',
        timezone:'Asia/Hong Kong'});

    let writePool = mysql.createPool({
        host:config.writeDB.szDbIP,
        port:config.writeDB.szDbPort,
        user:config.writeDB.szDbUser,
        password:config.writeDB.szDbPwd,
        database:config.writeDB.szDbDefaultDb,
        supportBigNumbers :true,
        connectionLimit:'10',
        timezone:'Asia/Hong Kong'});

    let dbObj = {
        readPool : readPool,
        writePool : writePool,
    };

    if (config.slaveDB) {
        let slavePool = mysql.createPool({
            host:config.slaveDB.szDbIP,
            port:config.slaveDB.szDbPort,
            user:config.slaveDB.szDbUser,
            password:config.slaveDB.szDbPwd,
            database:config.slaveDB.szDbDefaultDb,
            supportBigNumbers :true,
            connectionLimit:'10',
            timezone:'Asia/Hong Kong'});

        dbObj.slavePool = slavePool;
    }

    dbArray.push(dbObj);
});

//默认sqlPool
let sqlPool = mysql.createPool({
	host:arConfigList[0].writeDB.szDbIP,
	port:arConfigList[0].writeDB.szDbPort,
	user:arConfigList[0].writeDB.szDbUser,
	password:arConfigList[0].writeDB.szDbPwd,
	database:arConfigList[0].writeDB.szDbDefaultDb,
    supportBigNumbers:true,
	connectionLimit:'10',
	timezone:'Asia/Hong Kong'});

// SQL执行要使用的pool类型枚举
sqlPool.dbTypeEnum = {
    dbType_read : 1,
    dbType_write : 2,
    dbType_slave : 3,
};

let escapeId = function (val, forbidQualified) {
	if (Array.isArray(val)) {
        return val.map(function(v) {
            return escapeId(v, forbidQualified);
        }).join(', ');
	}
	if (forbidQualified) {
        return "'" + val.replace(/`/g, '``').replace(/^\s*'*|'*\s*$/,'') + "'";
	}
	return "'" + val.replace(/`/g, '``').replace(/\./g, '`.`').replace(/^\s*'*|'*\s*$/g,'') + "'";
};


//for repair func undef
let dateToString = function(val,timeZone) {
    /*
    console.error('sql params err Object try to string');
    */
    if(val.toString && typeof val.toString === 'function'){
        return val.toString();
    }else{
        return 'error object';
    }
};
let bufferToString = dateToString;
let objectToValues = dateToString;

let my_escape = function(val, stringifyObjects, timeZone) {
	if (val === undefined || val === null) {
        return 'NULL';
	}
	switch (typeof val) {
        case 'boolean': return (val) ? 'true' : 'false';
        case 'number': return val+'';
	}
	if (val instanceof Date) {
        val = dateToString(val, timeZone || 'local');
	}
	if (Buffer.isBuffer(val)) {
        return bufferToString(val);
	}
	if (Array.isArray(val)) {
        return arrayToList(val, timeZone);
	}
	if (typeof val === 'object') {
        if (stringifyObjects) {
            val = val.toString();
        } else {
            return objectToValues(val, timeZone);
        }
	}
    val = val.replace(/[\0\n\r\b\t\\\'\"\x1a]/g, function(s) {
        switch(s) {
            case "\0": return "\\0";
            case "\n": return "\\n";
            case "\r": return "\\r";
            case "\b": return "\\b";
            case "\t": return "\\t";
            case "\x1a": return "\\Z";
            default: return "\\"+s;
        }
    });
    return "'"+val+"'";
};

let escapeOrg = function(val, stringifyObjects, timeZone) {
	if (val === undefined || val === null) {
		return 'NULL';
	}

	switch (typeof val) {
		case 'boolean': return (val) ? 'true' : 'false';
		case 'number': return val+'';
	}

	if (val instanceof Date) {
		val = dateToString(val, timeZone || 'local');
	}

	if (Buffer.isBuffer(val)) {
		return bufferToString(val);
	}

	if (Array.isArray(val)) {
		return arrayToList(val, timeZone);
	}

	if (typeof val === 'object') {
		if (stringifyObjects) {
			val = val.toString();
		} else {
			return objectToValues(val, timeZone);
		}
	}

    val = val.replace(/[\0\n\r\b\t\\\"\x1a]/g, function(s) {
        switch(s) {
            case "\0": return "\\0";
            case "\n": return "\\n";
            case "\r": return "\\r";
            case "\b": return "\\b";
            case "\t": return "\\t";
            case "\x1a": return "\\Z";
            default: return "\\"+s;
        }
    });
    return val;
};

let arrayToList = function(array, timeZone) {
	return array.map(function(v) {
        if (Array.isArray(v)){ return '(' + arrayToList(v, timeZone) + ')'; }
        return my_escape(v, true, timeZone);
	}).join(', ');
};

let format = function(sql, values, stringifyObjects, timeZone) {
	values = values === null ? [] : [].concat(values);
	return sql.replace(/\?\??|!/g, function(match) {
        if (!values.length) {
            return match;
        }
        if (match == "??") {
            return escapeId(values.shift());
        }
        if(match == "!"){
            return escapeOrg(values.shift(), stringifyObjects, timeZone);
        }
        return my_escape(values.shift(), stringifyObjects, timeZone);
	});
};

let _ = {};
_.getSql = function(sqlIndex, params, cb, format_custom){
    let szSql = sqls[sqlIndex];
    if(typeof szSql == 'undefined'){
        if(cb){
            cb("sqlIndex undefined:"+sqlIndex);
        }
        return;
    }
    szSql = format(szSql, params);
    if(typeof format_custom == 'function'){
        szSql = format_custom(szSql, params);
    }
    return szSql;
};

_.excute = function(szSql, inst, cb,sqlIndex){
    let tStart = Date.now();
    inst.query(szSql, function(err, rows, field){
        let tUsed = Date.now() - tStart;
        console.info(sqlIndex + ": " + szSql + " " + tUsed + " ms");
        if(err){
            console.error('excute %s error %s', szSql, JSON.stringify(err));
        }
        if(cb){
            cb(err, rows, field);
        }
    });
};

let getSql = function(sqlIndex, params){
    let szSql = _.getSql(sqlIndex, params);
    return szSql;
};

let tableDbIndex = require('./sql_define').tableDbIndex;

//选择使用几号数据库
_.getDbIndex = function(szSql,iIndex) {
    let parseStr = (szSql+" ").trim().replace(/[\*\(\,]/g,' ');
    parseStr = parseStr.replace(/INTO/g,'into');
    parseStr = parseStr.replace(/FROM/g,'from');
    let tokens = parseStr.split(/\s+/);
    let preIdx = -1;
    let innerIndex = iIndex % 10000;
    if(innerIndex >= 5000 && innerIndex < 6000){
        //update 直接取第二个token作为表名
        preIdx = 0;
    }else{
        if((innerIndex >= 6000 && innerIndex < 7000) || (innerIndex >= 8000 && innerIndex < 9000)){
            preIdx = underscore.indexOf(tokens,'into'); //insert 和 replace 搜索 into的下一个
        }else{
            preIdx = underscore.lastIndexOf(tokens,'from'); //select delete 搜索 from的下一个
        }
        if (preIdx === -1) {}
    }
    let tbTableName = tokens[preIdx + 1];
    let dbIdx = tableDbIndex[tbTableName];
    if (dbIdx && dbArray[dbIdx]) {
        //console.log("table %s use dbIndex %d",tbTableName,dbIdx);
        return dbIdx;
    }else{
        return dbIndex.dbDefault;
    }
};

//cb:function(err, conn)
// format_custom:可选参数 function(szSql, params)
// iDbType : 可选参数，指定要使用的数据库类型（sqlPool.dbTypeEnum）
let excute = function(sqlIndex, params, cb, format_custom, iDbType){
    let szSql = _.getSql(sqlIndex, params, cb, format_custom);
    let iIndex = parseInt(sqlIndex);
    if(szSql === undefined){
        console.error("invalid sql no: [%d] caller is %s", iIndex, debugTool.getCaller());
        cb(msg.code.ERR_UNDEFINED_SQL);
        return;
    }
    let dbIndex = _.getDbIndex(szSql,iIndex);
    let curPool = dbArray[dbIndex].writePool;
    let innerIndex = iIndex % 10000;
    if(innerIndex >= 9000){
        let cmdStr = szSql.substr(0, 6);
        if (cmdStr.toLowerCase() !== 'select') {
            console.error("Only can use SELECT: [%d] caller is %s", iIndex, debugTool.getCaller());
            return;
        }
        curPool = dbArray[dbIndex].writePool;
    }

    if ( iDbType && ((innerIndex < 5000) || (innerIndex >= 9000)) ) {
        // 有传入该参数，且是读类型的sql，则在真正执行前，校正要使用的pool
        switch (iDbType) {
            case sqlPool.dbTypeEnum.dbType_slave:
                // 要走从库
                if (dbArray[dbIndex].slavePool) {
                    //console.log("sqlIndex:%d ---> using slaveDB", iIndex);
                    curPool = dbArray[dbIndex].slavePool;
                } else {
                    console.error("sqlIndex:%d==>no slavePool for dbIndex: [%d] caller is %s", iIndex, dbIndex, debugTool.getCaller());
                    return;
                }
                break;

            default :
                console.error("sqlIndex:%d==>invalid iDbType: [%d] caller is %s", iIndex, iDbType, debugTool.getCaller());
                return;
        }
    }
    _.excute(szSql, curPool, cb,sqlIndex);
};

//cb:function(conn, callback) callback:function(err) err不为null表示需要回滚 
let beginTrans = function(cb, cb2,iDBIndex){
    let connInst = {};
    connInst.format = format;
    iDBIndex = iDBIndex || dbIndex.dbDefault;
    //console.log('start trans use %d dbIndex',iDBIndex);
    dbArray[iDBIndex].writePool.getConnection(function(err, conn){
        if(err){
            console.error("fail to beginTrans %s", err);
            cb(null);
        }else{
            connInst.conn = conn;
            conn.beginTransaction(function(err){
                if(err){
                    cb(null, null);
                    if(cb2) cb2(err);
                    return;
                }
                cb(connInst, function(err){
                    if(err){
                        console.error('begin to rollback');
                        conn.rollback(function(){
                            if(cb2) cb2(err);
                            conn.release();
                        });
                    }else{
                        conn.commit(function(err){
                            if(err){
                                conn.rollback(function(){
                                    if(cb2) cb2(err);
                                    conn.release();
                                });
                            }else{
                                    if(cb2) cb2(err);
                                conn.release();
                            }
                        });
                    }
                });
            });
        }
    });
};


sqlPool.beginTrans = beginTrans;
sqlPool.format = format;
sqlPool.excute = excute;
sqlPool.getSql = getSql;
module.exports = sqlPool;
