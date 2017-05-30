/*jshint multistr:true*/

//指定走其它数据库的表，目前为空，全部走默认数据库
module.exports.tableDbIndex = {
};

/*每个业务分配10000个sql号，
 *0~4999 为select，5000~5999为update，6000~6999为insert，7000~7999为delete，8000~8999为replace，9000~9999为预留
 */

//0~9999 为用户相关模块sql
let user_sqls = {
    1 : "select 1",
    2 : "select *from tbTeacher limit ?, ?",
    6000 : "insert into tbTeacher (szName, szOpenID, szSignature, szArea, szPrice, szType, szPhone, szFreeTime, dtRegisterTime) values(?, ?, ?, ?, ?, ?, ?, ?, now())",
};

let all_sqls = user_sqls;

module.exports.sqls = all_sqls;
