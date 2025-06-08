// middlewares/auth.js
function checkAuth(req, res, next) {
    if (req.session.userId) return next();
    res.redirect('/index.html?error=login');
  }
  
  module.exports = checkAuth;
  