'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()
const imdb = require('imdb-api')

app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
  res.send('Hello, botworld!')
})

// Facebook verification
app.get('/webhook/', function (req, res) {
  if (req.query['hub.verify_token'] === 'tvakis_verification') {
    res.send(req.query['hub.challenge'])
  }
  res.send('Error, wrong token')
})

app.post('/webhook/', function (req, res) {
  let messaging_events = req.body.entry[0].messaging
  // Loop through messaging events
  for (let i = 0; i < messaging_events.length; i++) {
    let event = req.body.entry[0].messaging[i]
    // Get sender (user) info
    let sender = event.sender.id
    if (event.message && event.message.text) {
      // Parse actual text
      let text = event.message.text
      // Filter text
      text = text.toLowerCase()
      if (text == "hi" || text == "hey" || text == "hello") {
        sendTextMessage(sender, "Please give me a TV show or a movie!<3")
      } else {
        getShow(text, function (tvshow) {
          if (tvshow === null) {
            sendTextMessage(sender, "TV show or movie was not found!:/")
            return
          }
          sendTextMessage(sender, tvshow.title + " (" + tvshow.rating + " on IMDB)")
          sendTextMessage(sender, tvshow.plot.substring(0, 250) + "...")
          sendTextMessage(sender, "View on IMDB: http://www.imdb.com/title/" + tvshow.imdbid)
          // Find and show the correct last episode
          imdb.getReq({ name: tvshow.title }, (err, data) => {
            if (!err) {
              data.episodes((err, episodes) => { 
                if (!err) {
                  let correct = getCorrectEpisode(episodes)
                  sendTextMessage(sender, "Last episode aired was \"" + correct.name + "\" on " + correct.released.toDateString() + ".")
                } else {
                  console.log(err)
                }
              });
            }
          });
        })
      }
    }
  }
  res.sendStatus(200)
})

// Get TV show based on title
function getShow(title, cb) {
  imdb.getReq({ name: title }, (err, tvshow) => {
    if (!err) cb(tvshow)
    else cb(null)
  })
}

function getLastEpisode(tvshow) {
  imdb.getReq({ name: tvshow }, (err, data) => {
    if (!err) {
      data.episodes((err, episodes) => { 
        if (!err) {
          let correct = getCorrectEpisode(episodes)
          return correct
        } else {
          console.log(err)
        }
      });
    } else {
      console.log(err)
    }
  });
}

function getCorrectEpisode(episodes) {
  let i = episodes.length - 1
  let episode = episodes[i]
  let ep_date = episode.released

  var today = new Date()
  
  // We do not want the last episode to be later than to day
  // or to have invalid date
  while (ep_date > today || ep_date == "Invalid Date") {
    episode = episodes[i]
    ep_date = episode.released
    i--
  }
  return episode
}

const token = process.env.FB_PAGE_ACCESS_TOKEN

// Handles messaging from server to bot
function sendTextMessage(sender, text) {
  let messageData = { text:text }
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token:token},
    method: 'POST',
    json: {
      recipient: {id:sender},
      message: messageData,
    }
  }, function(error, response, body) {
    if (error) {
      console.log('Error sending messages: ', error)
    } else if (response.body.error) {
      console.log('Error: ', response.body.error)
    }
  })
}

// Run server
app.listen(app.get('port'), function() {
  console.log('Running on port: ', app.get('port'))
})