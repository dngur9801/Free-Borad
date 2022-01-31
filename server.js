const { response } = require('express');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));

const MongoClient = require('mongodb').MongoClient;
var db;

MongoClient.connect(
  'mongodb+srv://dngur9801:jil58895889!@cluster0.tgyry.mongodb.net/todoapp?retryWrites=true&w=majority',
  function (error, client) {
    if (error) {
      return console.log(error);
    }
    app.post('/add', function (request, response) {
      response.send('전송완료');

      db = client.db('todoapp');
      db.collection('post').insertOne(
        { 제목: request.body.title, 날짜: request.body.date },
        function (error, result) {
          console.log('저장완료');
        }
      );
    });

    app.listen(8080, function () {
      console.log('listening on 8080');
    });
  }
);
app.get('/write', function (request, response) {
  response.sendFile(__dirname + '/write.html');
});

app.get('/', function (request, response) {
  response.sendFile(__dirname + '/index.html');
});
