const { response, request } = require('express');
const express = require('express');
const app = express();
const http = require('http').createServer(app);

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

let port = process.env.PORT || 8079;
MongoClient.connect(process.env.MONGODB_URI, function (error, client) {
  if (error) {
    return console.log(error);
  }
  db = client.db('todoapp');
  http.listen(port, function () {
    console.log(
      'Express server listening on port %d in %s mode',
      this.address().port,
      app.settings.env
    );
  });
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

/* 로그인 기능  끝 */

/* 아이디와 비밀번호 검토 */
passport.use(
  new LocalStrategy(
    {
      usernameField: 'id',
      passwordField: 'pw',
      session: true,
      passReqToCallback: false,
    },
    function (inputId, inputPw, done) {
      db.collection('login').findOne({ id: inputId }, function (에러, 결과) {
        if (에러) return done(에러);
        if (!결과)
          return done(null, false, { message: '존재하지않는 아이디요' });
        bcrypt.compare(inputPw, 결과.pw, (err, same) => {
          if (same) {
            return done(null, 결과);
          } else {
            return done(null, false, { message: '비번틀렸어요' });
          }
        });
      });
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
    { $set: { 제목: request.body.title, 내용: request.body.content } },
    function (error, result) {
      response.send(
        '<script>alert("글수정이 완료되었습니다");location.href="/list"</script>'
      );
    }
  );
});

app.get('/', function (request, response) {
  response.render('login.ejs');
});

app.get('/search', (request, response) => {
  var 검색조건 = [
    {
      $search: {
        index: 'titleSearch',
        text: {
          query: request.query.value,
          path: '제목',
        },
      },
    },
  ];
  db.collection('post')
    .aggregate(검색조건)
    .toArray((error, result) => {
      response.render('search.ejs', { search: result, user: request.user });
    });
});
app.get('/write', loginCheck, function (request, response) {
  response.render('write.ejs');
});

app.get('/mypage', loginCheck, function (request, response) {
  db.collection('post')
    .find({ 작성자: request.user.id })
    .sort({ 날짜정렬: -1 })
    .toArray(function (error, result) {
      response.render('mypage.ejs', {
        user: request.user,
        userBoard: result,
      });
    });
});
function loginCheck(request, response, next) {
  if (request.user) {
    next();
  } else {
    response.send(
      `<script>
       alert("로그인 하셔야 이용가능합니다.");
       history.go(-1)
       </script>`
    );
  }
}

app.get('/list', function (request, response) {
  db.collection('post')
    .find()
    .sort({ 날짜정렬: -1 })
    .toArray(function (error, result) {
      response.render('list.ejs', {
        posts: result,
        view: request.query,
        user: request.user,
      });
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
  response.send(
    '<script>alert("글등록이 완료되었습니다");location.href="/list"</script>'
  );

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
        내용: request.body.content,
        작성일: dateString,
        조회수: 0,
        날짜정렬: new Date(),
      };
      db.collection('post').insertOne(stroage, function (error, result) {
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

app.post('/comment', function (req, res) {
  const now = new Date();
  const utcNow = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const koreaTimeDiff = 9 * 60 * 60 * 1000;
  const koreaNow = new Date(utcNow + koreaTimeDiff);
  const datearr = String(koreaNow).split(' ');

  const year = now.getFullYear();
  const month = ('0' + (now.getMonth() + 1)).slice(-2);
  const day = ('0' + now.getDate()).slice(-2);
  const dateString = year + '-' + month + '-' + day;
  const currentTime = dateString + ' ' + datearr[4];

  let totalNum;
  db.collection('counter').findOne(
    { name: '댓글갯수' },
    function (err, result) {
      totalNum = result.totalcomment;

      const storage = {
        _id: totalNum + 1,
        user: req.body.user_name,
        date: currentTime,
        content: req.body.comment_write,
        id: req.body.id,
      };
      db.collection('comment').insertOne(storage, function (err, result) {
        res.redirect('/detail/' + req.body.id);
      });
      db.collection('counter').updateOne(
        { name: '댓글갯수' },
        { $inc: { totalcomment: 1 } },
        function (err, result) {
          console.log(err);
        }
      );
    }
  );
});

app.get('/detail/:id', loginCheck, function (request, response) {
  let answer;
  let comment;
  db.collection('comment')
    .find({ id: request.params.id })
    .sort({ _id: -1 })
    .toArray(function (arr, result) {
      comment = result;

      db.collection('post').findOne(
        { _id: parseInt(request.params.id) },
        function (error, result) {
          if (result.작성자 === request.user.id) {
            answer = true;
          } else {
            answer = false;
          }

          db.collection('post').updateOne(
            { _id: parseInt(request.params.id) },
            { $inc: { 조회수: 1 } },
            function (error, result) {
              if (error) {
                return console.log(error);
              }
            }
          );
          response.render('detail.ejs', {
            comment: comment,
            data: result,
            answer: answer,
            user: request.user.id,
          });
        }
      );
    });
});

app.delete('/delete/:id', function (request, response) {
  let deleteData = {
    _id: parseInt(request.params.id),
    작성자: request.user.id,
  };
  db.collection('post').deleteOne(deleteData, function (error, result) {
    if (error) {
      console.log(error);
    }
    response.json({ success: true });
  });
});
