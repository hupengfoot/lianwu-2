const joi = require('joi');
let myJoi = {};

myJoi.orNumber = joi.string().regex(/^([0-9]+(\|)?)+$/); //例如 2|4|222

module.exports = myJoi; 

