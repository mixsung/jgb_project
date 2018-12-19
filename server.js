var http = require('http');
var express = require('express');
var config = require('./config.js');
var emailjs = require('emailjs');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var mongodb = require('mongodb');
var ejs = require('ejs');
var session = require('express-session');
var passport = require('passport');
var assert = require('assert');
var multer = require('multer');
var path = require('path');
var async = require('async'); //
//var flash = require('connect-flash');
var LocalStrategy = require('passport-local').Strategy;
var MongoStore = require('connect-mongo')(session);

var app = express();

app.use(session({
  secret:'adgad53ad1gadkj;dz5651df',
  resave:true,
  saveIninitialized:false
}));

app.set('view engine', 'ejs');

passport.serializeUser(function(user,done){ //strategy 성공 시 호출
  done(null,user._id); // user가 deserializeUser의 첫번째 매개변수로 전달
});

passport.deserializeUser(function(id,done){
  membersModel.findOne({'_id':id},function(err,user){
        done(err,user); // user가 req.uesr
  })
});

passport.use('local-login', new LocalStrategy({
  usernameField : 'email',
  passwordField : 'password',
  session:true,
  passReqToCallback: false,
},
function(email, password, done){
  membersModel.findOne({'email':email}, function(err,user){
    if(err) {
            console.log('err');
      return done(err);}
    if(!user) {
            console.log('no users found');
    return done(null, false);
              }
    if(user.password != password) {
            console.log('password does not match');
    return done(null, false);
    }
      console.log('return');
    console.log('user email : '+email);
    console.log('user : '+user);
    return done(null, user);
  });
})
);

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
var dbUrl = 'mongodb://127.0.0.1:27017/Shopping';

var emailServer = emailjs.server.connect({
  user:config.mail.user,
  password:config.mail.password,
  host:config.mail.host,
  port:config.mail.port,
  ssl: true
});

var isAuthenticated = function (req, res, next){
  if(req.isAuthenticated()){
    console.log('session value : ' + req.session.passport.user);
    return next();
  }
  console.log('로그인 페이지로 이동');
  return res.redirect('/');
};

var checkPermission_Goods = function (req, res, next){
  console.log('id : '+req.params.id);

  goodsModel.findOne({'_id':req.params.id}).
  exec(function(err,information){
    console.log('passport.user :'+req.session.passport.user);
    console.log('writer :'+information.writer);
    if(req.session.passport.user == information.writer){
      console.log('권한 확인');
      return  next();
    }
    console.log('권한 불허가');
    return res.redirect('/index'); //이전화면으로 수정
  });
};

var checkPermission_Comments = function (req, res, next){
  console.log('id : '+req.params.comment);

  commentsModel.findOne({'_id':req.params.comment}).
  exec(function(err,information){
    console.log('passport.user :'+req.session.passport.user);
    console.log('writer :'+information.writerID);
    if(req.session.passport.user == information.writerID){
      console.log('권한 확인');
      return  next();
    }
    console.log('권한 불허가');
    return res.redirect('/index'); //이전화면으로 수정
  });
};

var convertDate = function(date){
var convertdate = date;
  var m = convertdate.getMonth()+1;
	var d = convertdate.getDate();
	var h = convertdate.getHours();
	var i = convertdate.getMinutes();
	var s = convertdate.getSeconds();
  console.log(convertdate.getFullYear()+'-'+m+'-'+d+' '+h+':'+i+':'+s);
	return convertdate.getFullYear()+'-'+(m>9?m:'0'+m)+'-'+(d>9?d:'0'+d)+' '+(h>9?h:'0'+h)+':'+(i>9?i:'0'+i)+':'+(s>9?s:'0'+s);
};

var upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public/resources/images/');
    },
    filename: function (req, file, cb) {
      cb(null, new Date().valueOf() + path.extname(file.originalname));
    }
  }),
});

app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

var Schema = mongoose.Schema;
var db;
var goodsSchema;
var goodsModel;

app.get('/index',isAuthenticated, function(req,res){
  console.log('session value : '+ req.session.passport.user);
  goodsModel.find()
  .sort({'_id':-1})
  .limit(3)
  .exec(function(err,information){
        res.render('index',{info:information});
  });
});

app.get('/search',isAuthenticated, function(req,res){
  res.render('search');
});

app.get('/', function(req,res){
res.render('login');
});

app.post('/', function(req,res,next){
  if(req.body.email.length==0 || req.body.password.length == 0){
    res.redirect('/login');
    console.log('length==0');
  }else{
        console.log('next() called');
        next();
  }
}, passport.authenticate('local-login', {
  successRedirect : '/index',
  failureRedirect : '/'
})
);

app.get('/logout',isAuthenticated,function(req,res){
  req.logout();
  req.session.save(function(){
    res.redirect('/');
  })
});

app.get('/write',isAuthenticated, function(req,res){
  res.render('write');
});

app.post('/write_complete',isAuthenticated, upload.single('Image'), function(req,res){

  var date = new Date();

  membersModel.findById(req.session.passport.user,
    function(err,information){
      if(err) return res.json(err);

  var goods = new goodsModel({
   writer:req.session.passport.user,
   writer_nickname:information.nickname,
   title:req.body.Title,
   price:req.body.Price,
   content:req.body.Content,
   tag:req.body.Category,
   ImageName:req.file.filename,
   ImagePath:"resources/images/"+req.file.filename,
   createdData : convertDate(date)
 });

 function removeGoods(){
   goodsModel.remove({_id:goods._id}, function(err){
     console.log("등록 후 48시간이 경과하였습니다");
     console.log("succeccfully deleted");
   });
 };	  
	  
 goods.save(goods, function (err,goods){
   if(err)return console.error(err);
   console.log(goods.title + " save to Goods collection ");
   setTimeout(removeGoods,48*60*60*1000); //48*60*60초
   res.render('write_complete');
 });

  console.log(req.file);

});

});

app.get('/ask',isAuthenticated, function(req, res){
  res.render('ask');
});

app.get('/register', function(req,res){
  res.render('register');
});

app.get('/notice',isAuthenticated, function(req, res){
  res.render('notice');
});

app.get('/mypage',isAuthenticated, function(req,res){
  res.render('mypage');
});

app.get('/mypage/sell_list',isAuthenticated, function(req,res){
  goodsModel.find({'writer':req.session.passport.user})
  .sort({'_id':-1})
  .exec(function(err,information){
   res.render('sell_list', {info : information});
  });
});

app.get('/mypage/buy_list',isAuthenticated, function(req,res){
commentsModel.find({'writerID':req.session.passport.user})
  .sort({'_id':-1})
  .exec(function(err,information){
   res.render('buy_list', {info : information});
  });
});

app.post('/register_complete', function(req,res){
  var members = new membersModel({
    email:req.body.Email,
    password:req.body.Pw,
    nickname:req.body.Nickname
  });

  members.save(members, function (err,members){
    if(err)return console.error(err);
    console.log(members.title + " save to Members collection ");
    res.render('register_complete');
  });
});

app.get('/book',isAuthenticated, function(req,res){
  goodsModel.find({'tag':'전공/교양서적'})
  .sort({'_id':-1})
  .exec(function(err,information){
   res.render('book', {info : information});
  });
});

app.get('/household',isAuthenticated, function(req,res){
  goodsModel.find({'tag':'생활용품'})
  .sort({'_id':-1})
  .exec(function(err,information){
   res.render('household', {info : information});
  });
});

app.get('/eletronic',isAuthenticated, function(req,res){
  goodsModel.find({'tag':'전자제품'})
  .sort({'_id':-1})
  .exec(function(err,information){
   res.render('eletronic', {info : information});
  });
});

app.get('/clothes',isAuthenticated, function(req,res){
  goodsModel.find({'tag':'의류'})
  .sort({'_id':-1})
  .exec(function(err,information){
   res.render('clothes', {info : information});
  });
});

app.get('/hobby',isAuthenticated, function(req,res){
  goodsModel.find({'tag':'취미/오락'})
  .sort({'_id':-1})
  .exec(function(err,information){
   res.render('hobby', {info : information});
  });
});

app.get('/etc',isAuthenticated, function(req,res){
  goodsModel.find({'tag':'기타'})
  .sort({'_id':-1})
  .exec(function(err,information){
   res.render('etc', {info : information});
  });
});

app.get('/variety',isAuthenticated, function(req,res){
  goodsModel.find({'tag':'전공/교양잡화'})
  .sort({'_id':-1})
  .exec(function(err,information){
   res.render('variety', {info : information});
  });
});

app.get('/information/:id',isAuthenticated, function(req,res){
  goodsModel.findById(req.params.id,
    function(err, information){
    if(err) return res.json(err);

    commentsModel.find({'parentsGoods' : req.params.id})
    .exec(function(err,comments){
            res.render('information' ,{info : information, comments:comments, user : req.session.passport.user });
    });
  });
});

app.post('/information/:id/comments',isAuthenticated,function(req,res)
{

  var date = new Date();

  membersModel.findById(req.session.passport.user,
    function(err,information){
      if(err) return res.json(err);

      var comment = new commentsModel({
        writerID : req.session.passport.user,
        writer : information.nickname,
        content : req.body.Comment,
        parentsGoods : req.params.id,
        parentsComments : 'root',
        createdData : convertDate(date)
  });

  comment.save(comment,function (err,comment){
      if(err) return console.error(err);
      console.log(comment.content + "save to Comments collection ");
      res.redirect('/information/'+req.params.id);
  });
  });
});

app.post('/information/:id/comments/delete/:comment',isAuthenticated, checkPermission_Comments, function(req,res){
  console.log("start");
  commentsModel.remove({_id:req.params.comment}, function(err){
    console.log(req.params.comment);
    console.log(req.params.id);
    if(err)return console.error(err);
    console.log("succeccfully deleted");
    res.redirect('/information/'+req.params.id);
  });
});

app.get('/information/:id/delete',isAuthenticated, checkPermission_Goods, function(req,res){
  res.render('remove_complete');
  goodsModel.remove({_id:req.params.id}, function(err){
    if(err)return console.error(err);
    console.log("succeccfully deleted");
  });
});

app.post('/ask_complete',isAuthenticated, function(req, res){
  var message = {
    subject: req.body.Title,
    text: req.body.Text,
    from: config.mail.user,
    to: "<araka_672@naver.com>"
  };

  emailServer.send(message,function(err,message){
    console.log(err||message);
  });
  res.render('ask_complete');
});

http.createServer(app).listen(52273, function(){
  console.log('Express server listening on http://127.0.0.1:52273 ');
  connectDB();
});

function connectDB(){

  mongoose.connect(dbUrl, { useNewUrlParser: true });
  db = mongoose.connection;

  db.on('error', function(err){
    console.log('connect error : ', err);
  });
  db.once('open',function(){
    console.log('db connection');

    goodsSchema = new Schema({
        writer : {type:String, require:true},
        writer_nickname : {type:String, require:true},
        title : {type:String, require:true},
        price : {type:Number, require:true},
        content : {type:String, require:true},
        tag : {type:String, require:true},
        ImagePath: {type:String, require:true},
        ImageName: {type:String, require:true},
        createdData : {type:String} //ggg
    }, {collection:'Goods'});
    console.log('GoodsSchema Define');

    membersSchema = new Schema({
      email : {type:String, require:true, unique:true},
      password : {type:String, require:true},
      nickname : {type:String, require:true, unique:true}
    }, {collection:'Members'});
    console.log('MembersSchema Define');

    commentsSchema = new Schema({
      writerID : {type:String, require:true},
      writer : {type:String, require:true},
      content : {type:String, require:true},
      parentsGoods : {type:String, require:true},
      parentsComments : {type:String, require:true},
      createdData : {type:String}
    },{collection:'Comments'});

    console.log('CommentsSchema Define');

    goodsModel = mongoose.model('Goods',goodsSchema);
    membersModel = mongoose.model('Members',membersSchema);
    commentsModel = mongoose.model('Comments',commentsSchema);

  });
}
