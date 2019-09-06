console.log('Simple FXCM Socket !')
var config = {
  token: "a66ef35791215479446bee75a8d543e0ef0d6801",
  trading_api_host: 'api-demo.fxcm.com',
  trading_api_port: 443,
  trading_api_proto: 'https'
}
var FXCM_url = config.trading_api_proto + '://' + config.trading_api_host + ':' + config.trading_api_port;
// D291076810
// 1664
var io = require('socket.io-client')
var querystring = require('querystring')
var fetch = require('node-fetch')
var moment = require('moment')
var cron = require('node-cron')
const fs = require('fs')
var os = require("os")
var url = require('url')
var socket;
var isConnect = -1;
var request_headers = {
  'User-Agent': 'request',
  'Accept': 'application/json',
  'Content-Type': 'application/x-www-form-urlencoded'
}

var authenticate = (callback) => {
  if (isConnect === 1) {
    log("Connection already ready !")
    return
  }
  isConnect = 0;
  log('Socket.IO session is opening...');
  var token = config.token
  socket = io(config.trading_api_proto + '://' + config.trading_api_host + ':' + config.trading_api_port, {
    query: querystring.stringify({
      access_token: token
    }),
    transports: ['websocket'],
    rejectUnauthorized: false
  });
  socket.on('connect', () => {
    log('Socket.IO session has been opened: ' + socket.id)
    request_headers.Authorization = 'Bearer ' + socket.id + token
    isConnect = 1
    callback()
  });
  socket.on('connect_error', (error) => {
    log('[ERROR] Socket.IO session connect error: ' + error)
    isConnect = -1
    try {
      socket.disconnect();
      socket = null;
    } catch (error) {}

    log('Socket.IO restarting in 5 second...')
    setTimeout(() => {
      authenticate(onConnectServer)
    }, 5000);
  });
  socket.on('error', (error) => {
    log('[ERROR] Socket.IO session error: ' + error)
    isConnect = -1
    try {
      socket.disconnect();
      socket = null;
    } catch (error) {}

    log('Socket.IO restarting in 5 second...')
    setTimeout(() => {
      authenticate(onConnectServer)
    }, 5000)
  });
  socket.on('disconnect', () => {
    log('[ERROR] Socket disconnected, terminating client.')
    isConnect = -1
    try {
      socket.disconnect();
      socket = null;
    } catch (error) {}

    log('Socket.IO restarting in 5 second...')
    setTimeout(() => {
      authenticate(onConnectServer)
    }, 5000)
  });
}

var onConnectServer = async () => {
  var instruments = await fetch(FXCM_url + '/trading/get_instruments/', { method: 'GET', headers: request_headers })
    .then((response) => { return response.json(); })
    .then((json) => { if (json.response.executed) { return json.data.instrument } else { return null } })
    .catch(ex => { console.error(ex) })

  var eur_usd = instruments.find(a => { return a.symbol === 'EUR/USD' })
  var usd_try = instruments.find(a => { return a.symbol === 'USD/TRY' })
  var eur_try = instruments.find(a => { return a.symbol === 'EUR/TRY' })


  var listen_list = [eur_usd]
  for (let i = 0; i < listen_list.length; i++) {
    const element = listen_list[i];
    const params = new url.URLSearchParams()
    params.append('pairs', element.symbol);
    fetch(FXCM_url + '/subscribe', {
      method: 'POST',
      body: params,
      headers: request_headers
    }).then(response => {
      return response.json();
    }).then(json => {
      if (json.response.executed) {
        log(element.symbol + ' OK!');
        socket.on(element.symbol, (msg) => {
          priceUpdate(msg)
        })
      } else {
        log('[ERROR]' + json.response.error)
      }
    })
  }
}


var memory_price = []
var memory_format = 'YYYYMMDDHHmm'
var maps = {
  open: 0,
  close: 1,
  high: 2,
  low: 3,
}

var priceUpdate = (msg) => {
  var data = JSON.parse(msg)
  data.UpdatedDateTime = new Date(data.Updated)
  log(data.UpdatedDateTime + ' > ' + data.Rates[0], false)
}

authenticate(onConnectServer)

cron.schedule('0 21 * * 5', () => {
  log("Socket.IO session is closing for maintenance...")
  if (isConnect === 1) {
    socket.disconnect();
    socket = null;
    isConnect = -1;
  }
}, {
  scheduled: true,
  timezone: 'Etc/UTC'
});

cron.schedule('0 22 * * 7', () => {
  log("Socket.IO session is closing for maintenance...")
  if (isConnect === -1) {
    authenticate(onConnectServer)
  }
}, {
  scheduled: true,
  timezone: 'Etc/UTC'
});


function log(text, save = true) {
  var logText = '[' + new Date().toUTCString() + ']\t' + text;
  console.log(logText)

  if (!save)
    return

  fs.open("app/temp/log.txt", 'a', function(e, id) {
    fs.write(id, logText + os.EOL, null, 'utf8', function() {
      fs.close(id, function() {})
    })
  })
}