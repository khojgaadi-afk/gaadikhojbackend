module.exports = {
  superadmin: [
    "admins.manage",
    "users.manage",
    "posts.manage",
    "submissions.verify",
    "withdrawals.process",
    "audit.view",
    "analytics.view",
    "wallet.manage",        
  ],

  moderator: [
    "posts.manage",
    "submissions.verify",
    "analytics.view",
  ],

  finance: [
    "withdrawals.process",
    "audit.view",
    "analytics.view",
    "wallet.manage",        // 🔥 Optional (agar finance ko allow karna ho)
  ],
};
