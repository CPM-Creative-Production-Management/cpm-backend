const sequelize = require('../src/db/db');
const { DataTypes } = require("sequelize")
const User = require('../src/models/user')(sequelize, DataTypes)
const passport = require('passport')
  , LocalStrategy = require('passport-local').Strategy

var JwtStrategy = require('passport-jwt').Strategy,
  ExtractJwt = require('passport-jwt').ExtractJwt;

var opts = {}
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
opts.secretOrKey = 'catto';

passport.use(new JwtStrategy(opts, async function(jwt_payload, done) {
    try {
      const user = await User.findOne({where: {username: jwt_payload.username}})
        if (user) {
            return done(null, user);
        } else {
            return done(null, false);
            // or you could create a new account
        }
    }catch(err) {
      return done(err)
    }
}));


passport.use(new LocalStrategy({
  usernameField: 'username',
  passwordField: 'password'
},  async function(username, password, done) {
    console.log(username, password)
      try{
        const user = await User.findOne({where: { username: username }})
        if (!user){
            return done(null, false, { message: 'Incorrect username.' }) 
        }
        const passVal = user.validPassword(password)
        if(!passVal){
            return done(null, false, { message: 'Incorrect password.' })
        }
        return done(null, user);
      }catch(err){
          return done(err)
      }
  }
  ))
    
passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findByPk(id).then(function(user) { done(null, user); });
});