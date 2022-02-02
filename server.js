const { response, request } = require('express');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
require('dotenv').config();
app.use(bodyParser.urlencoded({ extended: true }));

const MongoClient = require('mongodb').MongoClient;
const methodOverride = require('method-override');
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');

app.use('/public', express.static('public'));

var db;

/* TODO 기능 */
MongoClient.connect(process.env.DB_URL, function (error, client) {
  if (error) {
    return console.log(error);
  }
  db = client.db('todoapp');
  app.listen(8080, function () {
    console.log('listening on 8080');
  });
});

app.get('/list', function (request, response) {
  db.collection('post')
    .find()
    .toArray(function (error, result) {
      console.log(result);
      response.render('list.ejs', { posts: result });
    });
});
app.get('/search', (request, response) => {
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
    {},
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
      console.log(result);
      response.render('detail.ejs', { data: result });
    }
  );
});

app.get('/edit/:id', function (request, response) {
  db.collection('post').findOne(
    { _id: parseInt(request.params.id) },
    function (error, result) {
      console.log(result);
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
    response.redirect('/');
  }
);
app.get('/mypage', loginCheck, function (request, response) {
  console.log(request);
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
          if (입력한비번 == 결과.pw) {
            return done(null, 결과);
          } else {
            return done(null, false, { message: '비번틀렸어요' });
          }
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

app.post('/register', function (request, response) {
  db.collection('login').insertOne(
    { id: request.body.id, pw: request.body.pw },
    function (error, result) {
      response.redirect('/');
    }
  );
});

app.post('/add', function (request, response) {
  response.send('전송완료');

  db.collection('counter').findOne(
    { name: '게시물갯수' },
    function (error, result) {
      let totalNum = result.totalPost;
      let stroage = {
        _id: totalNum + 1,
        작성자: request.user._id,
        제목: request.body.title,
        날짜: request.body.date,
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
  console.log(request.params.id);

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
