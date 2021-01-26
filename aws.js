const AWS = require('aws-sdk');
const config = require('./config.js');

AWS.config.update(config.aws_remote_config);
let docClient = new AWS.DynamoDB.DocumentClient();

let fetchOneByKey = function (message) {
    var params = {
        TableName: "main_table",
        Key: {
            "message": message
        }
    };
    docClient.scan(params, function (err, data) {
        if (err) {
            console.log("users::fetchOneByKey::error - " + JSON.stringify(err, null, 2));
        }
        else {
            console.log("users::fetchOneByKey::success - " + JSON.stringify(data, null, 2));
        }
    })
}

let addToUsedTable = function (message, author) {

    var input = {
        "message": message,
        "created_by": author,
        "created_on": new Date().toString(),
    };
    var params = {
        TableName: "used_messages",
        Item: input
    };
    docClient.put(params, function (err, data) {

        if (err) {
            console.log("users::save::error - " + JSON.stringify(err, null, 2));
        } else {
            console.log("users::save::success");
        }
    });
}

let addToMainTable = function (message, author) {

    var input = {
        "message": message,
        "created_by": author,
        "created_on": new Date().toString(),
    };
    var params = {
        TableName: "main_table",
        Item: input
    };
    docClient.put(params, function (err, data) {

        if (err) {
            console.log("users::save::error - " + JSON.stringify(err, null, 2));
        } else {
            console.log("users::save::success");
        }
    });
}

let getAllItemsFromMain = function () {
    var params = {
        TableName: "main_table",
    };
    return new Promise((resolve, reject) => {
        docClient.scan(params, function (err, data) {
            if (err) {
                // console.log("users::fetchOneByKey::error - " + JSON.stringify(err, null, 2));
                reject(err)
            }
            else {
                // console.log("users::fetchOneByKey::success - " + JSON.stringify(data, null, 2));
                // console.log("hey", data)
                resolve(data)
            }
        })
    })
}

let getAllItemsFromUsed = function () {
    var params = {
        TableName: "used_messages",
    };
    return new Promise((resolve, reject) => {
        docClient.scan(params, function (err, data) {
            if (err) {
                // console.log("users::fetchOneByKey::error - " + JSON.stringify(err, null, 2));
                reject(err)
            }
            else {
                // console.log("users::fetchOneByKey::success - " + JSON.stringify(data, null, 2));
                resolve(data)
            }
        })
    })
}

module.exports = {
    fetchOneByKey,
    addToMainTable,
    addToUsedTable,
    getAllItemsFromMain,
    getAllItemsFromUsed
}