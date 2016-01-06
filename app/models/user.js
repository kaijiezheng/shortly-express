var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');



var User = db.Model.extend({
  tableName: 'users',
  initialize: function(){
    this.on('creating', function(model, attrs, options){
      var hashPass = bcrypt.hashSync(model.attributes.password);
      model.set('password', hashPass);
    });
  }
});

module.exports = User;
