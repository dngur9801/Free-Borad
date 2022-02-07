const { response, request } = require('express');
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const { Server, Socket } = require('socket.io');
const io = new Server(http);

const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
require('dotenv').config();
const { ObjectId } = require('mongodb');

const MongoClient = require('mongodb').MongoClient;
const methodOverride = require('method-override');
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');
const bcrypt = require('bcrypt');

app.use('/public', express.static('public'));

var db;

/* TODO 기능 */
MongoClient.connect(process.env.DB_URL, function (error, client) {
  if (error) {
    return console.log(error);
  }
  db = client.db('todoapp');
  http.listen(8080, function () {
    console.log('listening on 8080');
  });
});

app.get('/list', function (request, response) {
  db.collection('post')
    .find()
    .sort({ 날짜정렬: -1 })
    .toArray(function (error, result) {
      response.render('list.ejs', { posts: result });
    });
});
app.get('/search', (request, response) => {
  console.log(request.query);
  var 검색조건 = [
    {
      $search: {
        index: 'titleSearch',
        text: {
          query: request.query.value,
          path: '제목', // 제목날짜 둘다 찾고 싶으면 ['제목', '날짜']
        },
      },
    },
  ];
  db.collection('post')
    .aggregate(검색조건)
    .toArray((error, result) => {
      console.log(result);
      response.render('search.ejs', { search: result });
    });
});

app.get('/write', function (request, response) {
  response.render('write.ejs');
});

app.get('/', function (request, response) {
  response.render('index.ejs');
});

app.get('/detail/:id', function (request, response) {
  db.collection('post').findOne(
    { _id: parseInt(request.params.id) },
    function (error, result) {
      response.render('detail.ejs', { data: result });
    }
  );
});

app.get('/edit/:id', function (request, response) {
  db.collection('post').findOne(
    { _id: parseInt(request.params.id) },
    function (error, result) {
      response.render('edit.ejs', { post: result });
    }
  );
});
app.put('/edit', function (request, response) {
  db.collection('post').updateOne(
    { _id: parseInt(request.body.id) },
    { $set: { 제목: request.body.title, 날짜: request.body.date } },
    function (error, result) {
      console.log('수정완료');
      response.redirect('/list');
    }
  );
});

/* 로그인 기능 */
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');

app.use(
  session({ secret: '비밀코드', resave: true, saveUninitialized: false })
);
app.use(passport.initialize());
app.use(passport.session());

app.get('/login', function (request, response) {
  response.render('login');
});

app.post(
  '/login',
  passport.authenticate('local', {
    failureRedirect: '/fail',
  }),
  function (request, response) {
    response.redirect('/list');
  }
);
app.get('/fail', function (req, res) {
  res.render('fail.ejs');
});
app.post('/idcheck', function (req, res) {
  let signal;
  db.collection('login')
    .findOne({ id: req.body.signId })
    .then(result => {
      if (result === null) {
        signal = true;
      } else {
        signal = false;
      }
      res.json({
        signal: signal,
      });
    });
});

app.get('/mypage', loginCheck, function (request, response) {
  response.render('mypage.ejs', { user: request.user });
});

function loginCheck(request, response, next) {
  if (request.user) {
    next();
  } else {
    response.send('로그인 안함');
  }
}
/* 아이디와 비밀번호 검토 */
passport.use(
  new LocalStrategy(
    {
      usernameField: 'id',
      passwordField: 'pw',
      session: true,
      passReqToCallback: false,
    },
    function (입력한아이디, 입력한비번, done) {
      //console.log(입력한아이디, 입력한비번);
      db.collection('login').findOne(
        { id: 입력한아이디 },
        function (에러, 결과) {
          if (에러) return done(에러);
          if (!결과)
            return done(null, false, { message: '존재하지않는 아이디요' });
          bcrypt.compare(입력한비번, 결과.pw, (err, same) => {
            if (same) {
              return done(null, 결과);
            } else {
              return done(null, false, { message: '비번틀렸어요' });
            }
          });
        }
      );
    }
  )
);

/* 세션 만들고 세션아이디 발급해서 쿠키로 보내기*/
passport.serializeUser(function (user, done) {
  done(null, user.id);
});
passport.deserializeUser(function (아이디, done) {
  db.collection('login').findOne({ id: 아이디 }, function (error, result) {
    done(null, result);
  });
});

app.get('/logout', function (req, res) {
  req.logout();
  res.redirect('/login');
});

app.post('/register', function (request, response) {
  bcrypt.hash(request.body.pw, 10, (err, encryptedPassowrd) => {
    db.collection('login').insertOne(
      { id: request.body.id, pw: encryptedPassowrd },
      function (error, result) {
        response.redirect('/login');
      }
    );
  });
});

app.post('/add', function (request, response) {
  response.render('write_success.ejs');

  db.collection('counter').findOne(
    { name: '게시물갯수' },
    function (error, result) {
      let totalNum = result.totalPost;

      var today = new Date();
      var year = today.getFullYear();
      var month = ('0' + (today.getMonth() + 1)).slice(-2);
      var day = ('0' + today.getDate()).slice(-2);
      var dateString = year + '-' + month + '-' + day;

      let stroage = {
        _id: totalNum + 1,
        작성자: request.user.id,
        제목: request.body.title,
        날짜: request.body.date,
        작성일: dateString,
        조회수: 0,
        날짜정렬: new Date(),
      };
      db.collection('post').insertOne(stroage, function (error, result) {
        console.log('저장완료');
        db.collection('counter').updateOne(
          { name: '게시물갯수' },
          { $inc: { totalPost: 1 } },
          function (error, result) {
            if (error) {
              return console.log(error);
            }
          }
        );
      });
    }
  );
});

app.delete('/delete/:id', function (request, response) {
  let deleteData = {
    _id: parseInt(request.params.id),
    작성자: request.user._id,
  };

  db.collection('post').deleteOne(deleteData, function (error, result) {
    console.log('삭제완료');
    if (error) {
      console.log(error);
    }
    response.status(200).send({ message: '성공했습니다.' });
  });
});

let multer = require('multer');
let storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/image');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

app.post('/chatroom', loginCheck, function (req, res) {
  let storage = {
    title: '무슨무슨채팅방',
    member: [ObjectId(req.body.receiveId), req.user._id],
    date: new Date(),
  };

  db.collection('chatroom')
    .insertOne(storage)
    .then(result => {
      res.send('성공');
    });
});

app.get('/chat', function (req, res) {
  db.collection('chatroom')
    .find({ member: req.user._id })
    .toArray()
    .then(result => {
      res.render('chat.ejs', { data: result });
    });
});

app.post('/message', loginCheck, function (req, res) {
  let storage = {
    parent: req.body.parent,
    content: req.body.content,
    userid: req.user._id,
    date: new Date(),
  };
  db.collection('message')
    .insertOne(storage)
    .then(result => {
      console.log('저장성공');
      res.send('저장성공');
    });
});

app.get('/message/:id', loginCheck, function (req, res) {
  res.writeHead(200, {
    Connection: 'keep-alive',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
  });

  db.collection('message')
    .find({ parent: req.params.id })
    .toArray()
    .then(result => {
      res.write('event: test\n');
      res.write('data:' + JSON.stringify(result) + '\n\n');
    });
});

app.get('/socket', function (req, res) {
  res.render('socket.ejs');
});

io.on('connection', function (socket) {
  console.log('접속됨');

  socket.on('room1-send', function (data) {
    io.to('room1').emit('broadcast', data);
  });
  socket.on('joinroom', function (data) {
    socket.join('room1');
  });
  socket.on('user-send', function (data) {
    console.log(data);
    io.emit('broadcast', data);
  });
});
