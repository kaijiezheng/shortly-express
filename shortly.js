var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');
var session = require('express-session');
// var BookshelfStore = require('connect-bookshelf')(session);

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  // store: new BookshelfStore({model: User}),
  secret: 'oursecretawesomesecret',
  resave: false,
  saveUninitialized: true
}));

app.use(function(req, res, next) {
  if (req.session && req.session.username) {
    new User({username: req.session.username}).fetch().then(function(user) {
      if (user) {
        req.username = user.attributes.username;
        req.session.username = user.attributes.username;
      }
      next();
    });
  } else {
    next();
  }
});

app.use(express.static(__dirname + '/public'));

app.get('/', util.checkUser, function(req, res) {
  res.render('index');
});

app.get('/create', util.checkUser, function(req, res) {
  res.render('index');
});

app.get('/login', function(req, res) {
  res.render('login');
});

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.get('/logout', function(req, res) {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/links', util.checkUser, function(req, res) {
  new User({ username: req.username }).fetch().then(function(found) {
    if (found) {
      Links.query(function(qb) {
        qb.where('user_id', '=', found.attributes.id);
      }).fetch()
      .then(function(links) {
        res.send(200, links.models);
      });
    }
  });
});

app.post('/links', util.checkUser, function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        new User({ username: req.username }).fetch().then(function(found) {
          if (found) {
            Links.create({
              url: uri,
              title: title,
              base_url: req.headers.origin,
              user_id: found.attributes.id
            })
            .then(function(newLink) {
              res.send(200, newLink);
            });
          }
        });

      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.post('/signup', function(req, res) {
  var data = req.body;

  new User({ username: data.username, password: data.password }).fetch().then(function(found) {

    if (found) {
      res.send(200, found.attributes);
    } else {
      Users.create({
        username: data.username,
        password: data.password,
      })
      .then(function(newUser) {
        req.username = newUser.attributes.username;
        req.session.username = newUser.attributes.username;
        res.redirect('/');
      });
    }
  });
});

app.post('/login', function(req, res) {
  var data = req.body;

  new User({ username: data.username }).fetch().then(function(found) {
    if (found && bcrypt.compareSync(data.password, found.attributes.password)) {
      req.username = found.attributes.username;
      req.session.username = found.attributes.username;
      res.redirect('/');
    } else {
      res.redirect('/login');
    }
  });
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits')+1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
