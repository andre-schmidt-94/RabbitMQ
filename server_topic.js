#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

var args = process.argv.slice(2);

const ZShepherd = require('zigbee-shepherd');
const shepherd = new ZShepherd('/dev/ttyACM0');
const chalk = require('chalk');

if (args.length == 0) {
  console.log("Usage: receive_logs_topic.js <facility>.<severity>");
  process.exit(1);
}

amqp.connect('amqp://localhost', function(err, conn) {
  conn.createChannel(function(err, ch) {
    var ex = 'topic_logs';

    ch.assertExchange(ex, 'topic', {durable: false});

    ch.assertQueue('', {exclusive: true}, function(err, q) {
        console.log(' [*] Waiting for logs. To exit press CTRL+C');

    args.forEach(function(key) {
        ch.bindQueue(q.queue, ex, key);
    });

    ch.consume(q.queue, function(msg) {
        console.log(" [x] %s: %s ", msg.fields.routingKey, msg.content.toString());
        var n = msg.content.toString();
        var nJSON = JSON.parse(n);
        switch(nJSON.type){
            case 'start':
                r = startShep();
                break;
            case 'stop':
                r = stopShep();
                break;
            case 'join':
                r = joinShep(nJSON);
                break;
            case 'tDevice':
                r = tDevice(nJSON);
                break;
            case 'bind':
                r = bind(nJSON);
                break;
            case 'unbind':
                r = unbind(nJSON);
                break;
            case 'find':
                r = find(nJSON);
                break;
            case 'list':
                r = list();
                break;
            default:
                console.log(nJSON);
                break;
        }
      }, {noAck: true});
    });
  });
});

function startShep() {
    shepherd.start(function (err) {                // start the server
        if (err)
            console.log(err);
        if (!err){
            console.log(chalk.green('Server Running'));
            return 1;
        }
    });
    return 0;
}

function stopShep() {
    shepherd.stop(function (err) {                // start the server
        if (err)
            console.log(err);
        if (!err){
            console.log(chalk.red('Server is Stopped'));
            return 1;
        }
    });
    return 0;
}

function joinShep(nJSON) {
    //console.log(chalk.blue('Entrei join!'));
    var time = nJSON.data;
    shepherd.permitJoin(time, function (err) {
        if (!err){
            console.log(chalk.green('ZNP is now allowing devices to join the network for ', time ,' seconds.'));
            return 1;
        }
    });
    return 0;
}

function tDevice(nJSON) {
    console.log(chalk.green('Device: ', nJSON.data));
    shepherd.find(nJSON.data.d1ieee,nJSON.data.d1ep).functional('genOnOff', nJSON.data.status, {}, (err) => {
        if (!err)
            return 1;
    });
    return 0;
}

function bind(nJSON) {
    console.log(chalk.green('Bind: '));
    shepherd.find(nJSON.data.d1ieee,nJSON.data.d1ep).bind('genOnOff', shepherd.find(nJSON.data.d2ieee,nJSON.data.d2ep), (err) => {
        if (!err){ //console.log('err in bind: ', err);
            console.log(chalk.green('Successfully bind', nJSON.data.d1ieee, '->', nJSON.data.d2ieee,'!'));
            return 1;
        }else{
            console.log('err in bind: ', err);
        }
    });
    return 0;
}

function unbind(nJSON) {
    console.log(chalk.green('Unbind: '));
    shepherd.find(nJSON.data.d1ieee,nJSON.data.d1ep).unbind('genOnOff', shepherd.find(nJSON.data.d2ieee,nJSON.data.d2ep), (err) => {
        if (!err){ 
            console.log(chalk.green('Successfully unbind', nJSON.data.d1ieee, '->', nJSON.data.d2ieee,'!'));
            return 1;
        }else{
            console.log('err in unbind: ', err);
        }
    });
    return 0;
}

function find(nJSON) {
    console.log(chalk.green('Find: ', nJSON.data.d1ieee));
    var ep = null;
    ep = shepherd.find(nJSON.data.d1ieee,nJSON.data.d1ep);
    console.log(ep);
}

function list() {
    console.log(chalk.green('List: '));
    console.log(shepherd.list());
}

shepherd.on('ind', (msg) => {
    switch (msg.type) {
        case 'attReport':
            console.log("-- Att Report --");
            console.log(msg.data);
            break;  
        case 'devChange':
            console.log("-- Dev Change --");
            console.log(chalk.gray(msg.data.data));
            if(msg.data.data.onOff==1)
                console.log(chalk.yellow('Ligou!'));
            else
                console.log(chalk.yellow('Desligou!'));
            break;
        case 'devStatus':
            console.log("-- Dev Status --");
            console.log(msg.data);
            break;
        case 'devIncoming':
            msg.endpoints.forEach((endPointOfDevice) => {
                console.log("-- Dev Incoming --");
                console.log(`Device: ${msg.data} joining the network!`);
            });
            break;
        case 'devLeaving':
            console.log("-- Dev Leaving --");
            console.log(msg.data);
            break;
    }
});

shepherd.on('ready', function () {
    console.log(chalk.green('Server is ready.'));
});

shepherd.on('permitJoining', (joinTimeLeft, zserver) => {
    if (joinTimeLeft == 0) {
        console.log(chalk.red("Join FINALIZADO"));
    }
});