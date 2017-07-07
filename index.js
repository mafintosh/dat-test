#!/usr/bin/env node

var hyperdrive = require('hyperdrive')
var pump = require('pump')
var ram = require('random-access-memory')
var net = require('net')
var diff = require('ansi-diff-stream')
var progress = require('progress-string')
var ws = require('websocket-stream')

var useWs = process.argv.indexOf('--websocket') > -1
var out = diff()

out.pipe(process.stdout)
out.write('Connecting to swarm ...')

var dns = require('dns-discovery')({
  server: [
    'discovery1.publicbits.org',
    'discovery2.publicbits.org'
  ],
  domain: 'dat.local'
})

var archive = hyperdrive(ram, 'e6b46dad39f3a60ae4c25a304b38e70580c4ebee2bd06771208e028cb044e014')

function style (com, inc) {
  return com + '>' + inc
}

archive.on('content', function () {
  archive.content.once('append', function () {
    var fetched = archive.content.downloaded()
    var len = archive.content.length

    var pr = progress({width: 50, total: archive.content.length, style: style})
    update()
    archive.content.on('download', function () {
      fetched++
      update()
    })
    archive.content.on('sync', function () {
      console.log('Dat worked!')
      process.exit()
    })

    function update () {
      out.write(
        'Downloading test dat from ' + archive.content.peers.length + ' peer(s) into memory\n' +
        '[' + pr(fetched) + '] ' + (100 * fetched / archive.content.length).toFixed(1) + '%'
      )
    }
  })
})

archive.on('ready', function () {
  var peers = []

  if (useWs) {
    var stream = ws('wss://hasselhoff.mafintosh.com')
    pump(stream, archive.replicate({encrypt: false}), stream, function (err) {
      if (err) throw err
    })
    return
  }

  dns.on('peer', function (id, peer) {
    peers.push(peer)
  })

  dns.lookup(archive.discoveryKey.slice(0, 20), function (err) {
    if (err) throw err

    out.write('Found ' + peers.length + ' peers. Connecting ...')

    peers.slice(0, 32).forEach(function (peer) {
      var socket = net.connect(peer.port, peer.host)
      pump(socket, archive.replicate(), socket)
    })
  })
})

// dns.on('peer', console.log)
// dns.announce('foo', 0, function () {
//   dns.lookup('foo')
// })
